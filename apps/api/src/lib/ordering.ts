export const STEP = 1024;
export const ORDER_STEP = STEP;
const MIN_GAP = 1e-6;
export function between(prev: number | null, next: number | null): number | null {
  if (prev === null && next === null) return STEP;
  if (prev === null) return next! - STEP;
  if (next === null) return prev + STEP;
  if (next - prev < MIN_GAP) return null;
  return (prev + next) / 2;
}
export const positionBetween = (before?: number | null, after?: number | null): number | null => between(before ?? null, after ?? null);
export function needsRenumber(before: number, after: number): boolean { return between(before, after) === null; }
export function renumberPositions(ids: string[]): Array<{ id: string; position: number }> { return ids.map((id, index) => ({ id, position: (index + 1) * STEP })); }
