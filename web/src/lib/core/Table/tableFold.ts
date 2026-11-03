// Box-based fold/occlusion rule for a scrollable table body with docked bands.
//
// jsdom has no layout, and a screenshot cannot tell "cut by the fold" from "hidden
// behind the footer" — both look like a sliced row. This module decides between them
// from boxes alone, so the same rule can run in a unit test and in a real browser.
//
// Keep every export free of imports and of TS-only runtime syntax (erasable types
// only): the browser probe serialises these functions with `toString()`.

export type FoldBox = { top: number; bottom: number; left: number; right: number };

export type DockedBand = {
  label: string;
  box: FoldBox;
  /** A band living inside the scroll viewport (sticky tfoot) rather than over it. */
  inside?: boolean;
};

export type RowSample = { label: string; box: FoldBox; hitCovered?: boolean };

export type FoldSample = {
  /** The scroll container's client box, viewport-relative. */
  viewport: FoldBox;
  /** The window box; content outside it is page-scrollable, not a defect. */
  window?: FoldBox;
  /** Opaque bands painted over the scroll viewport (sticky tfoot, overlapping pager). */
  bands?: DockedBand[];
  rows: RowSample[];
  /** True when the sample was taken with the scroller at its maximum scrollTop. */
  atEnd?: boolean;
};

export type FoldState = "clear" | "partial-scroll" | "outside-page" | "occluded" | "unreachable";

export type RowVerdict = {
  label: string;
  state: FoldState;
  /** px of the row still hidden at the sampled position. */
  hiddenPx: number;
  band: string | null;
};

export type FoldReport = {
  verdicts: RowVerdict[];
  defects: RowVerdict[];
  /** Bottom edge a row must stay above to count as fully shown. */
  clearBottom: number;
  lastRowBottom: number | null;
  /** Positive when the last row rests clear of every band, at `atEnd`. */
  clearancePx: number | null;
  foldOverlaps: { band: string; px: number }[];
};

const EPSILON = 1;

export function overlapHeight(a: FoldBox, b: FoldBox): number {
  const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return x > 0 && y > 0 ? y : 0;
}

/** The bottom a row must clear: the viewport edge, lifted by any band painted over it. */
export function clearBottomOf(
  viewport: FoldBox,
  bands: DockedBand[] = [],
): { clearBottom: number; folds: { band: string; px: number }[] } {
  let clearBottom = viewport.bottom;
  const folds: { band: string; px: number }[] = [];
  for (const band of bands) {
    const covers = overlapHeight(viewport, band.box);
    if (covers <= EPSILON) continue;
    folds.push({ band: band.label, px: Math.round(covers) });
    clearBottom = Math.min(clearBottom, band.box.top);
  }
  return { clearBottom, folds };
}

export function classifyRow(
  row: RowSample,
  sample: Pick<FoldSample, "viewport" | "window" | "bands" | "atEnd">,
): RowVerdict {
  const { clearBottom } = clearBottomOf(sample.viewport, sample.bands ?? []);
  const win = sample.window;
  if (win && (row.box.bottom <= win.top + EPSILON || row.box.top >= win.bottom - EPSILON)) {
    return { label: row.label, state: "outside-page", hiddenPx: 0, band: null };
  }
  const painted = (sample.bands ?? []).filter(
    (band) => !band.inside && overlapHeight(row.box, band.box) > EPSILON,
  );
  if (row.hitCovered === true && painted.length) {
    return {
      label: row.label,
      state: "occluded",
      hiddenPx: Math.round(overlapHeight(row.box, painted[0].box)),
      band: painted[0].label,
    };
  }
  const hidden = Math.max(0, row.box.bottom - clearBottom);
  if (hidden <= EPSILON) {
    return { label: row.label, state: "clear", hiddenPx: 0, band: null };
  }
  if (sample.atEnd) {
    const docked = (sample.bands ?? []).find((b) => overlapHeight(row.box, b.box) > EPSILON);
    return {
      label: row.label,
      state: "unreachable",
      hiddenPx: Math.round(hidden),
      band: docked ? docked.label : null,
    };
  }
  return { label: row.label, state: "partial-scroll", hiddenPx: Math.round(hidden), band: null };
}

export function isFoldDefect(verdict: RowVerdict): boolean {
  return verdict.state === "occluded" || verdict.state === "unreachable";
}

const boxOf = (el: Element): FoldBox => {
  const r = el.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
};

const dockedOverViewport = (
  el: Element,
  viewport: FoldBox,
  label: string,
  inside: boolean,
): DockedBand | null => {
  const box = boxOf(el);
  return overlapHeight(viewport, box) > EPSILON ? { label, box, inside } : null;
};

/**
 * Read real boxes for the first table under `root`. `atEnd` must be set by the caller
 * only after the scroller is parked at its maximum scrollTop.
 */
export function collectFoldSample(root: Element, atEnd = false): FoldSample | null {
  const sc = root.querySelector('[data-test="o2-table-scroll-container"]');
  if (!sc) return null;
  const viewport = boxOf(sc);
  const bands: DockedBand[] = [];
  const tfoot = sc.querySelector("tfoot");
  if (tfoot && getComputedStyle(tfoot).position === "sticky") {
    bands.push({ label: "sticky-tfoot", box: boxOf(tfoot), inside: true });
  }
  const streaming = sc.querySelector('[data-test="o2-table-streaming-bar"]');
  if (streaming) bands.push({ label: "streaming-bar", box: boxOf(streaming), inside: true });
  const pager = root.querySelector("[data-test='o2-table-pagination-bottom']");
  if (pager) {
    const band = dockedOverViewport(pager, viewport, "pager", false);
    if (band) bands.push(band);
  }
  for (const el of Array.from(root.querySelectorAll("[data-fold-band]"))) {
    const band = dockedOverViewport(
      el,
      viewport,
      el.getAttribute("data-fold-band") || "band",
      false,
    );
    if (band) bands.push(band);
  }
  const win: FoldBox = { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth };
  const rows: RowSample[] = [];
  for (const row of Array.from(sc.querySelectorAll("[data-test^='o2-table-row-'], tbody tr"))) {
    const box = boxOf(row);
    const over = bands.filter((b) => overlapHeight(box, b.box) > EPSILON);
    const y = over.length
      ? (Math.max(box.top, over[0].box.top) + Math.min(box.bottom, over[0].box.bottom)) / 2
      : box.top + 2;
    const inWindow = box.top < win.bottom - EPSILON && box.bottom > win.top + EPSILON;
    let hitCovered: boolean | undefined;
    if (inWindow && box.right > win.left && box.left < win.right) {
      const probe =
        typeof document.elementFromPoint === "function"
          ? document.elementFromPoint((box.left + box.right) / 2, y)
          : null;
      hitCovered = probe ? !(row === probe || row.contains(probe)) : undefined;
    }
    rows.push({ label: row.getAttribute("data-test") || "tr", box, hitCovered });
  }
  return { viewport, window: win, bands, rows, atEnd };
}

export function foldReport(sample: FoldSample): FoldReport {
  const { clearBottom, folds } = clearBottomOf(sample.viewport, sample.bands ?? []);
  const verdicts = sample.rows.map((row) => classifyRow(row, sample));
  const last = sample.rows.length ? sample.rows[sample.rows.length - 1] : null;
  return {
    verdicts,
    defects: verdicts.filter(isFoldDefect),
    clearBottom,
    lastRowBottom: last ? last.box.bottom : null,
    clearancePx: last ? Math.round(clearBottom - last.box.bottom) : null,
    foldOverlaps: folds,
  };
}
