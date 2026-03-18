import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { AccountForm } from "@/components/account-form";
import { createAccountAction } from "../actions";

export default function NewAccountPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/accounts"><ArrowLeft className="size-4" /></Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">New Account</h1>
      </div>
      <AccountForm action={createAccountAction} submitLabel="Create Account" />
    </div>
  );
}
