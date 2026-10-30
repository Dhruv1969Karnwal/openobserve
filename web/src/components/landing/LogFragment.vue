<script setup lang="ts">
// Copyright 2026 OpenObserve Inc.

// A working fragment of the log-search view for the public landing page:
// real product controls (tabs, search, severity chips, expandable rows) over
// example stream data. Root carries data-ui so design gates read it as the
// product's own chrome (its borders and chips are the product's).
import { computed, ref } from "vue";
import { useI18nTyped } from "@/types/i18n";
import { SAMPLE_JSON_FIELDS, SAMPLE_METRICS, SAMPLE_ROWS, SAMPLE_TRACES } from "./sampleData";

const { t } = useI18nTyped();

const props = withDefaults(defineProps<{ compact?: boolean }>(), { compact: false });

const tab = ref<"logs" | "metrics" | "traces">("logs");
const query = ref("");
const levelsOn = ref(new Set(["info", "warn", "error", "debug"]));
const openRow = ref<string | null>(null);

const matched = computed(() =>
  SAMPLE_ROWS.filter((r) => {
    if (!levelsOn.value.has(r.level)) return false;
    const q = query.value.trim().toLowerCase();
    if (!q) return true;
    return (
      r.message.toLowerCase().includes(q) || r.level.includes(q) || (r.traceId ?? "").includes(q)
    );
  }),
);

const chipStyles: Record<string, string> = {
  info: "text-text-heading border-log-severity-info-indicator",
  warn: "text-text-heading border-log-severity-warning-indicator",
  error: "text-text-heading border-log-severity-error-indicator",
  debug: "text-text-heading border-log-severity-debug-indicator",
};

const LEVELS = ["info", "warn", "error", "debug"] as const;

const TAB_KEYS = {
  logs: "welcome.fragment.tabLogs",
  metrics: "welcome.fragment.tabMetrics",
  traces: "welcome.fragment.tabTraces",
} as const;

const QUOTE = String.fromCharCode(34);
const SEP = ": ";

function quoted(v: string): string {
  return QUOTE + v + QUOTE;
}

function jsonClass(kind: string): string {
  return kind === "bool" ? "log-boolean" : "log-" + kind;
}

const MAX_ROWS = 7;
const visible = computed(() => matched.value.slice(0, MAX_ROWS));
const moreRows = computed(() => Math.max(0, matched.value.length - MAX_ROWS));

function toggleLevel(level: string) {
  const next = new Set(levelsOn.value);
  if (next.has(level)) next.delete(level);
  else next.add(level);
  if (next.size === 0) next.add(level);
  levelsOn.value = next;
}

function rowKey(row: { time: string; traceId?: string }): string {
  return row.traceId ?? row.time;
}

const spark = computed(() => {
  const s = SAMPLE_METRICS.series;
  const w = 560;
  const h = 96;
  const max = Math.max(...s);
  const min = Math.min(...s);
  return s
    .map((v, i) => {
      const x = (i / (s.length - 1)) * w;
      const y = h - ((v - min) / (max - min)) * (h - 12) - 6;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
});
</script>

<template>
  <section
    data-ui
    data-test="landing-log-fragment"
    class="rounded-surface border-border-subtle bg-surface-panel overflow-hidden border"
    :aria-label="t('welcome.fragment.aria')"
  >
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 pt-3">
      <div
        role="tablist"
        :aria-label="t('welcome.fragment.signal')"
        class="flex items-center gap-1"
      >
        <button
          v-for="tb in ['logs', 'metrics', 'traces'] as const"
          :key="tb"
          role="tab"
          :aria-selected="tab === tb"
          data-test="landing-fragment-tab"
          class="rounded-default text-compact focus-visible:ring-text-heading h-8 px-3 font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          :class="
            tab === tb
              ? 'bg-text-heading text-surface-base'
              : 'text-text-secondary hover:bg-surface-subtle hover:text-text-heading'
          "
          @click="tab = tb"
        >
          {{ t(TAB_KEYS[tb]) }}
        </button>
      </div>
      <span
        v-if="tab === 'logs'"
        class="text-text-secondary ms-auto font-mono text-xs tabular-nums"
        data-test="landing-fragment-count"
      >
        {{ t("welcome.fragment.rowsShown", { shown: visible.length, total: matched.length }) }}
      </span>
    </div>

    <div v-if="tab === 'logs'" class="px-3 pt-3">
      <label class="relative block sm:max-w-80">
        <span class="sr-only">{{ t("welcome.fragment.filter") }}</span>
        <svg
          class="text-text-secondary pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
        >
          <circle cx="7" cy="7" r="4.5" />
          <path d="m10.5 10.5 3 3" stroke-linecap="round" />
        </svg>
        <input
          v-model="query"
          type="search"
          :placeholder="t('welcome.fragment.filterPlaceholder')"
          data-test="landing-fragment-search"
          class="rounded-default border-border-subtle bg-surface-base text-compact text-text-body placeholder:text-text-placeholder focus-visible:ring-text-heading h-8 w-full border ps-8 pe-2 outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        />
      </label>
      <div class="mt-2 flex flex-wrap items-center gap-1.5">
        <span class="text-text-body text-xs font-medium">{{ t("welcome.fragment.level") }}</span>
        <button
          v-for="lv in LEVELS"
          :key="lv"
          type="button"
          :aria-pressed="levelsOn.has(lv)"
          data-test="landing-fragment-level"
          class="bg-surface-base text-2xs focus-visible:ring-text-heading h-7 shrink-0 rounded-xs border-s-2 px-2 font-mono transition-opacity duration-150 outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          :class="[chipStyles[lv], levelsOn.has(lv) ? '' : 'opacity-40']"
          @click="toggleLevel(lv)"
        >
          {{ lv }}
        </button>
      </div>
    </div>

    <div class="p-3" :class="props.compact ? '' : 'min-h-80'">
      <template v-if="tab === 'logs'">
        <ul
          class="divide-border-subtle rounded-default bg-surface-base divide-y overflow-y-auto"
          :class="props.compact ? 'max-h-64' : 'max-h-80'"
        >
          <li v-for="(row, i) in visible" :key="row.time + i">
            <button
              type="button"
              class="hover:bg-surface-subtle focus-visible:ring-text-heading grid w-full grid-cols-[1rem_5.35rem_4.6rem_minmax(0,1fr)] items-baseline gap-x-2.5 gap-y-0.5 px-2.5 py-2 text-start transition-colors duration-100 outline-none focus-visible:ring-2 focus-visible:ring-inset lg:grid-cols-[0.5rem_5rem_4.6rem_1fr_4.5rem]"
              :aria-expanded="openRow === rowKey(row)"
              data-test="landing-fragment-row"
              @click="openRow = openRow === rowKey(row) ? null : rowKey(row)"
            >
              <svg
                viewBox="0 0 12 12"
                class="text-text-secondary size-3 shrink-0 translate-y-0.5 transition-transform duration-150 motion-reduce:transition-none"
                :class="openRow === rowKey(row) ? 'rotate-90' : ''"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="m4.5 2.5 4 3.5-4 3.5" />
              </svg>
              <span class="text-text-secondary font-mono text-xs tabular-nums">{{ row.time }}</span>
              <span
                class="bg-surface-subtle text-2xs rounded-xs border-s-2 px-1.5 py-px font-mono leading-4"
                :class="chipStyles[row.level]"
                >{{ row.level }}</span
              >
              <span class="text-compact text-text-body min-w-0 truncate">{{ row.message }}</span>
              <span
                class="text-text-body hidden text-end font-mono text-xs tabular-nums lg:block"
                >{{ row.duration }}</span
              >
            </button>
            <div
              v-if="openRow === rowKey(row)"
              class="log-highlight border-border-subtle bg-surface-subtle border-t px-4 py-2.5"
            >
              <div v-for="pair in SAMPLE_JSON_FIELDS" :key="pair[0]" class="leading-5">
                <span class="log-key">{{ quoted(pair[0]) }}</span>
                <span class="log-separator">{{ SEP }}</span>
                <span :class="jsonClass(pair[2])">{{ quoted(pair[1]) }}</span>
              </div>
            </div>
          </li>
          <li
            v-if="moreRows > 0"
            class="text-text-body px-3 py-2 text-center font-mono text-xs"
            data-test="landing-more-rows"
          >
            +{{ moreRows }} {{ t("welcome.fragment.moreRows") }}
          </li>
          <li
            v-if="matched.length === 0"
            class="text-compact text-text-secondary px-3 py-8 text-center"
          >
            {{ t("welcome.fragment.noMatch") }}
          </li>
        </ul>
      </template>

      <template v-else-if="tab === 'metrics'">
        <div
          class="divide-border-subtle rounded-default bg-surface-base grid grid-cols-1 overflow-hidden sm:grid-cols-3 sm:divide-x sm:divide-y-0"
        >
          <div v-for="kpi in SAMPLE_METRICS.kpis" :key="kpi.label" class="px-3 py-3">
            <p class="text-text-secondary text-xs font-medium">{{ kpi.label }}</p>
            <p class="text-text-heading mt-1 font-mono text-xl tabular-nums">{{ kpi.value }}</p>
          </div>
        </div>
        <div class="rounded-default bg-surface-base mt-3 p-3">
          <svg
            viewBox="0 0 560 96"
            class="text-text-heading h-24 w-full"
            role="img"
            :aria-label="t('welcome.fragment.eventsChart')"
          >
            <path
              :d="spark"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              vector-effect="non-scaling-stroke"
            />
          </svg>
          <p class="text-text-secondary mt-1 font-mono text-xs">
            {{ t("welcome.fragment.eventsFoot") }}
          </p>
        </div>
      </template>

      <template v-else>
        <ul class="rounded-default bg-surface-base px-3 py-3">
          <li v-for="span in SAMPLE_TRACES" :key="span.name" :class="span.depth ? 'ms-6' : ''">
            <div class="flex items-center gap-3 py-1.5">
              <span class="text-text-body w-36 shrink-0 truncate font-mono text-xs">{{
                span.name
              }}</span>
              <span class="bg-surface-subtle relative h-3 grow rounded-xs">
                <span
                  class="absolute inset-y-0 rounded-xs"
                  :class="span.selected ? 'bg-text-heading' : 'bg-text-secondary'"
                  :style="{ left: span.offset + '%', width: span.width + '%' }"
                />
              </span>
              <span
                class="text-text-secondary w-14 shrink-0 text-end font-mono text-xs tabular-nums"
                >{{ span.ms }}</span
              >
            </div>
          </li>
        </ul>
        <p class="text-text-secondary mt-2 px-1 font-mono text-xs">
          {{ t("welcome.fragment.traceFoot") }}
        </p>
      </template>
    </div>
  </section>
</template>
