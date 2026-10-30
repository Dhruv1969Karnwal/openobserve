<script setup lang="ts">
// Copyright 2026 OpenObserve Inc.

// Capabilities: five statements, each with its product fragment on a shared
// grid. Round-4 decision: the interactive spotlight switches were removed -
// they read as broken state, not control; the page's interactive element is
// the hero explorer plus the ingestion stepper.
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
  sql: "SELECT level, count(*)\nFROM app_logs\nGROUP BY level",
  ingestRate: "ingest rate",
  rateNow: "4.1k events/min",
  rateWindow: "09:52 — 10:00",
  cond: "count(level='error') >= 2 in 5m",
  fired: "Fired 14:32:11 · 2 notified",
  email: "email",
  webhook: "webhook",
  dockerA: "docker run -p 5080:5080 \\",
  dockerB: "  retrace/retrace:latest",
  ready: ":5080 ready",
  sqlRes: [
    ["info", "1,204"],
    ["warn", "142"],
    ["error", "37"],
  ] as Array<[string, string]>,
};
</script>

<template>
  <section id="capabilities" aria-labelledby="capabilities-h" class="scroll-mt-24">
    <div class="mx-auto max-w-7xl px-6 pt-14 md:px-10 md:pt-16">
      <h2
        id="capabilities-h"
        class="text-text-heading text-2xl font-semibold tracking-tight text-balance md:text-3xl"
        data-reveal
      >
        {{ t("welcome.bands.heading") }}
      </h2>
      <p class="text-text-body mt-3 max-w-2xl text-base">{{ t("welcome.bands.note") }}</p>
    </div>

    <div class="mt-8 flex flex-col">
      <div v-for="b in BANDS" :key="b.n" class="border-border-subtle border-t" data-reveal>
        <div
          class="mx-auto grid max-w-7xl grid-cols-1 items-center gap-x-10 gap-y-6 px-6 py-8 md:grid-cols-12 md:px-10"
        >
          <div class="min-w-0 md:col-span-7">
            <p class="band-sentence text-text-heading text-balance">{{ t(b.s) }}</p>
            <p class="text-text-body mt-2 max-w-xl text-base leading-relaxed">{{ t(b.c) }}</p>
          </div>
          <div class="md:col-span-5" data-ui>
            <div
              v-if="b.n === 1"
              class="rounded-surface border-border-subtle bg-surface-panel border p-4"
            >
              <div class="flex flex-wrap items-center gap-2 font-mono text-xs">
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
              <p class="text-compact border-border-subtle text-text-body mt-3 border-t pt-2">
                {{ t("welcome.bands.b1note") }}
              </p>
              <p class="text-text-body mt-2 font-mono text-xs">{{ F.oneStore }}</p>
            </div>
            <div
              v-else-if="b.n === 2"
              class="rounded-surface border-border-subtle bg-surface-panel border p-4"
            >
              <div class="grid grid-cols-2 gap-4 font-mono text-xs">
                <p class="text-text-code whitespace-pre">{{ F.sql }}</p>
                <table class="text-text-body w-full border-collapse self-end">
                  <tbody>
                    <tr v-for="row in F.sqlRes" :key="row[0]" class="border-border-subtle border-b">
                      <td>{{ row[0] }}</td>
                      <td class="text-end tabular-nums">{{ row[1] }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div
              v-else-if="b.n === 3"
              class="rounded-surface border-border-subtle bg-surface-panel border p-4"
            >
              <div class="flex items-baseline justify-between gap-4">
                <p class="text-compact text-text-heading font-medium">{{ F.ingestRate }}</p>
                <p class="text-text-body font-mono text-xs tabular-nums">{{ F.rateNow }}</p>
              </div>
              <svg
                viewBox="0 0 240 48"
                class="text-text-heading mt-2 h-10 w-full"
                role="img"
                :aria-label="t('welcome.fragment.eventsChart')"
              >
                <line
                  x1="0"
                  y1="47"
                  x2="240"
                  y2="47"
                  stroke="currentColor"
                  stroke-opacity="0.35"
                  stroke-width="1"
                  vector-effect="non-scaling-stroke"
                />
                <g fill="currentColor">
                  <rect x="2" y="30" width="16" height="17" />
                  <rect x="22" y="24" width="16" height="23" />
                  <rect x="42" y="33" width="16" height="14" />
                  <rect x="62" y="18" width="16" height="29" />
                  <rect x="82" y="27" width="16" height="20" />
                  <rect x="102" y="14" width="16" height="33" />
                  <rect x="122" y="22" width="16" height="25" />
                  <rect x="142" y="10" width="16" height="37" />
                  <rect x="162" y="19" width="16" height="28" />
                  <rect x="182" y="8" width="16" height="39" />
                  <rect x="202" y="15" width="16" height="32" />
                  <rect x="222" y="4" width="16" height="43" />
                </g>
              </svg>
              <p class="text-text-body mt-1 text-end font-mono text-xs">{{ F.rateWindow }}</p>
            </div>
            <div
              v-else-if="b.n === 4"
              class="rounded-surface border-border-subtle bg-surface-panel border p-4"
            >
              <p class="text-text-code font-mono text-xs">{{ F.cond }}</p>
              <div class="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs">
                <span class="rounded-default bg-surface-subtle text-text-heading px-2 py-1">{{
                  F.email
                }}</span>
                <span class="rounded-default bg-surface-subtle text-text-heading px-2 py-1">{{
                  F.webhook
                }}</span>
                <span class="text-text-body ms-auto">{{ F.fired }}</span>
              </div>
            </div>
            <div v-else class="rounded-surface border-border-subtle bg-surface-panel border p-4">
              <p class="text-text-code font-mono text-xs leading-6">
                {{ F.dockerA }}<br />{{ F.dockerB }}
              </p>
              <p
                class="rounded-default bg-surface-subtle text-text-heading mt-2 inline-flex items-center gap-1.5 px-2 py-1 font-mono text-xs"
              >
                <span class="bg-text-heading size-1.5 rounded-full" aria-hidden="true" />{{
                  F.ready
                }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* keep(brand): statement step sits between body and section-h2; no utility
   covers it with the brand's tight tracking. */
.band-sentence {
  font-size: clamp(1.125rem, 0.9vw + 0.9rem, 1.375rem);
  line-height: 1.25;
  letter-spacing: var(--tracking-tight);
  font-weight: var(--font-semibold);
}
</style>
