/**
 * Kogane Restaurant Workstation POS - PM2 Process Ecosystem Configuration
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup
 */

module.exports = {
  apps: [
    {
      name: 'kogane-pos',
      script: '.output/server/index.mjs',
      interpreter: 'bun',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',
        DEV_MODE: 'true',
      },
    },
  ],
};
