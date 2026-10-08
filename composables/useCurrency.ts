import { computed } from 'vue';
import { COUNTRIES, findCountry, formatCurrencyAmount, type CountryOption, type FormatCurrencyOptions } from '~/lib/currency';
import { useBusiness } from './useBusiness';
import { useCanvasRuntime } from './useCanvasRuntime';

export function useCurrency() {
  const { business } = useBusiness();
  const runtime = useCanvasRuntime();

  const activeCountry = computed<string>(() => {
    return business.value?.country
      || (runtime?.state?.value?.sessionVars?.country as string)
      || 'US';
  });

  const currentCountry = computed<CountryOption>(() => {
    return findCountry(activeCountry.value);
  });

  const activeCurrency = computed<string>(() => {
    return business.value?.currency
      || (runtime?.state?.value?.sessionVars?.currency as string)
      || currentCountry.value.currency
      || 'USD';
  });

  const activeSymbol = computed<string>(() => {
    return business.value?.currencySymbol
      || (runtime?.state?.value?.sessionVars?.currencySymbol as string)
      || currentCountry.value.symbol
      || '$';
  });

  function format(amount: unknown, overrides?: FormatCurrencyOptions): string {
    return formatCurrencyAmount(amount, {
      currency: activeCurrency.value,
      symbol: activeSymbol.value,
      country: activeCountry.value,
      decimals: currentCountry.value.decimals,
      ...overrides,
    });
  }

  return {
    country: activeCountry,
    currency: activeCurrency,
    symbol: activeSymbol,
    currentCountry,
    countries: COUNTRIES,
    format,
    formatCurrency: format,
  };
}
