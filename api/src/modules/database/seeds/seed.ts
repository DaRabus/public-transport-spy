import 'reflect-metadata';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from '../entities';
import { User, UserRole } from '../../auth/entities/user.entity';
import { Device } from '../../device/entities/device.entity';
import { DeviceMetric } from '../../device/entities/device-metric.entity';
import { THEMES, type DisplayProfile } from '../../device/screens/screen-composer';

/**
 * Development seed data. Run with `npm run seed` (from `api/`) after migrations have been applied.
 *
 * - Refuses to run when NODE_ENV=production.
 * - Idempotent for users: existing seed users are reused. Devices/metrics are only generated
 *   for users that have none yet. Use `npm run seed -- --reset` to wipe seeded data first.
 * - Every seeded user gets the password `password123` (dev only!).
 */

const SEED = 20260410;
const DEV_PASSWORD = 'password123';
const STATIONS = ['Zürich HB', 'Bern', 'Basel SBB', 'Winterthur', 'Luzern', 'St. Gallen'];
/** Example on/off windows (minutes after midnight, weekday bits with bit 0 = Sunday). */
const SCHEDULES = [
  { scheduleEnabled: false },
  { scheduleEnabled: true, scheduleOn: 360, scheduleOff: 1380, scheduleDays: 0b0111110 }, // weekdays 06:00-23:00
  { scheduleEnabled: true, scheduleOn: 1080, scheduleOff: 120, scheduleDays: 0b1100000 } // Fri/Sat evenings until 02:00
];
/** Example screen rotations (see screens/screen-composer.ts); null = default departures board. */
const DISPLAYS: Array<DisplayProfile | null> = [
  null,
  {
    pages: [
      { type: 'departures', rows: 4, showPlatform: true, showDelay: true, walkMinutes: 3 },
      { type: 'clock', showDate: true, durationSec: 5 }
    ]
  },
  {
    pages: [
      { type: 'departures', categories: ['S'], title: 'S-Bahn' },
      { type: 'departures', station: 'Bern', rows: 2, timeFormat: 'clock' },
      { type: 'message', text: 'Seeded test board' }
    ]
  }
];

const SEED_USERS: { userName: string; role: UserRole }[] = [
  { userName: 'admin', role: UserRole.ADMIN },
  { userName: 'alice', role: UserRole.USER },
  { userName: 'bob', role: UserRole.USER }
];

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed data when NODE_ENV=production');
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL must be set');

  faker.seed(SEED);
  const reset = process.argv.includes('--reset');

  const ds = await new DataSource({ type: 'postgres', url, entities: ALL_ENTITIES }).initialize();
  try {
    const userRepo = ds.getRepository(User);
    const deviceRepo = ds.getRepository(Device);
    const metricRepo = ds.getRepository(DeviceMetric);

    if (reset) {
      // Deleting devices cascades to their metrics.
      await deviceRepo.createQueryBuilder().delete().execute();
      await userRepo.createQueryBuilder().delete().execute();
      console.log('Existing users, devices and metrics removed');
    }

    const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
    const users: User[] = [];
    for (const u of SEED_USERS) {
      let user = await userRepo.findOne({ where: { userName: u.userName } });
      if (!user) {
        user = await userRepo.save(
          userRepo.create({
            ...u,
            passwordHash,
            socialUrl: faker.internet.url(),
            avatarUrl: faker.image.avatar()
          })
        );
      }
      users.push(user);
    }

    let deviceCount = 0;
    let metricCount = 0;
    for (const user of users) {
      if (await deviceRepo.count({ where: { userId: user.id } })) continue;

      const howMany = faker.number.int({ min: 1, max: 3 });
      for (let i = 0; i < howMany; i++) {
        const station = faker.helpers.arrayElement(STATIONS);
        const lastSeen = faker.date.recent({ days: 1 });
        const device = await deviceRepo.save(
          deviceRepo.create({
            deviceUuid: randomUUID(), // like the firmware's random per-install identity
            name: `${faker.word.adjective()} ${faker.word.noun()} board`.slice(0, 128),
            stationName: station,
            theme: faker.helpers.arrayElement(THEMES),
            display: faker.helpers.arrayElement(DISPLAYS),
            timezone: faker.helpers.arrayElement([
              'Europe/Zurich',
              'Europe/Berlin',
              'Europe/London'
            ]),
            ...faker.helpers.arrayElement(SCHEDULES),
            deviceToken: randomBytes(16).toString('hex'),
            isPaired: true,
            claimedAt: faker.date.recent({ days: 30 }),
            lastSeenAt: lastSeen,
            lastIp: faker.internet.ipv4(),
            user,
            userId: user.id!
          })
        );
        deviceCount++;

        const ramTotal = 320_000;
        const fsTotal = 1_507_328;
        const metrics = Array.from({ length: 30 }, (_, n) =>
          metricRepo.create({
            deviceId: device.id!,
            stationName: station,
            firmwareVersion: '1.0.0',
            uptimeSeconds: 600 * (30 - n),
            resetReason: faker.helpers.arrayElement([1, 1, 1, 3, 4]),
            cpuFreqMHz: 240,
            ramFreeBytes: faker.number.int({ min: 160_000, max: 230_000 }),
            ramTotalBytes: ramTotal,
            ramMinFreeEver: faker.number.int({ min: 120_000, max: 160_000 }),
            ramMaxAllocBlock: faker.number.int({ min: 80_000, max: 110_000 }),
            fsTotalBytes: fsTotal,
            fsUsedBytes: faker.number.int({ min: 100_000, max: 400_000 }),
            wifiSignalRssi: faker.number.int({ min: -85, max: -45 }),
            wifiBssid: faker.internet.mac(),
            wifiChannel: faker.number.int({ min: 1, max: 13 }),
            createdAt: new Date(lastSeen.getTime() - n * 600_000)
          })
        );
        await metricRepo.save(metrics);
        metricCount += metrics.length;
      }
    }

    const pendingOwner = users.find((u) => u.userName === 'alice');
    if (pendingOwner && !(await deviceRepo.findOne({ where: { pairingCode: 'DEV234' } }))) {
      await deviceRepo.save(
        deviceRepo.create({
          pairingCode: 'DEV234',
          pairingCodeExpiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
          deviceUuid: null,
          isPaired: false,
          user: pendingOwner,
          userId: pendingOwner.id!
        })
      );
      deviceCount++;
    }

    console.log(
      `Seeded ${users.length} users (password: ${DEV_PASSWORD}), ${deviceCount} devices, ${metricCount} metrics`
    );
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
