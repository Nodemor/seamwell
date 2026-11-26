import { describe, expect, it } from "vitest";
import { completeTheLook, type LookItem, measurementsSchema, suggestSize } from "@seamwell/shared";

describe("suggestSize (try-on size helper)", () => {
  it("picks the smallest jacket size that fits the chest", () => {
    expect(suggestSize("blazer", { chestCm: 101, waistCm: 85 })).toMatchObject({ size: "40", between: false });
    expect(suggestSize("blazer", { chestCm: 98, waistCm: 85 })).toMatchObject({ size: "40", between: true });
    expect(suggestSize("kit", { chestCm: 96, waistCm: 80 })).toMatchObject({ size: "38" });
  });

  it("uses chest for shirts and waist for trousers", () => {
    expect(suggestSize("shirt", { chestCm: 104, waistCm: 70 }).size).toBe("L");
    expect(suggestSize("trousers", { chestCm: 104, waistCm: 80 }).size).toBe("32");
  });

  it("says made-to-measure when off the chart", () => {
    const big = suggestSize("blazer", { chestCm: 130, waistCm: 120 });
    expect(big.size).toBeNull();
    expect(big.note).toMatch(/make it to measure/);
    expect(suggestSize("trousers", { chestCm: 90, waistCm: 58 }).size).toBeNull();
  });

  it("adds a height note for very tall or short customers", () => {
    expect(suggestSize("blazer", { chestCm: 100, waistCm: 85, heightCm: 192 }).note).toMatch(/tall/);
    expect(suggestSize("trousers", { chestCm: 100, waistCm: 85, heightCm: 155 }).note).toMatch(/shorten/);
    expect(suggestSize("shirt", { chestCm: 100, waistCm: 85, heightCm: 175 }).note).toBeUndefined();
  });

  it("validates measurements", () => {
    expect(measurementsSchema.safeParse({ chestCm: "100", waistCm: "84" }).success).toBe(true);
    expect(measurementsSchema.safeParse({ chestCm: 10, waistCm: 84 }).success).toBe(false);
    expect(measurementsSchema.safeParse({ chestCm: 100, waistCm: 84, heightCm: 400 }).success).toBe(false);
  });
});

describe("completeTheLook", () => {
  const item = (id: string, slot: LookItem["slot"], color: string, fabric = "Cotton", name = `${color} ${slot}`): LookItem => ({ id, slot, color, fabric, name });
  const catalogue = [
    item("s-white", "shirt", "White"),
    item("s-sky", "shirt", "Sky blue"),
    item("s-black", "shirt", "Black"),
    item("t-black", "trousers", "Black"),
    item("t-stone", "trousers", "Stone", "Cotton twill", "Stone chinos"),
    item("t-navy", "trousers", "Navy"),
    item("b-other", "blazer", "Grey"),
  ];

  it("navy blazer → white/sky shirt + black/charcoal trousers, recommended first", () => {
    const look = completeTheLook(item("b", "blazer", "Navy", "Super 120s wool"), catalogue);
    expect(look.shirts.filter((s) => s.recommended).map((s) => s.id)).toEqual(["s-white", "s-sky"]);
    expect(look.shirts.at(-1)!.id).toBe("s-black");
    expect(look.trousers.filter((t) => t.recommended).map((t) => t.id)).toEqual(["t-black"]);
    expect(look.trousers).toHaveLength(3); // the rest are still offered
  });

  it("linen blazer → white shirt + stone chinos", () => {
    const look = completeTheLook(item("b", "blazer", "White", "Linen-cotton"), catalogue);
    expect(look.shirts.filter((s) => s.recommended).map((s) => s.id)).toEqual(["s-white"]);
    expect(look.trousers.filter((t) => t.recommended).map((t) => t.id)).toEqual(["t-stone"]);
  });

  it("only offers shirts and trousers", () => {
    const look = completeTheLook(item("b", "blazer", "Black"), catalogue);
    expect([...look.shirts, ...look.trousers].some((x) => x.slot === "blazer")).toBe(false);
  });
});
