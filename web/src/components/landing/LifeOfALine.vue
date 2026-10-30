<script setup lang="ts">
// Copyright 2026 OpenObserve Inc.

// "What one line does": three product fragments shown as a single-column
// stack — label above each fragment, left-aligned on the page grid.
import { ref } from "vue";
import { useI18nTyped } from "@/types/i18n";
import { LOG_ROWS } from "./sampleData";
import LogFragment from "./LogFragment.vue";

const { t } = useI18nTyped();

const LEVELS = ["info", "warn", "error"] as const;
const level = ref<number>(2);
const metric = ref(42);
</script>

<template>
  <section id="one-line" aria-labelledby="live-h" class="scroll-mt-24">
    <div class="mx-auto max-w-7xl px-6 pt-16 md:px-10 md:pt-20">
      <h2
        id="live-h"
        class="text-text-heading text-2xl font-semibold tracking-tight md:text-3xl"
        data-reveal
      >
        {{ t("welcome.oneLine.heading") }}
      </h2>

      <div class="mt-10 flex flex-col gap-12 lg:flex-row lg:items-start lg:gap-10">
        <div class="min-w-0 lg:w-1/2" data-reveal>
          <p class="text-compact text-text-secondary uppercase">
            {{ t("welcome.oneLine.arrives") }}
          </p>
          <LogFragment :rows="LOG_ROWS.slice(0, 4)" show-toolbar="false" class="mt-3" />
        </div>

        <div class="min-w-0 space-y-12 lg:w-1/2">
          <div data-reveal>
            <p class="text-compact text-text-secondary uppercase">
              {{ t("welcome.oneLine.look") }}
            </p>
            <div class="rounded-surface border-border-subtle bg-surface-panel mt-3 border p-5">
              <div class="space-y-3">
                <div
                  v-for="(r, i) in LOG_ROWS.slice(0, 3)"
                  :key="r.id"
                  class="grid grid-cols-[5.5rem_minmax(0,1fr)_3rem] items-center gap-3"
                >
                  <span class="text-text-secondary font-mono text-xs tabular-nums"
                    >{{ r.time.slice(-12, -7) }}:{{ String(i).padStart(2, "0") }}</span
                  >
                  <span
                    class="bg-text-heading h-2 rounded-none"
                    :style="{ width: `${[72, 40, 88][i]}%`, opacity: 0.25 - i * 0.06 }"
                  />
                  <span class="text-text-secondary text-end font-mono text-xs tabular-nums">{{
                    [142, 96, 58][i]
                  }}</span>
                </div>
              </div>
            </div>
          </div>

          <div data-reveal>
            <p class="text-compact text-text-secondary uppercase">
              {{ t("welcome.oneLine.warns") }}
            </p>
            <div
              class="rounded-surface border-border-strong bg-surface-panel mt-3 border p-5"
              data-test="landing-alert-demo"
            >
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-compact text-text-secondary">{{
                  t("welcome.oneLine.alertCond")
                }}</span>
                <span
                  v-for="(lv, i) in LEVELS"
                  :key="lv"
                  class="rounded-default inline-flex items-center gap-1.5 px-2 py-1 font-mono text-xs"
                  :class="
                    i === level
                      ? 'bg-surface-active text-text-heading'
                      : 'bg-surface-subtle text-text-body'
                  "
                >
                  <span
                    class="size-1.5 rounded-full"
                    :class="
                      lv === 'error'
                        ? 'bg-severity-error'
                        : lv === 'warn'
                          ? 'bg-severity-warn'
                          : 'bg-severity-info'
                    "
                    aria-hidden="true"
                  />{{ lv }}
                </span>
              </div>
              <div class="mt-4 flex items-center gap-4">
                <button
                  type="button"
                  class="rounded-surface border-border-strong text-compact text-text-heading focus-visible:ring-text-heading hover:bg-surface-subtle inline-flex h-10 shrink-0 items-center gap-2 border px-4 outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  data-test="landing-alert-trigger"
                  @click="
                    ((level = (level + 1) % 3), (metric = 30 + Math.round(Math.random() * 60)))
                  "
                >
                  {{ t("welcome.oneLine.alertRun") }}
                </button>
                <div class="min-w-0">
                  <div class="flex items-baseline justify-between gap-4">
                    <p class="text-compact text-text-secondary">
                      {{ t("welcome.oneLine.alertMetric") }}
                    </p>
                    <p class="text-text-heading font-mono text-sm tabular-nums">{{ metric }}</p>
                  </div>
                  <div
                    class="bg-surface-subtle mt-1.5 h-2"
                    role="img"
                    :aria-label="t('welcome.fragment.eventsChart')"
                  >
                    <div
                      class="bg-text-heading h-2 transition-[width] duration-300 motion-reduce:transition-none"
                      :style="{ width: `${metric}%` }"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
