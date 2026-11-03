// Copyright 2026 OpenObserve Inc.
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { mount, config, flushPromises } from "@vue/test-utils";
import { createI18n } from "vue-i18n";

const i18n = createI18n({ legacy: false, locale: "en", messages: { en: {} } });
beforeAll(() => {
  config.global.plugins.unshift([i18n as any]);
  (globalThis as any).requestAnimationFrame = (cb: any) => cb();
});

import { nextTick } from "vue";
import OTable from "./OTable.vue";
import { collectFoldSample, foldReport, type FoldBox } from "./tableFold";
import type { OTableColumnDef } from "./OTable.types";

const columns: OTableColumnDef[] = [
  { id: "name", header: "Name", accessorKey: "name", size: 300 },
  { id: "type", header: "Type", accessorKey: "type", size: 120 },
];

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ name: `stream_${i + 1}`, type: "logs" }));

// The measured /streams layout at 1024x768: body 243..716, 32px head, 38px rows,
// pager docked 716..759 (a flush sibling, so pager top == fold edge).
const SC_TOP = 243;
const SC_BOTTOM = 716;
const HEAD_H = 32;
const ROW_H = 38;
const PAGER_TOP = 716;
const WINDOW_H = 768;
const FOLD_CLEARANCE_PX = 8;

const rect = (top: number, bottom: number): DOMRect =>
  ({
    top,
    bottom,
    left: 48,
    right: 992,
    width: 944,
    height: bottom - top,
    x: 48,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

let beforeEachRect: typeof Element.prototype.getBoundingClientRect | null = null;

function modelLayout(scrollTop: number) {
  const real = Element.prototype.getBoundingClientRect;
  beforeEachRect = real;
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const el = this as HTMLElement;
    const test = el.getAttribute?.("data-test") || "";
    if (test === "o2-table-scroll-container") return rect(SC_TOP, SC_BOTTOM);
    if (test === "o2-table-pagination-bottom") return rect(PAGER_TOP, PAGER_TOP + 43);
    if (el.tagName === "THEAD") return rect(SC_TOP, SC_TOP + HEAD_H);
    if (/^o2-table-row-/.test(test)) {
      const i = Number(test.replace("o2-table-row-", "")) || 0;
      const top = SC_TOP + HEAD_H + i * ROW_H - scrollTop;
      return rect(top, top + ROW_H);
    }
    return rect(0, 0);
  } as any;
}

function setScrollerMetrics(el: HTMLElement, clientHeight: number, scrollHeight: number) {
  Object.defineProperty(el, "clientHeight", { value: clientHeight, configurable: true });
  Object.defineProperty(el, "scrollHeight", { value: scrollHeight, configurable: true });
}

async function mountTable(count: number, clientHeight: number, scrollHeight: number) {
  const wrapper = mount(OTable, {
    props: { data: rows(count), columns, pageSize: 20 } as any,
  });
  await flushPromises();
  await nextTick();
  const sc = wrapper.find('[data-test="o2-table-scroll-container"]').element as HTMLElement;
  setScrollerMetrics(sc, clientHeight, scrollHeight);
  await wrapper.setProps({ data: rows(count) });
  await flushPromises();
  await nextTick();
  return wrapper;
}

function endOfScrollClearance(wrapper: any) {
  const root = wrapper.find('[data-test="o2-table-root"]').element;
  const sc = wrapper.find('[data-test="o2-table-scroll-container"]').element as HTMLElement;
  const overflowing = sc.scrollHeight > sc.clientHeight + 1;
  const clearance = sc.classList.contains("o2-table-fold-clearance") ? FOLD_CLEARANCE_PX : 0;
  const maxScroll = overflowing ? sc.scrollHeight - sc.clientHeight : 0;
  modelLayout(maxScroll);
  try {
    const sample = collectFoldSample(root, true);
    const report = foldReport({
      ...sample!,
      window: { top: 0, bottom: WINDOW_H, left: 0, right: 1024 },
    });
    return { clearance, report };
  } finally {
    Element.prototype.getBoundingClientRect = beforeEachRect as any;
  }
}

describe("OTable fold clearance against a docked pager", () => {
  afterEach(() => {
    if (beforeEachRect) Element.prototype.getBoundingClientRect = beforeEachRect as any;
  });

  it("reserves clearance so the last row's divider cannot merge with the pager rule", async () => {
    const wrapper = await mountTable(20, 473, 792 + FOLD_CLEARANCE_PX);
    const { clearance, report } = endOfScrollClearance(wrapper);
    expect(clearance).toBe(FOLD_CLEARANCE_PX);
    // The pager must not overlap the scroll viewport, and the final row must rest
    // above the fold edge rather than flush against it.
    expect(report.foldOverlaps).toEqual([]);
    expect(report.clearancePx).toBeGreaterThan(0);
    expect(report.defects).toEqual([]);
  });

  it("leaves a short, non-scrolling dataset with no dead band above the pager", async () => {
    const wrapper = await mountTable(4, 473, 473);
    const { clearance, report } = endOfScrollClearance(wrapper);
    expect(clearance).toBe(0);
    expect(report.defects).toEqual([]);
  });

  describe("fold continuation cue", () => {
    function setScrollMetrics(
      el: HTMLElement,
      m: { clientHeight: number; scrollHeight: number; offsetWidth: number; clientWidth: number },
    ) {
      for (const [k, v] of Object.entries(m))
        Object.defineProperty(el, k, { value: v, configurable: true });
    }

    async function mountWith(m: {
      clientHeight: number;
      scrollHeight: number;
      offsetWidth: number;
      clientWidth: number;
    }) {
      const wrapper = mount(OTable, { props: { data: rows(20), columns, pageSize: 20 } as any });
      await flushPromises();
      await nextTick();
      const sc = wrapper.find('[data-test="o2-table-scroll-container"]').element as HTMLElement;
      setScrollMetrics(sc, m);
      await wrapper.setProps({ data: rows(20) });
      await flushPromises();
      await nextTick();
      return { wrapper, sc };
    }

    const overlay = { clientHeight: 473, scrollHeight: 792, offsetWidth: 926, clientWidth: 926 };
    const classic = { clientHeight: 473, scrollHeight: 792, offsetWidth: 941, clientWidth: 926 };

    it("is drawn while rows remain below and the platform scrollbar paints nothing", async () => {
      const { wrapper } = await mountWith(overlay);
      expect(wrapper.find('[data-test="o2-table-fold-cue"]').exists()).toBe(true);
    });

    it("is not drawn when a real scrollbar thumb already shows", async () => {
      const { wrapper } = await mountWith(classic);
      expect(wrapper.find('[data-test="o2-table-fold-cue"]').exists()).toBe(false);
    });

    it("is not drawn for a body that fits its frame", async () => {
      const { wrapper } = await mountWith({
        clientHeight: 473,
        scrollHeight: 473,
        offsetWidth: 926,
        clientWidth: 926,
      });
      expect(wrapper.find('[data-test="o2-table-fold-cue"]').exists()).toBe(false);
    });

    it("goes away once the body is scrolled to its end, and returns on scroll up", async () => {
      const { wrapper, sc } = await mountWith(overlay);
      expect(wrapper.find('[data-test="o2-table-fold-cue"]').exists()).toBe(true);
      Object.defineProperty(sc, "scrollTop", { value: 319, configurable: true });
      await wrapper.find('[data-test="o2-table-scroll-container"]').trigger("scroll");
      await nextTick();
      expect(wrapper.find('[data-test="o2-table-fold-cue"]').exists()).toBe(false);
      Object.defineProperty(sc, "scrollTop", { value: 120, configurable: true });
      await wrapper.find('[data-test="o2-table-scroll-container"]').trigger("scroll");
      await nextTick();
      expect(wrapper.find('[data-test="o2-table-fold-cue"]').exists()).toBe(true);
    });

    it("never carries an accessible name, because every row is already in the a11y tree", async () => {
      const { wrapper } = await mountWith(overlay);
      const cue = wrapper.find('[data-test="o2-table-fold-cue"]');
      expect(cue.attributes("aria-hidden")).toBe("true");
      expect(cue.attributes("role")).toBeUndefined();
      expect(cue.element.tabIndex).toBe(-1);
    });
  });

  it("still reports a real occlusion when a band is painted over the body", async () => {
    const wrapper = await mountTable(20, 473, 800);
    const root = wrapper.find('[data-test="o2-table-root"]').element;
    const sc = wrapper.find('[data-test="o2-table-scroll-container"]').element as HTMLElement;
    modelLayout(sc.scrollHeight - sc.clientHeight);
    try {
      const sample = collectFoldSample(root, true);
      // A pager drawn 20px up over the body, painting over the final row.
      const overlapping: FoldBox = {
        top: SC_BOTTOM - 20,
        bottom: PAGER_TOP + 43,
        left: 48,
        right: 992,
      };
      const report = foldReport({
        ...sample!,
        bands: [{ label: "pager", box: overlapping }],
        rows: sample!.rows.map((r, i) =>
          i === sample!.rows.length - 1 ? { ...r, hitCovered: true } : r,
        ),
      });
      expect(report.foldOverlaps).toEqual([{ band: "pager", px: 20 }]);
      expect(report.defects.length).toBeGreaterThan(0);
      expect(report.defects.some((d) => d.state === "occluded")).toBe(true);
    } finally {
      Element.prototype.getBoundingClientRect = beforeEachRect as any;
    }
  });
});
