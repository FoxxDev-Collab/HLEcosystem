import { createFileRoute } from "@tanstack/react-router"
import { fileExistsOnDisk, readFileStream } from "@/server/file-storage"
import { authenticateFileRequest } from "@/server/home-care/documents"
import { mimeFromFilename } from "@/server/finance/taxes"
import { getTripReceiptForServing } from "@/server/finance/trips"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const Route = createFileRoute(
  "/api/finance/trip-receipts/serve/$expenseId"
)({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const auth = await authenticateFileRequest()
        if (!auth.ok) return auth.response

        const { expenseId } = params
        if (!UUID_RE.test(expenseId)) {
          return new Response("Not found", { status: 404 })
        }

        // Household-scoped lookup (through FinanceTrip) — the scope IS the
        // authorization check.
        const receipt = await getTripReceiptForServing(
          auth.householdId,
          expenseId
        )
        if (!receipt) return new Response("Not found", { status: 404 })

        if (!(await fileExistsOnDisk(receipt.receiptPath))) {
          return new Response("File not found on disk", { status: 404 })
        }

        return new Response(readFileStream(receipt.receiptPath), {
          headers: {
            "Content-Type": mimeFromFilename(receipt.receiptFileName),
            "Content-Disposition": `inline; filename="${encodeURIComponent(receipt.receiptFileName)}"`,
            "Cache-Control": "private, max-age=3600",
          },
        })
      },
    },
  },
})
