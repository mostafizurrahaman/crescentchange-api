import config from '../../config';

export const ROLE = {
  CLIENT: 'CLIENT',
  ORGANIZATION: 'ORGANIZATION',
  BUSINESS: 'BUSINESS',
  ADMIN: 'ADMIN',
} as const;

export type TRole = keyof typeof ROLE;

export type ValueOf<T> = T[keyof T];

// Generate enum values dynamically from ROLE
export const roleValues = Object.values(ROLE) as [string, ...string[]];

export const defaultUserImage: string = config.defaultUserImage as string;
