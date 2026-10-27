// Copyright 2026 OpenObserve Inc.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import i18n from "@/locales";
import type { DbmInsight } from "@/utils/dbm/insights";
import type { QueryStatsRow } from "@/services/db_monitoring";

import DbmInsightStrip from "./DbmInsightStrip.vue";

const row = (over: Partial<QueryStatsRow> = {}): QueryStatsRow =>
  ({
    fingerprint: "fp1",
    db_system: "postgresql",
    db_instance: "orders-db",
    service_name: "checkout-service",
    query_norm: "SELECT id FROM orders WHERE customer_id = ?",
    calls: 100,
    total_time_ns: 1_000_000,
    ...over,
  }) as QueryStatsRow;

const insight = (over: Partial<DbmInsight> = {}): DbmInsight => ({
  id: "new-expensive",
  tone: "warning",
  fingerprints: ["fp1"],
  evidence: { row: row(), count: 1, toRank: 1 },
  ...over,
});

const mountStrip = (insights: DbmInsight[], activeId: DbmInsight["id"] | null = null) =>
  mount(DbmInsightStrip, {
    props: { insights, activeId },
    global: { plugins: [i18n] },
  });

describe("DbmInsightStrip", () => {
  /**
   * The strip points at rows the reader cannot currently see, so the word on the
   * button has to say which of the two things the click does — take me there, or
   * narrow the table. "Show" for both was the ambiguity this pins.
   */
  describe("the affordance names what the click does", () => {
    it("offers to find the row when the insight names exactly one", () => {
      const wrapper = mountStrip([insight()]);
      expect(wrapper.text()).toContain("Find it");
      expect(wrapper.text()).not.toContain("Show");
    });

    it("offers to filter when the insight names several rows", () => {
      const wrapper = mountStrip([
        insight({ fingerprints: ["fp1", "fp2"], evidence: { row: row(), count: 2, toRank: 1 } }),
      ]);
      expect(wrapper.text()).toContain("Show");
      expect(wrapper.text()).not.toContain("Find it");
    });

    it("offers to clear only the multi-row insight it is filtered to", () => {
      const wrapper = mountStrip(
        [insight({ fingerprints: ["fp1", "fp2"], evidence: { row: row(), count: 2, toRank: 1 } })],
        "new-expensive",
      );
      expect(wrapper.text()).toContain("Clear filter");
    });

    it("keeps offering to find a single-row insight rather than to clear it", () => {
      // A single-row insight jumps instead of filtering, so it never becomes the
      // active filter — and must not offer to clear one that does not exist.
      const wrapper = mountStrip([insight()], "new-expensive");
      expect(wrapper.text()).toContain("Find it");
      expect(wrapper.text()).not.toContain("Clear filter");
    });
  });

  it("emits the insight so the page can decide between jumping and filtering", async () => {
    const one = insight();
    const wrapper = mountStrip([one]);
    await wrapper.find('[data-test="dbm-insight-new-expensive"]').trigger("click");
    expect(wrapper.emitted("filter")?.[0]).toEqual([one]);
  });

  /**
   * An applied insight keeps its chip on the accent-active ground until the filter
   * is cleared, so the sentence has to survive that ground as long as the filter
   * does — the secondary tier measures 4.15:1 there, under AA.
   */
  describe("the applied chip keeps its evidence sentence legible", () => {
    const applied = () => mountStrip([insight(), insight({ id: "rank-churn" })], "new-expensive");
    const sentenceIn = (id: string) =>
      applied().get(`[data-test="dbm-insight-${id}"] [data-test="dbm-insight-sentence"]`);

    it("paints the accent-active ground on the applied chip only", () => {
      expect(applied().get('[data-test="dbm-insight-new-expensive"]').classes()).toContain(
        "bg-surface-accent-active",
      );
      expect(applied().get('[data-test="dbm-insight-rank-churn"]').classes()).not.toContain(
        "bg-surface-accent-active",
      );
    });

    it("binds the heading tier to the sentence the accent-active ground holds", () => {
      const classes = sentenceIn("new-expensive").classes();
      expect(classes).toContain("text-text-heading");
      expect(classes).not.toContain("text-text-secondary");
    });

    it("keeps the secondary tier on the chip that is not applied", () => {
      const classes = sentenceIn("rank-churn").classes();
      expect(classes).toContain("text-text-secondary");
      expect(classes).not.toContain("text-text-heading");
    });

    it("moves the sentence to the heading tier as soon as its filter applies", async () => {
      const wrapper = mountStrip([insight()]);
      expect(wrapper.get('[data-test="dbm-insight-sentence"]').classes()).toContain(
        "text-text-secondary",
      );
      await wrapper.setProps({ activeId: "new-expensive" });
      expect(wrapper.get('[data-test="dbm-insight-sentence"]').classes()).toContain(
        "text-text-heading",
      );
    });
  });
});
