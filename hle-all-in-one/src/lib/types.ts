// Hand-written row types for the raw-SQL (Bun.sql) data layer. Column casing
// matches the quoted camelCase columns in migrations/0001_init.sql, so Bun.sql
// rows map directly onto these shapes.

export type Role = "ADMIN" | "MEMBER"
export type HouseholdRole = "OWNER" | "MEMBER"

export type User = {
  id: string
  email: string
  firstName: string
  lastName: string
  password: string | null
  avatar: string | null
  role: Role
  active: boolean
  totpSecret: string | null
  totpEnabled: boolean
  createdAt: Date
  updatedAt: Date
}

// password + totpSecret stripped, `name` derived (firstName + lastName) — the
// only shape that leaves the server.
export type UserPublic = Omit<User, "password" | "totpSecret"> & {
  name: string
}

export type Household = {
  id: string
  name: string
  createdById: string | null
  createdAt: Date
  updatedAt: Date
}

export type Membership = {
  id: string
  householdId: string
  userId: string
  displayName: string
  role: HouseholdRole
  joinedAt: Date
}

// A household plus the current user's role in it (for the switcher + lists).
export type HouseholdWithRole = {
  id: string
  name: string
  role: HouseholdRole
}

// A household member joined to their user identity (for the members list).
export type MemberWithUser = {
  membershipId: string
  userId: string
  displayName: string
  role: HouseholdRole
  email: string
  name: string
  active: boolean
}

export type SessionInfo = {
  id: string
  userAgent: string | null
  ipAddress: string | null
  createdAt: Date
  expiresAt: Date
  current: boolean
}
