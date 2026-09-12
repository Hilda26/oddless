import { describe, expect, it } from "vitest";
import {
  parseGenToWei,
  parseGenToWeiAllowZero,
  formatWeiToGen,
  doubleWei,
  InvalidGenAmountError,
} from "@/lib/validation/gen";

describe("parseGenToWei (BigInt-safe, no floating point)", () => {
  it("parses a whole number", () => {
    expect(parseGenToWei("1")).toBe(1_000_000_000_000_000_000n);
  });

  it("parses a decimal", () => {
    expect(parseGenToWei("1.5")).toBe(1_500_000_000_000_000_000n);
  });

  it("parses a value with the max 18 fractional digits exactly", () => {
    expect(parseGenToWei("0.000000000000000001")).toBe(1n);
  });

  it("rejects more than 18 fractional digits", () => {
    expect(() => parseGenToWei("0.0000000000000000001")).toThrow(InvalidGenAmountError);
  });

  it("rejects zero", () => {
    expect(() => parseGenToWei("0")).toThrow(InvalidGenAmountError);
  });

  it("rejects negative numbers", () => {
    expect(() => parseGenToWei("-1")).toThrow(InvalidGenAmountError);
  });

  it("rejects non-numeric input", () => {
    expect(() => parseGenToWei("abc")).toThrow(InvalidGenAmountError);
    expect(() => parseGenToWei("1e18")).toThrow(InvalidGenAmountError);
  });

  it("never routes the value through a JS float (large values stay exact)", () => {
    // 2^53 + a fractional GEN amount that would lose precision as a Number.
    const result = parseGenToWei("9007199254740993.123456789012345678");
    expect(result).toBe(9007199254740993123456789012345678n);
  });
});

describe("parseGenToWeiAllowZero", () => {
  it("allows zero", () => {
    expect(parseGenToWeiAllowZero("0")).toBe(0n);
  });
});

describe("formatWeiToGen", () => {
  it("formats a whole number with no trailing decimal", () => {
    expect(formatWeiToGen(1_000_000_000_000_000_000n)).toBe("1");
  });

  it("formats a fractional amount, trimming trailing zeros", () => {
    expect(formatWeiToGen(1_500_000_000_000_000_000n)).toBe("1.5");
  });

  it("formats a sub-wei-unit amount", () => {
    expect(formatWeiToGen(1n)).toBe("0.000000000000000001");
  });

  it("round-trips through parseGenToWei", () => {
    const original = "42.000123";
    expect(formatWeiToGen(parseGenToWei(original))).toBe(original);
  });
});

describe("doubleWei", () => {
  it("doubles a stake exactly", () => {
    expect(doubleWei(1_000_000_000_000_000_000n)).toBe(2_000_000_000_000_000_000n);
  });
});
