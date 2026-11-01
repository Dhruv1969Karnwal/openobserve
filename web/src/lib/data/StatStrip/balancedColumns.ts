// Copyright 2026 OpenObserve Inc.
//
// Column maths for OStatStrip. An auto-fit grid makes every tile the same width,
// but it also lets a six-tile strip land as five-plus-one: one tile alone on its
// own row with a whole row-width of empty canvas beside it. The number of columns
// is therefore chosen from the tile count as well as the width.

/**
 * Largest number of `minPx` columns that fit `containerWidth`, then reduced until
 * the last row is not a single lonely tile. A short final row is fine — rows of
 * four then two read as a grid — but one tile by itself reads as a leftover.
 */
export function balancedColumns(
  count: number,
  containerWidth: number,
  minPx: number,
  gapPx = 8,
): number {
  if (count < 2 || containerWidth <= 0) return 1;
  const fits = Math.floor((containerWidth + gapPx) / (minPx + gapPx));
  const maxCols = Math.max(1, Math.min(fits, count));
  for (let cols = maxCols; cols > 2; cols--) {
    const lastRow = count % cols;
    if (lastRow !== 1) return cols;
  }
  return maxCols;
}
