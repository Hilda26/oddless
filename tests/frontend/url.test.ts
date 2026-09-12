import { describe, expect, it } from "vitest";
import {
  assertSafeSourceUrl,
  assertSafeSourceList,
  isSafeSourceUrl,
  canonicalizeUrl,
  UnsafeSourceUrlError,
} from "@/lib/validation/url";

describe("assertSafeSourceUrl", () => {
  it("accepts a normal https url", () => {
    expect(() => assertSafeSourceUrl("https://example.org/results")).not.toThrow();
  });

  it("rejects http", () => {
    expect(() => assertSafeSourceUrl("http://example.org")).toThrow(UnsafeSourceUrlError);
  });

  it("rejects embedded credentials", () => {
    expect(() => assertSafeSourceUrl("https://user:pass@example.org")).toThrow(UnsafeSourceUrlError);
  });

  it.each([
    "https://localhost/a",
    "https://127.0.0.1/a",
    "https://10.1.2.3/a",
    "https://192.168.0.1/a",
    "https://172.16.0.1/a",
    "https://172.31.255.255/a",
    "https://service.local/a",
  ])("rejects private/local host %s", (url) => {
    expect(() => assertSafeSourceUrl(url)).toThrow(UnsafeSourceUrlError);
  });

  it("does not false-positive on a public 172.x host outside the private range", () => {
    expect(() => assertSafeSourceUrl("https://172.32.0.1/a")).not.toThrow();
  });

  it("rejects overlong urls", () => {
    expect(() => assertSafeSourceUrl(`https://example.org/${"a".repeat(600)}`)).toThrow(
      UnsafeSourceUrlError,
    );
  });

  it("isSafeSourceUrl mirrors assert as a boolean", () => {
    expect(isSafeSourceUrl("https://example.org")).toBe(true);
    expect(isSafeSourceUrl("http://example.org")).toBe(false);
  });
});

describe("assertSafeSourceList", () => {
  it("requires between 2 and 4 sources", () => {
    expect(() => assertSafeSourceList(["https://example.org"])).toThrow(UnsafeSourceUrlError);
    expect(() =>
      assertSafeSourceList(Array.from({ length: 5 }, (_, i) => `https://example${i}.org`)),
    ).toThrow(UnsafeSourceUrlError);
  });

  it("accepts 2-4 valid sources", () => {
    expect(() =>
      assertSafeSourceList(["https://example.org/a", "https://example.net/b"]),
    ).not.toThrow();
  });

  it("rejects duplicate sources after canonicalization", () => {
    expect(() =>
      assertSafeSourceList(["https://Example.org/a/", "https://example.org/a"]),
    ).toThrow(UnsafeSourceUrlError);
  });
});

describe("canonicalizeUrl", () => {
  it("lowercases host and strips trailing slash/fragment", () => {
    expect(canonicalizeUrl("https://Example.ORG/Path/#frag")).toBe("https://example.org/Path");
  });
});
