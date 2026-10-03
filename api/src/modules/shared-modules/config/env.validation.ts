import { z } from 'zod';

const numberFromString = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'number' ? v : Number(v)))
  .pipe(z.number().int().positive());

/** Well-known placeholder secrets that must never be accepted in production. */
const KNOWN_DEV_ADMIN_KEYS = new Set(['dev-admin-secret-key-change-in-prod', 'changeme']);

const booleanFromString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: numberFromString.default(7778),
    DATABASE_URL: z.url(),
    ADMIN_API_KEY: z.string().default(''),
    /** Set to `true` when running behind a single reverse proxy so client IPs are read from X-Forwarded-For. */
    TRUST_PROXY: booleanFromString,
    /** Swagger UI is disabled in production unless explicitly enabled. */
    ENABLE_SWAGGER: z.enum(['true', 'false']).optional(),
    /** Public URL of the Next.js web app. Devices put `${PUBLIC_APP_URL}/pair?code=…` into their QR code. */
    PUBLIC_APP_URL: z
      .url()
      .default('http://localhost:7777')
      .transform((u) => u.replace(/\/+$/, '')),
    /** Optional. When set, devices switch their API base URL to this value (domain moves without reflashing). */
    DEVICE_BACKEND_URL: z
      .preprocess((v) => (v === '' ? undefined : v), z.url().optional())
      .transform((u) => u?.replace(/\/+$/, ''))
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    if (env.ADMIN_API_KEY.length < 24 || KNOWN_DEV_ADMIN_KEYS.has(env.ADMIN_API_KEY)) {
      ctx.addIssue({
        code: 'custom',
        path: ['ADMIN_API_KEY'],
        message:
          'must be a unique secret of at least 24 characters in production (generate one with `openssl rand -hex 32`)'
      });
    }
  });

export type Env = z.infer<typeof schema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
