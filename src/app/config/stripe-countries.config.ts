/**
 * Stripe Connect Express — supported countries and local settlement currencies.
 * Source: Stripe Connect country/currency matrix (platform configuration).
 *
 * `countryCode` → Stripe Accounts API `country` (ISO 3166-1 alpha-2)
 * `currency`    → charge currency (ISO 4217 uppercase in app, lowercase in Stripe API)
 */
export interface IStripeCountryConfig {
  countryCode: string;
  currency: string;
  name: string;
  /** Extra lookup keys (uppercase), e.g. full country names */
  aliases?: string[];
}

export const STRIPE_CONNECT_COUNTRIES: readonly IStripeCountryConfig[] = [
  { countryCode: 'AU', currency: 'AUD', name: 'Australia', aliases: ['AUS'] },
  { countryCode: 'AT', currency: 'EUR', name: 'Austria' },
  { countryCode: 'BE', currency: 'EUR', name: 'Belgium' },
  { countryCode: 'BR', currency: 'BRL', name: 'Brazil' },
  { countryCode: 'BG', currency: 'EUR', name: 'Bulgaria' },
  { countryCode: 'CA', currency: 'CAD', name: 'Canada', aliases: ['CAN'] },
  {
    countryCode: 'CI',
    currency: 'XOF',
    name: "Côte d'Ivoire",
    aliases: ['COTE D IVOIRE', 'IVORY COAST'],
  },
  { countryCode: 'HR', currency: 'EUR', name: 'Croatia' },
  { countryCode: 'CY', currency: 'EUR', name: 'Cyprus' },
  {
    countryCode: 'CZ',
    currency: 'CZK',
    name: 'Czech Republic',
    aliases: ['CZECHIA'],
  },
  { countryCode: 'DK', currency: 'DKK', name: 'Denmark' },
  { countryCode: 'EE', currency: 'EUR', name: 'Estonia' },
  { countryCode: 'FI', currency: 'EUR', name: 'Finland' },
  { countryCode: 'FR', currency: 'EUR', name: 'France' },
  { countryCode: 'DE', currency: 'EUR', name: 'Germany' },
  { countryCode: 'GH', currency: 'GHS', name: 'Ghana' },
  { countryCode: 'GI', currency: 'GIP', name: 'Gibraltar' },
  { countryCode: 'GR', currency: 'EUR', name: 'Greece' },
  { countryCode: 'HK', currency: 'HKD', name: 'Hong Kong' },
  { countryCode: 'HU', currency: 'HUF', name: 'Hungary' },
  { countryCode: 'IN', currency: 'INR', name: 'India' },
  { countryCode: 'ID', currency: 'IDR', name: 'Indonesia' },
  { countryCode: 'IE', currency: 'EUR', name: 'Ireland' },
  { countryCode: 'IT', currency: 'EUR', name: 'Italy' },
  { countryCode: 'JP', currency: 'JPY', name: 'Japan' },
  { countryCode: 'KE', currency: 'KES', name: 'Kenya' },
  { countryCode: 'LV', currency: 'EUR', name: 'Latvia' },
  { countryCode: 'LI', currency: 'CHF', name: 'Liechtenstein' },
  { countryCode: 'LT', currency: 'EUR', name: 'Lithuania' },
  { countryCode: 'LU', currency: 'EUR', name: 'Luxembourg' },
  { countryCode: 'MY', currency: 'MYR', name: 'Malaysia' },
  { countryCode: 'MT', currency: 'EUR', name: 'Malta' },
  { countryCode: 'MX', currency: 'MXN', name: 'Mexico' },
  { countryCode: 'NL', currency: 'EUR', name: 'Netherlands' },
  { countryCode: 'NZ', currency: 'NZD', name: 'New Zealand' },
  { countryCode: 'NG', currency: 'NGN', name: 'Nigeria' },
  { countryCode: 'NO', currency: 'NOK', name: 'Norway' },
  { countryCode: 'PL', currency: 'PLN', name: 'Poland' },
  { countryCode: 'PT', currency: 'EUR', name: 'Portugal' },
  { countryCode: 'RO', currency: 'RON', name: 'Romania' },
  { countryCode: 'SG', currency: 'SGD', name: 'Singapore' },
  { countryCode: 'SK', currency: 'EUR', name: 'Slovakia' },
  { countryCode: 'SI', currency: 'EUR', name: 'Slovenia' },
  {
    countryCode: 'ZA',
    currency: 'ZAR',
    name: 'South Africa',
    aliases: ['RSA'],
  },
  { countryCode: 'ES', currency: 'EUR', name: 'Spain' },
  { countryCode: 'SE', currency: 'SEK', name: 'Sweden' },
  { countryCode: 'CH', currency: 'CHF', name: 'Switzerland' },
  { countryCode: 'TH', currency: 'THB', name: 'Thailand' },
  {
    countryCode: 'AE',
    currency: 'AED',
    name: 'United Arab Emirates',
    aliases: ['UAE'],
  },
  {
    countryCode: 'GB',
    currency: 'GBP',
    name: 'United Kingdom',
    aliases: ['UK', 'GREAT BRITAIN'],
  },
  {
    countryCode: 'US',
    currency: 'USD',
    name: 'United States',
    aliases: ['USA', 'UNITED STATES OF AMERICA'],
  },
] as const;

/** ISO country codes enabled for Stripe Connect in this platform */
export const STRIPE_COUNTRY_CODES = STRIPE_CONNECT_COUNTRIES.map(
  (c) => c.countryCode
) as [string, ...string[]];

/** All settlement currencies used across supported countries */
export const STRIPE_SETTLEMENT_CURRENCIES = [
  ...new Set(STRIPE_CONNECT_COUNTRIES.map((c) => c.currency)),
] as string[];

/**
 * Currencies with no decimal sub-units in Stripe (amounts are whole units).
 * PaymentIntent amounts must NOT be multiplied by 100 for these.
 */
export const STRIPE_ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);

const LOOKUP = new Map<string, IStripeCountryConfig>();

const registerKey = (key: string, config: IStripeCountryConfig) => {
  const normalized = key.trim().toUpperCase().replace(/\./g, '');
  if (!normalized) return;
  LOOKUP.set(normalized, config);
};

for (const config of STRIPE_CONNECT_COUNTRIES) {
  registerKey(config.countryCode, config);
  registerKey(config.name, config);
  config.aliases?.forEach((alias) => registerKey(alias, config));
}

export const resolveStripeCountry = (
  country?: string | null
): IStripeCountryConfig | null => {
  if (!country?.trim()) return null;
  const key = country.trim().toUpperCase().replace(/\./g, '');
  return LOOKUP.get(key) ?? null;
};

export const getStripeCountryCode = (country?: string | null): string | null =>
  resolveStripeCountry(country)?.countryCode ?? null;

export const getCurrencyForCountry = (country?: string | null): string =>
  resolveStripeCountry(country)?.currency ?? 'USD';

export const isSupportedStripeCountry = (country?: string | null): boolean =>
  resolveStripeCountry(country) !== null;

export const getStripeCurrencyForCountry = (
  country?: string | null
): string =>
  (resolveStripeCountry(country)?.currency ?? 'USD').toLowerCase();

export const isZeroDecimalStripeCurrency = (currency?: string | null): boolean =>
  STRIPE_ZERO_DECIMAL_CURRENCIES.has(
    (currency ?? '').trim().toUpperCase()
  );
