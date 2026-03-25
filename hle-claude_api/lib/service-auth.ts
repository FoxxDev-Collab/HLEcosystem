import { NextResponse } from "next/server";

type ServiceAuthResult =
  | { valid: true; app: string }
  | { valid: false; response: NextResponse };

export function validateServiceAuth(request: Request): ServiceAuthResult {
  const expectedSecret = process.env.CLAUDE_API_SERVICE_SECRET;
  if (!expectedSecret) {
    return {
      valid: false,
      response: NextResponse.json(
        { success: false, error: "Service not configured", code: "NOT_CONFIGURED" },
        { status: 503 }
      ),
    };
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return {
      valid: false,
      response: NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      ),
    };
  }

  const app = request.headers.get("X-Requesting-App");
  if (!app) {
    return {
      valid: false,
      response: NextResponse.json(
        { success: false, error: "Missing X-Requesting-App header", code: "BAD_REQUEST" },
        { status: 400 }
      ),
    };
  }

  return { valid: true, app };
}
