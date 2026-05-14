/**
 * useLocale — lightweight locale composable with browser detection and English fallback.
 * Supports 'en', 'ph', 'es', 'ja', 'ko', and 'zh'.
 * Legacy 'fil' values are mapped to 'ph' so older sessions keep working.
 */

import { computed, ref } from 'vue';
import en from '~/locales/en.json';
import es from '~/locales/es.json';
import ja from '~/locales/ja.json';
import ko from '~/locales/ko.json';
import ph from '~/locales/ph.json';
import zh from '~/locales/zh.json';

type LocaleMessages = typeof en;
export type LocaleKey = keyof LocaleMessages;
export type LocaleCode = 'en' | 'ph' | 'es' | 'ja' | 'ko' | 'zh';

const STORAGE_KEY = 'kogane-locale';

const locales: Record<LocaleCode, Partial<LocaleMessages>> = { en, ph, es, ja, ko, zh };

const availableLocales: { code: LocaleCode; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'ph', label: 'Filipino', nativeLabel: 'Filipino' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español' },
  { code: 'ja', label: 'Japanese', nativeLabel: '日本語' },
  { code: 'ko', label: 'Korean', nativeLabel: '한국어' },
  { code: 'zh', label: 'Chinese', nativeLabel: '中文' },
];

function resolveCode(raw?: string | null): LocaleCode {
  const normalized = (raw ?? '').toLowerCase();

  if (normalized === 'fil' || normalized === 'tl') return 'ph';
  if (normalized.includes('-ph') || normalized === 'ph') return 'ph';
  if (normalized.startsWith('es')) return 'es';
  if (normalized.startsWith('ja')) return 'ja';
  if (normalized.startsWith('ko')) return 'ko';
  if (normalized.startsWith('zh')) return 'zh';
  if (normalized in locales) return normalized as LocaleCode;

  return 'en';
}

function detectBrowserLocale(): LocaleCode {
  if (!import.meta.client) return 'en';

  const candidates = [
    ...(navigator.languages ?? []),
    navigator.language,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();

    if (lower.includes('-ph') || lower === 'fil' || lower === 'tl') return 'ph';
    if (lower.startsWith('es')) return 'es';
    if (lower.startsWith('ja')) return 'ja';
    if (lower.startsWith('ko')) return 'ko';
    if (lower.startsWith('zh')) return 'zh';
  }

  return resolveCode(candidates[0]);
}

function interpolate(template: string, params?: Record<string, string | number>) {
  if (!params) return template;

  return Object.entries(params).reduce(
    (output, [key, value]) => output.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

const locale = ref<LocaleCode>('en');
const detectedLocale = ref<LocaleCode>('en');

export function useLocale() {
  function loadLocale() {
    if (!import.meta.client) return;

    detectedLocale.value = detectBrowserLocale();
    const saved = localStorage.getItem(STORAGE_KEY);
    locale.value = saved ? resolveCode(saved) : detectedLocale.value;
  }

  function setLocale(code: string) {
    locale.value = resolveCode(code);

    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, locale.value);
    }
  }

  function translateFor(code: string, key: LocaleKey, params?: Record<string, string | number>) {
    const resolved = resolveCode(code);
    const template = locales[resolved]?.[key] ?? locales.en[key] ?? key;
    return interpolate(template, params);
  }

  function t(key: LocaleKey, params?: Record<string, string | number>) {
    return translateFor(locale.value, key, params);
  }

  return {
    locale: computed(() => locale.value),
    detectedLocale: computed(() => detectedLocale.value),
    availableLocales,
    setLocale,
    loadLocale,
    t,
    translateFor,
  };
}
