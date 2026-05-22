"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uploadImportAction, type UploadImportState } from "./actions";

type AccountOption = { id: string; name: string };

export function ImportForm({ accounts }: { accounts: AccountOption[] }) {
  const [state, formAction] = useActionState<UploadImportState, FormData>(
    uploadImportAction,
    {},
  );

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Account</Label>
          <Select name="accountId" defaultValue={accounts[0]?.id}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Format</Label>
          <Select name="format" defaultValue="WELLS_FARGO">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="WELLS_FARGO">Wells Fargo CSV</SelectItem>
              <SelectItem value="GENERIC">Generic CSV</SelectItem>
              <SelectItem value="OFX">OFX / QFX</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>File</Label>
          <Input name="file" type="file" accept=".csv,.ofx,.qfx" required />
        </div>
      </div>

      {state.error && (
        <p
          role="alert"
          className="text-sm text-destructive border border-destructive/40 bg-destructive/5 rounded-md px-3 py-2"
        >
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Upload className="size-4 mr-2" />
      {pending ? "Uploading..." : "Upload & Parse"}
    </Button>
  );
}
