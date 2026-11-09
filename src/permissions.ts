
import type { UserRole } from "./schema";

export type Permission =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "manageUsers"
  | "manageItems"
  | "manageSettings"
  | "refundAdvance"
  | "viewActivityLog"
  | "manageBackup";

const OWNER_PERMISSIONS: Permission[] = [
  "view",
  "create",
  "edit",
  "delete",
  "manageUsers",
  "manageItems",
  "manageSettings",
  "refundAdvance",
  "viewActivityLog",
  "manageBackup",
];

const STAFF_PERMISSIONS: Permission[] = [
  "view",
  "create",
];

export function hasPermission(
  role: UserRole,
  permission: Permission
): boolean {
  const permissions =
    role === "owner"
      ? OWNER_PERMISSIONS
      : STAFF_PERMISSIONS;

  return permissions.includes(permission);
}
