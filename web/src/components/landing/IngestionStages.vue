<script setup lang="ts">
// Copyright 2026 OpenObserve Inc.

// How it works: a real range input drags through the ingestion story. The
// clause and the product fragment swap together; keyboard-operable by design.
// Commands are the ones the in-app ingestion guide prints (port 5080 default).
import { computed, ref } from "vue";
import { useI18nTyped } from "@/types/i18n";

const { t } = useI18nTyped();
const stage = ref(0);
const TOTAL = 4;

const CLAUSE_KEYS = [
  "welcome.stages.c0",
  "welcome.stages.c1",
  "welcome.stages.c2",
  "welcome.stages.c3",
] as const;
const LABEL_KEYS = [
  "welcome.stages.n0",
  "welcome.stages.n1",
  "welcome.stages.n2",
  "welcome.stages.n3",
] as const;

const ARRIVAL_ROWS = [
  { at: "welcome.stages.qJustNow", msg: "welcome.stages.a_r1" },
  { at: "welcome.stages.qS2", msg: "welcome.stages.a_r2" },
  { at: "welcome.stages.qS5", msg: "welcome.stages.a_r3" },
] as const;

const SEARCH_ROWS = [
  { at: "14:32:06.902", msg: "welcome.stages.s_r1" },
  { at: "14:32:04.886", msg: "welcome.stages.s_r2" },
] as const;

const CHIP = { left: "level", op: "=", val: "error" };

const pct = computed(() => (stage.value / (TOTAL - 1)) * 100);

const CURL = `curl -u [EMAIL]:[PASSCODE] -k \\
  http://localhost:5080/api/default/app_logs/_json \\
  -d '[{"level":"info","service":"billing",
        "msg":"charge accepted"}]'`;
</script>

<template>
  <section
    id="how-it-works"
    aria-labelledby="how-h"
    class="mx-auto max-w-7xl scroll-mt-24 px-6 py-28 md:px-10 md:py-36"
  >
    <h2 id="how-h" class="text-text-heading text-2xl font-semibold tracking-tight" data-reveal>
      {{ t("welcome.stages.heading") }}
    </h2>

    <div
      class="mt-16 grid min-h-96 grid-cols-1 items-center gap-12 md:grid-cols-2 md:gap-16"
      data-reveal
    >
      <!-- clause -->
      <p
        :key="stage"
        class="stage-clause text-text-heading"
        aria-live="polite"
        data-test="landing-stage-clause"
      >
        {{ t(CLAUSE_KEYS[stage]) }}
      </p>

      <!-- fragment -->
      <div class="min-h-72" data-ui>
        <div
          v-if="stage === 0"
          data-test="landing-stage-connect"
          class="rounded-surface border-border-subtle bg-surface-panel overflow-hidden border"
        >
          <p class="border-border-subtle text-2xs text-text-secondary border-b px-3 py-2 font-mono">
            {{ t("welcome.stages.terminal") }}
          </p>
          <pre class="text-text-code overflow-x-auto px-4 py-3 font-mono text-xs leading-6">{{
            CURL
          }}</pre>
          <p class="border-border-subtle text-2xs text-text-heading border-t px-4 py-2.5 font-mono">
            {{ t("welcome.stages.ok") }}
          </p>
        </div>

        <div
          v-else-if="stage === 1"
          data-test="landing-stage-arrival"
          class="rounded-surface border-border-subtle bg-surface-panel overflow-hidden border"
        >
          <p class="border-border-subtle text-2xs text-text-secondary border-b px-3 py-2 font-mono">
            {{ t("welcome.stages.searchScope") }}
          </p>
          <ul class="divide-border-subtle divide-y">
            <li v-for="r in ARRIVAL_ROWS" :key="r.at" class="flex items-baseline gap-3 px-4 py-2.5">
              <span class="text-2xs text-text-secondary w-16 shrink-0 font-mono">{{
                t(r.at)
              }}</span>
              <span class="text-compact text-text-body">{{ t(r.msg) }}</span>
            </li>
          </ul>
        </div>

        <div
          v-else-if="stage === 2"
          data-test="landing-stage-search"
          class="rounded-surface border-border-subtle bg-surface-panel overflow-hidden border"
        >
          <div class="border-border-subtle flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
            <span
              class="rounded-default bg-surface-subtle text-2xs text-text-heading inline-flex h-6 items-center gap-1.5 px-2 font-mono"
            >
              {{ CHIP.left }} {{ CHIP.op }} <em class="not-italic">{{ CHIP.val }}</em>
            </span>
            <span class="text-2xs text-text-secondary font-mono">{{
              t("welcome.stages.rowCount")
            }}</span>
          </div>
          <ul class="divide-border-subtle divide-y">
            <li v-for="r in SEARCH_ROWS" :key="r.at" class="flex items-baseline gap-3 px-4 py-2.5">
              <span class="text-2xs text-text-secondary w-24 shrink-0 font-mono tabular-nums">{{
                r.at
              }}</span>
              <span class="text-compact text-log-severity-error-indicator truncate">{{
                t(r.msg)
              }}</span>
            </li>
          </ul>
        </div>

        <div
          v-else
          data-test="landing-stage-alert"
          class="rounded-surface border-border-subtle bg-surface-panel overflow-hidden border"
        >
          <p class="border-border-subtle text-2xs text-text-secondary border-b px-3 py-2 font-mono">
            {{ t("welcome.stages.alertPanel") }}
          </p>
          <div class="px-4 py-3">
            <p class="text-text-code font-mono text-xs leading-6">
              {{ t("welcome.stages.alertCond") }}
            </p>
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <span class="text-compact text-text-secondary">{{
                t("welcome.stages.notifyLabel")
              }}</span>
              <span
                class="rounded-default bg-surface-subtle text-2xs text-text-heading inline-flex h-6 items-center px-2 font-mono"
              >
                {{ t("welcome.stages.tEmail") }}
              </span>
              <span
                class="rounded-default bg-surface-subtle text-2xs text-text-heading inline-flex h-6 items-center px-2 font-mono"
              >
                {{ t("welcome.stages.tWebhook") }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- the real slider across both fields -->
    <div class="mt-14">
      <label for="landing-stages" class="sr-only">{{ t("welcome.stages.slider") }}</label>
      <input
        id="landing-stages"
        v-model.number="stage"
        type="range"
        min="0"
        :max="TOTAL - 1"
        step="1"
        class="stage-range focus-visible:outline-focus-ring-accent w-full focus-visible:outline-2 focus-visible:outline-offset-4"
        :style="{
          background: `linear-gradient(to right, var(--color-text-heading) ${pct}%, var(--color-surface-subtle) ${pct}%)`,
        }"
        data-test="landing-stage-slider"
      />
      <ol
        class="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4"
        :aria-label="t('welcome.stages.stagesLabel')"
      >
        <li v-for="(lk, i) in LABEL_KEYS" :key="lk">
          <button
            type="button"
            class="rounded-default focus-visible:outline-focus-ring-accent py-1 text-start text-base transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
            :class="
              i === stage
                ? 'text-text-heading font-medium'
                : 'text-text-secondary hover:text-text-heading'
            "
            :aria-current="i === stage ? 'step' : undefined"
            data-test="landing-stage-name"
            @click="stage = i"
          >
            {{ t(lk) }}
          </button>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
/* keep(complex-state): the clause’s swap animation and the range slider's thumb/track
   have no utility equivalents; both are token-fed and reduced-motion guarded. */

.stage-clause {
  font-size: clamp(2.25rem, 4.6vw, 4.25rem);
  line-height: 1.02;
  letter-spacing: var(--tracking-tight);
  font-weight: var(--font-semibold);
  animation: stage-in 0.25s ease-out both;
}
@keyframes stage-in {
  from {
    opacity: 0;
    transform: translateY(0.5rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.stage-range {
  appearance: none;
  height: 0.5rem;
  border-radius: var(--radius-full);
  cursor: pointer;
}
.stage-range::-webkit-slider-thumb {
  appearance: none;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-default);
  background: var(--color-text-heading);
  border: 0;
}
.stage-range::-moz-range-thumb {
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-default);
  background: var(--color-text-heading);
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .stage-clause {
    animation: none;
  }
}
</style>
