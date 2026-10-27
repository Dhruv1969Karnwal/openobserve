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

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALERT_INSIGHTS_TABS,
  ALERT_LIST_TABS,
  DEFAULT_ALERT_INSIGHTS_TAB,
  DEFAULT_ALERT_LIST_TAB,
  LOCKED_ALERT_INSIGHTS_TABS,
  isAlertInsightsTab,
  isAlertListTab,
  resolveAlertInsightsTab,
  resolveAlertListTab,
} from "./alertTabs";

/** The Alerts list's anomaly tab is the one gated value in its set. */
const FREE = { anomalyDetectionEnabled: false };
const UNLOCKED = { anomalyDetectionEnabled: true };

const LOCKED_INSIGHTS = { insightsAllowed: false };
const ALLOWED_INSIGHTS = { insightsAllowed: true };

describe("resolveAlertListTab (F-101)", () => {
  /**
   * Every value the toggle group actually renders round-trips — including the
   * anomaly tab, whose cell with `anomalyDetectionEnabled: true` is the mirror
   * image of the coercion below (remove the closed set and these still pass;
   * remove the anomaly check and this fails).
   */
  it.each(ALERT_LIST_TABS)("keeps the rendered tab %s", (tab) => {
    expect(resolveAlertListTab(tab, UNLOCKED)).toBe(tab);
  });

  it.each(ALERT_LIST_TABS.filter((tab) => tab !== "anomalyDetection"))(
    "keeps the ungated tab %s whatever the feature state",
    (tab) => {
      expect(resolveAlertListTab(tab, FREE)).toBe(tab);
    },
  );

  /** The pre-existing coercion, restated against the closed set. */
  it("falls back to all when the anomaly tab is restored but the feature is not enabled", () => {
    expect(resolveAlertListTab("anomalyDetection", FREE)).toBe(DEFAULT_ALERT_LIST_TAB);
  });

  it("keeps the anomaly tab once the feature is enabled", () => {
    expect(resolveAlertListTab("anomalyDetection", UNLOCKED)).toBe("anomalyDetection");
  });

  /**
   * The gap this closes: a value that is not a tab at all used to be adopted and
   * re-persisted — `incidents` (a branch whose tab no longer exists) disabled row
   * filtering with no tab lit.
   */
  it.each([
    "incidents",
    "undefined-tab",
    "",
    "ALL",
    " All",
    "all\n",
    "パターンス",
    "<script>",
    "../logs",
    "__proto__",
    "constructor",
  ])("coerces the non-tab value %p to the default", (value) => {
    expect(resolveAlertListTab(value, UNLOCKED)).toBe(DEFAULT_ALERT_LIST_TAB);
    expect(isAlertListTab(value)).toBe(false);
  });

  it.each([undefined, null, 0, 1, true, false, {}, [], ["all"], ["all", "scheduled"], () => "all"])(
    "coerces a non-string query shape (%#)",
    (value) => {
      expect(resolveAlertListTab(value, UNLOCKED)).toBe(DEFAULT_ALERT_LIST_TAB);
    },
  );

  it("names exactly the tabs the toggle group renders", () => {
    expect(ALERT_LIST_TABS).toEqual([
      "all",
      "scheduled",
      "realTime",
      "composite",
      "anomalyDetection",
    ]);
    expect(DEFAULT_ALERT_LIST_TAB).toBe("all");
  });
});

describe("resolveAlertInsightsTab (F-101)", () => {
  /** Both free tabs round-trip; garbage never reaches `currentTab`. */
  it.each(["overview", "quality"])("keeps the free tab %s", (tab) => {
    expect(resolveAlertInsightsTab(tab, LOCKED_INSIGHTS)).toBe(tab);
  });

  it.each(LOCKED_ALERT_INSIGHTS_TABS)("refuses the locked tab %s while un-entitled", (tab) => {
    expect(resolveAlertInsightsTab(tab, LOCKED_INSIGHTS)).toBe(DEFAULT_ALERT_INSIGHTS_TAB);
  });

  /** Entitled mirror: the same URLs land on the paid tabs when the feature is on. */
  it.each(LOCKED_ALERT_INSIGHTS_TABS)("restores the paid tab %s when entitled", (tab) => {
    expect(resolveAlertInsightsTab(tab, ALLOWED_INSIGHTS)).toBe(tab);
  });

  it.each(["incidents", "frequency ", "FREQUENCY", "", "🙃", "__proto__", "toString"])(
    "coerces the non-tab value %p to overview",
    (value) => {
      expect(resolveAlertInsightsTab(value, ALLOWED_INSIGHTS)).toBe(DEFAULT_ALERT_INSIGHTS_TAB);
      expect(isAlertInsightsTab(value)).toBe(false);
    },
  );

  it.each([undefined, null, 0, true, {}, [], ["overview"]])(
    "coerces a non-string query shape (%#)",
    (value) => {
      expect(resolveAlertInsightsTab(value, ALLOWED_INSIGHTS)).toBe(DEFAULT_ALERT_INSIGHTS_TAB);
    },
  );

  it("names exactly the tabs the component renders", () => {
    expect(ALERT_INSIGHTS_TABS).toEqual(["overview", "frequency", "correlation", "quality"]);
    expect(DEFAULT_ALERT_INSIGHTS_TAB).toBe("overview");
    expect(LOCKED_ALERT_INSIGHTS_TABS).toEqual(["frequency", "correlation"]);
    for (const locked of LOCKED_ALERT_INSIGHTS_TABS) {
      expect(ALERT_INSIGHTS_TABS).toContain(locked);
    }
  });
});

/**
 * The closed sets claim to be "every tab the component renders", so they are
 * checked against the components themselves rather than against a literal copy
 * of the constant: a transcription that matches itself stays green when a tab is
 * added or renamed upstream, and the coercion would then start refusing a
 * legitimate deep link — invisibly, because the refused value is exactly the one
 * that no longer appears in the set. Same source-scanning pattern
 * themeRuntimeContrast.spec.ts uses for its consumer sweep, anti-vacuity floor
 * included: a regex that stops matching anything fails the floor, not the test.
 */
describe("closed sets match the components they mirror", () => {
  const here = process.cwd();
  const sourceOf = (rel: string) => readFileSync(join(here, rel), "utf8");

  /** The `value:` literals inside AlertList.vue's own `alertTabs` computed. */
  const renderedAlertListTabs = () => {
    const source = sourceOf("src/components/alerts/AlertList.vue");
    const start = source.indexOf("const alertTabs = computed(");
    const end = source.indexOf("return tabs;", start);
    expect(start, "AlertList.vue must still build its tabs in `alertTabs`").toBeGreaterThan(-1);
    expect(end, "AlertList.vue's `alertTabs` must still end with `return tabs`").toBeGreaterThan(
      start,
    );
    return [...source.slice(start, end).matchAll(/value:\s*"([^"]+)"/g)].map((m) => m[1]);
  };

  /** Every `<OTab name>` in AlertInsights.vue, plus the ones gated on the paid tabs. */
  const renderedInsightsTabs = () => {
    const source = sourceOf("src/components/alerts/AlertInsights.vue");
    const blocks = [...source.matchAll(/<OTab\b([^>]*?)\/>/g)].map((m) => m[1]);
    expect(
      blocks.length,
      "AlertInsights.vue must still render its tabs with <OTab>",
    ).toBeGreaterThan(1);
    return blocks.map((attrs) => ({
      name: /name="([^"]+)"/.exec(attrs)?.[1] ?? "",
      gated: /v-if="insightsAccess\.visible"/.test(attrs),
    }));
  };

  it("keeps ALERT_LIST_TABS equal to the values AlertList.vue renders", () => {
    const rendered = renderedAlertListTabs();
    expect(rendered.length).toBeGreaterThan(4); // anti-vacuity floor
    expect([...ALERT_LIST_TABS].sort()).toEqual([...rendered].sort());
  });

  it("keeps ALERT_INSIGHTS_TABS and its locked subset equal to the OTabs AlertInsights.vue renders", () => {
    const rendered = renderedInsightsTabs();
    expect(rendered.length).toBeGreaterThan(1); // anti-vacuity floor
    expect(ALERT_INSIGHTS_TABS).toEqual(rendered.map((tab) => tab.name));
    expect(LOCKED_ALERT_INSIGHTS_TABS).toEqual(
      rendered.filter((tab) => tab.gated).map((tab) => tab.name),
    );
  });

  it("keeps each set's default on a tab that is always rendered (never the gated one)", () => {
    expect(ALERT_LIST_TABS).toContain(DEFAULT_ALERT_LIST_TAB);
    expect(renderedAlertListTabs()).toContain(DEFAULT_ALERT_LIST_TAB);
    expect(ALERT_INSIGHTS_TABS).toContain(DEFAULT_ALERT_INSIGHTS_TAB);
    expect(LOCKED_ALERT_INSIGHTS_TABS).not.toContain(DEFAULT_ALERT_INSIGHTS_TAB);
  });
});
