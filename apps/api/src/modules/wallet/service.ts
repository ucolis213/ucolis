// Portefeuille du transporteur : bonus de bienvenue, prélèvement de la commission à la livraison,
// recharges validées par le staff, ajustements motivés. Le solde ne bouge que par move() :
// $inc atomique et ligne d'historique dans la même transaction.
// La commission est figée sur le colis à l'acceptation (snapshot) ; le statut de cette commission
// (pending → charged → refunded, ou waived) rend le prélèvement et le remboursement idempotents.

import type { Request } from 'express';
import type { ClientSession, FilterQuery, Types } from 'mongoose';
import {
  CARRIER_INTENTS,
  commissionBreakdown,
  isCommissionActive,
  isOwnedUpload,
  isWalletBlocked,
  type TopUpDecisionInput,
  type TopUpDto,
  type TopUpRequestInput,
  type TopUpStatus,
  type WalletDto,
  type WalletTransactionDto,
  type WalletTransactionType,
} from '@ucolis/shared';
import type { Deps } from '../../deps';
import { audit } from '../../lib/audit';
import { AppError } from '../../lib/errors';
import { paginate } from '../../lib/http';
import { signedFileUrl } from '../carrier/service';
import { withTransaction } from '../offers/service';
import { ParcelModel, type ParcelLean } from '../parcels/model';
import { UserModel, type UserLean } from '../users/model';
import { TopUpRequestModel, WalletModel, WalletTransactionModel, type TopUpLean, type WalletTransactionLean } from './model';

type Id = string | Types.ObjectId;

interface MoveMeta {
  type: WalletTransactionType;
  parcel?: Id | null;
  topUp?: Id | null;
  staff?: Id | null;
  note?: string | null;
}

/** Solde avant et après un mouvement, pour prévenir le transporteur qui passe sous le seuil. */
export interface BalanceChange {
  userId: string;
  before: number;
  after: number;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function toTopUpDto(t: TopUpLean): TopUpDto {
  return {
    id: t._id.toString(),
    amount: t.amount,
    creditedAmount: t.creditedAmount ?? null,
    method: t.method,
    reference: t.reference ?? null,
    status: t.status,
    decisionReason: t.decisionReason ?? null,
    createdAt: t.createdAt.toISOString(),
    decidedAt: t.decidedAt?.toISOString() ?? null,
  };
}

export function createWalletService(deps: Deps) {
  const config = async () => (await deps.settings.getAll()).commission;

  /** Même règle que pour faire une offre : transporteur vérifié, ou intention transporteur si la vérification est débrayée. */
  async function eligible(user: UserLean) {
    const { requireCarrierVerification } = await deps.settings.getAll();
    if (user.carrierVerification?.status === 'approved') return true;
    return !requireCarrierVerification && CARRIER_INTENTS.includes(user.intent);
  }

  /** Ouvre le portefeuille avec le bonus de bienvenue s'il n'existe pas encore. */
  async function ensure(userId: Id) {
    const existing = await WalletModel.findOne({ user: userId }).lean();
    if (existing) return existing;
    const { welcomeBonus } = await config();
    try {
      await withTransaction(async (session) => {
        const [w] = await WalletModel.create([{ user: userId, balance: welcomeBonus }], { session });
        if (welcomeBonus > 0) {
          await WalletTransactionModel.create(
            [{ user: userId, type: 'welcome_bonus', amount: welcomeBonus, balanceAfter: w!.balance }],
            { session },
          );
        }
      });
    } catch (err) {
      // Ouvert en parallèle par une autre requête.
      if ((err as { code?: number }).code !== 11000) throw err;
    }
    return (await WalletModel.findOne({ user: userId }).lean())!;
  }

  /** Seul point d'écriture du solde. Le portefeuille doit exister (ensure). */
  async function move(userId: Id, amount: number, meta: MoveMeta, session: ClientSession): Promise<BalanceChange> {
    const w = await WalletModel.findOneAndUpdate({ user: userId }, { $inc: { balance: amount } }, { new: true, session }).lean();
    if (!w) throw new AppError(404, 'NOT_FOUND', 'Portefeuille introuvable');
    await WalletTransactionModel.create(
      [
        {
          user: userId,
          type: meta.type,
          amount,
          balanceAfter: w.balance,
          parcel: meta.parcel ?? null,
          topUp: meta.topUp ?? null,
          staff: meta.staff ?? null,
          note: meta.note ?? null,
        },
      ],
      { session },
    );
    return { userId: userId.toString(), before: w.balance - amount, after: w.balance };
  }

  /** À appeler après le commit : prévient le transporteur qui vient de passer sous le seuil. */
  async function afterMove(change: BalanceChange | null) {
    if (!change) return;
    const { minBalance } = await config();
    if (!isWalletBlocked(change.before, minBalance) && isWalletBlocked(change.after, minBalance)) {
      await deps.bus.emit('wallet.blocked', { userId: change.userId, balance: change.after });
    }
  }

  async function transactionDtos(rows: WalletTransactionLean[]): Promise<WalletTransactionDto[]> {
    const parcelIds = rows.map((r) => r.parcel).filter(Boolean);
    const parcels = await ParcelModel.find({ _id: { $in: parcelIds } }, { reference: 1, title: 1 }).lean();
    const byId = new Map(parcels.map((p) => [p._id.toString(), p]));
    return rows.map((r) => {
      const p = r.parcel ? byId.get(r.parcel.toString()) : undefined;
      return {
        id: r._id.toString(),
        type: r.type,
        amount: r.amount,
        balanceAfter: r.balanceAfter,
        parcel: p ? { id: p._id.toString(), reference: p.reference, title: p.title } : null,
        note: r.note ?? null,
        createdAt: r.createdAt.toISOString(),
      };
    });
  }

  async function loadTopUp(id: string) {
    const t = (await TopUpRequestModel.findById(id).lean()) as TopUpLean | null;
    if (!t) throw new AppError(404, 'NOT_FOUND', 'Demande introuvable');
    return t;
  }

  return {
    ensure,
    afterMove,

    /** Commission figée à l'acceptation, ou null si elle n'est pas en vigueur. */
    async snapshot(finalPrice: number, at: Date) {
      const cfg = await config();
      if (!isCommissionActive(cfg, at)) return null;
      return { ...commissionBreakdown(finalPrice, cfg), status: 'pending' as const, chargedAt: null };
    },

    /**
     * Refuse une nouvelle course à un transporteur sous le seuil. as = 'sender' : l'expéditeur accepte
     * l'offre d'un transporteur bloqué, qui reçoit un message neutre.
     */
    async assertCanTakeJobs(carrierId: Id, as: 'carrier' | 'sender' = 'carrier') {
      const cfg = await config();
      if (!cfg.enabled) return;
      const w = await WalletModel.findOne({ user: carrierId }, { balance: 1 }).lean();
      if (!w || !isWalletBlocked(w.balance, cfg.minBalance)) return;
      if (as === 'sender') throw new AppError(422, 'CARRIER_UNAVAILABLE', 'Transporteur indisponible');
      throw new AppError(422, 'WALLET_INSUFFICIENT_BALANCE', 'Solde insuffisant', { balance: w.balance, minBalance: cfg.minBalance });
    },

    /**
     * À appeler avant la transaction de charge() ou refund() : une transaction ne voit pas un portefeuille
     * ouvert après son début (lecture à l'instant du premier accès).
     */
    async prepare(p: ParcelLean) {
      if (p.commission && ['pending', 'charged'].includes(p.commission.status) && p.assignedCarrier) {
        await ensure(p.assignedCarrier);
      }
    },

    /** Débit de la commission à la livraison, dans la transaction qui passe le colis en delivered. */
    async charge(p: ParcelLean, session: ClientSession): Promise<BalanceChange | null> {
      if (p.commission?.status !== 'pending' || !p.assignedCarrier) return null;
      const cfg = await config();
      // Retour à la gratuité entre l'acceptation et la livraison : rien n'est prélevé.
      const status = cfg.enabled ? 'charged' : 'waived';
      const marked = await ParcelModel.updateOne(
        { _id: p._id, 'commission.status': 'pending' },
        { $set: { 'commission.status': status, 'commission.chargedAt': cfg.enabled ? deps.now() : null } },
        { session },
      );
      if (!marked.modifiedCount || !cfg.enabled) return null;
      return move(p.assignedCarrier, -p.commission.totalCommission, { type: 'commission_debit', parcel: p._id }, session);
    },

    /** Livraison annulée par le staff après prélèvement : la commission est rendue. */
    async refund(p: ParcelLean, session: ClientSession): Promise<BalanceChange | null> {
      if (p.commission?.status !== 'charged' || !p.assignedCarrier) return null;
      const marked = await ParcelModel.updateOne(
        { _id: p._id, 'commission.status': 'charged' },
        { $set: { 'commission.status': 'refunded' } },
        { session },
      );
      if (!marked.modifiedCount) return null;
      return move(p.assignedCarrier, p.commission.totalCommission, { type: 'commission_refund', parcel: p._id }, session);
    },

    // --- Transporteur ---------------------------------------------------------------------------

    async me(user: UserLean): Promise<WalletDto> {
      const cfg = await config();
      const userId = user._id;
      const isEligible = await eligible(user);
      const wallet = cfg.enabled && isEligible ? await ensure(userId) : await WalletModel.findOne({ user: userId }).lean();
      const pending = (await TopUpRequestModel.findOne({ user: userId, status: 'pending' }).lean()) as TopUpLean | null;
      const balance = wallet?.balance ?? 0;
      return {
        enabled: cfg.enabled,
        active: isCommissionActive(cfg, deps.now()),
        effectiveFrom: cfg.effectiveFrom,
        eligible: isEligible || !!wallet,
        balance,
        minBalance: cfg.minBalance,
        blocked: cfg.enabled && !!wallet && isWalletBlocked(balance, cfg.minBalance),
        pendingTopUp: pending ? toTopUpDto(pending) : null,
      };
    },

    async transactions(userId: string, page: number, limit: number) {
      const filter = { user: userId };
      const [total, rows] = await Promise.all([
        WalletTransactionModel.countDocuments(filter),
        WalletTransactionModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ]);
      return paginate(await transactionDtos(rows as WalletTransactionLean[]), page, limit, total);
    },

    async topUps(userId: string) {
      const rows = (await TopUpRequestModel.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean()) as TopUpLean[];
      return { items: rows.map(toTopUpDto) };
    },

    async requestTopUp(user: UserLean, input: TopUpRequestInput) {
      const cfg = await config();
      if (!cfg.enabled) throw new AppError(403, 'FORBIDDEN', 'Commission non activée');
      if (!(await eligible(user)) && !(await WalletModel.exists({ user: user._id }))) {
        throw new AppError(403, 'CARRIER_NOT_VERIFIED', 'Vérification transporteur requise');
      }
      if (input.amount < cfg.topUp.minAmount || input.amount > cfg.topUp.maxAmount) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Montant hors limites', {
          fields: [{ path: 'amount', message: 'validation.topUpAmount' }],
        });
      }
      if (!isOwnedUpload(input.proof.publicId, 'topup_proof', user._id.toString())) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Preuve invalide', { fields: [{ path: 'proof', message: 'validation.required' }] });
      }
      await ensure(user._id);
      try {
        const created = await TopUpRequestModel.create({
          user: user._id,
          amount: input.amount,
          method: input.method,
          reference: input.reference || null,
          proof: input.proof,
        });
        return toTopUpDto(created.toObject() as TopUpLean);
      } catch (err) {
        if ((err as { code?: number }).code === 11000) {
          throw new AppError(409, 'TOPUP_ALREADY_PENDING', 'Une demande est déjà en attente');
        }
        throw err;
      }
    },

    // --- Staff (wallet.manage) ------------------------------------------------------------------

    async topUpQueue(status: TopUpStatus, page: number, limit: number) {
      const filter = { status };
      const [total, rows] = await Promise.all([
        TopUpRequestModel.countDocuments(filter),
        TopUpRequestModel.find(filter)
          .sort({ createdAt: status === 'pending' ? 1 : -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
      ]);
      const users = await UserModel.find({ _id: { $in: rows.map((r) => r.user) } }, { firstName: 1, lastName: 1 }).lean();
      const names = new Map(users.map((u) => [u._id.toString(), `${u.firstName} ${u.lastName}`]));
      return paginate(
        (rows as TopUpLean[]).map((r) => ({ ...toTopUpDto(r), userId: r.user.toString(), userName: names.get(r.user.toString()) ?? '' })),
        page,
        limit,
        total,
      );
    },

    async topUpDetail(req: Request, id: string) {
      const t = await loadTopUp(id);
      const [user, wallet] = await Promise.all([
        UserModel.findById(t.user, { firstName: 1, lastName: 1 }).lean(),
        WalletModel.findOne({ user: t.user }).lean(),
      ]);
      await audit(req, { action: 'topup.view_proof', targetType: 'topup', targetId: id });
      return {
        ...toTopUpDto(t),
        userId: t.user.toString(),
        userName: user ? `${user.firstName} ${user.lastName}` : '',
        balance: wallet?.balance ?? 0,
        proof: signedFileUrl(deps, t.proof),
      };
    },

    async decideTopUp(req: Request, id: string, input: TopUpDecisionInput) {
      const staffId = req.staff!.id;
      const t = await loadTopUp(id);
      if (t.status !== 'pending') throw new AppError(409, 'INVALID_TRANSITION', 'Demande déjà traitée');
      const approved = input.decision === 'approve';
      const credited = approved ? (input.amount ?? t.amount) : null;
      if (approved) await ensure(t.user);
      const change = await withTransaction(async (session) => {
        const res = await TopUpRequestModel.updateOne(
          { _id: id, status: 'pending' },
          {
            $set: {
              status: approved ? 'approved' : 'rejected',
              creditedAmount: credited,
              decisionReason: approved ? (input.reason ?? null) : input.reason,
              decidedBy: staffId,
              decidedAt: deps.now(),
            },
          },
          { session },
        );
        if (!res.modifiedCount) throw new AppError(409, 'INVALID_TRANSITION', 'Demande déjà traitée');
        return approved ? move(t.user, credited!, { type: 'topup', topUp: t._id, staff: staffId }, session) : null;
      });
      await audit(req, {
        action: `topup.${input.decision}`,
        targetType: 'topup',
        targetId: id,
        reason: input.reason ?? null,
        before: { status: 'pending', amount: t.amount },
        after: { status: approved ? 'approved' : 'rejected', creditedAmount: credited },
      });
      await deps.bus.emit('wallet.topup_decided', {
        userId: t.user.toString(),
        topUpId: id,
        approved,
        amount: credited ?? t.amount,
        reason: input.reason ?? null,
      });
      return { balance: change?.after ?? null };
    },

    async list(q: { page: number; limit: number; q?: string; blocked?: boolean }) {
      const filter: FilterQuery<unknown> = {};
      if (q.q) {
        const re = new RegExp(escapeRegex(q.q), 'i');
        const users = await UserModel.find({ $or: [{ firstName: re }, { lastName: re }, { email: re }] }, { _id: 1 }).limit(200).lean();
        filter.user = { $in: users.map((u) => u._id) };
      }
      if (q.blocked !== undefined) {
        const { minBalance } = await config();
        filter.balance = q.blocked ? { $lt: minBalance } : { $gte: minBalance };
      }
      const [total, rows] = await Promise.all([
        WalletModel.countDocuments(filter),
        WalletModel.find(filter).sort({ balance: 1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
      ]);
      const users = await UserModel.find({ _id: { $in: rows.map((r) => r.user) } }, { firstName: 1, lastName: 1, wilayaCode: 1 }).lean();
      const byId = new Map(users.map((u) => [u._id.toString(), u]));
      return paginate(
        rows.map((w) => {
          const u = byId.get(w.user.toString());
          return {
            userId: w.user.toString(),
            name: u ? `${u.firstName} ${u.lastName}` : '',
            wilayaCode: u?.wilayaCode ?? null,
            balance: w.balance,
            updatedAt: w.updatedAt.toISOString(),
          };
        }),
        q.page,
        q.limit,
        total,
      );
    },

    async detail(userId: string) {
      const user = await UserModel.findById(userId, { firstName: 1, lastName: 1 }).lean();
      if (!user) throw new AppError(404, 'NOT_FOUND', 'Utilisateur introuvable');
      const [wallet, rows, topUps] = await Promise.all([
        WalletModel.findOne({ user: userId }).lean(),
        WalletTransactionModel.find({ user: userId }).sort({ createdAt: -1, _id: -1 }).limit(100).lean(),
        TopUpRequestModel.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean(),
      ]);
      return {
        userId,
        name: `${user.firstName} ${user.lastName}`,
        balance: wallet?.balance ?? null,
        transactions: await transactionDtos(rows as WalletTransactionLean[]),
        topUps: (topUps as TopUpLean[]).map(toTopUpDto),
      };
    },

    async adjust(req: Request, userId: string, amount: number, reason: string) {
      if (!(await UserModel.exists({ _id: userId }))) throw new AppError(404, 'NOT_FOUND', 'Utilisateur introuvable');
      await ensure(userId);
      const change = await withTransaction((session) => move(userId, amount, { type: 'adjustment', staff: req.staff!.id, note: reason }, session));
      await audit(req, {
        action: 'wallet.adjust',
        targetType: 'user',
        targetId: userId,
        reason,
        before: { balance: change.before },
        after: { balance: change.after },
      });
      await afterMove(change);
      return { balance: change.after };
    },

    /** Tableau de bord : commissions nettes encaissées et recharges en attente. */
    async stats() {
      const [sums, pendingTopUps, blocked] = await Promise.all([
        WalletTransactionModel.aggregate<{ _id: string; total: number }>([
          { $match: { type: { $in: ['commission_debit', 'commission_refund'] } } },
          { $group: { _id: '$type', total: { $sum: '$amount' } } },
        ]),
        TopUpRequestModel.countDocuments({ status: 'pending' }),
        config().then((c) => WalletModel.countDocuments({ balance: { $lt: c.minBalance } })),
      ]);
      const commissions = -sums.reduce((s, r) => s + r.total, 0);
      return { commissions, pendingTopUps, blockedWallets: blocked };
    },
  };
}

export type WalletService = ReturnType<typeof createWalletService>;
