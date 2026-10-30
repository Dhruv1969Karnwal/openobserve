<script setup lang="ts">
// Copyright 2026 OpenObserve Inc.

// How it works: a real range input with step nodes drives the ingestion story.
// Clause and product fragment swap together; keyboard-operable by design.
// The command is the one the in-app ingestion guide prints (port 5080 default).
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
  http://localhost:5080/api/default/
  app_logs/_json \\
  -d '[{"level":"info",
        "service":"billing",
        "msg":"charge accepted"}]'`;
</script>

<template>
  <section
    id="how-it-works"
    aria-labelledby="how-h"
    class="mx-auto max-w-7xl scroll-mt-24 px-6 py-20 md:px-10 md:py-28"
  >
    <h2
      id="how-h"
      class="text-text-heading text-2xl font-semibold tracking-tight md:text-3xl"
      data-reveal
    >
      {{ t("welcome.stages.heading") }}
    </h2>

    <div class="mt-10 grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16" data-reveal>
      <p
        :key="stage"
        class="stage-clause text-text-heading order-2 lg:order-1"
        aria-live="polite"
        data-test="landing-stage-clause"
      >
        {{ t(CLAUSE_KEYS[stage]) }}
      </p>

      <div class="order-1 min-h-56 lg:order-2" data-ui>
        <div
          v-if="stage === 0"
          data-test="landing-stage-connect"
          class="rounded-surface border-border-subtle bg-surface-panel overflow-hidden border"
        >
          <p class="border-border-subtle text-2xs text-text-secondary border-b px-3 py-2 font-mono">
            {{ t("welcome.stages.terminal") }}
          </p>
          <pre
            class="text-text-code overflow-x-auto px-4 py-3 font-mono text-xs leading-6 break-words lg:break-normal"
            >{{ CURL }}</pre>
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
                class="rounded-default bg-surface-subtle text-2xs text-text-heading inline-flex h-6 items-center gap-1.5 px-2 font-mono"
              >
                <svg
                  viewBox="0 0 24 24"
                  class="size-3.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                {{ t("welcome.stages.tEmail") }}
              </span>
              <span
                class="rounded-default bg-surface-subtle text-2xs text-text-heading inline-flex h-6 items-center gap-1.5 px-2 font-mono"
              >
                <svg
                  viewBox="0 0 24 24"
                  class="size-3.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path
                    d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A3 3 0 1 1 2 17c0-1.1.45-2.1 1.17-2.83L7 10.34V6c0-1.1.9-2 2-2h1"
                  />
                  <circle cx="18" cy="19" r="3" />
                  <circle cx="6" cy="6" r="3" />
                </svg>
                {{ t("welcome.stages.tWebhook") }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- real slider with step nodes aligned under the track positions -->
    <div class="relative mt-10" data-reveal>
      <label for="landing-stages" class="sr-only">{{ t("welcome.stages.slider") }}</label>
      <div class="relative">
        <input
          id="landing-stages"
          v-model.number="stage"
          type="range"
          min="0"
          :max="TOTAL - 1"
          step="1"
          class="stage-range focus-visible:ring-focus-ring-accent relative z-2 w-full focus-visible:ring-2 focus-visible:ring-offset-2"
          :style="{
            background: `linear-gradient(to right, var(--color-text-heading) ${pct}%, var(--color-surface-subtle) ${pct}%)`,
          }"
          data-test="landing-stage-slider"
        />
        <span
          v-for="i in TOTAL"
          :key="i"
          aria-hidden="true"
          class="border-border-strong pointer-events-none absolute top-1/2 z-1 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
          :class="i - 1 <= stage ? 'bg-text-heading' : 'bg-border-strong'"
          :style="{ left: `calc(% - rem + 0.625rem)` }"
        />
      </div>
      <div class="relative mt-3 h-8">
        <button
          v-for="(lk, i) in LABEL_KEYS"
          :key="lk"
          type="button"
          class="rounded-default focus-visible:ring-focus-ring-accent absolute top-0 -translate-x-1/2 py-1 text-base transition-colors duration-150 first:translate-x-0 last:-translate-x-full focus-visible:ring-2 focus-visible:ring-offset-2"
          :class="
            i === stage
              ? 'text-text-heading font-medium'
              : 'text-text-secondary hover:text-text-heading'
          "
          :aria-current="i === stage ? 'step' : undefined"
          :aria-label="t('welcome.stages.nodeAria', { n: i + 1, label: t(lk) })"
          :style="{
            left: `calc(% - rem + 0.625rem)`,
            transform:
              i === 0 ? 'none' : i === TOTAL - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
          }"
          data-test="landing-stage-name"
          @click="stage = i"
        >
          {{ t(lk) }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* keep(complex-state): the clause swap animation and the range slider's
   thumb/track have no utility equivalents; both are token-fed. */
.stage-clause {
  font-size: clamp(2rem, 3.2vw + 1rem, 3.75rem);
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
  width: 1.5rem;
  height: 1.5rem;
  border-radius: var(--radius-full);
  background: var(--color-text-heading);
  border: 0.25rem solid var(--color-surface-base);
}
.stage-range::-moz-range-thumb {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: var(--radius-full);
  background: var(--color-text-heading);
  border: 0.25rem solid var(--color-surface-base);
}

@media (prefers-reduced-motion: reduce) {
  .stage-clause {
    animation: none;
  }
}
</style>
