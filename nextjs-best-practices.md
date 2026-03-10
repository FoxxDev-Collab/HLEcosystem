# Next.js Best Practices — FoxxLab Reference Guide

> **Version:** 3.0 — February 2026
> **Target:** Next.js 15.x / 16.x with App Router
> **Stack:** Next.js (full-stack) + shadcn/ui + Prisma + Tailwind CSS
> **Auth:** Authentik SSO across all apps
> **Database:** Centralized PostgreSQL 16 (schema-per-app via Prisma)
> **Deployment:** Next.js standalone output, one process per app

---

## Table of Contents

1. [Project Structure & Organization](#1-project-structure--organization)
2. [App Router Architecture](#2-app-router-architecture)
3. [Server vs Client Components](#3-server-vs-client-components)
4. [Rendering Strategies](#4-rendering-strategies)
5. [Caching — The Mental Model](#5-caching--the-mental-model)
6. [Data Fetching Patterns](#6-data-fetching-patterns)
7. [Server Actions & Mutations](#7-server-actions--mutations)
8. [Prisma — Database Access Layer](#8-prisma--database-access-layer)
9. [TypeScript — Non-Negotiable](#9-typescript--non-negotiable)
10. [Security Best Practices](#10-security-best-practices)
11. [Authentication — Authentik SSO](#11-authentication--authentik-sso)
12. [Performance Optimization](#12-performance-optimization)
13. [State Management](#13-state-management)
14. [Styling & UI — shadcn/ui](#14-styling--ui--shadcnui)
15. [Error Handling & Loading States](#15-error-handling--loading-states)
16. [Linting, Formatting & Code Quality](#16-linting-formatting--code-quality)
17. [Testing Strategy](#17-testing-strategy)
18. [Deployment & Self-Hosting](#18-deployment--self-hosting)
19. [Environment Variables](#19-environment-variables)
20. [Turbopack](#20-turbopack)
21. [Common Pitfalls & Gotchas](#21-common-pitfalls--gotchas)
22. [FoxxLab Ecosystem — Template Strategy](#22-foxxlab-ecosystem--template-strategy)
23. [Why This Stack](#23-why-this-stack)

---

## 1. Project Structure & Organization

### Why This Matters

A predictable structure means you (and future-you at 11 PM) can find anything in seconds. Next.js is unopinionated about organization, but being consistent is what separates a maintainable project from a nightmare. This matters even more when you're building multiple apps from the same template — muscle memory transfers across projects.

### Recommended Layout

```
my-app/
├── src/
│   ├── app/                    # App Router — routing ONLY lives here
│   │   ├── (auth)/             # Route Group — no URL impact, shares auth layout
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (app)/              # Authenticated app routes
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── loading.tsx
│   │   │   │   └── error.tsx
│   │   │   ├── layout.tsx      # App shell: sidebar + header
│   │   │   └── [...routes]/
│   │   ├── api/                # API Route Handlers (webhooks, external integrations)
│   │   │   └── auth/[...nextauth]/
│   │   │       └── route.ts
│   │   ├── layout.tsx          # Root layout (required)
│   │   ├── page.tsx            # Landing / redirect
│   │   ├── not-found.tsx       # Custom 404
│   │   └── global-error.tsx    # Global error boundary
│   ├── components/             # Shared UI components
│   │   ├── ui/                 # shadcn primitives (button, card, input, etc.)
│   │   ├── forms/              # Form-specific components
│   │   ├── layouts/            # Sidebar, header, mobile nav
│   │   └── shared/             # Data tables, page headers, empty states
│   ├── lib/                    # Utilities, helpers, shared logic
│   │   ├── prisma.ts           # Prisma client singleton
│   │   ├── auth.ts             # Authentik / Auth.js configuration
│   │   ├── utils.ts            # cn() helper, formatters
│   │   └── constants.ts        # App-wide constants
│   ├── actions/                # Server Actions (organized by domain)
│   │   ├── expenses.ts         # createExpense, updateExpense, deleteExpense
│   │   └── categories.ts       # CRUD for categories
│   ├── hooks/                  # Custom React hooks
│   ├── types/                  # TypeScript type definitions
│   ├── styles/                 # Global styles
│   └── config/                 # App configuration, navigation
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── migrations/             # Migration history
├── public/                     # Static assets
├── next.config.ts              # Next.js configuration
├── tailwind.config.ts          # Tailwind configuration
├── tsconfig.json               # TypeScript configuration
├── components.json             # shadcn/ui configuration
├── .env.local                  # Local environment variables (git-ignored)
├── .env.example                # Template for environment variables (committed)
└── package.json
```

### Key Principles

**Keep `app/` for routing only.** The `app/` directory defines your URL structure. Don't dump components, utilities, or business logic in here. Use `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, and `route.ts` — that's it.

**Server Actions get their own directory.** `src/actions/` keeps your mutation logic organized by domain. This is your data access layer — it replaces the need for a separate backend.

**Why `src/`?** It cleanly separates application code from config files at the root. Next.js natively supports `src/app/` with zero configuration. Every config file (`next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `prisma/`) stays at root where tools expect them.

**Route Groups `(name)/` are free organization.** Parentheses in folder names create logical groupings without affecting the URL. Use `(auth)` for login/callback pages with a centered layout, and `(app)` for authenticated routes with the sidebar layout.

**Use TypeScript path aliases:**

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Now every import is `@/components/ui/Button` — clean and absolute.

---

## 2. App Router Architecture

### Why App Router

The App Router (introduced in Next.js 13, matured in 15/16) is the only actively developed routing system. Every new Next.js feature targets it. For a pure Next.js full-stack app, it gives you everything:

- **React Server Components by default** — less JavaScript shipped to the browser.
- **Nested layouts that persist** — sidebar/header stays mounted across navigation.
- **Streaming with Suspense** — send the shell immediately, stream in data.
- **Server Actions** — mutate data directly from components, no API routes needed.
- **Collocated data fetching** — fetch data right where you use it with Prisma.

### Special Files

Each route segment can define behavior through convention-named files:

| File | Purpose | When It Renders |
|------|---------|-----------------|
| `page.tsx` | The UI for this route | When the URL matches |
| `layout.tsx` | Shared wrapper for this segment and children | Persists across child navigation |
| `loading.tsx` | Suspense fallback | While `page.tsx` is resolving async data |
| `error.tsx` | Error boundary (must be `'use client'`) | When `page.tsx` or children throw |
| `not-found.tsx` | 404 UI | When `notFound()` is called |
| `route.ts` | API endpoint (Route Handler) | HTTP requests to this path |

### Layouts — The Killer Feature

Layouts are persistent. When a user navigates from `/dashboard` to `/expenses`, the `(app)/layout.tsx` **does not re-render**. This means:

- Sidebar state (scroll position, open/closed sections) survives navigation.
- No unnecessary re-fetches for shared data.
- Animations and transitions feel native.

```tsx
// src/app/(app)/layout.tsx
import { AppSidebar } from "@/components/layouts/app-sidebar";
import { AppHeader } from "@/components/layouts/app-header";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen">
      <AppSidebar user={session.user} />
      <div className="flex flex-col flex-1">
        <AppHeader user={session.user} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

**Important caveat:** Because layouts don't re-render on navigation, `searchParams` aren't available in layouts. If you need URL-reactive UI in a layout, use a Client Component that reads from `useSearchParams()`.

### Route Groups for Layout Control

```
src/app/
├── (auth)/               # Centered card layout — login, callback
│   ├── layout.tsx
│   └── login/
│       └── page.tsx
├── (app)/                # Sidebar layout — authenticated app
│   ├── layout.tsx
│   ├── dashboard/
│   │   └── page.tsx      # /dashboard
│   ├── expenses/
│   │   └── page.tsx      # /expenses
│   └── settings/
│       └── page.tsx      # /settings
```

Same root URL structure, completely different layouts, zero naming conflicts.

---

## 3. Server vs Client Components

### The Golden Rule

**Server Components are the default. Client Components are the exception.**

Every `.tsx` file in the App Router is a Server Component unless you explicitly add `'use client'` at the top. This is intentional:

| | Server Component | Client Component |
|---|---|---|
| Runs where | Server only | Server (SSR) + Browser |
| JavaScript to browser | Zero | Full component bundle |
| Can access Prisma/DB | Yes — directly | No — must use Server Action or API |
| Can use hooks/state | No | Yes |
| Can use browser APIs | No | Yes |

### When to Use `'use client'`

Only add `'use client'` when you **need interactivity**:

- `useState`, `useReducer`, `useEffect`, `useRef`, or any React hook
- Event handlers (`onClick`, `onChange`, `onSubmit`)
- Browser APIs (`window`, `localStorage`, `navigator`)
- Third-party libraries that use hooks or browser APIs

### Push the Boundary Down

Don't slap `'use client'` on a page component because one button needs an `onClick`. Extract the interactive part:

```tsx
// ❌ BAD — entire page becomes a Client Component
"use client";
export default function ExpensesPage() {
  const [filter, setFilter] = useState("");
  // Now you can't use Prisma directly here...
  return <div>...</div>;
}

// ✅ GOOD — page is Server Component, only filter is client
// src/app/(app)/expenses/page.tsx (Server Component)
import { prisma } from "@/lib/prisma";
import { ExpenseTable } from "@/components/expense-table";
import { ExpenseFilters } from "@/components/expense-filters"; // 'use client'

export default async function ExpensesPage() {
  const expenses = await prisma.expense.findMany({
    orderBy: { date: "desc" },
    take: 50,
  });

  return (
    <div>
      <ExpenseFilters />
      <ExpenseTable data={expenses} />
    </div>
  );
}
```

### Composition Pattern — Server Children in Client Parents

Client Components can receive Server Components as `children`:

```tsx
// ClientWrapper.tsx — 'use client'
"use client";
export function Collapsible({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  return isOpen ? <div>{children}</div> : null;
}

// page.tsx — Server Component
import { Collapsible } from "./Collapsible";
import { ServerContent } from "./ServerContent";

export default function Page() {
  return (
    <Collapsible>
      <ServerContent /> {/* Rendered on server, passed as children */}
    </Collapsible>
  );
}
```

---

## 4. Rendering Strategies

### How Next.js Decides

In the App Router, rendering is **automatic based on what your code does**:

- **Static by default** — if your page doesn't use dynamic APIs, it's statically rendered at build time.
- **Becomes dynamic** when you use: `cookies()`, `headers()`, `searchParams`, `connection()`, or uncached data access.

You can override with route segment config:

```tsx
// Force dynamic (always SSR — good for dashboards with live data)
export const dynamic = "force-dynamic";

// ISR — regenerate every 60 seconds
export const revalidate = 60;
```

### For Your Homelab Apps

Since you're running a full Next.js server, you get the complete rendering toolkit:

| Strategy | When to Use | Example |
|----------|-------------|---------|
| **Static (SSG)** | Content that rarely changes | Settings pages, about/help |
| **ISR** | Content that changes periodically | Dashboard summary stats |
| **Dynamic (SSR)** | User-specific or real-time data | Expense lists, health records |
| **Client-side** | Interactive real-time updates | Search-as-you-type, live stats |

Most of your family app pages will be **dynamic** because they read from the database per-request with Prisma. This is fine — the pages are behind auth and data should always be fresh.

---

## 5. Caching — The Mental Model

### Next.js 15+ Defaults

Next.js 14 cached everything by default and confused everyone. **Next.js 15 flipped this:** nothing is cached unless you explicitly opt in.

- `fetch()` is **not cached** by default.
- Pages are dynamic by default unless they qualify for static rendering.
- Router Cache `staleTime` for pages is `0`.

### The Four Cache Layers

| Layer | What It Caches | How to Control |
|-------|---------------|----------------|
| **Request Memoization** | Duplicate calls in one render | `React.cache()` for Prisma |
| **Data Cache** | fetch() responses across requests | `next: { revalidate: 60 }` |
| **Full Route Cache** | Rendered HTML + RSC payload | `export const revalidate = N` |
| **Router Cache** | Prefetched routes in browser | Automatic, clears on refresh |

### Prisma and Caching

Prisma queries don't go through `fetch()`, so the Data Cache doesn't apply. Use `React.cache()` for request-level deduplication:

```tsx
import { cache } from "react";
import { prisma } from "@/lib/prisma";

// Deduplicates within a single request — only one DB query
export const getUser = cache(async (userId: string) => {
  return prisma.user.findUnique({ where: { id: userId } });
});
```

### Practical Take

For most homelab app pages: **don't cache.** Your PostgreSQL is on the same network. The overhead is negligible compared to the confusion of stale data.

---

## 6. Data Fetching Patterns

### Server Component + Prisma (The Default)

```tsx
// src/app/(app)/expenses/page.tsx
import { prisma } from "@/lib/prisma";

export default async function ExpensesPage() {
  const expenses = await prisma.expense.findMany({
    include: { category: true },
    orderBy: { date: "desc" },
  });

  return <ExpenseTable data={expenses} />;
}
```

No API route. No fetch call. No loading state boilerplate. Data is there when the page renders.

### Client-Side Fetching (When You Need It)

For interactive data that refreshes without page navigation:

```tsx
"use client";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function LiveStats() {
  const { data, error, isLoading } = useSWR("/api/stats", fetcher, {
    refreshInterval: 5000,
  });

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorDisplay error={error} />;
  return <StatsGrid data={data} />;
}
```

For client-side fetching, create API Route Handlers:

```tsx
// src/app/api/stats/route.ts
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const stats = await prisma.expense.aggregate({
    where: { userId: session.user.id },
    _sum: { amount: true },
    _count: true,
  });

  return Response.json(stats);
}
```

### Rule of Thumb

- **Page load data?** → Server Component + Prisma directly
- **Live updates without navigation?** → Client SWR + API Route Handler
- **User-triggered mutation?** → Server Action

---

## 7. Server Actions & Mutations

### What They Are

Server Actions are async functions that run on the server, called directly from components. They replace the pattern of creating API routes for every form submission. **This is your primary mutation pattern.**

```tsx
// src/actions/expenses.ts
"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ExpenseSchema = z.object({
  description: z.string().min(1).max(200),
  amount: z.number().positive().max(100000),
  categoryId: z.string().cuid(),
  date: z.string().datetime(),
});

export async function createExpense(formData: FormData) {
  // 1. Authenticate
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  // 2. Validate
  const parsed = ExpenseSchema.safeParse({
    description: formData.get("description"),
    amount: parseFloat(formData.get("amount") as string),
    categoryId: formData.get("categoryId"),
    date: formData.get("date"),
  });

  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten() };
  }

  // 3. Create
  await prisma.expense.create({
    data: { ...parsed.data, userId: session.user.id },
  });

  // 4. Revalidate the page
  revalidatePath("/expenses");
}

export async function deleteExpense(id: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  // Verify ownership
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense || expense.userId !== session.user.id) {
    throw new Error("Not found");
  }

  await prisma.expense.delete({ where: { id } });
  revalidatePath("/expenses");
}
```

### With Client-Side UX (useActionState)

```tsx
"use client";
import { useActionState } from "react";
import { createExpense } from "@/actions/expenses";

export function ExpenseForm() {
  const [state, action, isPending] = useActionState(createExpense, null);

  return (
    <form action={action}>
      <input name="description" required />
      <input name="amount" type="number" step="0.01" required />
      {state?.error && <p className="text-red-500">{state.error}</p>}
      <button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Add Expense"}
      </button>
    </form>
  );
}
```

### Security — Every Action, Every Time

Server Actions compile to POST endpoints. Always: authenticate, validate (Zod), authorize (verify ownership).

---

## 8. Prisma — Database Access Layer

### Why Prisma

Type-safe database access with auto-generated TypeScript types from your schema. Change a column → TypeScript catches every mismatch at compile time.

### Prisma Client Singleton

Next.js hot-reloads in dev, creating new clients on every reload. This prevents connection pool exhaustion:

```tsx
// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### Schema-Per-App

Each app connects to the same PostgreSQL instance with its own schema:

```bash
# Finance.App
DATABASE_URL="postgresql://finance_app:pass@postgres.foxxlab.local:5432/foxxlab?schema=finance"

# FamilyHub.App
DATABASE_URL="postgresql://familyhub_app:pass@postgres.foxxlab.local:5432/foxxlab?schema=familyhub"
```

Each app gets its own database role limited to its own schema. Databasemgr provisions these.

### Example Schema

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Expense {
  id          String   @id @default(cuid())
  description String
  amount      Float
  date        DateTime
  categoryId  String
  category    Category @relation(fields: [categoryId], references: [id])
  userId      String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId, date])
}

model Category {
  id       String    @id @default(cuid())
  name     String    @unique
  color    String?
  icon     String?
  expenses Expense[]
}
```

### Migration Workflow

```bash
npx prisma migrate dev --name add-expense-table   # Dev: create + apply
npx prisma migrate deploy                          # Prod: apply only
npx prisma generate                                # Regenerate types
npx prisma studio                                  # GUI browser
```

---

## 9. TypeScript — Non-Negotiable

### Configuration

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "strict": true,
    "noEmit": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  }
}
```

**`strict: true` is mandatory.** Without it, TypeScript isn't doing its job.

### Prisma Types Are Free

```tsx
import type { Expense, Category } from "@prisma/client";

// With relations
import type { Prisma } from "@prisma/client";
type ExpenseWithCategory = Prisma.ExpenseGetPayload<{
  include: { category: true };
}>;
```

---

## 10. Security Best Practices

### Environment Variables

```bash
# .env.local (git-ignored)
DATABASE_URL="postgresql://finance_app:pass@postgres.foxxlab.local:5432/foxxlab?schema=finance"
AUTHENTIK_CLIENT_SECRET="your-secret"
NEXTAUTH_SECRET="random-32-char-string"

# NEXT_PUBLIC_ = exposed to browser (no secrets!)
NEXT_PUBLIC_APP_NAME="FoxxLab Finance"
```

### Server Action Pattern (Every Action)

```tsx
"use server";
import { z } from "zod";
import { auth } from "@/lib/auth";

export async function updateProfile(formData: FormData) {
  const session = await auth();                    // 1. Authenticate
  if (!session) throw new Error("Unauthorized");

  const schema = z.object({ name: z.string().min(1).max(100) });
  const parsed = schema.safeParse({                // 2. Validate
    name: formData.get("name"),
  });
  if (!parsed.success) return { error: "Invalid input" };

  // 3. Authorize (verify ownership) → 4. Execute
}
```

### Keep Next.js Patched

The December 2025 CVSS 10.0 RCE vulnerability (CVE-2025-55182 / CVE-2025-66478) affected all App Router applications. Always update:

```bash
npm audit
npm install next@latest react@latest react-dom@latest
```

---

## 11. Authentication — Authentik SSO

### Auth.js (NextAuth v5) + Authentik

```bash
npm install next-auth@beta @auth/prisma-adapter
```

```tsx
// src/lib/auth.ts
import NextAuth from "next-auth";
import Authentik from "next-auth/providers/authentik";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Authentik({
      clientId: process.env.AUTHENTIK_CLIENT_ID!,
      clientSecret: process.env.AUTHENTIK_CLIENT_SECRET!,
      issuer: process.env.AUTHENTIK_ISSUER!,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
```

```tsx
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

### Route Protection

```tsx
// src/app/(app)/layout.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  return <>{children}</>;
}
```

### Authentik Setup Per App

For each app, create an OAuth2/OIDC Provider:
- **Client ID:** `finance-app`, `familyhub-app`, etc.
- **Redirect URI:** `https://finance.foxxlab.local/api/auth/callback/authentik`
- **Scopes:** `openid profile email`

---

## 12. Performance Optimization

### Image Optimization

```tsx
import Image from "next/image";
<Image src="/photo.jpg" alt="Photo" width={800} height={600} priority={false} />
```

### Code Splitting

```tsx
import dynamic from "next/dynamic";
const Chart = dynamic(() => import("@/components/chart"), {
  loading: () => <ChartSkeleton />,
  ssr: false,
});
```

### Font Optimization

```tsx
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
```

`next/font` self-hosts fonts — no external requests.

---

## 13. State Management

### You Probably Don't Need a Library

| Need | Solution |
|------|----------|
| Local state | `useState` |
| Complex local state | `useReducer` |
| Server data on page load | Server Component + Prisma |
| Server data that updates live | SWR or TanStack Query |
| URL state (filters, pagination) | `useSearchParams` |
| Form state | `useActionState` with Server Actions |
| Global client state (rare) | Zustand if you truly need it |

### URL as State

```tsx
"use client";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

export function ExpenseFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    value ? params.set(key, value) : params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={searchParams.get("category") || "all"}
      onChange={(e) => updateFilter("category", e.target.value)}
    >
      <option value="all">All Categories</option>
      <option value="groceries">Groceries</option>
    </select>
  );
}
```

---

## 14. Styling & UI — shadcn/ui

### Why shadcn/ui Is Perfect

It **copies component source files into your project.** You own them, customize them, and every ecosystem app uses the same base.

```bash
npx shadcn@latest init
npx shadcn@latest add button card input table dialog form select sidebar sheet toast
```

### Shared Theme

All FoxxLab apps share the same `globals.css`. Change the primary color once → every app inherits it.

```css
@layer base {
  :root {
    --primary: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
    /* ... */
  }
  .dark {
    --primary: 217.2 91.2% 59.8%;
    /* ... */
  }
}
```

### Dark Mode

```bash
npm install next-themes
```

```tsx
// Root layout
import { ThemeProvider } from "@/components/theme-provider";
<ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
  {children}
</ThemeProvider>
```

---

## 15. Error Handling & Loading States

### Error Boundary

```tsx
// src/app/(app)/expenses/error.tsx
"use client";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center p-8">
      <h2 className="text-xl font-bold text-destructive">Something went wrong</h2>
      <p className="mt-2 text-muted-foreground">{error.message}</p>
      <Button onClick={reset} className="mt-4">Try Again</Button>
    </div>
  );
}
```

### Loading State

```tsx
// src/app/(app)/expenses/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
```

### Streaming with Suspense

```tsx
import { Suspense } from "react";
export default function DashboardPage() {
  return (
    <div>
      <Suspense fallback={<StatsSkeleton />}>
        <StatsOverview />
      </Suspense>
      <Suspense fallback={<ChartSkeleton />}>
        <ExpenseChart />
      </Suspense>
    </div>
  );
}
```

---

## 16. Linting, Formatting & Code Quality

```json
// .eslintrc.json
{ "extends": ["next/core-web-vitals", "next/typescript"] }
```

```json
// .prettierrc
{ "semi": true, "trailingComma": "all", "singleQuote": false, "tabWidth": 2, "printWidth": 100 }
```

```bash
npm install --save-dev prettier eslint-config-prettier husky lint-staged
```

---

## 17. Testing Strategy

| Priority | What | Why |
|----------|------|-----|
| High | Server Actions | Your mutation layer — auth + validation |
| High | Prisma queries | Validates data access patterns |
| Medium | Complex utilities | Math, dates, transformations |
| Low | Static UI | Low ROI |

Stack: **Vitest** + **React Testing Library** + **Playwright** (E2E).

---

## 18. Deployment & Self-Hosting

### Standalone Output

```ts
// next.config.ts
const nextConfig: NextConfig = {
  output: "standalone",
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
};
```

### systemd Service

```ini
[Unit]
Description=FoxxLab Finance App
After=network-online.target

[Service]
Type=simple
User=finance
WorkingDirectory=/opt/finance-app
ExecStart=/usr/bin/node /opt/finance-app/.next/standalone/server.js
Restart=always
Environment=NODE_ENV=production
Environment=PORT=3001
EnvironmentFile=/etc/finance-app/.env

[Install]
WantedBy=multi-user.target
```

### Podman Container

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
COPY prisma ./prisma
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "server.js"]
```

### NGINX Reverse Proxy

```nginx
server {
    listen 443 ssl;
    server_name finance.foxxlab.local;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /_next/static/ {
        proxy_pass http://127.0.0.1:3001;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## 19. Environment Variables

### Per-App Pattern

```bash
# Finance.App .env
DATABASE_URL="postgresql://finance_app:pass@postgres.foxxlab.local:5432/foxxlab?schema=finance"
AUTHENTIK_CLIENT_ID="finance-app"
AUTHENTIK_CLIENT_SECRET="..."
AUTHENTIK_ISSUER="https://auth.foxxlab.local/application/o/finance-app/"
NEXTAUTH_SECRET="random-32-chars"
NEXTAUTH_URL="https://finance.foxxlab.local"
```

Same structure across every app, different credentials and schemas.

---

## 20. Turbopack

Default bundler in Next.js 16. Faster dev startup, near-instant HMR, 2-5x faster builds. No configuration needed. Fallback: `next build --webpack`.

---

## 21. Common Pitfalls & Gotchas

1. **`'use client'` doesn't mean client-only** — it still SSR renders, it just ships JS to the browser too.
2. **Layouts don't re-render on navigation** — put per-page data in `page.tsx`, not `layout.tsx`.
3. **Cannot import Prisma in Client Components** — Prisma is server-only. Use Server Actions or API Routes.
4. **Caching differs dev vs prod** — always test with `next build && next start`.
5. **`params` are async in Next.js 15+** — `const { id } = await params;`
6. **Middleware is NOT sufficient for auth** — always check session in layouts/actions (CVE-2025-29927).
7. **Prisma singleton is required** — without it, hot reload exhausts connection pools.
8. **Keep dependencies lean** — `Intl.DateTimeFormat`, `crypto.randomUUID()`, `structuredClone()` before reaching for npm packages.

---

## 22. FoxxLab Ecosystem — Template Strategy

### The Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Authentik (SSO)                             │
│                       OIDC/OAuth2 Provider                          │
└──────────────────────────────────────────────────────────────────────┘
                                 │
     ┌───────────────┬───────────┼───────────┬───────────────┐
     ▼               ▼           ▼           ▼               ▼
┌──────────┐  ┌──────────┐ ┌──────────┐ ┌──────────┐  ┌──────────┐
│ Finance  │  │ FamilyHub│ │ Health   │  │  Home    │  │Household │
│  .App    │  │  .App    │ │ Tracker  │  │ Manager  │  │  Ops     │
│ Next.js  │  │ Next.js  │ │ Next.js  │  │ Next.js  │  │ Next.js  │
│ Prisma   │  │ Prisma   │ │ Prisma   │  │ Prisma   │  │ Prisma   │
└────┬─────┘  └────┬─────┘ └────┬─────┘  └────┬─────┘  └────┬─────┘
     │              │            │              │              │
     └──────────────┴────────────┼──────────────┴──────────────┘
                                 ▼
                    ┌───────────────────────┐
                    │    PostgreSQL 16      │
                    │  (Schema per App)     │
                    └───────────────────────┘
```

### The Five Family App Pillars

| App | Purpose | Key Features |
|-----|---------|-------------|
| **Finance.App** | Budget, expenses, net worth | Mobile-first expense entry, asset tracking, subscriptions |
| **FamilyHub.App** | Relations, gifts, contacts | Important dates, gift history, wishlists, communication log |
| **HealthTracker.App** | Medical records, appointments | Vaccinations, medications, emergency info |
| **HomeManager.App** | Property, maintenance, inventory | Maintenance schedules, warranties, car care |
| **HouseholdOps.App** | Chores, grocery, daily tasks | Task rotation, grocery lists, family calendar |

### Template Repository

```
foxxlab-app-template/
├── src/
│   ├── app/
│   │   ├── (auth)/               # Login/callback (centered layout)
│   │   │   ├── login/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (app)/                # Authenticated routes (sidebar layout)
│   │   │   ├── dashboard/page.tsx
│   │   │   └── layout.tsx        # Auth check + app shell
│   │   ├── api/auth/[...nextauth]/route.ts
│   │   ├── layout.tsx            # Root (font, theme)
│   │   └── page.tsx              # Redirect → /dashboard or /login
│   ├── actions/                  # Server Actions by domain
│   ├── components/
│   │   ├── ui/                   # shadcn (shared across all apps)
│   │   ├── layouts/
│   │   │   ├── app-sidebar.tsx   # Responsive sidebar + mobile sheet
│   │   │   └── app-header.tsx    # Header with user menu
│   │   └── shared/
│   │       ├── data-table.tsx    # Reusable table
│   │       ├── page-header.tsx
│   │       └── empty-state.tsx
│   ├── lib/
│   │   ├── prisma.ts            # Singleton
│   │   ├── auth.ts              # Auth.js + Authentik
│   │   └── utils.ts             # cn(), formatters
│   ├── hooks/
│   ├── types/
│   ├── config/
│   │   └── navigation.ts        # App-specific sidebar links
│   └── styles/
│       └── globals.css           # Shared theme
├── prisma/
│   └── schema.prisma            # App-specific models
├── next.config.ts
├── tailwind.config.ts
├── components.json
├── .env.example
└── package.json
```

### Creating a New App

```bash
# 1. Clone template
git clone https://github.com/FoxxDev-Collab/foxxlab-app-template.git finance-app
cd finance-app

# 2. Install + add shadcn components
npm install
npx shadcn@latest add button card input table dialog form select

# 3. Configure
cp .env.example .env.local   # Set DATABASE_URL, AUTHENTIK_*, NEXTAUTH_*

# 4. Define Prisma schema, run migrations
npx prisma migrate dev --name init

# 5. Update navigation, build pages
npm run dev
```

### Port Assignments

| App | Port | Domain |
|-----|------|--------|
| Dashboard | 3000 | dashboard.foxxlab.local |
| Finance.App | 3001 | finance.foxxlab.local |
| FamilyHub.App | 3002 | familyhub.foxxlab.local |
| HealthTracker.App | 3003 | health.foxxlab.local |
| HomeManager.App | 3004 | home.foxxlab.local |
| HouseholdOps.App | 3005 | household.foxxlab.local |

### Mobile-First Sidebar (Template Default)

```tsx
"use client";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      {/* Desktop */}
      <aside className="hidden md:flex md:w-64 md:flex-col border-r">
        <SidebarContent />
      </aside>

      <div className="flex flex-col flex-1">
        {/* Mobile */}
        <header className="md:hidden flex items-center p-4 border-b">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SidebarContent />
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

---

## 23. Why This Stack

### The .NET Retrospective

The .NET 10 ASP/MVC ecosystem proved the app organization. Authentication worked. But Bootstrap in Razor views was a constant fight, Alpine.js felt bolted-on, and sharing UI across apps meant NuGet packages or fragile copy-paste.

### What Changed

| Pain Point | Solution |
|---|---|
| Bootstrap looks dated | shadcn/ui — modern, accessible, ownable |
| Alpine.js feels bolted-on | React IS the reactivity layer |
| Razor mixes logic and markup | Server/Client Components have clear boundaries |
| Sharing UI across apps is hard | shadcn copies source — consistent across all apps |
| Need separate API backend | Server Actions + Prisma = full-stack in one process |
| ORM story is weak | Prisma — type-safe, auto-generated types, migrations |

### What Carries Forward

- ✅ The family app organization (Finance, FamilyHub, Health, Home, Household)
- ✅ Authentik SSO across all apps
- ✅ Centralized PostgreSQL with schema-per-app
- ✅ Mobile-first, spouse-acceptance-factor priority
- ✅ Enterprise patterns at homelab scale

### The Simplicity Win

One framework. One language (TypeScript). One UI library (shadcn). One ORM (Prisma). One auth provider (Authentik). One database (PostgreSQL).

No backend/frontend split. No inter-process communication. No separate API server. Server Actions and Server Components mean your "backend" is just functions in the same codebase.

Each app is: `npm run build` → `node server.js` → running. That's it.

---

## Quick Reference

```bash
# New app from template
git clone https://github.com/FoxxDev-Collab/foxxlab-app-template.git my-app

# Development
npm run dev                    # Turbopack dev server
npm run build                  # Production build
npm run start                  # Production server
npm run lint                   # ESLint

# Prisma
npx prisma migrate dev         # Create + apply migration
npx prisma migrate deploy      # Apply in production
npx prisma generate            # Regenerate types
npx prisma studio              # Data browser

# shadcn/ui
npx shadcn@latest add button   # Add component
npx shadcn@latest diff         # Check for updates

# Security
npm audit
npm install next@latest react@latest react-dom@latest
```

---

## Appendix: next.config.ts

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
  reactCompiler: true,   // Next.js 16+ automatic memoization
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "auth.foxxlab.local", pathname: "/media/**" },
    ],
  },
};

export default nextConfig;
```

---

*Built for FoxxLab. Pure Next.js + shadcn/ui + Prisma. Covers: Finance.App, FamilyHub.App, HealthTracker.App, HomeManager.App, HouseholdOps.App, and Dashboard. Verified against Next.js 16.1 (Dec 2025).*
