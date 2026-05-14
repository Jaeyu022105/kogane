/**
 * useLocale — lightweight locale composable.
 * Supports 'en', 'fil', and falls back to 'en' for anything else.
 * Locale preference is persisted to localStorage.
 */

import { ref, computed } from 'vue';
import en  from '~/locales/en.json';
import fil from '~/locales/fil.json';

type LocaleKey = keyof typeof en;
type LocaleCode = 'en' | 'fil';

const STORAGE_KEY = 'pf-locale';

const locales: Record<LocaleCode, typeof en> = { en, fil };

const availableLocales: { code: LocaleCode; label: string; nativeLabel: string }[] = [
  { code: 'en',  label: 'English',  nativeLabel: 'English'  },
  { code: 'fil', label: 'Filipino', nativeLabel: 'Filipino' },
];

function resolveCode(raw: string): LocaleCode
{
  return (raw in locales) ? (raw as LocaleCode) : 'en';
}

const locale = ref<LocaleCode>('en');

export function useLocale()
{
  function loadLocale()
  {
    if (import.meta.client)
    {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) locale.value = resolveCode(saved);
    }
  }

  function setLocale(code: string)
  {
    locale.value = resolveCode(code);

    if (import.meta.client)
    {
      localStorage.setItem(STORAGE_KEY, locale.value);
    }
  }

  function t(key: LocaleKey): string
  {
    return locales[locale.value][key] ?? locales['en'][key] ?? key;
  }

  const currentLocale = computed(() => locale.value);

  return { locale: currentLocale, availableLocales, setLocale, loadLocale, t };
}
