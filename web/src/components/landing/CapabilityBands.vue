<script setup lang="ts">
// Copyright 2026 OpenObserve Inc.

// Capabilities: a statement row each with a working switch and a matching
// product fragment in a fixed right column (the round-2 council: the off rows
// read unfinished with an empty half). On = the row's field inverts — the
// product's primary-by-inversion signature.
import { ref } from "vue";
import { useI18nTyped } from "@/types/i18n";

const { t } = useI18nTyped();

const BANDS = [
  { n: 1, s: "welcome.bands.b1", c: "welcome.bands.b1c" },
  { n: 2, s: "welcome.bands.b2", c: "welcome.bands.b2c" },
  { n: 3, s: "welcome.bands.b3", c: "welcome.bands.b3c" },
  { n: 4, s: "welcome.bands.b4", c: "welcome.bands.b4c" },
  { n: 5, s: "welcome.bands.b5", c: "welcome.bands.b5c" },
] as const;

const F = {
  streams: ["app_logs", "host_metrics", "ingest_traces"] as const,
  oneStore: "one store · node retrace-0",
  sql: "SELECT level, count(*) FROM app_logs GROUP BY level",
  lucene: "level:error AND service:billing",
  ingestRate: "ingest rate",
  refreshFast: "5s",
  refreshSlow: "1m",
  cond: "count(level:error) >= 2 in 5m",
  email: "email",
  webhook: "webhook",
  docker: "docker run -p 5080:5080 retrace/retrace",
  ready: ":5080 ready",
  modeSQL: "SQL",
  modeLucene: "Lucene",
};

const bands = ref<Record<number, boolean>>({ 1: true, 2: true, 3: false, 4: false, 5: false });
const MODES = ["SQL", "Lucene"] as const;
const mode = ref<"SQL" | "Lucene">("SQL");

function toggle(i: number) {
  bands.value[i] = !bands.value[i];
}
</script>

<template>
  <section id="capabilities" aria-labelledby="capabilities-h" class="scroll-mt-24">
    <div class="mx-auto max-w-7xl px-6 pt-20 md:px-10 md:pt-24">
      <h2
        id="capabilities-h"
        class="text-text-heading text-2xl font-semibold tracking-tight text-balance md:text-3xl"
        data-reveal
      >
        {{ t("welcome.bands.heading") }}
      </h2>
      <p class="text-text-secondary mt-3 text-base">{{ t("welcome.bands.note") }}</p>
    </div>

    <div class="mt-8 flex flex-col">
      <template v-for="b in BANDS" :key="b.n">
        <div v-if="bands[b.n]" class="bg-text-heading" data-reveal>
          <div
            class="mx-auto grid max-w-7xl grid-cols-1 items-center gap-x-8 gap-y-5 px-6 py-8 md:grid-cols-12 md:px-10"
          >
            <div class="min-w-0 md:col-span-6 lg:col-span-7">
              <div class="flex items-center gap-5">
                <button
                  type="button"
                  role="switch"
                  :aria-checked="true"
                  :aria-label="t('welcome.bands.toggleDetail', { sentence: t(b.s) })"
                  data-test="landing-band-switch"
                  class="border-surface-base bg-surface-base focus-visible:ring-surface-base relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 px-0.5 transition-colors duration-150 focus-visible:ring-2"
                  @click="toggle(b.n)"
                >
                  <span
                    class="bg-text-heading block size-5 translate-x-5 rounded-full"
                    aria-hidden="true"
                  />
                </button>
                <p class="band-sentence text-surface-base min-w-0 text-balance">{{ t(b.s) }}.</p>
              </div>
              <p class="text-surface-base mt-3 max-w-xl ps-17 text-base leading-relaxed">
                {{ t(b.c) }}
              </p>
            </div>
            <div class="md:col-span-6 lg:col-span-5" data-ui>
              <!-- per-band fragment, same geometry in every row -->
              <div
                v-if="b.n === 1"
                class="rounded-surface border-border-subtle bg-surface-panel border p-3"
              >
                <div class="text-2xs flex flex-wrap items-center gap-2 font-mono">
                  <span class="rounded-default bg-surface-base text-text-heading px-2 py-1">{{
                    F.streams[0]
                  }}</span>
                  <span class="rounded-default bg-surface-base text-text-heading px-2 py-1">{{
                    F.streams[1]
                  }}</span>
                  <span class="rounded-default bg-surface-base text-text-heading px-2 py-1">{{
                    F.streams[2]
                  }}</span>
                </div>
                <p class="text-2xs text-text-secondary mt-2 font-mono">
                  {{ F.oneStore }}
                </p>
              </div>
              <div
                v-else-if="b.n === 2"
                class="rounded-surface border-border-subtle bg-surface-panel border p-3"
              >
                <div class="flex gap-1">
                  <button
                    v-for="m in MODES"
                    :key="m"
                    type="button"
                    class="rounded-default text-compact focus-visible:ring-text-heading h-7 px-3 font-medium transition-colors duration-150 focus-visible:ring-2"
                    :class="
                      mode === m
                        ? 'bg-text-heading text-surface-base'
                        : 'text-text-secondary hover:text-text-heading'
                    "
                    :aria-pressed="mode === m"
                    data-test="landing-mode-chip"
                    @click="mode = m"
                  >
                    {{ m }}
                  </button>
                </div>
                <p class="text-2xs text-text-code mt-2 truncate font-mono">
                  {{ F.sql }}
                </p>
              </div>
              <div
                v-else-if="b.n === 3"
                class="rounded-surface border-border-subtle bg-surface-panel border p-3"
              >
                <div class="flex items-center justify-between">
                  <p class="text-compact text-text-heading font-medium">{{ F.ingestRate }}</p>
                  <span
                    class="rounded-default bg-surface-subtle text-2xs text-text-heading px-2 py-0.5 font-mono"
                    >{{ F.refreshFast }}</span
                  >
                </div>
                <svg
                  viewBox="0 0 240 64"
                  class="text-text-heading mt-2 h-14 w-full"
                  role="img"
                  :aria-label="t('welcome.fragment.eventsChart')"
                >
                  <path
                    d="M0 52 L24 46 L48 49 L72 38 L96 41 L120 30 L144 33 L168 22 L192 26 L216 14 L240 17"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    vector-effect="non-scaling-stroke"
                  />
                </svg>
              </div>
              <div
                v-else-if="b.n === 4"
                class="rounded-surface border-border-subtle bg-surface-panel border p-3"
              >
                <p class="text-2xs text-text-code font-mono">{{ F.cond }}</p>
                <div class="text-2xs mt-2 flex flex-wrap gap-2 font-mono">
                  <span class="rounded-default bg-surface-subtle text-text-heading px-2 py-1">{{
                    F.email
                  }}</span>
                  <span class="rounded-default bg-surface-subtle text-text-heading px-2 py-1">{{
                    F.webhook
                  }}</span>
                </div>
              </div>
              <div v-else class="rounded-surface border-border-subtle bg-surface-panel border p-3">
                <p class="text-2xs text-text-code truncate font-mono">
                  {{ F.docker }}
                </p>
                <p
                  class="rounded-default bg-surface-subtle text-2xs text-text-heading mt-2 inline-flex items-center gap-1.5 px-2 py-1 font-mono"
                >
                  <span class="bg-text-heading size-1.5 rounded-full" aria-hidden="true" />{{
                    F.ready
                  }}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="bg-surface-base" data-reveal>
          <div
            class="mx-auto grid max-w-7xl grid-cols-1 items-center gap-x-8 gap-y-5 px-6 py-8 md:grid-cols-12 md:px-10"
          >
            <div class="min-w-0 md:col-span-6 lg:col-span-7">
              <div class="flex items-center gap-5">
                <button
                  type="button"
                  role="switch"
                  :aria-checked="false"
                  :aria-label="t('welcome.bands.toggleDetail', { sentence: t(b.s) })"
                  data-test="landing-band-switch"
                  class="border-text-heading focus-visible:ring-focus-ring-accent relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 bg-transparent px-0.5 transition-colors duration-150 focus-visible:ring-2"
                  @click="toggle(b.n)"
                >
                  <span
                    class="bg-text-heading block size-5 translate-x-0 rounded-full"
                    aria-hidden="true"
                  />
                </button>
                <p class="band-sentence text-text-heading min-w-0 text-balance">{{ t(b.s) }}.</p>
              </div>
              <p class="text-text-secondary mt-3 max-w-xl ps-17 text-base leading-relaxed">
                {{ t(b.c) }}
              </p>
            </div>
            <div class="md:col-span-6 lg:col-span-5" data-ui>
              <div
                v-if="b.n === 1"
                class="rounded-surface border-border-subtle bg-surface-panel border p-3"
              >
                <div class="text-2xs flex flex-wrap items-center gap-2 font-mono">
                  <span class="rounded-default bg-surface-base text-text-heading px-2 py-1">{{
                    F.streams[0]
                  }}</span>
                  <span class="rounded-default bg-surface-base text-text-heading px-2 py-1">{{
                    F.streams[1]
                  }}</span>
                  <span class="rounded-default bg-surface-base text-text-heading px-2 py-1">{{
                    F.streams[2]
                  }}</span>
                </div>
                <p class="text-2xs text-text-secondary mt-2 font-mono">
                  {{ F.oneStore }}
                </p>
              </div>
              <div
                v-else-if="b.n === 2"
                class="rounded-surface border-border-subtle bg-surface-panel border p-3"
              >
                <div class="flex gap-1">
                  <span
                    class="rounded-default bg-text-heading text-compact text-surface-base h-7 px-3 leading-7 font-medium"
                    >{{ F.modeSQL }}</span
                  >
                  <span
                    class="rounded-default text-compact text-text-secondary h-7 px-3 leading-7 font-medium"
                    >{{ F.modeLucene }}</span
                  >
                </div>
                <p class="text-2xs text-text-code mt-2 truncate font-mono">
                  {{ F.lucene }}
                </p>
              </div>
              <div
                v-else-if="b.n === 3"
                class="rounded-surface border-border-subtle bg-surface-panel border p-3"
              >
                <div class="flex items-center justify-between">
                  <p class="text-compact text-text-heading font-medium">{{ F.ingestRate }}</p>
                  <span
                    class="rounded-default bg-surface-subtle text-2xs text-text-heading px-2 py-0.5 font-mono"
                    >{{ F.refreshSlow }}</span
                  >
                </div>
                <svg
                  viewBox="0 0 240 64"
                  class="text-text-heading mt-2 h-14 w-full"
                  role="img"
                  :aria-label="t('welcome.fragment.eventsChart')"
                >
                  <path
                    d="M0 40 L24 44 L48 36 L72 41 L96 32 L120 37 L144 28 L168 34 L192 26 L216 31 L240 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    vector-effect="non-scaling-stroke"
                  />
                </svg>
              </div>
              <div
                v-else-if="b.n === 4"
                class="rounded-surface border-border-subtle bg-surface-panel border p-3"
              >
                <p class="text-2xs text-text-code font-mono">{{ F.cond }}</p>
                <div class="text-2xs mt-2 flex flex-wrap gap-2 font-mono">
                  <span class="rounded-default bg-surface-subtle text-text-heading px-2 py-1">{{
                    F.email
                  }}</span>
                  <span class="rounded-default bg-surface-subtle text-text-heading px-2 py-1">{{
                    F.webhook
                  }}</span>
                </div>
              </div>
              <div v-else class="rounded-surface border-border-subtle bg-surface-panel border p-3">
                <p class="text-2xs text-text-code truncate font-mono">
                  {{ F.docker }}
                </p>
                <p
                  class="rounded-default bg-surface-subtle text-2xs text-text-heading mt-2 inline-flex items-center gap-1.5 px-2 py-1 font-mono"
                >
                  <span class="bg-text-heading size-1.5 rounded-full" aria-hidden="true" />{{
                    F.ready
                  }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
/* keep(brand): fluid marketing sentence step between 2xl and 3xl; no utility
   covers the 1.25rem-1.875rem marketing band with the brand's tight tracking. */
.band-sentence {
  font-size: clamp(1.25rem, 1.2vw + 1rem, 1.875rem);
  line-height: 1.15;
  letter-spacing: var(--tracking-tight);
  font-weight: var(--font-medium);
}
</style>
