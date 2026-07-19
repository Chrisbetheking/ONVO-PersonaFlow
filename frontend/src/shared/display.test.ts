import { describe, expect, it } from "vitest";
import {
  entityDisplayName,
  internalStatusValues,
  statusLabel,
  statusTone,
} from "./display";

describe("status display mapping", () => {
  it("covers confirmed internal enums with Chinese labels", () => {
    const required = [
      "open",
      "pending_review",
      "high",
      "current",
      "superseded",
      "manager_assigned",
      "published",
    ];
    for (const value of required) {
      expect(internalStatusValues).toContain(value);
      expect(statusLabel(value)).not.toBe(value);
      expect(statusLabel(value)).not.toContain("_");
    }
  });

  it("uses semantic tones and hides unresolved entity ids", () => {
    expect(statusTone("verified")).toBe("success");
    expect(statusTone("needs_revalidation")).toBe("warning");
    expect(statusTone("failed")).toBe("danger");
    expect(
      entityDisplayName("advisor-1", [{ id: "advisor-1", name: "林悦" }]),
    ).toBe("林悦");
    expect(entityDisplayName("advisor-missing", [])).toBe("未识别对象");
  });
});
