// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
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
