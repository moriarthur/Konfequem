import type { User } from "../types";

/**
 * True when the given auth user is an organization admin.
 * Tolerates the untyped AuthContext user and its brief null window
 * during cross-tab token adoption.
 */
export function isOrgAdmin(
  user: User | Record<string, unknown> | null | undefined
): boolean {
  return (user as User | null | undefined)?.role === "org_admin";
}
