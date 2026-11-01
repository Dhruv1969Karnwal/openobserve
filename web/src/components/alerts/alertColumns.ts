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
 * Alerts-list column policy (O16): an OPTIONAL column that carries nothing in
 * the loaded dataset is hidden, but stays in `columns` so the table's
 * column-visibility picker still lists it.
 */

import type { OTableColumnDef } from "@/lib/core/Table/OTable.types";

/** The row cannot be read without these, so an empty value never hides them. */
export const MANDATORY_COLUMN_IDS = ["name", "last_outcome", "actions"] as const;

/** Operator value order for the width budget: earlier keeps its column first. */
export const OPTIONAL_COLUMN_PRIORITY = [
  "priority",
  "last_triggered_at",
  "tags",
  "groups",
  "oncall_team",
  "owner",
  "last_satisfied_at",
  "status",
  "frequency",
] as const;

/** Values the identity cell's second line already prints, so the column repeats them. */
export const SUBLINE_REDUNDANT_IDS = ["frequency"] as const;

/** The selection and index gutters OTable adds itself: outside `columns`, inside the frame. */
export const GUTTER_PX = 100;

/** A column with no declared width still needs this much to show its header. */
export const DEFAULT_COLUMN_PX = 120;

export type HideReason = "dataset-empty" | "in-subline" | "does-not-fit";

export interface ColumnVisibilityPlan {
  visibility: Record<string, boolean>;
  /** Only the auto-hidden ids, with the rule that hid each. */
  hidden: Record<string, HideReason>;
}

/** `"--"` and `"—"` are the placeholder a cell prints for a missing value, not values. */
const PLACEHOLDER_TEXT = new Set(["", "--", "—", "-", "n/a", "null", "undefined"]);

export function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return !PLACEHOLDER_TEXT.has(value.trim().toLowerCase());
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

/** What the cell would print, which is not always `row[accessorKey]` — hence the per-id probes. */
const COLUMN_VALUE_PROBES: Record<string, (row: any) => unknown> = {
  groups: (row) => (row?.multi_alert ? row?.groups_observed : null),
  status: (row) => (String(row?.status ?? "") === "--" ? null : row?.status),
  oncall_team: (row) => row?.oncall_team,
};

export function columnValueAt(column: OTableColumnDef, row: any): unknown {
  const probe = COLUMN_VALUE_PROBES[column.id];
  if (probe) return probe(row);
  const key = (column.accessorKey || column.id) as string;
  return row?.[key];
}

export function datasetCarriesValue(column: OTableColumnDef, rows: any[]): boolean {
  return rows.some((row) => hasMeaningfulValue(columnValueAt(column, row)));
}

export function isMandatoryColumn(id: string): boolean {
  return (MANDATORY_COLUMN_IDS as readonly string[]).includes(id);
}

/** The identity column absorbs the leftover; the reserve is what it must keep. */
export function identityReserveFor(frameWidth: number): number {
  return Math.round(Math.min(420, Math.max(280, frameWidth * 0.36)));
}

const sizeOf = (column: OTableColumnDef): number => column.size ?? DEFAULT_COLUMN_PX;

/** `meta.flex` marks the identity column: the reserve stands in for its width. */
const isFlexColumn = (column: OTableColumnDef): boolean => Boolean((column.meta as any)?.flex);

export function resolveColumnVisibility(options: {
  columns: OTableColumnDef[];
  rows: any[];
  /** Whether the loaded dataset has been seen; while loading, nothing is dataset-hidden. */
  datasetEvaluated: boolean;
  /** Measured inner width of the table frame; 0/unknown (jsdom, pre-layout) skips the fit. */
  frameWidth: number;
  /** The user's own picker choices, which outrank every rule here. */
  userVisibility?: Record<string, boolean>;
}): ColumnVisibilityPlan {
  const { columns, rows, datasetEvaluated, frameWidth, userVisibility = {} } = options;
  const visibility: Record<string, boolean> = {};
  const hidden: Record<string, HideReason> = {};

  const optional = columns.filter((c) => !isMandatoryColumn(c.id));
  const keep = new Set<string>();
  for (const column of optional) {
    const userId = userVisibility[column.id];
    if (userId === false) {
      visibility[column.id] = false;
      continue;
    }
    if (userId === true) {
      visibility[column.id] = true;
      continue;
    }
    if (datasetEvaluated && (SUBLINE_REDUNDANT_IDS as readonly string[]).includes(column.id)) {
      hidden[column.id] = "in-subline";
      visibility[column.id] = false;
      continue;
    }
    if (datasetEvaluated && !datasetCarriesValue(column, rows)) {
      hidden[column.id] = "dataset-empty";
      visibility[column.id] = false;
      continue;
    }
    keep.add(column.id);
  }

  if (frameWidth > 0) {
    const byId = new Map(columns.map((c) => [c.id, c] as const));
    const always = columns
      .filter(
        (c) =>
          (!isFlexColumn(c) && isMandatoryColumn(c.id)) ||
          (!keep.has(c.id) && visibility[c.id] === true),
      )
      .reduce((sum, c) => sum + sizeOf(c), 0);
    let remaining = frameWidth - GUTTER_PX - identityReserveFor(frameWidth) - always;
    const order: string[] = [
      ...(OPTIONAL_COLUMN_PRIORITY as readonly string[]),
      ...columns.map((c) => c.id),
    ];
    const seen = new Set<string>();
    for (const id of order) {
      if (!keep.has(id) || seen.has(id)) continue;
      seen.add(id);
      const width = sizeOf(byId.get(id) as OTableColumnDef);
      if (width > remaining) {
        keep.delete(id);
        visibility[id] = false;
        hidden[id] = "does-not-fit";
        continue;
      }
      remaining -= width;
    }
    for (const id of keep) visibility[id] = true;
  }

  for (const column of columns) {
    if (isMandatoryColumn(column.id)) visibility[column.id] = true;
    else if (visibility[column.id] === undefined) visibility[column.id] = true;
  }

  const shownFixed = columns
    .filter((c) => visibility[c.id] && !isFlexColumn(c))
    .reduce((sum, c) => sum + sizeOf(c), 0);
  const identityWidth = frameWidth > 0 ? Math.max(0, frameWidth - GUTTER_PX - shownFixed) : 0;

  return { visibility, hidden, identityWidth };
}
