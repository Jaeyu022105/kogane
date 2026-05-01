import { db } from '~/lib/db';
import type { AuditWriteInput } from '~/lib/audit';
import { serializeAuditJson } from '~/lib/audit';

export async function writeAuditLog(input: AuditWriteInput) {
  return db.insert('audit_log', {
    business_id: input.businessId,
    actor_id: input.actorId ?? null,
    actor_type: input.actorType,
    actor_name: input.actorName,
    action_type: input.actionType,
    target_table: input.targetTable ?? null,
    target_id: input.targetId ?? null,
    payload_before: serializeAuditJson(input.payloadBefore),
    payload_after: serializeAuditJson(input.payloadAfter),
    metadata: serializeAuditJson(input.metadata ?? null),
  });
}
