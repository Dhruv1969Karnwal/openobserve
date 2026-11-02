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
  One error-budget story per row: how much budget is left, and how fast it is
  going. The axis carries a zero mark so an overspent budget paints an overrun
  instead of an empty track.
-->
<script setup lang="ts">
import { computed } from "vue";
import type { SloStatus } from "@/ts/interfaces/slo";
import { ABSENT, formatBudget, formatBurn } from "@/composables/useSloFormat";

const props = withDefaults(
  defineProps<{
    status?: SloStatus | null;
    enabled?: boolean;
  }>(),
  // Vue casts an absent Boolean prop to `false`, which would paint every row's
  // budget neutral; only an explicit `false` means paused.
  { enabled: undefined },
);

// Share of the track left of the zero mark, i.e. how far the overrun can grow
// before it runs out of room.
const OVERRUN_ZONE = 0.32;

const remaining = computed(() => {
  const v = props.status?.error_budget_remaining;
  return v === null || v === undefined || !Number.isFinite(v) ? null : v;
});

const hasBudget = computed(
  () => !!props.status && !props.status.no_data && remaining.value !== null,
);

const burn = computed(() => {
  const b = props.status?.burn_rate;
  return b === null || b === undefined || !Number.isFinite(b) ? null : b;
});

const toneClass = computed(() => {
  // A paused SLO's numbers are the last ones it measured, not a live state, so
  // the bar keeps the neutral ink and the severity stays on the live rows.
  if (props.enabled === false) return "bg-progress-bar-neutral";
  const v = remaining.value ?? 0;
  if (v <= 0) return "bg-progress-bar-danger";
  if (v < 25) return "bg-progress-bar-warning";
  return "bg-progress-bar-success";
});

const geometry = computed(() => {
  const v = remaining.value ?? 0;
  if (v >= 0) {
    const width = (Math.min(v, 100) / 100) * (1 - OVERRUN_ZONE);
    return { start: OVERRUN_ZONE, width };
  }
  const width = (Math.min(-v, 100) / 100) * OVERRUN_ZONE;
  return { start: OVERRUN_ZONE - width, width };
});

const segmentStyle = computed(() => ({
  insetInlineStart: `${(geometry.value.start * 100).toFixed(1)}%`,
  width: `${(geometry.value.width * 100).toFixed(1)}%`,
}));

const zeroStyle = computed(() => ({ insetInlineStart: `${OVERRUN_ZONE * 100}%` }));

const numberClass = computed(() => {
  const v = remaining.value ?? 0;
  if (v <= 0) return props.enabled === false ? "text-text-body" : "text-negative";
  return "text-text-heading";
});
</script>

<template>
  <span v-if="!hasBudget" class="text-text-secondary">{{ ABSENT }}</span>
  <span v-else class="flex min-w-0 items-center gap-1.5" data-test="slo-budget-cell">
    <span
      class="bg-progress-bar-track relative inline-block h-2 w-16 shrink-0 rounded-full"
      role="progressbar"
      :aria-valuenow="Math.round(remaining ?? 0)"
      aria-valuemin="-100"
      aria-valuemax="100"
      data-test="slo-budget-bar"
    >
      <span
        class="absolute inset-y-0 rounded-full"
        :class="toneClass"
        :style="segmentStyle"
        data-test="slo-budget-segment"
      ></span>
      <span
        class="bg-border-default absolute inset-y-0 w-px"
        :style="zeroStyle"
        data-test="slo-budget-zero"
      ></span>
    </span>
    <span class="text-compact font-semibold tabular-nums" :class="numberClass">{{
      formatBudget(remaining)
    }}</span>
    <span class="text-text-secondary text-compact tabular-nums" data-test="slo-budget-burn">{{
      formatBurn(burn)
    }}</span>
  </span>
</template>
