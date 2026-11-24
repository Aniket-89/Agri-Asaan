import { describe, expect, it } from "vitest";

import { negotiateLocale, preferredLocale, stripLocale, withLocale } from "./config";
import { en } from "./dictionaries/en";
import { hi } from "./dictionaries/hi";
import { format } from "./format";

function flatten(dictionary: object, prefix = ""): Record<string, string> {
  return Object.entries(dictionary).reduce<Record<string, string>>((flat, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string"
      ? { ...flat, [path]: value }
      : { ...flat, ...flatten(value as object, path) };
  }, {});
}

const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map(([, name]) => name).sort();

describe("dictionaries", () => {
  const english = flatten(en);
  const hindi = flatten(hi);

  it("have the same keys", () => {
    expect(Object.keys(hindi).sort()).toEqual(Object.keys(english).sort());
  });

  it.each(Object.keys(english))("%s uses the same placeholders in every locale", (key) => {
    expect(placeholders(hindi[key])).toEqual(placeholders(english[key]));
  });

  it("have no empty translations", () => {
    expect(Object.values(hindi).filter((text) => text.trim() === "")).toEqual([]);
  });
});

describe("negotiateLocale", () => {
  it("picks the highest-weighted supported language", () => {
    expect(negotiateLocale("fr;q=0.9, hi-IN;q=0.8, en;q=0.5")).toBe("hi");
    expect(negotiateLocale("en-GB,en;q=0.9,hi;q=0.8")).toBe("en");
  });

  it("returns null when nothing is supported", () => {
    expect(negotiateLocale("fr, de;q=0.5")).toBeNull();
    expect(negotiateLocale(null)).toBeNull();
    expect(negotiateLocale("hi;q=0")).toBeNull();
  });
});

describe("preferredLocale", () => {
  it("prefers the cookie, then the browser, then English", () => {
    expect(preferredLocale("hi", "en")).toBe("hi");
    expect(preferredLocale("xx", "hi")).toBe("hi");
    expect(preferredLocale(undefined, null)).toBe("en");
  });
});

describe("stripLocale / withLocale", () => {
  it("round-trips localized paths", () => {
    expect(stripLocale("/hi/dashboard")).toEqual({ locale: "hi", path: "/dashboard" });
    expect(stripLocale("/en")).toEqual({ locale: "en", path: "/" });
    expect(stripLocale("/dashboard")).toEqual({ locale: null, path: "/dashboard" });
    expect(withLocale("hi", "/login?error=x")).toBe("/hi/login?error=x");
    expect(withLocale("en", "/")).toBe("/en");
  });

  it("rejects external or relative paths", () => {
    expect(() => withLocale("en", "//evil.example")).toThrow();
    expect(() => withLocale("en", "https://evil.example")).toThrow();
  });
});

describe("format", () => {
  it("fills placeholders and leaves unknown ones visible", () => {
    expect(format("Sign in to {brand}", { brand: "Greenfield" })).toBe("Sign in to Greenfield");
    expect(format("{missing}", {})).toBe("{missing}");
  });
});
