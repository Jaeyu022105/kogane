import { createError, createEventStream, defineEventHandler, getQuery } from 'h3';
import { db } from '~/lib/db';
import { realtimeHub } from '~/server/utils/realtimeHub';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const rawBusinessId = String(query.businessId || '').trim();
  const rawTerminalId = String(query.terminalId || '').trim();
  const rawSlug = String(query.slug || '').trim();

  let businessId = rawBusinessId;

  // Resolve businessId from terminalId if not supplied directly
  if (!businessId && rawTerminalId) {
    const { data: terminal } = await db.queryOne<{ business_id: string }>(
      'SELECT business_id FROM terminals WHERE id = ?',
      [rawTerminalId],
    );
    if (terminal?.business_id) {
      businessId = terminal.business_id;
    }
  }

  // Resolve businessId from public terminal slug
  if (!businessId && rawSlug) {
    const { data: terminal } = await db.queryOne<{ business_id: string }>(
      'SELECT business_id FROM terminals WHERE public_slug = ?',
      [rawSlug],
    );
    if (terminal?.business_id) {
      businessId = terminal.business_id;
    }
  }

  if (!businessId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid businessId, terminalId, or slug is required for realtime streaming',
    });
  }

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
