/**
 * Global HTTP security headers middleware for Nitro/Nuxt server routes and pages.
 */

import { defineEventHandler, getRequestHeader, setResponseHeader } from 'h3';

export default defineEventHandler((event) => {
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff');
  setResponseHeader(event, 'X-Frame-Options', 'SAMEORIGIN');
  setResponseHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin');
  setResponseHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  setResponseHeader(event, 'X-XSS-Protection', '0');

  const proto = getRequestHeader(event, 'x-forwarded-proto');
  if (proto === 'https' || process.env.COOKIE_SECURE === 'true') {
    setResponseHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
});
