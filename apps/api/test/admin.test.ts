import { describe, expect, it } from 'vitest';
import { totpAt } from '../src/lib/totp';
import { AuditLogModel, StaffModel } from '../src/modules/admin/model';
import { NotificationModel } from '../src/modules/notifications/model';
import { ParcelModel } from '../src/modules/parcels/model';
import { UserModel } from '../src/modules/users/model';
import { STAFF_PASSWORD, createParcel, createStaff, verifiedUser } from './fixtures';
import { makeTestApp, useDatabase } from './helpers';

useDatabase();

const PASSWORD = STAFF_PASSWORD;

describe('authentification du staff', () => {
  it('exige le mot de passe puis le code TOTP', async () => {
    const ctx = makeTestApp();
    const admin = await createStaff(ctx, 'super_admin');
    const noTotp = await ctx.http().post('/api/v1/admin/auth/login').send({ email: admin.email, password: PASSWORD });
    expect(noTotp.body.error.code).toBe('TOTP_REQUIRED');
    const badTotp = await ctx.http().post('/api/v1/admin/auth/login').send({ email: admin.email, password: PASSWORD, totp: '000000' });
    expect(badTotp.body.error.code).toBe('INVALID_CREDENTIALS');
    const badPass = await ctx.http().post('/api/v1/admin/auth/login').send({ email: admin.email, password: 'x', totp: totpAt(admin.secret, Date.now()) });
    expect(badPass.status).toBe(401);
    const me = await ctx.http().get('/api/v1/admin/me').set(admin.auth);
    expect(me.body).toMatchObject({ role: 'super_admin', email: admin.email });
  });

  it("refuse un jeton utilisateur sur l'API du staff, et inversement", async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const admin = await createStaff(ctx, 'super_admin');
    expect((await ctx.http().get('/api/v1/admin/me').set(amina.auth)).status).toBe(401);
    expect((await ctx.http().get('/api/v1/me').set(admin.auth)).status).toBe(401);
  });

  it('expire la session après 30 min sans activité', async () => {
    const ctx = makeTestApp();
    const admin = await createStaff(ctx, 'super_admin');
    ctx.clock.advance(20 * 60_000);
    const refreshed = await ctx.http().post('/api/v1/admin/auth/refresh').send({ refreshToken: admin.refreshToken });
    expect(refreshed.status).toBe(200);
    ctx.clock.advance(31 * 60_000);
    const expired = await ctx.http().post('/api/v1/admin/auth/refresh').send({ refreshToken: refreshed.body.refreshToken });
    expect(expired.status).toBe(401);
  });
});

describe('modérateurs', () => {
  it("invite un modérateur avec un modèle, qui active son compte et sa 2FA par le lien", async () => {
    const ctx = makeTestApp();
    const admin = await createStaff(ctx, 'super_admin');
    const res = await ctx
      .http()
      .post('/api/v1/admin/staff/invite')
      .set(admin.auth)
      .send({ email: 'verif@ucolis.dz', firstName: 'Nadia', lastName: 'Khelif', template: 'verifier', permissions: ['staff.manage'] });
    expect(res.status).toBe(201);
    expect(res.body.permissions.sort()).toEqual(['dashboard.view', 'users.view', 'verifications.identity', 'verifications.pro'].sort());
    const token = /accept-invite\/([\w-]+)/.exec(ctx.mailer.last('verif@ucolis.dz')!.text)![1]!;
    const info = await ctx.http().get(`/api/v1/admin/auth/invite/${token}`);
    expect(info.body.otpauthUrl).toContain('otpauth://totp/UCOLIS');
    const accept = await ctx
      .http()
      .post('/api/v1/admin/auth/accept-invite')
      .send({ token, password: 'Moderateur123', totp: totpAt(info.body.secret, ctx.clock.now().getTime()) });
    expect(accept.body.status).toBe('active');
    const login = await ctx
      .http()
      .post('/api/v1/admin/auth/login')
      .send({ email: 'verif@ucolis.dz', password: 'Moderateur123', totp: totpAt(info.body.secret, ctx.clock.now().getTime()) });
    expect(login.status).toBe(200);
    ctx.clock.advance(73 * 3600_000);
    expect((await ctx.http().get(`/api/v1/admin/auth/invite/${token}`)).status).toBe(404);
  });

  it('protège le super-administrateur et les permissions réservées', async () => {
    const ctx = makeTestApp();
    const admin = await createStaff(ctx, 'super_admin');
    const modo = await createStaff(ctx, 'moderator', ['dashboard.view', 'users.view', 'users.suspend', 'parcels.view', 'parcels.moderate']);
    expect((await ctx.http().post(`/api/v1/admin/staff/${admin.id}/disable`).set(admin.auth).send({ reason: 'test' })).status).toBe(403);
    expect((await ctx.http().patch(`/api/v1/admin/staff/${admin.id}`).set(admin.auth).send({ permissions: [], reason: 'test' })).status).toBe(403);
    expect((await ctx.http().get('/api/v1/admin/staff').set(modo.auth)).status).toBe(403);
    expect((await ctx.http().get('/api/v1/admin/settings').set(modo.auth)).status).toBe(403);
    expect((await ctx.http().get('/api/v1/admin/audit').set(modo.auth)).status).toBe(403);
    expect((await ctx.http().get('/api/v1/admin/stats').set(modo.auth)).status).toBe(200);
    expect(await StaffModel.countDocuments({ role: 'super_admin' })).toBe(1);
    await expect(StaffModel.create({ email: 'x@x.dz', firstName: 'X', lastName: 'Y', role: 'super_admin' })).rejects.toThrow();
  });

  it('transfère le rôle de super-administrateur après mot de passe et 2FA', async () => {
    const ctx = makeTestApp();
    const admin = await createStaff(ctx, 'super_admin');
    const modo = await createStaff(ctx, 'moderator', ['dashboard.view']);
    const body = { toStaffId: modo.id, password: PASSWORD, reason: 'Départ', totp: totpAt(admin.secret, ctx.clock.now().getTime()) };
    expect((await ctx.http().post('/api/v1/admin/staff/transfer-super-admin').set(admin.auth).send({ ...body, password: 'faux' })).status).toBe(401);
    expect((await ctx.http().post('/api/v1/admin/staff/transfer-super-admin').set(admin.auth).send(body)).status).toBe(204);
    expect((await StaffModel.findById(modo.id).lean())!.role).toBe('super_admin');
    expect((await StaffModel.findById(admin.id).lean())!.role).toBe('moderator');
  });
});

describe('masquage et vérifications', () => {
  it('un Vérificateur valide un transporteur sans jamais voir un email ni un téléphone en clair', async () => {
    const ctx = makeTestApp();
    const karim = await verifiedUser(ctx, { firstName: 'Karim' }, { 'carrierVerification.status': 'pending', 'carrierVerification.submittedAt': new Date() });
    const verifier = await createStaff(ctx, 'moderator', ['dashboard.view', 'users.view', 'verifications.identity', 'verifications.pro']);

    const list = await ctx.http().get('/api/v1/admin/users').set(verifier.auth);
    const row = list.body.items.find((u: { id: string }) => u.id === karim.id);
    expect(row.email).toMatch(/^.•••@test\.dz$/);
    expect(row.phone).toMatch(/^\+213 \d•• •• •• \d\d$/);
    const csv = await ctx.http().get('/api/v1/admin/users').query({ format: 'csv' }).set(verifier.auth);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).not.toContain(karim.email);
    const detail = await ctx.http().get(`/api/v1/admin/users/${karim.id}`).set(verifier.auth);
    expect(JSON.stringify(detail.body)).not.toContain(karim.email);
    // Recherche par email interdite sans users.view_pii.
    expect((await ctx.http().get('/api/v1/admin/users').query({ q: karim.email }).set(verifier.auth)).body.total).toBe(0);

    const queue = await ctx.http().get('/api/v1/admin/verifications/identity').set(verifier.auth);
    expect(queue.body.items.map((i: { userId: string }) => i.userId)).toEqual([karim.id]);
    const doc = await ctx.http().get(`/api/v1/admin/verifications/identity/${karim.id}`).set(verifier.auth);
    expect(JSON.stringify(doc.body)).not.toContain(karim.email);
    expect((await ctx.http().post(`/api/v1/admin/verifications/identity/${karim.id}/claim`).set(verifier.auth)).status).toBe(200);

    const other = await createStaff(ctx, 'moderator', ['verifications.identity']);
    const conflict = await ctx.http().post(`/api/v1/admin/verifications/identity/${karim.id}/claim`).set(other.auth);
    expect(conflict.status).toBe(409);
    const refuseNoReason = await ctx.http().post(`/api/v1/admin/verifications/identity/${karim.id}/decision`).set(verifier.auth).send({ decision: 'reject' });
    expect(refuseNoReason.status).toBe(400);
    const ok = await ctx.http().post(`/api/v1/admin/verifications/identity/${karim.id}/decision`).set(verifier.auth).send({ decision: 'approve' });
    expect(ok.status).toBe(204);
    expect((await UserModel.findById(karim.id).lean())!.carrierVerification!.status).toBe('approved');
    expect(await NotificationModel.countDocuments({ recipient: karim.id, type: 'identity_approved' })).toBe(1);
    expect(await AuditLogModel.countDocuments({ action: 'identity.approve', targetId: karim.id })).toBe(1);
    expect((await ctx.http().post(`/api/v1/admin/users/${karim.id}/suspend`).set(verifier.auth).send({ reason: 'Abus' })).status).toBe(403);
  });

  it("montre les données en clair avec users.view_pii et journalise l'accès", async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const support = await createStaff(ctx, 'moderator', ['users.view', 'users.view_pii']);
    const detail = await ctx.http().get(`/api/v1/admin/users/${amina.id}`).set(support.auth);
    expect(detail.body.user.email).toBe(amina.email);
    expect(await AuditLogModel.countDocuments({ action: 'user.view_pii', targetId: amina.id })).toBe(1);
  });

  it("sert les pièces sensibles uniquement avec la permission de vérification", async () => {
    const ctx = makeTestApp();
    const verifier = await createStaff(ctx, 'moderator', ['verifications.identity']);
    const content = await createStaff(ctx, 'moderator', ['parcels.view']);
    const publicId = 'ucolis/identity_doc/abc/front';
    expect((await ctx.http().get('/api/v1/admin/files').query({ publicId }).set(content.auth)).status).toBe(403);
    const ok = await ctx.http().get('/api/v1/admin/files').query({ publicId }).set(verifier.auth);
    expect(ok.body.url).toContain('expires_at=');
    expect(ok.body.url).toContain('type=authenticated');
    // Preuve de livraison stockée en public : signée avec ce type, sinon Cloudinary la dit introuvable.
    const proof = await ctx.http().get('/api/v1/admin/files').query({ publicId: 'ucolis/delivery_proof/abc/p1' }).set(content.auth);
    expect(proof.body.url).toContain('type=upload');
  });
});

describe('consommation Cloudinary', () => {
  it('est réservée au tableau de bord', async () => {
    const ctx = makeTestApp();
    const viewer = await createStaff(ctx, 'moderator', ['dashboard.view']);
    const other = await createStaff(ctx, 'moderator', ['parcels.view']);
    expect((await ctx.http().get('/api/v1/admin/storage-usage').set(other.auth)).status).toBe(403);
    const res = await ctx.http().get('/api/v1/admin/storage-usage').set(viewer.auth);
    expect(res.body.usage.credits).toEqual({ used: 5, limit: 25, percent: 20 });
  });

});

describe('modération', () => {
  it('suspend un utilisateur : éjecté immédiatement, notifié par email, sans push', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const modo = await createStaff(ctx, 'moderator', ['users.view', 'users.suspend']);
    expect((await ctx.http().post(`/api/v1/admin/users/${amina.id}/suspend`).set(modo.auth).send({ reason: 'x' })).status).toBe(400);
    const res = await ctx.http().post(`/api/v1/admin/users/${amina.id}/suspend`).set(modo.auth).send({ reason: 'Fraude avérée' });
    expect(res.status).toBe(204);
    expect((await ctx.http().get('/api/v1/me').set(amina.auth)).body.error.code).toBe('ACCOUNT_SUSPENDED');
    expect(ctx.realtime.disconnected).toContainEqual({ userId: amina.id, reason: 'suspended' });
    expect(ctx.mailer.last(amina.email)!.subject).toBe('Compte suspendu');
    expect(ctx.push.sent).toHaveLength(0);
    await ctx.http().post(`/api/v1/admin/users/${amina.id}/reactivate`).set(modo.auth).send({ reason: 'Erreur' });
    expect((await ctx.http().get('/api/v1/me').set(amina.auth)).status).toBe(200);
  });

  it("force un statut avec motif, mais jamais pendant un litige", async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const p = await createParcel(ctx, amina);
    const modo = await createStaff(ctx, 'moderator', ['parcels.view', 'parcels.moderate']);
    const res = await ctx.http().post(`/api/v1/admin/parcels/${p.id}/force-status`).set(modo.auth).send({ status: 'cancelled', reason: 'Annonce frauduleuse' });
    expect(res.body.parcel.status).toBe('cancelled');
    expect(res.body.parcel.statusHistory.at(-1)).toMatchObject({ byType: 'staff', reason: 'Annonce frauduleuse' });
    await ParcelModel.updateOne({ _id: p.id }, { status: 'disputed' });
    const blocked = await ctx.http().post(`/api/v1/admin/parcels/${p.id}/force-status`).set(modo.auth).send({ status: 'delivered', reason: 'Tentative' });
    expect(blocked.status).toBe(409);
    const search = await ctx.http().get('/api/v1/admin/parcels').query({ q: p.reference }).set(modo.auth);
    expect(search.body.total).toBe(1);
  });

  it('modifie un réglage validé, avec audit, et le journal reste en ajout seul', async () => {
    const ctx = makeTestApp();
    const admin = await createStaff(ctx, 'super_admin');
    const bad = await ctx.http().put('/api/v1/admin/settings/autoConfirmHours').set(admin.auth).send({ value: -1, reason: 'Test' });
    expect(bad.status).toBe(400);
    const noReason = await ctx.http().put('/api/v1/admin/settings/autoConfirmHours').set(admin.auth).send({ value: 48 });
    expect(noReason.status).toBe(400);
    expect((await ctx.http().put('/api/v1/admin/settings/autoConfirmHours').set(admin.auth).send({ value: 48, reason: 'Décision comité' })).status).toBe(200);
    const audit = await ctx.http().get('/api/v1/admin/audit').query({ action: 'settings.update' }).set(admin.auth);
    expect(audit.body.items[0]).toMatchObject({ targetId: 'autoConfirmHours', reason: 'Décision comité', after: 48 });
    await expect(AuditLogModel.updateOne({}, { reason: 'falsifié' })).rejects.toThrow();
    await expect(AuditLogModel.deleteMany({})).rejects.toThrow();
    const csv = await ctx.http().get('/api/v1/admin/audit/export').set(admin.auth);
    expect(csv.text).toContain('settings.update');
  });

  it('agrège le tableau de bord', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    await createParcel(ctx, amina);
    const admin = await createStaff(ctx, 'super_admin');
    const stats = await ctx.http().get('/api/v1/admin/stats').set(admin.auth);
    expect(stats.body).toMatchObject({ users: { total: 1 }, parcels: { open: 1 }, queues: { identity: { count: 0 } } });
  });
});
