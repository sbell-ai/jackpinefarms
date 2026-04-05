import { db, platformAdminAuditLogsTable } from "@workspace/db";

export async function logAuditEvent(
  adminId: number | null,
  action: string,
  targetType?: string | null,
  targetId?: number | null,
  metadata?: Record<string, unknown> | null,
): Promise<void> {
  try {
    await db.insert(platformAdminAuditLogsTable).values({
      adminId:    adminId ?? null,
      action,
      targetType: targetType ?? null,
      targetId:   targetId ?? null,
      metadata:   metadata ?? null,
    });
  } catch {
    // Audit logging must never crash the primary request
  }
}
