/**
 * Bun.serve attaches `params` to the request object for parameterized
 * routes (e.g. `/api/foo/:id`). The DOM Request type does not declare
 * this property, so we widen it locally rather than polluting the global.
 */
export function param(req: Request, name: string): string | null {
  const params = (req as Request & { params?: Record<string, string> }).params;
  return params?.[name] ?? null;
}
