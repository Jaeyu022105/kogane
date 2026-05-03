/**
 * PATCH /api/terminals/[id]/public
 * Updates the public access settings (is_public flag and public_slug) for a terminal.
 */

import { defineEventHandler, readBody } from 'h3';
import { verifyAdmin } from '~/lib/authUtils';
import { db } from '~/lib/db';
import { getBusinessForAdmin } from '~/server/utils/business';
import { writeAuditLog } from '~/server/utils/audit';

export default defineEventHandler(async (event) => {
  const { userId } = await verifyAdmin(event);

  const id = event.context.params?.id;
  if (!id) return { error: 'Missing id', success: false };

  const body = await readBody<{
    businessId: string;
    isPublic: boolean;
    publicSlug: string | null;
  }>(event);

  if (!body.businessId) return { error: 'Missing businessId', success: false };

  const { data: business } = await getBusinessForAdmin(userId, body.businessId);
  if (!business) return { error: 'Forbidden', success: false };

  /* validate slug format — only lowercase alphanumeric + hyphens */
  if (body.publicSlug && !/^[a-z0-9-]+$/.test(body.publicSlug)) {
    return { error: 'Slug must contain only lowercase letters, numbers, and hyphens', success: false };
  }

  const { error } = await db.update(
    'terminals',
    {
      is_public: body.isPublic ? 1 : 0,
      public_slug: body.isPublic ? (body.publicSlug || null) : null,
    },
    { id, business_id: body.businessId },
  );

  if (error) return { error, success: false };

  await writeAuditLog({
    businessId: body.businessId,
    actorId: userId,
    actorType: 'admin',
    actorName: 'Admin',
    actionType: 'update',
    targetTable: 'terminals',
    targetId: id,
    metadata: {
      event: 'terminal:public-settings',
      is_public: body.isPublic,
      public_slug: body.publicSlug,
    },
  });

  return { success: true, error: null };
});
