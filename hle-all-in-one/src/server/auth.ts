import {
  deleteCookie,
  getCookie,
  getRequestHeader,
  setCookie,
} from "@tanstack/react-start/server"
import { validateSession } from "./session"
import type { ValidatedSession } from "./session"

const SESSION_COOKIE = "hle_session"
const MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export function readSessionToken(): string | undefined {
  return getCookie(SESSION_COOKIE)
}

// Secure flag: on in production unless COOKIE_SECURE=false explicitly opts
// out. The opt-out exists for LAN testing of the production container over
// plain http://<host-ip>:8100 — browsers accept Secure cookies on localhost
// but silently drop them on non-TLS remote origins, which breaks login with
// no visible error. Never set COOKIE_SECURE=false on an internet-facing
// deployment; anything public must terminate TLS (SC-8) and keep the default.
function cookieSecure(): boolean {
  if (process.env.COOKIE_SECURE === "false") return false
  return process.env.NODE_ENV === "production"
}

export function writeSessionCookie(token: string): void {
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    maxAge: MAX_AGE,
    path: "/",
  })
}

export function clearSessionCookie(): void {
  deleteCookie(SESSION_COOKIE, { path: "/" })
}

export async function currentSession(): Promise<ValidatedSession | null> {
  const token = readSessionToken()
  if (!token) return null
  return validateSession(token)
}

export function requestMeta(): {
  userAgent: string | null
  ipAddress: string | null
} {
  return {
    userAgent: getRequestHeader("user-agent") ?? null,
    ipAddress: getRequestHeader("x-forwarded-for") ?? null,
  }
}
