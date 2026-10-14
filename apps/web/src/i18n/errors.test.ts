import { ERROR_CODES } from "@howlsinthedark/shared";
import { describe, expect, it } from "vitest";
import es from "./locales/es.json";

describe("error texts", () => {
  it.each([...ERROR_CODES, "TIMEOUT"])("%s has a Spanish text", (code) => {
    expect(typeof (es.errors as Record<string, unknown>)[code]).toBe("string");
  });
});
