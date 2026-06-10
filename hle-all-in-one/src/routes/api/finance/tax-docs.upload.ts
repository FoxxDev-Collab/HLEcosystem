import { createFileRoute } from "@tanstack/react-router"
import { extname } from "node:path"
import { validateUpload } from "@/lib/file-validation"
import { authenticateFileRequest } from "@/server/home-care/documents"
import {
  FINANCE_UPLOAD_EXTENSIONS,
  attachTaxDocumentFile,
} from "@/server/finance/taxes"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const Route = createFileRoute("/api/finance/tax-docs/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateFileRequest()
        if (!auth.ok) return auth.response

        const formData = await request.formData()
        const documentId = String(formData.get("documentId") ?? "")
        if (!UUID_RE.test(documentId)) {
          return Response.json(
            { error: "Invalid document id" },
            { status: 400 }
          )
        }

        const file = formData.get("file")
        if (!(file instanceof File) || file.size === 0) {
          return Response.json({ error: "No file provided" }, { status: 400 })
        }

        // Legacy allowlist on top of the shared blocklist + magic-byte check.
        if (!FINANCE_UPLOAD_EXTENSIONS.has(extname(file.name).toLowerCase())) {
          return Response.json(
            { error: "File type not allowed (PDF or image only)" },
            { status: 400 }
          )
        }

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

        // Household-scoped lookup inside — the scope IS the authz check.
        const result = await attachTaxDocumentFile(
          auth.householdId,
          documentId,
          {
            buffer,
            originalName: validation.sanitizedName,
          }
        )
        if ("error" in result) {
          return Response.json(result, { status: 404 })
        }
        return Response.json({ ok: true }, { status: 201 })
      },
    },
  },
})
