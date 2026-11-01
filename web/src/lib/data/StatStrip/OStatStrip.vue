<script setup lang="ts">
// Copyright 2026 OpenObserve Inc.
//
// OStatStrip — the responsive row that lays out OStatCards. Two ways to use it:
//
//   1. Data-driven (simple counts): pass `items`.
//        <OStatStrip :items="stats" :loading="loading" />
//   2. Composed (custom tiles, charts, etc.): use the default slot with
//      <OStatCard> children.
//
// Set `selectable` to turn the tiles into filter toggles: each becomes a button,
// the one whose key === `selectedKey` shows the active ring, and clicking emits
// `select` with the item key.
//
// It always occupies its space (fixed tile height + skeleton while `loading`) so
// data arriving never shifts the layout below it.

import { computed, ref, watch } from "vue";

import OStatCard from "./OStatCard.vue";
import type { StatItem } from "./OStatStrip.types";

const props = withDefaults(
  defineProps<{
    items?: StatItem[];
    loading?: boolean;
    /** Make the tiles clickable filter toggles. */
    selectable?: boolean;
    /** Key of the currently-selected tile (draws the ring). */
    selectedKey?: string | null;
    /**
     * Tile that reads as active when nothing is filtered — the "All"/"Total"
     * one. Without it the strip shows no tile selected while the list behind it
     * shows everything, which is a state the control cannot express, and the
     * reset tile is a button that never looks pressed.
     */
    defaultKey?: string | null;
    /**
     * Narrows the wrap threshold for strips of short-labelled tiles (filter
     * counts, buckets), so five or six fit one row instead of wrapping to two.
     * Leave off for the standard strip — long labels need the wider basis.
     */
    compact?: boolean;
  }>(),
  {
    items: () => [],
    loading: false,
    selectable: false,
    selectedKey: null,
    defaultKey: null,
    compact: false,
  },
);

const emit = defineEmits<{ select: [key: string] }>();

// Only the FIRST load blanks the values: a refresh keeps the last numbers rather than flickering every tile.
const settled = ref(false);
watch(
  () => props.loading,
  (loading, wasLoading) => {
    if (wasLoading && !loading) settled.value = true;
  },
);
const showSkeleton = computed(() => props.loading && !settled.value);

// Callers spell "no filter" as null, "all", or a key they never render — all three mean the default tile.
const activeKey = computed(() => {
  if (!props.selectable) return null;
  const named = props.items.some((item) => item.key === props.selectedKey);
  return named ? props.selectedKey : props.defaultKey;
});

const onCardClick = (item: StatItem) => {
  if (props.selectable && item.selectable !== false) emit("select", item.key);
};
</script>

<template>
  <div
    :class="[
      'grid gap-2 max-lg:gap-1.5',
      compact
        ? 'grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]'
        : 'grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]',
    ]"
    data-test="o-stat-strip"
  >
    <!-- An auto-fit grid, not a growing flex row: every tile in the strip is the
         same width and the columns line up down the strip. Under flex, a strip
         whose last row held one tile stretched that tile across the canvas, so
         the same component measured 256px on one screen and 210px plus a full-
         width orphan on the next. -->
    <OStatCard
      v-for="item in items"
      :key="item.key"
      :label="item.label"
      :value="item.value"
      :sub="item.sub"
      :sub-icon="item.subIcon"
      :sub-tooltip="item.subTooltip"
      :icon="item.icon"
      :tone="item.tone"
      :trend="item.trend"
      :max="item.max"
      :loading="showSkeleton"
      :clickable="selectable && item.selectable !== false"
      :selected="item.selectable !== false && activeKey === item.key"
      :data-test="item.dataTest"
      @click="onCardClick(item)"
    />
    <slot />
  </div>
</template>
