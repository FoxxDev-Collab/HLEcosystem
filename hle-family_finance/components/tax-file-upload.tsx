"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

export function TaxFileUpload({
  action,
  documentId,
  taxYearId,
}: {
  action: (formData: FormData) => Promise<void>;
  documentId: string;
  taxYearId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form ref={formRef} action={action}>
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="taxYearId" value={taxYearId} />
      <input
        ref={inputRef}
        type="file"
        name="file"
        accept=".pdf,.png,.jpg,.jpeg,.tiff,.heic"
        className="hidden"
        onChange={() => formRef.current?.requestSubmit()}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-3 mr-1" />
        Upload
      </Button>
    </form>
  );
}
