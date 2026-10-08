// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: process.env.NODE_ENV !== 'production' },
  devServer: {
    host: process.env.HOST || '0.0.0.0',
    port: Number(process.env.PORT) || 3000,
  },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover' },
        { name: 'theme-color', content: '#161116' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      ],
    },
  },
  experimental: {
    appManifest: false,
  },

  modules: [
    '@nuxtjs/tailwindcss',
    // @nuxtjs/supabase is intentionally excluded — Supabase is only accessed
    // server-side via @supabase/supabase-js in lib/db-supabase.ts and lib/authUtils.ts.
    // The module would unconditionally try to initialize a client on every request.
  ],

  // Runtime config — server-only secrets + public client vars
  runtimeConfig: {
    devMode: process.env.DEV_MODE === 'true',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || '',
    public: {
      supabaseUrl:     process.env.SUPABASE_URL || '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
      enterpriseTools: process.env.NUXT_PUBLIC_ENTERPRISE_TOOLS || '',
      shareOrigin:     process.env.NUXT_PUBLIC_SHARE_ORIGIN || '',
    },
  },

  tailwindcss: {
    cssPath:    '~/assets/css/tailwind.css',
    configPath: 'tailwind.config.ts',
  },

  // Suppress nitro warning about better-sqlite3 — it's server-only
  nitro: {
    experimental: {
      wasm: false,
    },
  },
});
