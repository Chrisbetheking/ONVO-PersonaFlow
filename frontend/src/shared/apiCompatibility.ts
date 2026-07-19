export const EXPECTED_API_SCHEMA_VERSION = "1";

export function assertSchemaCompatibility(actual: string | null | undefined) {
  if (actual !== EXPECTED_API_SCHEMA_VERSION) {
    throw new Error(
      `前后端 API 版本不兼容：前端需要 ${EXPECTED_API_SCHEMA_VERSION}，后端返回 ${actual || "未知"}。`,
    );
  }
  return true;
}
