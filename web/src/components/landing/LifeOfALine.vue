<script setup lang="ts">
// Copyright 2026 OpenObserve Inc.

// "What one line does": three quiet labeled fragments, each showing one phase
// of a line's life. The arrival card is a static receipt, not a second copy
// of the hero explorer.
import { ref } from "vue";
import { useI18nTyped } from "@/types/i18n";
import { LOG_ROWS } from "./sampleData";

const { t } = useI18nTyped();

const LEVELS = ["info", "warn", "error"] as const;
const level = ref<number>(2);

const F = {
  stream: "app_logs",
  post: "POST · 200",
  q: "/app_logs/_search?q=error",
  ms: "21 ms",
  cond: "count(level='error') >= 2 in 5m",
};
const fired = ref(false);
</script>

<template>
  <section id="one-line" aria-labelledby="live-h" class="scroll-mt-24">
    <div class="mx-auto max-w-7xl px-6 pt-12 md:px-10 md:pt-14">
      <h2
        id="live-h"
        class="text-text-heading text-2xl font-semibold tracking-tight md:text-3xl"
        data-reveal
      >
        {{ t("welcome.oneLine.heading") }}
      </h2>

      <div class="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-stretch">
        <div class="min-w-0" data-reveal>
          <p class="text-compact text-text-body">{{ t("welcome.oneLine.arrives") }}</p>
          <div class="rounded-surface border-border-subtle bg-surface-panel mt-3 h-full border p-4">
            <div class="flex items-center justify-between gap-3">
              <p class="text-text-heading font-mono text-xs">{{ F.stream }}</p>
              <p class="text-text-secondary font-mono text-xs">{{ F.post }}</p>
            </div>
            <ul
              class="divide-border-subtle border-border-subtle mt-3 flex flex-col divide-y border-t"
            >
              <li
                v-for="r in LOG_ROWS.slice(0, 3)"
                :key="r.id"
                class="flex items-baseline gap-3 py-2"
              >
                <span class="text-text-secondary shrink-0 font-mono text-xs tabular-nums">{{
                  r.time
                }}</span>
                <span
                  class="rounded-default bg-surface-subtle text-text-heading inline-flex h-5 shrink-0 items-center gap-1.5 px-1.5 font-mono text-xs"
                >
                  <span
                    class="size-1.5 rounded-full"
                    :class="
                      r.level === 'error'
                        ? 'bg-severity-error'
                        : r.level === 'warn'
                          ? 'bg-severity-warn'
                          : 'bg-severity-info'
                    "
                    aria-hidden="true"
                  />{{ r.level }}</span
                >
                <span class="text-text-body min-w-0 truncate text-sm">{{ r.message }}</span>
              </li>
            </ul>
            <p class="text-compact text-text-body mt-3">{{ t("welcome.oneLine.arrivesNote") }}</p>
          </div>
        </div>

        <div class="min-w-0 space-y-8 lg:contents">
          <div data-reveal>
            <p class="text-compact text-text-body">{{ t("welcome.oneLine.look") }}</p>
            <div
              class="rounded-surface border-border-subtle bg-surface-panel mt-3 h-full border p-4"
            >
              <div class="flex items-baseline justify-between gap-3">
                <p class="text-text-heading font-mono text-xs">{{ F.q }}</p>
                <p class="text-text-secondary font-mono text-xs tabular-nums">{{ F.ms }}</p>
              </div>
              <ul
                class="divide-border-subtle border-border-subtle mt-3 flex flex-col divide-y border-t"
              >
                <li
                  v-for="r in LOG_ROWS.filter((x) => x.level === 'error').slice(0, 3)"
                  :key="r.id"
                  class="flex items-baseline gap-3 py-2"
                >
                  <span class="text-text-secondary shrink-0 font-mono text-xs tabular-nums">{{
                    r.time
                  }}</span>
                  <span class="text-text-body min-w-0 truncate text-sm">{{ r.message }}</span>
                </li>
              </ul>
              <p class="text-compact text-text-body mt-3">{{ t("welcome.oneLine.lookNote") }}</p>
            </div>
          </div>

          <div data-reveal>
            <p class="text-compact text-text-body">{{ t("welcome.oneLine.warns") }}</p>
            <div
              class="rounded-surface border-border-subtle bg-surface-panel mt-3 h-full border p-4"
              data-test="landing-alert-demo"
            >
              <p class="text-text-code font-mono text-xs">{{ F.cond }}</p>
              <div class="mt-3 grid grid-cols-3 gap-2">
                <span
                  v-for="(lv, i) in LEVELS"
                  :key="lv"
                  class="rounded-default inline-flex items-center justify-center gap-1.5 px-2 py-1 font-mono text-xs whitespace-nowrap"
                  :class="
                    i === level
                      ? 'bg-text-heading text-surface-panel'
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
              <div class="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  class="rounded-default border-border-strong text-compact text-text-heading hover:bg-surface-subtle focus-visible:ring-text-heading inline-flex h-9 shrink-0 items-center border px-3 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  data-test="landing-alert-trigger"
                  @click="((level = (level + 1) % 3), (fired = level === 2))"
                >
                  {{ t("welcome.oneLine.alertRun") }}
                </button>
                <p
                  v-if="fired"
                  class="text-text-heading inline-flex items-center gap-2 font-mono text-xs"
                  data-test="landing-alert-state"
                  role="status"
                >
                  <span class="bg-text-heading size-1.5 rounded-full" aria-hidden="true" />{{
                    t("welcome.oneLine.alertFired")
                  }}
                </p>
                <p
                  v-else
                  class="text-text-body font-mono text-xs"
                  data-test="landing-alert-state"
                  role="status"
                >
                  {{ t("welcome.oneLine.notify") }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
