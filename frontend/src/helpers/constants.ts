import { ICONS } from '@react-ui-kit/icons';

const __IS_CLIENT = typeof window !== 'undefined';
const __IS_SERVER = !__IS_CLIENT;

export enum COOKIE_KEYS {
  SESSION = 'pts_session',
  USER_ID = 'pts_uid'
}

export enum SWR_CACHE_KEYS {
  USER = 'USER',
  DEVICES = 'DEVICES'
}

export enum SEARCH_PARAMS_UNCACHED {
  USERNAME = 'userName'
}

export const API_BASE_URL =
  process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7778';

// No fallback in production: an empty key makes the API reject every admin call (fail-closed).
export const ADMIN_API_KEY =
  process.env.ADMIN_API_KEY ||
  (process.env.NODE_ENV === 'production' ? '' : 'dev-admin-secret-key-change-in-prod');

export interface LinkProperties {
  name: string;
  icon?: string;
  link: string;
  protected?: boolean;
}

const GITHUB_LINK = 'https://github.com/DaRabus/public-transport-spy';

export const SOCIAL_LINKS: LinkProperties[] = [
  {
    name: 'Github',
    icon: ICONS.GITHUB,
    link: GITHUB_LINK
  }
];
