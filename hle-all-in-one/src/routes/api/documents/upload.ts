import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { validateUpload } from "@/lib/file-validation"
import { saveFile } from "@/server/file-storage"
import {
  authenticateFileRequest,
  insertUploadedDocument,
} from "@/server/home-care/documents"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const optUuid = z
  .string()
  .max(40)
  .transform((v) => v.trim() || null)
  .refine((v) => v === null || UUID_RE.test(v), { message: "Invalid id" })

const fieldsSchema = z.object({
  type: z
    .enum(["MANUAL", "WARRANTY", "RECEIPT", "INVOICE", "PHOTO", "OTHER"])
    .catch("OTHER"),
  name: z
    .string()
    .max(255)
    .transform((v) => v.trim() || null),
  notes: z
    .string()
    .max(2000)
    .transform((v) => v.trim() || null),
  itemId: optUuid,
  vehicleId: optUuid,
  repairId: optUuid,
})

export const Route = createFileRoute("/api/documents/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateFileRequest()
        if (!auth.ok) return auth.response

        const formData = await request.formData()
        const file = formData.get("file")
        if (!(file instanceof File) || file.size === 0) {
          return Response.json({ error: "No file provided" }, { status: 400 })
        }

        const parsed = fieldsSchema.safeParse({
          type: String(formData.get("type") ?? "OTHER"),
          name: String(formData.get("name") ?? ""),
          notes: String(formData.get("notes") ?? ""),
          itemId: String(formData.get("itemId") ?? ""),
          vehicleId: String(formData.get("vehicleId") ?? ""),
          repairId: String(formData.get("repairId") ?? ""),
        })
        if (!parsed.success) {
          return Response.json({ error: "Invalid fields" }, { status: 400 })
        }
        const fields = parsed.data

        const buffer = new Uint8Array(await file.arrayBuffer())
        const validation = validateUpload({
          name: file.name,
          size: file.size,
          buffer,
          type: file.type,
        })
        if (!validation.valid) {
          return Response.json({ error: validation.error }, { status: 400 })
        }

        const { storagePath, contentHash, size } = await saveFile(
          auth.householdId,
          buffer,
          file.name
        )

        const document = await insertUploadedDocument(auth.householdId, {
          type: fields.type,
          name: fields.name || validation.sanitizedName,
          originalName: validation.sanitizedName,
          mimeType: validation.detectedMime,
          size,
          storagePath,
          contentHash,
          uploadedById: auth.userId,
          itemId: fields.itemId,
          vehicleId: fields.vehicleId,
          repairId: fields.repairId,
          notes: fields.notes,
        })

        return Response.json(
          { id: document.id, name: document.name, size: document.size },
          { status: 201 }
        )
      },
    },
  },
})
