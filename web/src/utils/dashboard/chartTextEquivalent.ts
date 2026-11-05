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
 * The text/table equivalent of a rendered chart (O18).
 *
 * A `<canvas>` is one image to an assistive technology: `role="img"` plus a name
 * says WHAT is drawn and nothing about WHAT IT SAYS. This turns the ECharts
 * option a chart was drawn from into (a) a summary carrying each series' latest
 * and peak value and (b) a row/column table of the plotted samples, so the
 * quantitative payload exists outside the pixels.
 *
 * Every sentence is assembled from the caller's labels (the component passes
 * translated ones; the defaults keep this module testable on its own), and every
 * number goes through the axis' own formatter so the value a screen reader hears
 * is the value the axis prints.
 */

export interface ChartA11yLabels {
  fallbackTitle: string;
  unitIn: (unit: string) => string;
  range: (start: string, end: string) => string;
  seriesCount: (count: number) => string;
  fromRange: (start: string, end: string) => string;
  noValues: string;
  seriesKey: string;
  latestPeak: (name: string, latest: string, peak: string) => string;
  latest: (name: string, latest: string) => string;
  noValue: string;
  moreSeries: (count: number) => string;
  tableHint: string;
  timeColumn: string;
  sampleColumn: string;
  strideNote: (stride: number, total: number) => string;
  caption: (title: string) => string;
}

/** One plotted series reduced to the facts a summary can state. */
export interface SeriesFacts {
  name: string;
  samples: number;
  latest: number | null;
  peak: number | null;
  low: number | null;
}

export interface ChartTable {
  caption: string;
  columns: string[];
  rows: Array<{ label: string; cells: string[] }>;
  strideNote?: string;
}

const MAX_TABLE_ROWS = 120;

/** Reads only the structural fields of an ECharts point. */
const xOf = (point: any): any => {
  if (Array.isArray(point)) return point[0];
  if (point && typeof point === "object") return point.value ?? null;
  return point;
};

const yOf = (point: any): number | null => {
  const raw = Array.isArray(point) ? point[1] : point;
  if (raw === null || raw === undefined || raw === "") return null;
  const value = typeof raw === "object" ? raw.value : raw;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export const DEFAULT_LABELS: ChartA11yLabels = {
  fallbackTitle: "Chart",
  unitIn: (unit) => `in ${unit}`,
  range: (start, end) => `${start} to ${end}`,
  seriesCount: (count) => `${count} series`,
  fromRange: (start, end) => `from ${start} to ${end}`,
  noValues: "No values in this window.",
  seriesKey: "Series key",
  latestPeak: (name, latest, peak) => `${name}: latest ${latest}, peak ${peak}`,
  latest: (name, latest) => `${name}: latest ${latest}`,
  noValue: "no value",
  moreSeries: (count) => `and ${count} more series`,
  tableHint: "The full samples are available in the data table after this chart.",
  timeColumn: "Time",
  sampleColumn: "Sample",
  strideNote: (stride, total) => `Every ${stride}th sample of ${total} plotted.`,
  caption: (title) => `${title} — plotted values`,
};

const axisOf = (options: any, key: "xAxis" | "yAxis") =>
  Array.isArray(options?.[key]) ? options[key][0] : options?.[key];

/** The x extent, using the labels the axis itself prints under the plot. */
export const xAxisExtentOf = (options: any): { start: string; end: string } | null => {
  const data = axisOf(options, "xAxis")?.data;
  if (!Array.isArray(data) || data.length === 0) return null;
  const label = (entry: any): string => {
    if (Array.isArray(entry)) return String(entry[1] ?? entry[0] ?? "");
    if (entry && typeof entry === "object") return String(entry.value ?? "");
    return String(entry ?? "");
  };
  const start = label(data[0]);
  const end = label(data[data.length - 1]);
  if (!start || !end) return null;
  return { start, end };
};

/** Reduces plotted series to names, sample counts, latest value, peak and low. */
export const seriesFactsOf = (series: any): SeriesFacts[] => {
  if (!Array.isArray(series)) return [];
  return series
    .filter((entry: any) => entry && typeof entry === "object" && entry.name != null)
    .map((entry: any) => {
      const data = Array.isArray(entry.data) ? entry.data : [];
      const values = data.map(yOf).filter((v: number | null) => v !== null) as number[];
      const last = data.length ? yOf(data[data.length - 1]) : null;
      return {
        name: String(entry.name),
        samples: values.length,
        latest: last === null ? (values.length ? values[values.length - 1] : null) : last,
        peak: values.length ? Math.max(...values) : null,
        low: values.length ? Math.min(...values) : null,
      };
    });
};

export const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) return "—";
  const fractionDigits = Math.abs(value) >= 100 || Number.isInteger(value) ? 0 : 2;
  return value.toLocaleString("en-US", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  });
};

/** Formats a value with the y axis' own formatter so text and axis agree. */
export const valueFormatterOf = (options: any): ((value: number) => string) => {
  const formatter = axisOf(options, "yAxis")?.axisLabel?.formatter;
  if (typeof formatter !== "function") return formatNumber;
  return (value: number) => {
    try {
      const formatted = formatter(value);
      if (typeof formatted === "string" && formatted.trim()) return formatted.trim();
    } catch {
      // A formatter needing more than a bare value cannot be reused here.
    }
    return formatNumber(value);
  };
};

/** The unit the axis prints, lifted off a formatted sample tick ("4.00c/s"). */
export const unitOf = (options: any, facts: SeriesFacts[]): string | undefined => {
  const sample = facts.find((fact) => fact.peak !== null)?.peak;
  if (sample === undefined || sample === null) return undefined;
  const stripped = valueFormatterOf(options)(sample).replace(/[-0-9.,+\s]/g, "");
  return stripped.length > 0 && stripped.length <= 12 ? stripped : undefined;
};

const titleOf = (title: string | undefined, labels: ChartA11yLabels) =>
  title && title.trim() ? title.trim() : labels.fallbackTitle;

/** Accessible name: what is plotted, in what unit, over what window. */
export const chartAccessibleName = (
  title: string | undefined,
  options: any,
  facts: SeriesFacts[],
  labels: ChartA11yLabels = DEFAULT_LABELS,
): string => {
  const extent = xAxisExtentOf(options);
  const unit = unitOf(options, facts);
  const parts = [titleOf(title, labels)];
  if (unit) parts.push(labels.unitIn(unit));
  if (extent) parts.push(labels.range(extent.start, extent.end));
  return parts.join(", ");
};

/** The spoken equivalent: every drawn series, its latest value and its peak. */
export const chartSummaryText = (
  title: string | undefined,
  options: any,
  facts: SeriesFacts[],
  labels: ChartA11yLabels = DEFAULT_LABELS,
): string => {
  const extent = xAxisExtentOf(options);
  const unit = unitOf(options, facts);
  const drawn = facts.filter((fact) => fact.samples > 0);
  const head = [titleOf(title, labels) + ":", labels.seriesCount(drawn.length)];
  if (unit) head.push(labels.unitIn(unit));
  if (extent) head.push(labels.fromRange(extent.start, extent.end));
  if (!drawn.length) return `${head.join(" ")}. ${labels.noValues}`;

  const format = valueFormatterOf(options);
  const listed = drawn.slice(0, 12);
  const key = listed.map((fact) => {
    const latest = fact.latest === null ? labels.noValue : format(fact.latest);
    return fact.peak === null
      ? labels.latest(fact.name, latest)
      : labels.latestPeak(fact.name, latest, format(fact.peak));
  });
  if (drawn.length > listed.length) key.push(labels.moreSeries(drawn.length - listed.length));
  return `${head.join(" ")}. ${labels.seriesKey} — ${key.join("; ")}. ${labels.tableHint}`;
};

const labelOfX = (x: any, options: any): string => {
  const data = axisOf(options, "xAxis")?.data;
  const list = Array.isArray(data) ? data : [];
  const key = (entry: any) => (Array.isArray(entry) ? entry[0] : entry);
  const asMs = Number(x);
  // Converters carry the axis in s, ms or µs depending on the query path, so the
  // tick that prints under this point is found by value at any of the three scales.
  const sameInstant = (entry: any) => {
    if (String(key(entry)) === String(x)) return true;
    const k = Number(key(entry));
    if (!Number.isFinite(k) || !Number.isFinite(asMs)) return false;
    return k === asMs || k / 1000 === asMs || k * 1000 === asMs;
  };
  const match = list.find(sameInstant);
  const raw = Array.isArray(match)
    ? String(match[1] ?? x)
    : match !== undefined
      ? String(match)
      : null;
  // A converter may hand the point's x as the formatted date itself, so every
  // exit is normalised, not just the one that found the axis tick.
  if (raw !== null) return readableTimestamp(raw) ?? raw;
  if (Number.isFinite(asMs) && asMs > 1e11) {
    return new Date(asMs).toISOString().slice(0, 19).replace("T", " ");
  }
  if (!Number.isFinite(asMs) && typeof x === "string") return readableTimestamp(x) ?? x;
  return Number.isFinite(asMs) ? formatNumber(asMs) : String(x);
};

/** A time-series converter stores the axis row label as a bare ISO string; a
 *  screen reader reads the milliseconds too, so the row header drops them. */
const readableTimestamp = (value: string): string | null => {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/.exec(value);
  return match ? `${match[1]} ${match[2]}` : null;
};

/** The plotted samples as a real table: one row per x, one column per series. */
export const chartTableOf = (
  title: string | undefined,
  options: any,
  series: any,
  labels: ChartA11yLabels = DEFAULT_LABELS,
): ChartTable | null => {
  const list = Array.isArray(series) ? series.filter((s: any) => s && s.name != null) : [];
  if (list.length === 0) return null;
  const format = valueFormatterOf(options);
  const columns = list.map((entry: any) => String(entry.name));

  const rowsByX = new Map<string, { x: any; cells: Array<string | null> }>();
  list.forEach((entry: any, index: number) => {
    const data = Array.isArray(entry.data) ? entry.data : [];
    data.forEach((point: any) => {
      const x = xOf(point);
      if (x === null || x === undefined || x === "") return;
      const key = String(x);
      if (!rowsByX.has(key)) {
        rowsByX.set(key, { x, cells: columns.map(() => null) });
      }
      const value = yOf(point);
      if (value !== null) rowsByX.get(key)!.cells[index] = format(value);
    });
  });

  const ordered = [...rowsByX.values()];
  if (!ordered.length) return null;
  const stride = Math.max(1, Math.ceil(ordered.length / MAX_TABLE_ROWS));
  const shown = ordered.filter((_, index) => index % stride === 0);
  const extent = xAxisExtentOf(options);
  // A time axis may carry no `data` array, so a formatted row header is the
  // other way to tell the operator that column one is a clock, not a category.
  const firstLabel = labelOfX(ordered[0].x, options);
  const isTime = !!extent || /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(firstLabel);

  return {
    caption: labels.caption(titleOf(title, labels)),
    columns: [isTime ? labels.timeColumn : labels.sampleColumn, ...columns],
    rows: shown.map((row) => ({
      label: labelOfX(row.x, options),
      cells: row.cells.map((cell) => cell ?? "—"),
    })),
    ...(stride > 1 ? { strideNote: labels.strideNote(stride, ordered.length) } : {}),
  };
};
