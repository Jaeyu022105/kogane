import { db } from '~/lib/db';
import type { AuditWriteInput } from '~/lib/audit';
import {
  buildAuditCsv,
  escapeCsvCell,
  parseAuditJson,
  redactAuditJsonString,
  redactAuditPayload,
  serializeAuditJson,
  summarizeAuditDiff,
} from '~/lib/audit';

export {
  buildAuditCsv,
  escapeCsvCell,
  parseAuditJson,
  redactAuditJsonString,
  redactAuditPayload,
  serializeAuditJson,
  summarizeAuditDiff,
};

export async function writeAuditLog(input: AuditWriteInput) {
  const safeBefore = input.payloadBefore !== undefined ? redactAuditPayload(input.payloadBefore) : null;
  const safeAfter = input.payloadAfter !== undefined ? redactAuditPayload(input.payloadAfter) : null;
  const safeMetadata = input.metadata != null ? redactAuditPayload(input.metadata) : null;

  return db.insert('audit_log', {
    business_id: input.businessId,
    actor_id: input.actorId ?? null,
    actor_type: input.actorType,
    actor_name: input.actorName,
    action_type: input.actionType,
    target_table: input.targetTable ?? null,
    target_id: input.targetId ?? null,
    payload_before: serializeAuditJson(safeBefore),
    payload_after: serializeAuditJson(safeAfter),
    metadata: serializeAuditJson(safeMetadata),
  });
}
