import { describe, expect, it } from 'vitest';
import { DEFAULT_COMMISSION, DEFAULT_SETTINGS, type CommissionSettings } from '@ucolis/shared';
import { autoConfirmDeliveries } from '../src/jobs/sweeps';
import { AuditLogModel } from '../src/modules/admin/model';
import { NotificationModel } from '../src/modules/notifications/model';
import { ParcelModel } from '../src/modules/parcels/model';
import { DisputeModel } from '../src/modules/trust/model';
import { TopUpRequestModel, WalletModel, WalletTransactionModel } from '../src/modules/wallet/model';
import { createParcel, createStaff, verifiedCarrier, verifiedUser, type TestApp } from './fixtures';
import { makeTestApp, useDatabase } from './helpers';

useDatabase();

const HOUR = 3600_000;
const pickup = () => new Date(Date.now() + 2 * 86_400_000).toISOString();
const enabled = (patch: Partial<CommissionSettings> = {}) => ({ commission: { ...DEFAULT_COMMISSION, enabled: true, ...patch } });

/** Remplace les réglages en cours de test (les services relisent deps.settings à chaque appel). */
function setCommission(ctx: TestApp, patch: Partial<CommissionSettings>) {
  const settings = { ...DEFAULT_SETTINGS, commission: { ...DEFAULT_COMMISSION, ...patch } };
  ctx.deps.settings = { getAll: async () => settings };
}

type Carrier = Awaited<ReturnType<typeof verifiedCarrier>>;

async function offer(ctx: TestApp, parcelId: string, carrier: Carrier, price = 3250) {
  return ctx.http().post(`/api/v1/parcels/${parcelId}/offers`).set(carrier.auth).send({ price, vehicleId: carrier.vehicleId, proposedPickupDate: pickup() });
}

/** Colis à 3 250 DA accepté par l'expéditeur. */
async function deal(ctx: TestApp, price = 3250) {
  const amina = await verifiedUser(ctx);
  const karim = await verifiedCarrier(ctx);
  const parcel = await createParcel(ctx, amina);
  const o = (await offer(ctx, parcel.id, karim, price)).body;
  const accepted = await ctx.http().post(`/api/v1/offers/${o.id}/accept`).set(amina.auth);
  expect(accepted.status).toBe(200);
  return { amina, karim, parcel };
}

async function deliverWithCode(ctx: TestApp, d: Awaited<ReturnType<typeof deal>>) {
  await ctx.http().post(`/api/v1/parcels/${d.parcel.id}/start`).set(d.karim.auth);
  const { code } = (await ctx.http().get(`/api/v1/parcels/${d.parcel.id}/delivery-code`).set(d.amina.auth)).body;
  const res = await ctx.http().post(`/api/v1/parcels/${d.parcel.id}/delivery-code`).set(d.karim.auth).send({ code });
  expect(res.body.status, JSON.stringify(res.body)).toBe('delivered');
}

const wallet = (ctx: TestApp, user: { auth: Record<string, string> }) => ctx.http().get('/api/v1/me/wallet').set(user.auth);

describe('service gratuit (lancement)', () => {
  it('ne fige ni ne prélève aucune commission, et n’ouvre pas de portefeuille', async () => {
    const ctx = makeTestApp();
    const d = await deal(ctx);
    await deliverWithCode(ctx, d);
    expect((await ParcelModel.findById(d.parcel.id).lean())!.commission).toBeNull();
    const w = await wallet(ctx, d.karim);
    expect(w.body).toMatchObject({ enabled: false, active: false, eligible: true, balance: 0, blocked: false, pendingTopUp: null });
    expect(await WalletModel.countDocuments()).toBe(0);
    const topUp = await ctx.http().post('/api/v1/me/wallet/topups').set(d.karim.auth).send({
      amount: 1000,
      method: 'ccp',
      proof: { url: 'https://res.cloudinary.com/demo/image/authenticated/x.jpg', publicId: `ucolis/topup_proof/${d.karim.id}/x`, kind: 'image' },
    });
    expect(topUp.status).toBe(403);
  });

  it('expose la grille dans la configuration publique', async () => {
    const ctx = makeTestApp();
    const res = await ctx.http().get('/api/v1/app/config');
    expect(res.body.commission).toMatchObject({ enabled: false, fixedFee: 50, welcomeBonus: 1000 });
  });
});

describe('commission activée', () => {
  it('ouvre le portefeuille avec le bonus, fige la commission à l’acceptation et la prélève à la livraison', async () => {
    const ctx = makeTestApp({ settings: enabled() });
    const karimWallet = async (d: { karim: Carrier }) => (await wallet(ctx, d.karim)).body;
    const d = await deal(ctx);

    // Commission de 3 250 DA : 10 % + 50 DA.
    const asCarrier = (await ctx.http().get(`/api/v1/parcels/${d.parcel.id}`).set(d.karim.auth)).body;
    expect(asCarrier.commission).toMatchObject({ grossPrice: 3250, ratePercent: 10, variableCommission: 325, totalCommission: 375, netEarnings: 2875, status: 'pending' });
    expect((await ctx.http().get(`/api/v1/parcels/${d.parcel.id}`).set(d.amina.auth)).body.commission).toBeNull();

    expect(await karimWallet(d)).toMatchObject({ enabled: true, active: true, eligible: true, balance: 1000, blocked: false });
    await deliverWithCode(ctx, d);
    expect(await karimWallet(d)).toMatchObject({ balance: 625, blocked: false });

    const history = (await ctx.http().get('/api/v1/me/wallet/transactions').set(d.karim.auth)).body;
    expect(history.items.map((t: { type: string; amount: number }) => [t.type, t.amount])).toEqual([
      ['commission_debit', -375],
      ['welcome_bonus', 1000],
    ]);
    expect(history.items[0]).toMatchObject({ balanceAfter: 625, parcel: { id: d.parcel.id, reference: d.parcel.reference } });
    const p = await ParcelModel.findById(d.parcel.id).lean();
    expect(p!.commission).toMatchObject({ status: 'charged' });
    expect(p!.commission!.chargedAt).toBeTruthy();

    // Le bonus n'est versé qu'une fois, et un second prélèvement est sans effet.
    expect(await WalletTransactionModel.countDocuments({ type: 'welcome_bonus' })).toBe(1);
    expect(await ctx.services.wallet.charge(p!, undefined as never)).toBeNull();
  });

  it('prélève aussi à la validation automatique', async () => {
    const ctx = makeTestApp({ settings: enabled() });
    const d = await deal(ctx, 800);
    await ctx.http().post(`/api/v1/parcels/${d.parcel.id}/start`).set(d.karim.auth);
    await ctx.http().post(`/api/v1/parcels/${d.parcel.id}/declare-delivered`).set(d.karim.auth).send({});
    ctx.clock.advance(73 * HOUR);
    expect(await autoConfirmDeliveries(ctx.deps, ctx.services)).toBe(1);
    // 800 DA : 15 % + 50 DA = 170 DA.
    expect((await WalletModel.findOne({ user: d.karim.id }).lean())!.balance).toBe(830);
  });

  it('ne prélève pas une course acceptée avant la date d’entrée en vigueur', async () => {
    const ctx = makeTestApp({ settings: enabled({ effectiveFrom: new Date(Date.now() + 7 * 24 * HOUR).toISOString() }) });
    const d = await deal(ctx);
    expect((await wallet(ctx, d.karim)).body).toMatchObject({ enabled: true, active: false, balance: 1000 });
    await deliverWithCode(ctx, d);
    expect((await WalletModel.findOne({ user: d.karim.id }).lean())!.balance).toBe(1000);
  });

  it('renonce à la commission si la gratuité revient avant la livraison', async () => {
    const ctx = makeTestApp({ settings: enabled() });
    const d = await deal(ctx);
    setCommission(ctx, { enabled: false });
    await deliverWithCode(ctx, d);
    expect((await ParcelModel.findById(d.parcel.id).lean())!.commission).toMatchObject({ status: 'waived', chargedAt: null });
    expect(await WalletTransactionModel.countDocuments({ type: 'commission_debit' })).toBe(0);
  });

  it('oublie la commission figée quand le transporteur se désiste', async () => {
    const ctx = makeTestApp({ settings: enabled() });
    const d = await deal(ctx);
    await ctx.http().post(`/api/v1/parcels/${d.parcel.id}/withdraw`).set(d.karim.auth);
    expect((await ParcelModel.findById(d.parcel.id).lean())!.commission).toBeNull();
  });

  it('bloque offres et nouvelles courses sous le seuil, et prévient le transporteur', async () => {
    const ctx = makeTestApp({ settings: enabled({ welcomeBonus: 100 }) });
    const d = await deal(ctx);
    // Une deuxième offre, en attente, avant le passage sous le seuil.
    const other = await verifiedUser(ctx);
    const second = await createParcel(ctx, other);
    const pending = (await offer(ctx, second.id, d.karim)).body;
    await deliverWithCode(ctx, d);

    expect((await wallet(ctx, d.karim)).body).toMatchObject({ balance: -275, blocked: true });
    expect(await NotificationModel.countDocuments({ recipient: d.karim.id, type: 'wallet_blocked' })).toBe(1);

    const third = await createParcel(ctx, other);
    const refused = await offer(ctx, third.id, d.karim);
    expect(refused.status).toBe(422);
    expect(refused.body.error).toMatchObject({ code: 'WALLET_INSUFFICIENT_BALANCE', details: { balance: -275, minBalance: 0 } });
    const accept = await ctx.http().post(`/api/v1/offers/${pending.id}/accept`).set(other.auth);
    expect(accept.body.error.code).toBe('CARRIER_UNAVAILABLE');
    await ctx.http().post(`/api/v1/offers/${pending.id}/counter`).set(other.auth).send({ price: 3000 });
    expect((await ctx.http().post(`/api/v1/offers/${pending.id}/reoffer`).set(d.karim.auth).send({ price: 3100 })).body.error.code).toBe('WALLET_INSUFFICIENT_BALANCE');
    expect((await ctx.http().post(`/api/v1/offers/${pending.id}/accept-counter`).set(d.karim.auth)).body.error.code).toBe('WALLET_INSUFFICIENT_BALANCE');

    // Sans commission, rien n'est bloqué.
    setCommission(ctx, { enabled: false });
    expect((await offer(ctx, third.id, d.karim)).status).toBe(201);
  });
});

const proof = (userId: string) => ({
  url: 'https://res.cloudinary.com/demo/image/authenticated/proof.jpg',
  publicId: `ucolis/topup_proof/${userId}/proof`,
  kind: 'image',
});

describe('recharge et back-office', () => {
  it('reçoit une demande avec preuve, la fait valider par le staff et crédite le solde', async () => {
    const ctx = makeTestApp({ settings: enabled() });
    const karim = await verifiedCarrier(ctx);
    const send = (body: Record<string, unknown>) => ctx.http().post('/api/v1/me/wallet/topups').set(karim.auth).send(body);

    expect((await send({ amount: 100, method: 'ccp', proof: proof(karim.id) })).body.error.details.fields[0]).toMatchObject({ path: 'amount', message: 'validation.topUpAmount' });
    expect((await send({ amount: 2000, method: 'ccp', proof: { ...proof(karim.id), publicId: 'ucolis/topup_proof/autre/proof' } })).status).toBe(400);
    const created = await send({ amount: 2000, method: 'baridimob', reference: 'BM-42', proof: proof(karim.id) });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ amount: 2000, method: 'baridimob', reference: 'BM-42', status: 'pending' });
    expect((await send({ amount: 3000, method: 'ccp', proof: proof(karim.id) })).body.error.code).toBe('TOPUP_ALREADY_PENDING');
    expect((await wallet(ctx, karim)).body.pendingTopUp).toMatchObject({ id: created.body.id });

    const modo = await createStaff(ctx, 'moderator', ['dashboard.view']);
    expect((await ctx.http().get('/api/v1/admin/wallets/topups').set(modo.auth)).status).toBe(403);
    const admin = await createStaff(ctx, 'super_admin');
    const queue = (await ctx.http().get('/api/v1/admin/wallets/topups').set(admin.auth)).body;
    expect(queue.items).toHaveLength(1);
    expect(queue.items[0]).toMatchObject({ userId: karim.id, userName: 'Karim Benali', amount: 2000 });
    const detail = (await ctx.http().get(`/api/v1/admin/wallets/topups/${created.body.id}`).set(admin.auth)).body;
    expect(detail).toMatchObject({ balance: 1000, proof: { kind: 'image' } });
    expect(detail.proof.url).toContain('proof');
    const file = await ctx.http().get('/api/v1/admin/files').query({ publicId: proof(karim.id).publicId, kind: 'image' }).set(admin.auth);
    expect(file.body.url).toBeTruthy();

    const decide = (body: Record<string, unknown>) => ctx.http().post(`/api/v1/admin/wallets/topups/${created.body.id}/decision`).set(admin.auth).send(body);
    expect((await decide({ decision: 'reject' })).status).toBe(400);
    const approved = await decide({ decision: 'approve', amount: 1800 });
    expect(approved.body).toEqual({ balance: 2800 });
    expect((await decide({ decision: 'approve' })).body.error.code).toBe('INVALID_TRANSITION');
    expect(await NotificationModel.countDocuments({ recipient: karim.id, type: 'wallet_topup_approved' })).toBe(1);
    expect(await AuditLogModel.countDocuments({ action: 'topup.approve' })).toBe(1);

    const mine = (await ctx.http().get('/api/v1/me/wallet/topups').set(karim.auth)).body.items;
    expect(mine[0]).toMatchObject({ status: 'approved', creditedAmount: 1800 });
    const history = (await ctx.http().get('/api/v1/me/wallet/transactions').set(karim.auth)).body.items;
    expect(history[0]).toMatchObject({ type: 'topup', amount: 1800, balanceAfter: 2800 });
  });

  it('refuse une recharge avec un motif envoyé au transporteur', async () => {
    const ctx = makeTestApp({ settings: enabled() });
    const karim = await verifiedCarrier(ctx);
    const created = (await ctx.http().post('/api/v1/me/wallet/topups').set(karim.auth).send({ amount: 1000, method: 'ccp', proof: proof(karim.id) })).body;
    const admin = await createStaff(ctx, 'super_admin');
    const res = await ctx.http().post(`/api/v1/admin/wallets/topups/${created.id}/decision`).set(admin.auth).send({ decision: 'reject', reason: 'Virement introuvable' });
    expect(res.body).toEqual({ balance: null });
    expect((await TopUpRequestModel.findById(created.id).lean())!).toMatchObject({ status: 'rejected', decisionReason: 'Virement introuvable' });
    expect(await NotificationModel.countDocuments({ recipient: karim.id, type: 'wallet_topup_rejected' })).toBe(1);
    expect((await ctx.http().get('/api/v1/admin/wallets/topups?status=rejected').set(admin.auth)).body.items).toHaveLength(1);
  });

  it('ajuste un solde avec motif, liste les portefeuilles et compte les commissions', async () => {
    const ctx = makeTestApp({ settings: enabled() });
    const d = await deal(ctx);
    await deliverWithCode(ctx, d);
    const admin = await createStaff(ctx, 'moderator', ['wallet.manage', 'dashboard.view']);
    const adjust = (body: Record<string, unknown>) => ctx.http().post(`/api/v1/admin/wallets/${d.karim.id}/adjust`).set(admin.auth).send(body);
    expect((await adjust({ amount: 0, reason: 'Erreur' })).status).toBe(400);
    expect((await adjust({ amount: -700, reason: 'Correction' })).body).toEqual({ balance: -75 });
    expect(await NotificationModel.countDocuments({ recipient: d.karim.id, type: 'wallet_blocked' })).toBe(1);
    expect(await AuditLogModel.countDocuments({ action: 'wallet.adjust' })).toBe(1);
    expect((await ctx.http().post('/api/v1/admin/wallets/000000000000000000000000/adjust').set(admin.auth).send({ amount: 10, reason: 'Test' })).status).toBe(404);

    const blocked = (await ctx.http().get('/api/v1/admin/wallets?blocked=true').set(admin.auth)).body;
    expect(blocked.items).toEqual([expect.objectContaining({ userId: d.karim.id, name: 'Karim Benali', balance: -75 })]);
    expect((await ctx.http().get('/api/v1/admin/wallets?blocked=false').set(admin.auth)).body.items).toHaveLength(0);
    expect((await ctx.http().get('/api/v1/admin/wallets?q=karim').set(admin.auth)).body.total).toBe(1);
    expect((await ctx.http().get('/api/v1/admin/wallets?q=personne').set(admin.auth)).body.total).toBe(0);

    const detail = (await ctx.http().get(`/api/v1/admin/wallets/${d.karim.id}`).set(admin.auth)).body;
    expect(detail.transactions.map((t: { type: string }) => t.type)).toEqual(['adjustment', 'commission_debit', 'welcome_bonus']);
    expect(detail.transactions[0]).toMatchObject({ note: 'Correction' });
    expect((await ctx.http().get('/api/v1/admin/wallets/000000000000000000000000').set(admin.auth)).status).toBe(404);

    const stats = (await ctx.http().get('/api/v1/admin/stats').set(admin.auth)).body;
    expect(stats.wallet).toEqual({ commissions: 375, pendingTopUps: 0, blockedWallets: 1 });
    expect(stats.queues.topUps).toEqual({ count: 0, oldestHours: null });
  });

  it('rembourse la commission quand le staff sort un colis de delivered, et la prélève quand il l’y force', async () => {
    const ctx = makeTestApp({ settings: enabled() });
    const d = await deal(ctx);
    await deliverWithCode(ctx, d);
    const admin = await createStaff(ctx, 'super_admin');
    const force = (status: string) => ctx.http().post(`/api/v1/admin/parcels/${d.parcel.id}/force-status`).set(admin.auth).send({ status, reason: 'Erreur de saisie' });

    expect((await force('cancelled')).body.parcel.commission).toMatchObject({ status: 'refunded' });
    expect((await WalletModel.findOne({ user: d.karim.id }).lean())!.balance).toBe(1000);
    // Une commission remboursée n'est plus prélevée.
    await force('delivered');
    expect((await WalletModel.findOne({ user: d.karim.id }).lean())!.balance).toBe(1000);
    expect(await WalletTransactionModel.countDocuments({ type: 'commission_refund' })).toBe(1);
  });

  it('prélève la commission d’un litige tranché en faveur de la livraison', async () => {
    const ctx = makeTestApp({ settings: enabled() });
    const d = await deal(ctx);
    await ctx.http().post(`/api/v1/parcels/${d.parcel.id}/start`).set(d.karim.auth);
    const opened = await ctx.http().post(`/api/v1/parcels/${d.parcel.id}/disputes`).set(d.amina.auth).send({ reason: 'delay', description: 'Le colis n’arrive pas.' });
    expect(opened.status).toBe(201);
    const dispute = await DisputeModel.findOne({ parcel: d.parcel.id }).lean();
    const admin = await createStaff(ctx, 'super_admin');
    const res = await ctx.http().post(`/api/v1/admin/disputes/${dispute!._id}/decision`).set(admin.auth).send({ outcome: 'delivered', note: 'Livraison confirmée par le destinataire.' });
    expect(res.status).toBe(204);
    expect((await WalletModel.findOne({ user: d.karim.id }).lean())!.balance).toBe(625);
  });

  it('ouvre le portefeuille avec le bonus à la validation de l’identité', async () => {
    const ctx = makeTestApp({ settings: { ...enabled(), requireCarrierVerification: true } });
    const karim = await verifiedUser(ctx, { intent: 'carrier' }, { 'carrierVerification.status': 'pending', 'carrierVerification.submittedAt': new Date() });
    expect((await wallet(ctx, karim)).body).toMatchObject({ eligible: false, balance: 0 });
    const admin = await createStaff(ctx, 'super_admin');
    await ctx.http().post(`/api/v1/admin/verifications/identity/${karim.id}/decision`).set(admin.auth).send({ decision: 'approve' });
    expect((await WalletModel.findOne({ user: karim.id }).lean())!.balance).toBe(1000);
    // Sans vérification obligatoire, l'intention transporteur suffit.
    setCommission(ctx, { enabled: true });
    const settings = await ctx.deps.settings.getAll();
    ctx.deps.settings = { getAll: async () => ({ ...settings, requireCarrierVerification: false }) };
    const sender = await verifiedUser(ctx, { intent: 'sender' });
    const both = await verifiedUser(ctx, { intent: 'both' });
    expect((await wallet(ctx, sender)).body.eligible).toBe(false);
    expect((await wallet(ctx, both)).body).toMatchObject({ eligible: true, balance: 1000 });
    expect((await ctx.http().post('/api/v1/me/wallet/topups').set(sender.auth).send({ amount: 1000, method: 'ccp', proof: proof(sender.id) })).body.error.code).toBe('CARRIER_NOT_VERIFIED');
  });
});
