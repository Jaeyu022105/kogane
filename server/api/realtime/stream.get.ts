import { createError, createEventStream, defineEventHandler, getQuery } from 'h3';
import { verifyAdmin, verifyTerminalSession } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { getBusinessForAdmin } from '~/server/utils/business';
import { realtimeHub } from '~/server/utils/realtimeHub';

/**
 * Live data changes for one business, as server-sent events.
 * The business always comes from the caller's session, never from the URL alone:
 *   ?terminalId= / ?slug=  → that terminal's session (or the owner's admin session)
 *   ?businessId=           → the owner's admin session
 * EventSource cannot send headers, so the session arrives as the login cookie.
 */
async function resolveStreamBusinessId(event: Parameters<typeof verifyAdmin>[0]): Promise<string> {
  const query = getQuery(event);
  const rawBusinessId = String(query.businessId || '').trim();
  const rawSlug = String(query.slug || '').trim();
  let terminalId = String(query.terminalId || '').trim();

  if (!terminalId && rawSlug) {
    const { data: terminal } = await db.queryOne<{ id: string }>(
      'SELECT id FROM terminals WHERE public_slug = ? AND is_public = 1',
      [rawSlug],
    );
    if (!terminal?.id) throw createError({ statusCode: 404, statusMessage: 'Terminal not found' });
    terminalId = terminal.id;
  }

  if (terminalId) {
    const session = await verifyTerminalSession(event, terminalId);
    return session.businessId;
  }

  if (rawBusinessId) {
    const { userId } = await verifyAdmin(event);
    const business = await getBusinessForAdmin(userId, rawBusinessId);
    if (!business.data) throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
    return business.data.id;
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'A valid businessId, terminalId, or slug is required for realtime streaming',
  });
}

export default defineEventHandler(async (event) => {
  const businessId = await resolveStreamBusinessId(event);

  const eventStream = createEventStream(event);

  // Send initial handshake message
  await eventStream.push(
    JSON.stringify({
      type: 'connected',
      businessId,
      timestamp: new Date().toISOString(),
    }),
  );

  // Subscribe to real-time events for this business
  const unsubscribe = realtimeHub.subscribe(businessId, (mutation) => {
    eventStream.push(JSON.stringify(mutation)).catch(() => {
      unsubscribe();
    });
  });

  // Heartbeat ping every 20 seconds to prevent intermediate proxy/browser timeouts
  const heartbeat = setInterval(() => {
    eventStream.push(
      JSON.stringify({
        type: 'ping',
        timestamp: new Date().toISOString(),
      }),
    ).catch(() => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  }, 20000);

  eventStream.onClosed(() => {
    clearInterval(heartbeat);
    unsubscribe();
  });

  return eventStream.send();
});
