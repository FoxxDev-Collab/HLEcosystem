import prisma from "./prisma";
import type { AuditAction } from "@prisma/client";

export async function logAudit(params: {
  householdId: string;
  userId: string;
  action: AuditAction;
  fileId?: string | null;
  folderId?: string | null;
  details?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        householdId: params.householdId,
        userId: params.userId,
        action: params.action,
        fileId: params.fileId ?? null,
        folderId: params.folderId ?? null,
        details: params.details ? JSON.stringify(params.details) : null,
      },
    });
  } catch {
    // Audit logging should never break the main operation
    console.error("Failed to write audit log", params.action);
  }
}
