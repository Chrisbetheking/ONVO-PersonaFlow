import type { ConnectionMode, RoleSpace, WorkspaceResponse } from "../types";

export function applyOptimisticRole(
  workspace: WorkspaceResponse,
  role: RoleSpace,
  updatedAt = new Date().toISOString(),
): WorkspaceResponse {
  return {
    ...workspace,
    enterprise: {
      ...workspace.enterprise,
      enterprise_meta: {
        ...workspace.enterprise.enterprise_meta,
        current_role: role,
        updated_at: updatedAt,
      },
    },
  };
}

export function connectionModeAfterRequestFailure(
  current: ConnectionMode,
): ConnectionMode {
  return current === "local_demo" ? "local_demo" : "stale_online";
}
