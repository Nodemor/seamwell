import { compareSizes } from "@seamwell/shared";
import { describe, expect, it } from "vitest";

describe("compareSizes", () => {
  it("orders letter sizes S → XL, not alphabetically", () => {
    expect(["L", "M", "S", "XL"].sort(compareSizes)).toEqual(["S", "M", "L", "XL"]);
    expect(["XXL", "xs", "M"].sort(compareSizes)).toEqual(["xs", "M", "XXL"]);
  });
  it("orders numeric sizes by value and puts unknown sizes last", () => {
    expect(["46", "38", "40", "Free size", "28"].sort(compareSizes)).toEqual(["28", "38", "40", "46", "Free size"]);
    expect(["50", "48"].sort(compareSizes)).toEqual(["48", "50"]);
  });
});
