import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import {
  apiClient,
  createIntegrationApp,
  IntegrationContext,
  PASSWORD,
  resetDatabase
} from './integration-app';

/**
 * Device ownership lifecycle, database to API: one account per hardware UUID, several displays per
 * account, pending requests, transfer by username, and account deletion releasing displays.
 */
describe('Device ownership (integration, PostgreSQL)', () => {
  let ctx: IntegrationContext;
  let api: ReturnType<typeof apiClient>;
  let db: DataSource;

  const deviceRow = async (deviceUuid: string) =>
    (
      await db.query(
        `SELECT d.*, u."userName" FROM device d LEFT JOIN "user" u ON u.id = d."userId" WHERE d."deviceUuid" = $1`,
        [deviceUuid]
      )
    )[0];

  beforeAll(async () => {
    ctx = await createIntegrationApp();
    api = apiClient(ctx.app);
    db = ctx.dataSource;
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(db);
    await api.register('alice');
    await api.register('bob');
  });

  describe('accounts', () => {
    it('keeps usernames unique, case-insensitively', async () => {
      await api
        .http()
        .post('/v1/auth/register')
        .send({ userName: 'ALICE', password: PASSWORD })
        .expect(409);
      const users = await db.query(`SELECT "userName" FROM "user" ORDER BY "userName"`);
      expect(users.map((u: { userName: string }) => u.userName)).toEqual(['alice', 'bob']);
    });

    it('generates UUIDv7 primary keys in the database', async () => {
      const rows = await db.query(`SELECT uuid_extract_version(id) AS v FROM "user"`);
      expect(rows.every((r: { v: number }) => r.v === 7)).toBe(true);
    });
  });

  describe('one account per hardware UUID', () => {
    it('lets an account own several displays', async () => {
      const x = randomUUID();
      const y = randomUUID();
      await api.adoptDevice('alice', 'ANKA22', x);
      await api.adoptDevice('alice', 'ANKA33', y);

      const devices = await api.devicesOf('alice');
      expect(devices.map((d) => d.deviceUuid).sort()).toEqual([x, y].sort());
    });

    it('refuses a claim for a UUID registered to another account and changes nothing', async () => {
      const x = randomUUID();
      await api.adoptDevice('alice', 'ANKA22', x);
      await api.pair('bob', 'BEBA22').expect(200);

      const res = await api.claim('BEBA22', x).expect(403);
      expect(res.body.message).toMatch(/registered to another account/);

      const row = await deviceRow(x);
      expect(row.userName).toBe('alice');
      expect(row.isPaired).toBe(true);
      const bobs = await api.devicesOf('bob');
      expect(bobs).toHaveLength(1); // bob's request stays pending, it never got the UUID
      expect(bobs[0].deviceUuid).toBeNull();
    });

    it("replaces the same account's leftover row for a UUID (e.g. after a lost claim response)", async () => {
      const x = randomUUID();
      await api.adoptDevice('alice', 'ANKA22', x);
      const firstRowId = (await deviceRow(x)).id;

      await api.pair('alice', 'ANKA33').expect(200);
      await api.claim('ANKA33', x).expect(200);

      const rows = await db.query(`SELECT id FROM device WHERE "deviceUuid" = $1`, [x]);
      expect(rows).toHaveLength(1);
      expect(rows[0].id).not.toBe(firstRowId);
    });

    it('enforces the uniqueness in the schema itself', async () => {
      const x = randomUUID();
      await api.adoptDevice('alice', 'ANKA22', x);
      await expect(db.query(`INSERT INTO device ("deviceUuid") VALUES ($1)`, [x])).rejects.toThrow(
        /duplicate key/
      );
    });
  });

  describe('pending pairing requests', () => {
    it('belong to the account that entered the code first', async () => {
      await api.pair('alice', 'ANKA22').expect(200);
      const res = await api.pair('bob', 'ANKA22').expect(409);
      expect(res.body.message).toMatch(/already being paired by another account/);
      expect(await api.devicesOf('alice')).toHaveLength(1);
    });

    it('can be cancelled only by their owner, never for a claimed display', async () => {
      await api.pair('alice', 'ANKA22').expect(200);
      const pendingId = (await api.devicesOf('alice'))[0].id as string;
      const x = randomUUID();
      await api.adoptDevice('alice', 'ANKA33', x);
      const claimedId = (await deviceRow(x)).id as string;

      const cancel = (id: string, userId: string) =>
        api.asAdmin(api.http().delete(`/v1/devices/pending/${id}?userId=${userId}`));
      await cancel(pendingId, 'bob').expect(404);
      await cancel(claimedId, 'alice').expect(404);
      await cancel(pendingId, 'alice').expect(204);

      const left = await api.devicesOf('alice');
      expect(left.map((d) => d.deviceUuid)).toEqual([x]);
    });

    it('disappear once expired, the next time devices are listed', async () => {
      await api.pair('alice', 'ANKA22').expect(200);
      await db.query(
        `UPDATE device SET "pairingCodeExpiresAt" = now() - interval '1 minute' WHERE "pairingCode" = 'ANKA22'`
      );

      expect(await api.devicesOf('alice')).toEqual([]);
      expect(await db.query(`SELECT 1 FROM device WHERE "pairingCode" = 'ANKA22'`)).toHaveLength(0);
    });
  });

  describe('transfer by username', () => {
    it('moves a display to another account; it stays paired and keeps working with its token', async () => {
      const x = randomUUID();
      const token = await api.adoptDevice('alice', 'ANKA22', x);

      const res = await api
        .asAdmin(api.http().post(`/v1/devices/${x}/transfer`))
        .send({ toUserName: 'BOB', fromUserName: 'alice' })
        .expect(200);
      expect(res.body).toMatchObject({ deviceUuid: x, userId: 'bob', isPaired: true });

      expect(await api.devicesOf('alice')).toEqual([]);
      expect((await api.devicesOf('bob')).map((d) => d.deviceUuid)).toEqual([x]);
      const config = await api.deviceConfig(x, token).expect(200);
      expect(config.body.isPaired).toBe(true);
    });

    it('refuses unknown usernames, the current owner as target, and callers who do not own it', async () => {
      const x = randomUUID();
      await api.adoptDevice('alice', 'ANKA22', x);
      const transfer = (toUserName: string, fromUserName: string) =>
        api
          .asAdmin(api.http().post(`/v1/devices/${x}/transfer`))
          .send({ toUserName, fromUserName });

      expect((await transfer('ghost', 'alice').expect(404)).body.message).toMatch(
        /No account with the username 'ghost'/
      );
      await transfer('alice', 'alice').expect(400);
      await transfer('bob', 'bob').expect(404);
      expect((await deviceRow(x)).userName).toBe('alice');
    });
  });

  describe('account deletion', () => {
    it('requires the password and changes nothing when it is wrong', async () => {
      const x = randomUUID();
      await api.adoptDevice('alice', 'ANKA22', x);

      await api
        .asAdmin(api.http().delete('/v1/auth/user/alice'))
        .send({ currentPassword: 'wrong' })
        .expect(401);
      expect(await db.query(`SELECT 1 FROM "user" WHERE "userName" = 'alice'`)).toHaveLength(1);
      expect((await deviceRow(x)).userName).toBe('alice');
    });

    it('releases the displays so their hardware UUIDs can be claimed by another account', async () => {
      const x = randomUUID();
      const token = await api.adoptDevice('alice', 'ANKA22', x);
      await api
        .asAdmin(api.http().patch(`/v1/devices/${x}`))
        .send({
          name: 'Alice kitchen',
          scheduleEnabled: true,
          display: { pages: [{ type: 'message', text: 'Private note' }] }
        })
        .expect(200);
      await api
        .http()
        .post('/api/v1/device/metrics')
        .set('X-Device-ID', x)
        .set('X-Device-Token', token)
        .send({
          deviceId: x,
          stationName: 'Zürich HB',
          uptimeSeconds: 60,
          resetReason: 1,
          cpuFreqMHz: 240,
          ramFreeBytes: 200000,
          ramTotalBytes: 320000,
          ramMinFreeEver: 150000,
          ramMaxAllocBlock: 90000,
          fsTotalBytes: 1500000,
          fsUsedBytes: 50000,
          wifiSignalRssi: -60,
          wifiChannel: 6
        })
        .expect(200);
      await api.pair('alice', 'ANKA33').expect(200); // a pending request too

      const res = await api
        .asAdmin(api.http().delete('/v1/auth/user/alice'))
        .send({ currentPassword: PASSWORD })
        .expect(200);
      expect(res.body).toEqual({ releasedDevices: 1 });

      // account and pending request gone; display released and personal settings cleared
      expect(await db.query(`SELECT 1 FROM "user" WHERE "userName" = 'alice'`)).toHaveLength(0);
      expect(await db.query(`SELECT 1 FROM device WHERE "pairingCode" = 'ANKA33'`)).toHaveLength(0);
      const row = await deviceRow(x);
      expect(row).toMatchObject({
        userId: null,
        isPaired: false,
        name: 'ESP32 Departure Board',
        display: null,
        scheduleEnabled: false,
        isConfigured: true
      });
      // device health history stays with the hardware (admin telemetry)
      expect(
        await db.query(`SELECT 1 FROM device_metric WHERE "deviceId" = $1`, [row.id])
      ).toHaveLength(1);

      // the display keeps its token and now shows a fresh pairing code ...
      const config = await api.deviceConfig(x, token).expect(200);
      expect(config.body).toMatchObject({
        isPaired: false,
        pairingCode: expect.stringMatching(/^[A-Z2-9]{6}$/)
      });

      // ... which another account enters to claim the same hardware UUID
      const claimed = await api.pair('bob', config.body.pairingCode).expect(200);
      expect(claimed.body).toMatchObject({ deviceUuid: x, userId: 'bob', isPaired: true });
      expect((await deviceRow(x)).userName).toBe('bob');
    });
  });
});
