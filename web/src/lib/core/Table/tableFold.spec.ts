// Copyright 2026 OpenObserve Inc.

import { describe, it, expect } from "vitest";
import {
  classifyRow,
  clearBottomOf,
  foldReport,
  isFoldDefect,
  shouldShowFoldCue,
  overlapHeight,
  type FoldBox,
  type FoldSample,
  type RowSample,
} from "./tableFold";

const row = (top: number, bottom: number, hitCovered?: boolean): RowSample => ({
  label: `row-${top}`,
  box: { top, bottom, left: 0, right: 900 },
  hitCovered,
});

const box = (top: number, bottom: number): FoldBox => ({ top, bottom, left: 0, right: 900 });

// The measured 1024x768 streams layout: body viewport 243..716, pager docked below it.
const VIEWPORT = box(243, 716);
const WINDOW = { top: 0, bottom: 768, left: 0, right: 1024 };
const ROW_H = 38;
const CLEARANCE = 8;

const rowsAt = (scrollTop: number, count: number, contentTop = 243): RowSample[] =>
  Array.from({ length: count }, (_, i) => {
    const top = contentTop + i * ROW_H - scrollTop;
    return row(top, top + ROW_H);
  });

describe("tableFold", () => {
  it("measures the vertical overlap of two boxes and ignores side-by-side boxes", () => {
    expect(overlapHeight(box(700, 738), box(716, 759))).toBe(22);
    expect(overlapHeight(box(700, 715), box(716, 759))).toBe(0);
  });

  it("lifts the clear bottom only by bands that actually cover the scroll viewport", () => {
    const sibling = clearBottomOf(VIEWPORT, [{ label: "pager", box: box(716, 759) }]);
    expect(sibling.clearBottom).toBe(716);
    expect(sibling.folds).toEqual([]);

    const overlapping = clearBottomOf(VIEWPORT, [{ label: "pager", box: box(700, 759) }]);
    expect(overlapping.clearBottom).toBe(700);
    expect(overlapping.folds).toEqual([{ band: "pager", px: 16 }]);
  });

  // SELF-TEST: without this, a fold rule that never fires looks identical to a correct one.
  it("self-test: a row deliberately clipped by a sticky footer IS reported as unreachable", () => {
    // tfoot docked 32px into the bottom of the viewport with no reserved clearance:
    // the last row can never rise above it, no matter how far the body scrolls.
    const tfoot = { label: "sticky-tfoot", box: box(684, 716), inside: true };
    const clipped = row(678, 716);
    const sample: FoldSample = {
      viewport: VIEWPORT,
      window: WINDOW,
      bands: [tfoot],
      rows: [clipped],
      atEnd: true,
    };
    const report = foldReport(sample);
    expect(report.defects).toHaveLength(1);
    expect(report.defects[0].state).toBe("unreachable");
    expect(report.defects[0].hiddenPx).toBe(32);
    expect(isFoldDefect(report.defects[0])).toBe(true);
    expect(report.clearancePx).toBe(-32);

    // Same band with scroll-padding reserved: the row can rest above it, so the
    // identical rule must stay quiet.
    const cleared = row(646, 684);
    const after = foldReport({ ...sample, rows: [cleared] });
    expect(after.defects).toEqual([]);
    expect(after.clearancePx).toBe(0);
  });

  it("reports a row the pager paints over as genuine occlusion", () => {
    const covered = row(700, 738, true);
    const verdict = classifyRow(covered, {
      viewport: VIEWPORT,
      window: WINDOW,
      bands: [{ label: "pager", box: box(700, 759) }],
      atEnd: false,
    });
    expect(verdict.state).toBe("occluded");
    expect(verdict.band).toBe("pager");
  });

  it("treats a row cut at the fold mid-scroll as normal scrollable content", () => {
    const verdicts = rowsAt(0, 13).map((r) =>
      classifyRow(r, { viewport: VIEWPORT, window: WINDOW, bands: [], atEnd: false }),
    );
    const partial = verdicts.filter((v) => v.state === "partial-scroll");
    expect(partial).toHaveLength(1);
    expect(partial[0].hiddenPx).toBe(21);
    expect(verdicts.filter(isFoldDefect)).toEqual([]);
  });

  it("treats a row scrolled past the browser window as page content, not a defect", () => {
    const verdict = classifyRow(row(1050, 1088), {
      viewport: box(243, 1082),
      window: WINDOW,
      bands: [],
      atEnd: false,
    });
    expect(verdict.state).toBe("outside-page");
    expect(isFoldDefect(verdict)).toBe(false);
  });

  describe("shouldShowFoldCue", () => {
    const overlay = { atBottom: false, scrollbarTakesSpace: false };

    it("shows the cue when rows remain below and the platform scrollbar paints nothing", () => {
      expect(shouldShowFoldCue({ ...overlay, overflowPx: 319 })).toBe(true);
    });

    it("stays silent when the platform scrollbar already shows a thumb", () => {
      expect(
        shouldShowFoldCue({ overflowPx: 319, atBottom: false, scrollbarTakesSpace: true }),
      ).toBe(false);
    });

    it("stays silent once the body is scrolled to its end", () => {
      expect(shouldShowFoldCue({ ...overlay, overflowPx: 319, atBottom: true })).toBe(false);
    });

    it("stays silent for a body that fits, or overflows by less than a row", () => {
      expect(shouldShowFoldCue({ ...overlay, overflowPx: 0 })).toBe(false);
      expect(shouldShowFoldCue({ ...overlay, overflowPx: 6 })).toBe(false);
      expect(shouldShowFoldCue({ ...overlay, overflowPx: 6, minOverflowPx: 4 })).toBe(true);
    });
  });

  it("accepts the last row only when it can rest clear of the docked band", () => {
    const withoutClearance = foldReport({
      viewport: VIEWPORT,
      window: WINDOW,
      bands: [],
      rows: rowsAt(319, 20, 275).slice(-1),
      atEnd: true,
    });
    expect(withoutClearance.lastRowBottom).toBe(716);
    expect(withoutClearance.clearancePx).toBe(0);

    const withClearance = foldReport({
      viewport: VIEWPORT,
      window: WINDOW,
      bands: [],
      rows: rowsAt(319 + CLEARANCE, 20, 275).slice(-1),
      atEnd: true,
    });
    expect(withClearance.clearancePx).toBe(CLEARANCE);
    expect(withClearance.defects).toEqual([]);
  });
});
