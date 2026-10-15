import { describe, expect, it } from 'vitest';
import { needsRenumber, positionBetween, renumberPositions } from './ordering.js';
describe('fractional positions', () => {
  it('places values before, after, between, and in an empty list', () => { expect(positionBetween()).toBe(1024); expect(positionBetween(null, 1024)).toBe(0); expect(positionBetween(1024, null)).toBe(2048); expect(positionBetween(1024, 2048)).toBe(1536); });
  it('detects tiny gaps and renumbers in order', () => { expect(needsRenumber(1, 1 + Number.EPSILON)).toBe(true); expect(renumberPositions(['a', 'b'])).toEqual([{ id: 'a', position: 1024 }, { id: 'b', position: 2048 }]); });
});
