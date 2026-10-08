/**
 * Country & Currency configuration for Kogane.
 * Defines supported countries, currencies, symbols, locales, and formatting logic.
 */

export interface CountryOption {
  code: string;        // ISO 3166-1 alpha-2, e.g. 'PH', 'US', 'GB'
  name: string;        // English name, e.g. 'Philippines'
  currency: string;    // ISO 4217 code, e.g. 'PHP'
  symbol: string;      // Currency symbol, e.g. '₱'
  locale: string;      // BCP 47 locale tag, e.g. 'en-PH'
  decimals: number;    // Decimal places (usually 2, 0 for JPY/KRW/VND/IDR)
}

export const COUNTRIES: CountryOption[] = [
  { code: 'PH', name: 'Philippines', currency: 'PHP', symbol: '₱', locale: 'en-PH', decimals: 2 },
  { code: 'US', name: 'United States', currency: 'USD', symbol: '$', locale: 'en-US', decimals: 2 },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', symbol: '£', locale: 'en-GB', decimals: 2 },
  { code: 'EU', name: 'European Union', currency: 'EUR', symbol: '€', locale: 'de-DE', decimals: 2 },
  { code: 'JP', name: 'Japan', currency: 'JPY', symbol: '¥', locale: 'ja-JP', decimals: 0 },
  { code: 'CA', name: 'Canada', currency: 'CAD', symbol: '$', locale: 'en-CA', decimals: 2 },
  { code: 'AU', name: 'Australia', currency: 'AUD', symbol: '$', locale: 'en-AU', decimals: 2 },
  { code: 'SG', name: 'Singapore', currency: 'SGD', symbol: '$', locale: 'en-SG', decimals: 2 },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD', symbol: '$', locale: 'en-NZ', decimals: 2 },
  { code: 'HK', name: 'Hong Kong', currency: 'HKD', symbol: 'HK$', locale: 'zh-HK', decimals: 2 },
  { code: 'KR', name: 'South Korea', currency: 'KRW', symbol: '₩', locale: 'ko-KR', decimals: 0 },
  { code: 'IN', name: 'India', currency: 'INR', symbol: '₹', locale: 'en-IN', decimals: 2 },
  { code: 'MX', name: 'Mexico', currency: 'MXN', symbol: '$', locale: 'es-MX', decimals: 2 },
  { code: 'BR', name: 'Brazil', currency: 'BRL', symbol: 'R$', locale: 'pt-BR', decimals: 2 },
  { code: 'CH', name: 'Switzerland', currency: 'CHF', symbol: 'CHF', locale: 'de-CH', decimals: 2 },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', symbol: 'AED', locale: 'ar-AE', decimals: 2 },
  { code: 'TW', name: 'Taiwan', currency: 'TWD', symbol: 'NT$', locale: 'zh-TW', decimals: 2 },
  { code: 'TH', name: 'Thailand', currency: 'THB', symbol: '฿', locale: 'th-TH', decimals: 2 },
  { code: 'VN', name: 'Vietnam', currency: 'VND', symbol: '₫', locale: 'vi-VN', decimals: 0 },
  { code: 'ID', name: 'Indonesia', currency: 'IDR', symbol: 'Rp', locale: 'id-ID', decimals: 0 },
  { code: 'MY', name: 'Malaysia', currency: 'MYR', symbol: 'RM', locale: 'en-MY', decimals: 2 },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // Philippines as top or US

export function findCountry(query?: string | null): CountryOption {
  if (!query) return COUNTRIES.find((c) => c.code === 'US') ?? COUNTRIES[0];
  const q = String(query).trim().toLowerCase();
  const match = COUNTRIES.find((c) =>
    c.code.toLowerCase() === q
    || c.name.toLowerCase() === q
    || c.currency.toLowerCase() === q
    || c.symbol.toLowerCase() === q
  );
  return match ?? (COUNTRIES.find((c) => c.code === 'US') ?? COUNTRIES[0]);
}

export interface FormatCurrencyOptions {
  currency?: string;
  symbol?: string;
  country?: string;
  decimals?: number;
  locale?: string;
}

/**
 * Formats a numeric value into a localized currency string with the given symbol or country currency.
 * Handles numbers, numeric strings, empty/null values, and negative amounts cleanly.
 */
export function formatCurrencyAmount(
  val: unknown,
  options?: FormatCurrencyOptions,
): string {
  if (val == null || val === '' || val === '—') return '—';

  let num: number;
  if (typeof val === 'number') {
    num = val;
  } else {
    const rawStr = String(val).trim();
    if (!/\d/.test(rawStr)) {
      return rawStr;
    }
    const isNeg = rawStr.startsWith('-') || /-\s*[^\d]/.test(rawStr) || /^\(.*\)$/.test(rawStr);
    const cleaned = rawStr.replace(/[^\d.]/g, '');
    const parsed = parseFloat(cleaned);
    num = isNeg ? -parsed : parsed;
  }

  if (!Number.isFinite(num) || Number.isNaN(num)) {
    return String(val);
  }

  // Resolve matching country definition if available
  let matchedCountry: CountryOption | undefined;
  if (options?.country) {
    matchedCountry = findCountry(options.country);
  } else if (options?.currency) {
    matchedCountry = findCountry(options.currency);
  } else if (options?.symbol) {
    matchedCountry = findCountry(options.symbol);
  }

  const symbol = options?.symbol ?? matchedCountry?.symbol ?? '$';
  const decimals = options?.decimals ?? matchedCountry?.decimals ?? 2;
  const isNegative = num < 0;
  const absVal = Math.abs(num);

  const formattedNum = absVal.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return isNegative ? `-${symbol}${formattedNum}` : `${symbol}${formattedNum}`;
}
