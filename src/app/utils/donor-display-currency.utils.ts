import httpStatus from 'http-status';
import { Convert } from 'easy-currencies';
import AppError from './AppError';
import {
  currencySymbol,
  normalizeCurrency,
  STRIPE_SETTLEMENT_CURRENCIES,
} from './currency.utils';
import Client from '../modules/Client/client.model';

const FX_TTL_MS = 5 * 60 * 1000;
const fxCache = new Map<string, { rate: number; expiresAt: number }>();

export const DISPLAY_CURRENCIES = [
  ...new Set(STRIPE_SETTLEMENT_CURRENCIES.map((code) => normalizeCurrency(code))),
].sort();

export const isSupportedDisplayCurrency = (
  currency?: string | null
): boolean => {
  if (!currency) return false;
  return DISPLAY_CURRENCIES.includes(normalizeCurrency(currency));
};

export const normalizePreferredCurrency = (
  currency?: string | null
): string | undefined => {
  if (currency === undefined || currency === null || currency === '') {
    return undefined;
  }

  const code = normalizeCurrency(currency);
  if (!isSupportedDisplayCurrency(code)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Unsupported display currency "${currency}". Use one of: ${DISPLAY_CURRENCIES.join(', ')}`
    );
  }

  return code;
};

export const getSupportedDisplayCurrencies = () =>
  DISPLAY_CURRENCIES.map((code) => ({
    code,
    symbol: currencySymbol(code),
    label: `${code} (${currencySymbol(code)})`,
  }));

export const getFxRate = async (
  fromCurrency?: string | null,
  toCurrency?: string | null
): Promise<number> => {
  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);

  if (from === to) return 1;

  const cacheKey = `${from}:${to}`;
  const cached = fxCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.rate;
  }

  try {
    const converted = await Convert(1).from(from).to(to);
    const rate = Number(Number(converted).toFixed(8)) || 1;
    fxCache.set(cacheKey, { rate, expiresAt: Date.now() + FX_TTL_MS });
    return rate;
  } catch (error) {
    console.error(`FX rate failed (${from} → ${to}). Falling back to 1.`, error);
    return 1;
  }
};

export interface IDonorDisplayLayer {
  sourceCurrency: string;
  displayCurrency: string;
  displayCurrencySymbol: string;
  displayRate: number;
  isEstimate: boolean;
  displayNote: string;
  convert: (amount: number) => number;
}

export const buildDonorDisplayLayer = async (
  sourceCurrency?: string | null,
  preferredCurrency?: string | null
): Promise<IDonorDisplayLayer> => {
  const source = normalizeCurrency(sourceCurrency);
  const display = normalizeCurrency(preferredCurrency || source);
  const displayRate = await getFxRate(source, display);
  const isEstimate = display !== source;

  return {
    sourceCurrency: source,
    displayCurrency: display,
    displayCurrencySymbol: currencySymbol(display),
    displayRate,
    isEstimate,
    displayNote: isEstimate
      ? `Estimated in ${display}. Charged amount and official receipt stay in ${source}.`
      : `Amounts are in ${source}.`,
    convert: (amount: number) =>
      Number(((Number.isFinite(amount) ? amount : 0) * displayRate).toFixed(2)),
  };
};

export const donorDisplayMeta = (layer: IDonorDisplayLayer) => ({
  displayCurrency: layer.displayCurrency,
  displayCurrencySymbol: layer.displayCurrencySymbol,
  displayRate: layer.displayRate,
  isEstimate: layer.isEstimate,
  displayNote: layer.displayNote,
});

export const withDonorDisplay = async <T extends Record<string, unknown>>(
  record: T,
  preferredCurrency?: string | null,
  options?: {
    sourceCurrency?: string | null;
    amountFields?: Array<{ from: string; to: string }>;
  }
): Promise<T & ReturnType<typeof donorDisplayMeta>> => {
  const sourceCurrency =
    options?.sourceCurrency ||
    (typeof record.currency === 'string' ? record.currency : undefined);
  const layer = await buildDonorDisplayLayer(sourceCurrency, preferredCurrency);
  const amountFields = options?.amountFields || [
    { from: 'amount', to: 'displayAmount' },
    { from: 'totalAmount', to: 'displayTotalAmount' },
  ];

  const converted: Record<string, number> = {};
  for (const field of amountFields) {
    converted[field.to] = layer.convert(Number(record[field.from] ?? 0));
  }

  return {
    ...record,
    ...donorDisplayMeta(layer),
    ...converted,
  };
};

export const resolveUserPreferredCurrency = async (
  userId?: string | null,
  override?: string | null
): Promise<string | undefined> => {
  const fromOverride = normalizePreferredCurrency(override || undefined);
  if (fromOverride) return fromOverride;
  if (!userId) return undefined;

  const client = await Client.findOne({ auth: userId }).select(
    'preferredCurrency'
  );
  return client?.preferredCurrency
    ? normalizeCurrency(client.preferredCurrency)
    : undefined;
};
