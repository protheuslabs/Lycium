import { describe, expect, it } from "vitest";
import { domainContains, parseGraphDomain } from "./graphDomain";

describe("graph domain restrictions", () => {
  it("recognizes inclusive and exclusive endpoints", () => {
    const { expression, domain } = parseGraphDomain("y=x^2 {-2<=x<3}");
    expect(expression).toBe("y=x^2");
    expect(domainContains(domain, -2)).toBe(true);
    expect(domainContains(domain, 3)).toBe(false);
    expect(domainContains(domain, 0)).toBe(true);
  });
  it("rejects malformed and reversed bounds", () => {
    expect(() => parseGraphDomain("x {3<x<1}")).toThrow();
    expect(() => parseGraphDomain("x {x<3}")).toThrow();
  });
  it("leaves unrestricted expressions alone", () => {
    expect(parseGraphDomain("sin(x)")).toEqual({ expression: "sin(x)", domain: null });
  });
});
