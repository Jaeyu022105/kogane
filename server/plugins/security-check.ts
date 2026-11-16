/**
 * Refuses to start an online (Firebase) production server whose SESSION_SECRET or
 * ENCRYPTION_KEY is missing, too short, or still the .env.example placeholder.
 * Local / single-server installs generate a private secret instead (see lib/security.ts).
 */

import { assertProductionSecrets } from '~/lib/security';

export default defineNitroPlugin(() => {
  assertProductionSecrets();
});
