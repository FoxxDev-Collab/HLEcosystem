"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  generateTotpAction,
  verifyAndEnableTotpAction,
  disableTotpAction,
} from "@/app/(app)/security/actions";

export function TotpSetup({
  enabled,
  userEmail,
}: {
  enabled: boolean;
  userEmail: string;
}) {
  if (enabled) {
    return <DisableTotp />;
  }
  return <EnableTotp />;
}

function EnableTotp() {
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(
    null
  );
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleBeginSetup = () => {
    startTransition(async () => {
      const result = await generateTotpAction();
      if (!result) return;
      setSetup(result);

      // Generate QR code client-side using a canvas approach
      try {
        const QRCode = (await import("qrcode")).default;
        const dataUrl = await QRCode.toDataURL(result.uri, {
          width: 200,
          margin: 2,
        });
        setQrDataUrl(dataUrl);
      } catch {
        // QR generation failed; user can enter secret manually
      }
    });
  };

  const handleVerify = (formData: FormData) => {
    startTransition(async () => {
      const result = await verifyAndEnableTotpAction(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  if (!setup) {
    return (
      <Button onClick={handleBeginSetup} disabled={isPending}>
        {isPending ? "Setting up..." : "Set up two-factor authentication"}
      </Button>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <p className="text-sm">
          Scan this QR code with your authenticator app:
        </p>
        {qrDataUrl && (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="TOTP QR Code"
              className="rounded-lg border"
              width={200}
              height={200}
            />
          </div>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Can&apos;t scan? Enter this key manually
          </summary>
          <code className="mt-2 block rounded bg-muted px-3 py-2 text-xs font-mono break-all">
            {setup.secret}
          </code>
        </details>
      </div>

      <form action={handleVerify} className="space-y-3">
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="totp-verify">
            Enter the 6-digit code from your app
          </Label>
          <Input
            id="totp-verify"
            name="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="000000"
            autoComplete="one-time-code"
            className="max-w-[200px] text-center text-lg tracking-widest"
            required
          />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Verifying..." : "Verify and enable"}
        </Button>
      </form>
    </div>
  );
}

function DisableTotp() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDisable = (formData: FormData) => {
    startTransition(async () => {
      const result = await disableTotpAction(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  if (!showConfirm) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Two-factor authentication is currently enabled. You&apos;ll need your
          authenticator app to sign in.
        </p>
        <Button
          variant="destructive"
          onClick={() => setShowConfirm(true)}
        >
          Disable two-factor authentication
        </Button>
      </div>
    );
  }

  return (
    <form action={handleDisable} className="space-y-3">
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="disable-password">
          Enter your password to confirm
        </Label>
        <Input
          id="disable-password"
          name="password"
          type="password"
          placeholder="Your password"
          className="max-w-sm"
          required
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" disabled={isPending}>
          {isPending ? "Disabling..." : "Confirm disable"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setShowConfirm(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
