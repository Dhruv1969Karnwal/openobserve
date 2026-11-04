<!-- Copyright 2026 OpenObserve Inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
-->

<!--
  OverviewAnomalySeries — the buckets the anomaly check already answered for the
  selected range, drawn instead of thrown away. OverviewTab fetches
  `value`/`lower_bound`/`upper_bound` per bucket and used to keep only a count.

  Mark colour is the backend's own verdict (`anomaly_count > 0`), never an
  inference from the bounds, so the legend swatches say exactly what is painted.
  Two or fewer buckets are figures, not a shape: the plot stays hidden and the
  numbers carry it.
-->
<template>
  <div class="flex flex-wrap items-end gap-x-6 gap-y-2">
    <div v-if="plotable" class="flex min-w-[13.5rem] flex-1 flex-col gap-1">
      <div
        class="flex h-16 items-stretch gap-px"
        data-test="overview-anomaly-series-plot"
        role="img"
        :aria-label="ariaLabel"
      >
        <div v-for="(point, i) in points" :key="i" class="relative min-w-0 flex-1">
          <span
            class="absolute inset-x-0"
            :style="{
              top: offsetOf(point.upper) + '%',
              height: heightOf(point) + '%',
              background: BAND,
            }"
          />
          <span
            class="absolute inset-x-0 mx-auto h-0.5 w-2"
            :style="{ top: offsetOf(point.value) + '%', background: markOf(point) }"
          />
        </div>
      </div>
      <div class="text-2xs text-text-secondary flex justify-between tabular-nums">
        <span>{{ oldestLabel }}</span>
        <span>{{ newestLabel }}</span>
      </div>
    </div>

    <div v-if="head" class="ms-auto flex flex-wrap items-baseline gap-x-6 gap-y-1">
      <div class="flex items-baseline gap-2">
        <span
          v-if="plotable"
          class="inline-block h-0.5 w-2 align-middle"
          :style="{ background: INK }"
          aria-hidden="true"
        />
        <span class="text-text-secondary text-xs">{{ t("alerts.anomaly.seriesValue") }}</span>
        <span class="text-text-heading text-xl leading-none font-semibold tabular-nums">{{
          format(head.value)
        }}</span>
      </div>
      <div class="flex items-baseline gap-2">
        <span
          v-if="plotable"
          class="inline-block h-2 w-1.5 align-middle"
          :style="{ background: BAND }"
          aria-hidden="true"
        />
        <span class="text-text-secondary text-xs">{{
          t("alerts.anomaly.seriesExpectedRange")
        }}</span>
        <span class="text-text-body text-sm font-medium tabular-nums"
          >{{ format(head.lower) }}{{ "–" }}{{ format(head.upper) }}</span
        >
      </div>
      <div v-if="plotable" class="flex items-baseline gap-2">
        <span
          class="inline-block h-0.5 w-2 align-middle"
          :style="{ background: OUT }"
          aria-hidden="true"
        />
        <span class="text-text-secondary text-xs">{{ t("alerts.anomaly.seriesAnomaly") }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18nTyped, raw } from "@/types/i18n";

/** One scored bucket of an anomaly check, as the history endpoint returns it. */
export type AnomalySeriesPoint = {
  ts: number;
  value: number;
  lower: number;
  upper: number;
  anomalous: boolean;
};

const props = defineProps<{
  points: AnomalySeriesPoint[];
}>();

const { t } = useI18nTyped();

const BAND = "var(--color-chart-band)";
const INK = "var(--color-text-body)";
const OUT = "var(--color-status-error-text)";

const sorted = computed(() => [...props.points].sort((a, b) => a.ts - b.ts));

const plotable = computed(() => sorted.value.length > 2);

/** The scale spans every bound and every observation, so no mark is clipped. */
const lo = computed(() => Math.min(...sorted.value.map((p) => Math.min(p.lower, p.value))));
const hi = computed(() => Math.max(...sorted.value.map((p) => Math.max(p.upper, p.value))));
const range = computed(() => hi.value - lo.value);

const offsetOf = (value: number) =>
  range.value > 0 ? ((hi.value - value) / range.value) * 100 : 50;

const heightOf = (point: AnomalySeriesPoint) =>
  range.value > 0 ? ((point.upper - point.lower) / range.value) * 100 : 0;

const markOf = (point: AnomalySeriesPoint) => (point.anomalous ? OUT : INK);

/** The figure the row is about: the newest bucket the detector flagged. */
const head = computed(() => {
  const flagged = sorted.value.filter((p) => p.anomalous);
  return flagged.length ? flagged[flagged.length - 1] : sorted.value[sorted.value.length - 1];
});

const labelOf = (ts: number) =>
  new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const oldestLabel = computed(() => (sorted.value.length ? labelOf(sorted.value[0].ts) : ""));
const newestLabel = computed(() =>
  sorted.value.length ? labelOf(sorted.value[sorted.value.length - 1].ts) : "",
);

const format = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });

const ariaLabel = computed(() =>
  sorted.value.length
    ? `${t("alerts.anomaly.seriesValue")} ${format(head.value.value)} · ${t(
        "alerts.anomaly.seriesExpectedRange",
      )} ${format(head.value.lower)} – ${format(head.value.upper)} · ${oldestLabel.value} – ${
        newestLabel.value
      }`
    : raw("—"),
);
</script>
