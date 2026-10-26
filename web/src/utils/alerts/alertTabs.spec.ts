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
