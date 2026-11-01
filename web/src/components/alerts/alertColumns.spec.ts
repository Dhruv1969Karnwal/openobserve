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

import { describe, expect, it } from "vitest";
import type { OTableColumnDef } from "@/lib/core/Table/OTable.types";
import {
  GUTTER_PX,
  datasetCarriesValue,
  hasMeaningfulValue,
  identityReserveFor,
  resolveColumnVisibility,
} from "./alertColumns";

const col = (
  id: string,
  size = 120,
  accessorKey?: string,
  meta?: Record<string, unknown>,
): OTableColumnDef =>
  ({
    id,
    accessorKey: accessorKey ?? id,
    size,
    header: id,
    hideable: id !== "name" && id !== "actions",
    meta,
  }) as OTableColumnDef;

// The shape and sizes the alerts list declares; `name` is the flex identity column.
const COLUMNS: OTableColumnDef[] = [
  col("name", 280, undefined, { flex: true }),
  col("last_outcome", 130),
  col("priority", 100),
  col("groups", 170, "groups_observed"),
  col("tags", 200),
  col("owner", 160),
  col("frequency", 130),
  col("last_triggered_at", 150),
  col("status", 100),
  col("actions", 160),
];

// The served dataset: no priority, no tags, no groups, no anomaly status, no cadence.
const EMPTY_ROW = {
  name: "p99-latency-checkout",
  last_outcome: "succeeded",
  priority: null,
  tags: [],
  groups_observed: undefined,
  multi_alert: false,
  owner: "ana.diaz@example.com",
  frequency: "",
  last_triggered_at: "2026-11-01 12:00:00",
  status: "--",
};

const RICH_ROW = {
  ...EMPTY_ROW,
  priority: 2,
  tags: ["prod"],
  multi_alert: true,
  groups_observed: 3,
  frequency: 5,
  status: "failed",
};

const plan = (overrides: Partial<Parameters<typeof resolveColumnVisibility>[0]> = {}) =>
  resolveColumnVisibility({
    columns: COLUMNS,
    rows: [EMPTY_ROW],
    datasetEvaluated: true,
    frameWidth: 0,
    ...overrides,
  });

describe("hasMeaningfulValue", () => {
  it("reads the cell's placeholders as empty and a real zero as a value", () => {
    expect(hasMeaningfulValue(null)).toBe(false);
    expect(hasMeaningfulValue(undefined)).toBe(false);
    expect(hasMeaningfulValue("--")).toBe(false);
    expect(hasMeaningfulValue("—")).toBe(false);
    expect(hasMeaningfulValue([])).toBe(false);
    expect(hasMeaningfulValue(0)).toBe(true);
    expect(hasMeaningfulValue(false)).toBe(true);
    expect(hasMeaningfulValue(["prod"])).toBe(true);
  });
});

describe("resolveColumnVisibility — dataset rule", () => {
  it("hides every optional column that is empty across the whole dataset", () => {
    const result = plan();
    expect(result.hidden).toMatchObject({
      priority: "dataset-empty",
      tags: "dataset-empty",
      groups: "dataset-empty",
      status: "dataset-empty",
      frequency: "in-subline",
    });
    expect(result.visibility.priority).toBe(false);
    expect(result.visibility.owner).toBe(true);
  });

  it("shows those columns again when one row carries a value", () => {
    const result = plan({ rows: [EMPTY_ROW, { ...EMPTY_ROW, priority: 1, tags: ["prod"] }] });
    expect(result.visibility.priority).toBe(true);
    expect(result.visibility.tags).toBe(true);
    expect(result.hidden.priority).toBeUndefined();
  });

  it("counts a group summary only when the alert opted in to per-group evaluation", () => {
    const groups = COLUMNS.find((c) => c.id === "groups")!;
    expect(
      datasetCarriesValue(groups, [{ ...EMPTY_ROW, multi_alert: true, groups_observed: 4 }]),
    ).toBe(true);
    expect(datasetCarriesValue(groups, [EMPTY_ROW])).toBe(false);
  });

  it("never hides a mandatory column, even with no rows and no values", () => {
    const result = plan({ rows: [{ name: "", last_outcome: null }] });
    expect(result.visibility.name).toBe(true);
    expect(result.visibility.last_outcome).toBe(true);
    expect(result.visibility.actions).toBe(true);
  });

  it("hides nothing before the first dataset has been evaluated", () => {
    const result = plan({ datasetEvaluated: false, rows: [] });
    expect(result.hidden).toEqual({});
    expect(Object.values(result.visibility).every(Boolean)).toBe(true);
  });

  it("keeps the user's own picker choice in both directions", () => {
    const result = plan({ userVisibility: { priority: true, owner: false } });
    expect(result.visibility.priority).toBe(true);
    expect(result.hidden.priority).toBeUndefined();
    expect(result.visibility.owner).toBe(false);
  });
});

describe("resolveColumnVisibility — width budget", () => {
  it("skips the fit while the frame is unmeasured (jsdom, pre-layout)", () => {
    const result = plan({ rows: [RICH_ROW], frameWidth: 0 });
    expect(result.hidden.last_triggered_at).toBeUndefined();
    expect(result.hidden.status).toBeUndefined();
    expect(result.visibility.owner).toBe(true);
  });

  it("keeps the valuable columns and drops the tail when the frame is tight", () => {
    const result = plan({ rows: [RICH_ROW], frameWidth: 1112 });
    expect(result.visibility.priority).toBe(true);
    expect(result.visibility.last_triggered_at).toBe(true);
    expect(result.hidden.tags).toBe("does-not-fit");
    expect(result.hidden.groups).toBe("does-not-fit");
    expect(result.hidden.owner).toBe("does-not-fit");
  });

  it("leaves the identity column its reserve", () => {
    const frame = 1112;
    const result = plan({ rows: [RICH_ROW], frameWidth: frame });
    const used = COLUMNS.filter((c) => result.visibility[c.id] && !(c.meta as any)?.flex).reduce(
      (sum, c) => sum + (c.size ?? 0),
      0,
    );
    expect(frame - used - GUTTER_PX).toBeGreaterThanOrEqual(identityReserveFor(frame));
  });

  it("falls back to mandatory columns alone when nothing else fits", () => {
    const result = plan({ rows: [RICH_ROW], frameWidth: 640 });
    expect(result.visibility.name).toBe(true);
    expect(result.visibility.last_outcome).toBe(true);
    expect(result.visibility.actions).toBe(true);
    expect(result.hidden.priority).toBe("does-not-fit");
    expect(result.hidden.last_triggered_at).toBe("does-not-fit");
  });
});
