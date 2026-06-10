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

export function writeSessionCookie(token: string): void {
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
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
