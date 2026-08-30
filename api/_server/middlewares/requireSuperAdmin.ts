// See the comment in requireAuth.ts for why Express's own request/response
// types are avoided here.
interface MinimalRequest {
  adminRole?: "super_admin" | "admin";
}
interface MinimalResponse {
  status: (code: number) => MinimalResponse;
  json: (body: unknown) => MinimalResponse;
}
type NextFn = (err?: unknown) => void;

// Must run AFTER requireAuth (which populates req.adminRole).
export function requireSuperAdmin(req: MinimalRequest, res: MinimalResponse, next: NextFn): void {
  if (req.adminRole !== "super_admin") {
    res.status(403).json({ error: "Super admin access required" });
    return;
  }
  next();
}
