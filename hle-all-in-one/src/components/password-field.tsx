import { Check, X } from "lucide-react"
import { PASSWORD_RULES } from "@/lib/password"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Controlled password input with a live complexity checklist. The parent owns
// the value and gates submit on passwordIsValid(value).
export function PasswordField({
  id,
  name,
  label,
  value,
  onChange,
  autoFocus,
}: {
  id: string
  name: string
  label: string
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="new-password"
        autoFocus={autoFocus}
      />
      <ul className="space-y-1 pt-0.5">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(value)
          return (
            <li
              key={rule.label}
              className={cn(
                "flex items-center gap-1.5 text-xs transition-colors",
                ok
                  ? "text-emerald-600 dark:text-emerald-500"
                  : "text-muted-foreground"
              )}
            >
              {ok ? (
                <Check className="size-3.5 shrink-0" />
              ) : (
                <X className="size-3.5 shrink-0 opacity-50" />
              )}
              {rule.label}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
