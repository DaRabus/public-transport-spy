import { validateEnv } from './env.validation';

const base = { DATABASE_URL: 'postgres://u:p@localhost:5432/db' };

describe('validateEnv', () => {
  it('treats an empty DEVICE_BACKEND_URL (docker compose default) as unset', () => {
    expect(validateEnv({ ...base, DEVICE_BACKEND_URL: '' }).DEVICE_BACKEND_URL).toBeUndefined();
  });

  it('normalizes URLs without trailing slashes', () => {
    const env = validateEnv({
      ...base,
      PUBLIC_APP_URL: 'https://app.example.com/',
      DEVICE_BACKEND_URL: 'https://api.example.com/'
    });
    expect(env.PUBLIC_APP_URL).toBe('https://app.example.com');
    expect(env.DEVICE_BACKEND_URL).toBe('https://api.example.com');
  });

  it('still rejects a malformed DEVICE_BACKEND_URL', () => {
    expect(() => validateEnv({ ...base, DEVICE_BACKEND_URL: 'not a url' })).toThrow(
      /DEVICE_BACKEND_URL/
    );
  });
});
