import prisma from "./prisma";
import type { AuditAction } from "@prisma/client";

export async function logAudit(params: {
  householdId: string;
  userId: string;
  action: AuditAction;
  fileId?: string | null;
  folderId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
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
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch {
    console.error("Failed to write audit log", params.action);
  }
}

export function getClientIp(request: Request): string | null {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}
