/**
 * DELETE /api/presets/:id
 * Deletes a business-owned custom preset after enforcing ownership and audit logging.
 */

import { createError, defineEventHandler } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { findBuiltInBuilderPreset } from '~/lib/builderPresets';
import { db } from '~/lib/db';
import { writeAuditLog } from '~/server/utils/audit';
import { getBusinessForAdmin } from '~/server/utils/business';
import { realtimeHub } from '~/server/utils/realtimeHub';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);
  const presetId = event.context.params?.id;

  if (!presetId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing preset id' });
  }

  const { data: existing, error: fetchErr } = await db.queryOne<{
    id: string;
    business_id: string | null;
    name: string;
    description: string | null;
    category: string | null;
    preset_key: string | null;
    version: number | null;
  }>(
    'SELECT id, business_id, name, description, category, preset_key, version FROM presets WHERE id = ?',
    [presetId],
  );

  if (fetchErr) {
    throw createError({ statusCode: 500, statusMessage: fetchErr });
  }

  if (!existing) {
    if (findBuiltInBuilderPreset(presetId)) {
      throw createError({ statusCode: 403, statusMessage: 'Built-in system presets cannot be deleted' });
    }
    throw createError({ statusCode: 404, statusMessage: 'Preset not found' });
  }

  if (!existing.business_id) {
    throw createError({ statusCode: 403, statusMessage: 'Built-in global presets cannot be deleted' });
  }

  const { data: business } = await getBusinessForAdmin(userId, existing.business_id);
  if (!business) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }

  const { error: deleteErr } = await db.delete('presets', { id: existing.id });
  if (deleteErr) {
    throw createError({ statusCode: 500, statusMessage: deleteErr });
  }

  realtimeHub.publish(business.id, {
    table: 'presets',
    action: 'delete',
    recordId: existing.id,
    data: { id: existing.id },
  });

  await writeAuditLog({
    businessId: business.id,
    actorId: userId,
    actorType: 'admin',
    actorName: 'Admin',
    actionType: 'delete',
    targetTable: 'presets',
    targetId: existing.id,
    payloadBefore: existing,
    metadata: {
      event: 'preset:delete',
    },
  });

  return {
    success: true,
    deletedId: existing.id,
    error: null,
  };
});
