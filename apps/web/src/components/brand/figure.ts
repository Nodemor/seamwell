/**
 * Outline of a standing figure (100 × 256 units, head centred at 50,22 r14) — shared by the try-on pose guide and
 * the size guide's measuring diagram. Plain module (no "use client") so server components can use it too.
 */
export type Pt = [number, number];

/** Smooth open curve through points (Catmull-Rom → cubic Béziers). */
export function smooth(pts: Pt[]): string {
  let d = `M${pts[0]![0]} ${pts[0]![1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/** Left half of the body outline (neck → arm → hand → torso → leg → foot → crotch), mirrored for the right. */
export const ARMS_DOWN: Pt[] = [
  [44, 36], [43, 43], [34, 47], [26, 52], [22, 61], [20, 82], [18, 106], [17, 130], [16, 146], [18, 156], [23, 155], [24, 146],
  [25, 130], [27, 106], [29, 84], [31, 72], [33, 92], [34, 118], [33, 140], [35, 176], [37, 212], [38, 240], [33, 249], [34, 254],
  [46, 254], [46, 246], [47, 212], [48, 178], [50, 152],
];
export const HANDS_IN_POCKETS: Pt[] = [
  [44, 36], [43, 43], [34, 47], [26, 52], [21, 62], [18, 84], [19, 104], [24, 118], [31, 128], [34, 124], [29, 113], [26, 100],
  [28, 84], [31, 72], [33, 92], [34, 118], [33, 140], [35, 176], [37, 212], [38, 240], [33, 249], [34, 254],
  [46, 254], [46, 246], [47, 212], [48, 178], [50, 152],
];
export const body = (half: Pt[]) => smooth([...half, ...half.slice(0, -1).reverse().map(([x, y]) => [100 - x, y] as Pt)]);
export const BODY = { down: body(ARMS_DOWN), pockets: body(HANDS_IN_POCKETS) };
