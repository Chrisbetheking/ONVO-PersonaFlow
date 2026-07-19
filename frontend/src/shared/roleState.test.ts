import { describe, expect, it } from "vitest";
import { fallbackWorkspace } from "./demoData";
import {
  applyOptimisticRole,
  connectionModeAfterRequestFailure,
} from "./roleState";

describe("optimistic role switching", () => {
  it("changes the role immediately without waiting for a workspace refresh", () => {
    const changed = applyOptimisticRole(
      fallbackWorkspace,
      "manager",
      "2026-07-19T10:00:00Z",
    );
    expect(changed.enterprise.enterprise_meta.current_role).toBe("manager");
    expect(changed.enterprise.enterprise_meta.updated_at).toBe(
      "2026-07-19T10:00:00Z",
    );
    expect(changed.opportunities).toEqual(fallbackWorkspace.opportunities);
  });

  it("keeps remote failures stale online rather than silently entering local demo", () => {
    expect(connectionModeAfterRequestFailure("live")).toBe("stale_online");
    expect(connectionModeAfterRequestFailure("stale_online")).toBe(
      "stale_online",
    );
    expect(connectionModeAfterRequestFailure("local_demo")).toBe("local_demo");
  });
});
