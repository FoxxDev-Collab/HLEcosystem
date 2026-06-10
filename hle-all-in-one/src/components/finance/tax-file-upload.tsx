import { useRef, useState } from "react"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"

// Legacy components/tax-file-upload.tsx: hidden file input that uploads on
// pick. Posts to the finance tax-docs upload API route (magic-byte validated
// server-side).
export function TaxFileUpload({
  documentId,
  onUploaded,
}: {
  documentId: string
  onUploaded: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setError(null)
    setPending(true)
    try {
      const formData = new FormData()
      formData.set("documentId", documentId)
      formData.set("file", file)
      const res = await fetch("/api/finance/tax-docs/upload", {
        method: "POST",
        body: formData,
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        setError(body?.error ?? "Upload failed")
        return
      }
      onUploaded()
    } catch {
      setError("Upload failed")
    } finally {
      setPending(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.tiff,.heic"
        className="hidden"
        onChange={onPick}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-3" />
        {pending ? "Uploading…" : "Upload"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  )
}
