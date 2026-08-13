import "server-only";

/** The public surface (PLAN §5.3). */

export {
  listStaff,
  inviteStaff,
  changeRole,
  removeStaff,
  type StaffRoleValue,
  type StaffRow,
} from "./staff.service";
