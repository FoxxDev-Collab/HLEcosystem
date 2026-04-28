/**
 * Tiny typed fetch wrapper. Always `credentials: include` because every
 * request needs the `hle_session` and `mv_household_id` cookies.
 */
export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    let message = `${init.method ?? "GET"} ${path} → ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message += `: ${body.error}`;
    } catch {
      /* ignore — non-JSON body */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
