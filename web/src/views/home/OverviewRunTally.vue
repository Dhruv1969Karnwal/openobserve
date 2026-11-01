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
  OverviewRunTally — every alert run the selected range returned, counted.
  OverviewTab fetches up to 500 history rows and lists six, so this footer is
  the window's own remainder: what the rows left out, and the span they cover.
  Colour sits on the dot, ink on the number.
-->
<template>
  <div
    class="border-t-border-default text-2xs flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-t-[0.0625em] px-3.5 py-2"
    data-test="overview-run-tally"
  >
    <span v-if="firing > 0" class="flex items-center gap-1.5">
      <span class="bg-badge-error-solid-bg inline-block h-2 w-2 shrink-0" aria-hidden="true" />
      <span class="text-text-body font-medium tabular-nums"
        >{{ firing }} {{ t("alerts.historyTimeline.firing") }}</span
      >
    </span>
    <span v-if="errored > 0" class="flex items-center gap-1.5">
      <span class="bg-badge-warning-solid-bg inline-block h-2 w-2 shrink-0" aria-hidden="true" />
      <span class="text-text-body font-medium tabular-nums"
        >{{ errored }} {{ t("alerts.historyTimeline.error") }}</span
      >
    </span>
    <span v-if="pending > 0" class="flex items-center gap-1.5">
      <span class="bg-badge-blue-solid-bg inline-block h-2 w-2 shrink-0" aria-hidden="true" />
      <span class="text-text-body font-medium tabular-nums"
        >{{ pending }} {{ t("alerts.historyTimeline.pending") }}</span
      >
    </span>
    <span v-if="healthy > 0" class="flex items-center gap-1.5">
      <span class="bg-badge-success-solid-bg inline-block h-2 w-2 shrink-0" aria-hidden="true" />
      <span class="text-text-secondary tabular-nums"
        >{{ healthy }} {{ t("alerts.historyTimeline.ok") }}</span
      >
    </span>
    <span v-if="skipped > 0" class="flex items-center gap-1.5">
      <span class="bg-border-default inline-block h-2 w-2 shrink-0" aria-hidden="true" />
      <span class="text-text-secondary tabular-nums"
        >{{ skipped }} {{ t("alerts.historyTimeline.skipped") }}</span
      >
    </span>
    <span v-if="spanLabel" class="text-text-secondary ms-auto tabular-nums">{{ spanLabel }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18nTyped } from "@/types/i18n";
import {
  isErrorOutcome,
  isFiringOutcome,
  isOkOutcome,
  isPendingOutcome,
} from "@/utils/alerts/runOutcome";

const props = defineProps<{
  runs: Array<{ status: string; timestamp: number }>;
}>();

const { t } = useI18nTyped();

const firing = computed(() => props.runs.filter((r) => isFiringOutcome(r.status)).length);
const errored = computed(() => props.runs.filter((r) => isErrorOutcome(r.status)).length);
const healthy = computed(() => props.runs.filter((r) => isOkOutcome(r.status)).length);
// `pending` is its own outcome, never folded into healthy or skipped.
const pending = computed(() => props.runs.filter((r) => isPendingOutcome(r.status)).length);
const skipped = computed(
  () =>
    props.runs.filter(
      (r) =>
        !isFiringOutcome(r.status) &&
        !isOkOutcome(r.status) &&
        !isErrorOutcome(r.status) &&
        !isPendingOutcome(r.status),
    ).length,
);

const stampOf = (ts: number) =>
  new Date(ts > 1e12 ? ts / 1000 : ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** The rows this count actually covers — a sampled page never claims the range. */
const spanLabel = computed(() => {
  if (props.runs.length < 2) return "";
  const stamps = props.runs.map((r) => r.timestamp).sort((a, b) => a - b);
  return `${stampOf(stamps[0])} – ${stampOf(stamps[stamps.length - 1])}`;
});
</script>
