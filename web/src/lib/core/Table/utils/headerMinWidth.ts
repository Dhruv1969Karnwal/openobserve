// Copyright 2026 OpenObserve Inc.

/**
 * A header label is the one piece of text in a table cell that must never be
 * cut: the column's own value can ellipsize, but "Storage" reading as "Sto…"
 * leaves the number underneath unnamed. The floor below is what a column may be
 * squeezed to (resize floor and, through `fillMinSum`, the point where the table
 * starts scrolling instead of crushing), so it is derived from the label.
 *
 * Widths are ESTIMATED from the 12px/500 header face rather than measured in a
 * canvas: a canvas measures nothing under jsdom, where the resize floors are
 * pinned by tests. It only ever raises a floor that is then capped at the
 * column's declared `size`, so an over-estimate makes the table scroll a little
 * early and never widens a column.
 */

/** Advance widths (px) per character class at 12px / weight 500. */
const NARROW = "iljtfI.,:;'|!()[]\\/-_ ";
const WIDE = "mwMW@";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const NARROW_W = 3.9;
const WIDE_W = 10.2;
const UPPER_W = 8.1;
const DIGIT_W = 7.2;
const DEFAULT_W = 6.5;

/** Cell chrome a single-line header label shares its box with. */
const PADDING = 16;
const SORT_ICON = 20;

export function headerLabelMinWidth(label: unknown, opts: { sortable?: boolean } = {}): number {
  const text = typeof label === "string" ? label.trim() : "";
  if (!text) return 0;
  let width = 0;
  for (const char of text) {
    if (NARROW.includes(char)) width += NARROW_W;
    else if (WIDE.includes(char)) width += WIDE_W;
    else if (UPPER.includes(char)) width += UPPER_W;
    else if (char >= "0" && char <= "9") width += DIGIT_W;
    else width += DEFAULT_W;
  }
  return Math.ceil(width + PADDING + (opts.sortable ? SORT_ICON : 0));
}
