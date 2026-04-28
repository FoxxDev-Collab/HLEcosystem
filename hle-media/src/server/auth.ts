import { parseCookies } from "./cookies";
import { SESSION_COOKIE, validateSession } from "./session";
import {
  HOUSEHOLD_COOKIE,
  isHouseholdAdmin,
  userBelongsToHousehold,
  type Household,
} from "./household";
import type { User } from "./users";

export type AuthContext = {
  user: User;
};

export type HouseholdContext = AuthContext & {
  householdId: string;
};

type Handler<C> = (req: Request, ctx: C) => Response | Promise<Response>;

const unauthorized = () =>
  Response.json({ error: "unauthorized" }, { status: 401 });

const forbidden = () =>
  Response.json({ error: "forbidden" }, { status: 403 });

/**
 * Wrap a route handler so it only runs for an authenticated user.
 * Resolves the user via the shared `hle_session` cookie + family_manager."Session".
 */
export function requireAuth(
  handler: Handler<AuthContext>,
): (req: Request) => Promise<Response> {
  return async (req) => {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (!token) return unauthorized();
    const user = await validateSession(token);
    if (!user) return unauthorized();
    return handler(req, { user });
  };
}

/**
 * Like requireAuth, but also requires `mv_household_id` cookie pointing to a
 * household the user is a member of. The chosen household is the tenant
 * boundary for every read and write below.
 */
export function requireHousehold(
  handler: Handler<HouseholdContext>,
): (req: Request) => Promise<Response> {
  return requireAuth(async (req, { user }) => {
    const householdId = parseCookies(req)[HOUSEHOLD_COOKIE];
    if (!householdId) {
      return Response.json({ error: "household_not_selected" }, { status: 409 });
    }
    if (!(await userBelongsToHousehold(user.id, householdId))) {
      return forbidden();
    }
    return handler(req, { user, householdId });
  });
}

/**
 * Like requireHousehold, but additionally requires the user be an ADMIN of
 * the household (HouseholdMember.role = 'ADMIN'). Used for destructive or
 * resource-heavy operations like library scans.
 */
export function requireHouseholdAdmin(
  handler: Handler<HouseholdContext>,
): (req: Request) => Promise<Response> {
  return requireHousehold(async (req, ctx) => {
    if (!(await isHouseholdAdmin(ctx.user.id, ctx.householdId))) {
      return forbidden();
    }
    return handler(req, ctx);
  });
}

export type { User, Household };
