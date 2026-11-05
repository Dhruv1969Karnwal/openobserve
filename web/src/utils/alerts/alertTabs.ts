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

/**
 * Closed sets for the two `?tab=` surfaces under Alerts, restoring a URL the
 * same way `resolveLogsVisualizeToggle` (logs panel) and
 * `resolveTraceSearchMode` (traces tab) restore theirs: a value that is not a
 * rendered tab is not state, it is a typo or a crafted link, so it coerces to
 * the default instead of being adopted and re-persisted.
 *
 * Before this, the Alerts list only special-cased `anomalyDetection` and let
 * anything else through: `?tab=incidents` switched row filtering off with no tab
 * lit, and `?tab=%E2%80%8B` stuck in the URL because the watcher that re-writes
 * the tab fires on CHANGE only, so the garbage param survived every refresh.
 */

/** Every tab `AlertList.vue`'s `alertTabs` renders (anomaly only when visible). */
export const ALERT_LIST_TABS = ["all", "scheduled", "realTime", "composite", "anomalyDetection"];

export type AlertListTab = (typeof ALERT_LIST_TABS)[number];

export const DEFAULT_ALERT_LIST_TAB: AlertListTab = "all";

/** The gated tab: a "lock" build renders it locked, the shipped "hide" policy omits it
 *  (`useAnomalyLibraryAccess()` → "hidden").
 *  Module-internal on purpose — callers pass the ENABLED answer, never this name,
 *  so the set and its gated member cannot be re-assembled wrongly elsewhere. */
const GATED_ALERT_LIST_TAB: AlertListTab = "anomalyDetection";

export const isAlertListTab = (value: unknown): value is AlertListTab =>
  typeof value === "string" && ALERT_LIST_TABS.some((tab) => tab === value);

/**
 * `anomalyDetectionEnabled` is the ENABLED answer (`useAnomalyLibraryAccess()
 * === "enabled"`), not the visible one — a locked-but-visible tab must not be
 * restored from the URL either, which is what the pre-existing coercion did.
 */
export const resolveAlertListTab = (
  value: unknown,
  { anomalyDetectionEnabled }: { anomalyDetectionEnabled: boolean },
): AlertListTab =>
  !isAlertListTab(value) || (value === GATED_ALERT_LIST_TAB && !anomalyDetectionEnabled)
    ? DEFAULT_ALERT_LIST_TAB
    : value;

/** Every `OTab` `AlertInsights.vue` renders — `quality` included. */
export const ALERT_INSIGHTS_TABS = ["overview", "frequency", "correlation", "quality"];

export type AlertInsightsTab = (typeof ALERT_INSIGHTS_TABS)[number];

export const DEFAULT_ALERT_INSIGHTS_TAB: AlertInsightsTab = "overview";

/**
 * The enterprise-only tabs, rendered on `insightsAccess.visible` and refused by
 * the controlled `OTabs` handler while locked. `LOCKED_TAB_NAMES` in the
 * component is this array, so the two cannot drift apart.
 */
export const LOCKED_ALERT_INSIGHTS_TABS: AlertInsightsTab[] = ["frequency", "correlation"];

export const isAlertInsightsTab = (value: unknown): value is AlertInsightsTab =>
  typeof value === "string" && ALERT_INSIGHTS_TABS.some((tab) => tab === value);

export const resolveAlertInsightsTab = (
  value: unknown,
  { insightsAllowed }: { insightsAllowed: boolean },
): AlertInsightsTab =>
  !isAlertInsightsTab(value) ||
  (!insightsAllowed && LOCKED_ALERT_INSIGHTS_TABS.includes(value as AlertInsightsTab))
    ? DEFAULT_ALERT_INSIGHTS_TAB
    : value;
