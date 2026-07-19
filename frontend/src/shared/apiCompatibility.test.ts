import { describe, expect, it } from "vitest";
import {
  assertSchemaCompatibility,
  EXPECTED_API_SCHEMA_VERSION,
} from "./apiCompatibility";

describe("API schema compatibility", () => {
  it("accepts schema v1 and rejects mismatched deployments", () => {
    expect(assertSchemaCompatibility(EXPECTED_API_SCHEMA_VERSION)).toBe(true);
    expect(() => assertSchemaCompatibility("0")).toThrow(/API 版本不兼容/);
    expect(() => assertSchemaCompatibility(undefined)).toThrow(/未知/);
  });
});
