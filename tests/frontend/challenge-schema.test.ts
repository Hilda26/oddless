import { describe, expect, it } from "vitest";
import { challengeFormSchema } from "@/lib/validation/challenge";

function validPayload(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    question: "Will Atlas publish Release Note A before cutoff?",
    sideALabel: "Yes",
    sideBLabel: "No",
    stakeGen: "1",
    acceptDeadline: new Date(now + 3_600_000).toISOString(),
    resolveAfter: new Date(now + 7_200_000).toISOString(),
    resolveBy: new Date(now + 14_400_000).toISOString(),
    sourceUrls: ["https://example.org/a", "https://example.net/b"],
    resolutionPolicy: "PRIORITY_ORDER",
    opponentAddress: "",
    ...overrides,
  };
}

describe("challengeFormSchema", () => {
  it("accepts a well-formed payload", () => {
    expect(challengeFormSchema.safeParse(validPayload()).success).toBe(true);
  });

  it("rejects identical side labels (case-insensitive)", () => {
    const result = challengeFormSchema.safeParse(validPayload({ sideALabel: "Red", sideBLabel: "red" }));
    expect(result.success).toBe(false);
  });

  it("rejects an accept deadline in the past", () => {
    const result = challengeFormSchema.safeParse(
      validPayload({ acceptDeadline: new Date(Date.now() - 1000).toISOString() }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects resolveAfter before acceptDeadline", () => {
    const now = Date.now();
    const result = challengeFormSchema.safeParse(
      validPayload({
        acceptDeadline: new Date(now + 7200_000).toISOString(),
        resolveAfter: new Date(now + 3600_000).toISOString(),
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects fewer than 2 or more than 4 sources", () => {
    expect(challengeFormSchema.safeParse(validPayload({ sourceUrls: ["https://example.org/a"] })).success).toBe(
      false,
    );
    expect(
      challengeFormSchema.safeParse(
        validPayload({
          sourceUrls: Array.from({ length: 5 }, (_, i) => `https://example${i}.org`),
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects an insecure (http) source", () => {
    const result = challengeFormSchema.safeParse(
      validPayload({ sourceUrls: ["http://example.org/a", "https://example.net/b"] }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a malformed opponent address", () => {
    const result = challengeFormSchema.safeParse(validPayload({ opponentAddress: "not-an-address" }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid stake amount", () => {
    const result = challengeFormSchema.safeParse(validPayload({ stakeGen: "0" }));
    expect(result.success).toBe(false);
  });
});
