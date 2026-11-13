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
      title: 'Kogane',
      titleTemplate: '%s — Kogane',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover' },
        {
          name: 'description',
          content: 'Managed business terminals configured from presets and updated automatically.',
        },
        { name: 'theme-color', content: '#F4F3EF' },
        { name: 'application-name', content: 'Kogane' },
        { name: 'apple-mobile-web-app-title', content: 'Kogane' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'dns-prefetch', href: 'https://fonts.googleapis.com' },
        { rel: 'dns-prefetch', href: 'https://fonts.gstatic.com' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/manifest.webmanifest' },
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
    dbProvider: process.env.DB_PROVIDER || '',
    // Use STORAGE_PROVIDER=firestore (or FIREBASE_SPARK_MODE=true) on Firebase Spark free tier (<= 700 KB assets in Firestore)
    storageProvider: process.env.STORAGE_PROVIDER || '',
    firebaseSparkMode: process.env.FIREBASE_SPARK_MODE === 'true',
    sessionSecret: process.env.SESSION_SECRET || '',
    encryptionKey: process.env.ENCRYPTION_KEY || '',
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
    firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || '',
    public: {
      devMode:                process.env.DEV_MODE === 'true',
      dbProvider:             process.env.DB_PROVIDER || '',
      firebaseProjectId:      process.env.FIREBASE_PROJECT_ID || '',
      supabaseUrl:            process.env.SUPABASE_URL || '',
      supabaseAnonKey:        process.env.SUPABASE_ANON_KEY || '',
      enterpriseTools:        process.env.NUXT_PUBLIC_ENTERPRISE_TOOLS || '',
      shareOrigin:            process.env.NUXT_PUBLIC_SHARE_ORIGIN || '',
      siteUrl:                process.env.NUXT_PUBLIC_SITE_URL || process.env.SITE_URL || '',
      googleSiteVerification: process.env.NUXT_PUBLIC_GOOGLE_SITE_VERIFICATION || process.env.GOOGLE_SITE_VERIFICATION || '',
      bingSiteVerification:   process.env.NUXT_PUBLIC_BING_SITE_VERIFICATION || process.env.BING_SITE_VERIFICATION || '',
    },
  },

  tailwindcss: {
    cssPath:    '~/assets/css/tailwind.css',
    configPath: 'tailwind.config.ts',
  },

  // Suppress nitro warning about better-sqlite3 — it's server-only
  nitro: {
    ...(process.env.NITRO_PRESET === 'firebase' ? { preset: 'firebase' } : {}),
    firebase: {
      gen: 2,
      nodeVersion: '20',
      httpsOptions: {
        // Cloud Functions Gen 2 requires Blaze; Spark deployments use Node PaaS (Render/Koyeb) or `bun run tunnel`
        // with Cloud Firestore in e.g. 'asia-southeast1' or 'us-central1'.
        region: process.env.FIREBASE_REGION || 'asia-southeast1',
      },
    },
    experimental: {
      wasm: false,
    },
  },
});
