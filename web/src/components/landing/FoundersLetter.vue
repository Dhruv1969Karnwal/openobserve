<script setup lang="ts">
// Copyright 2026 OpenObserve Inc.

// The open-source section as a first-person letter on the shared page grid.
// No portrait photo exists, so the lead mark is the brand's own glyph.
import { useI18nTyped } from "@/types/i18n";

const { t } = useI18nTyped();
</script>

<template>
  <section id="open-source" aria-labelledby="letter-h" class="scroll-mt-24">
    <div class="mx-auto grid max-w-7xl grid-cols-1 px-6 py-14 md:px-10 md:py-16 lg:grid-cols-12">
      <h2 id="letter-h" class="sr-only">{{ t("welcome.letter.heading") }}</h2>
      <article class="rounded-surface bg-surface-subtle p-6 md:p-10 lg:col-span-12" data-reveal>
        <svg
          viewBox="14 72 96 96"
          class="size-10"
          role="img"
          :aria-label="t('welcome.letter.mark')"
        >
          <rect x="14" y="72" width="96" height="96" rx="14" class="fill-text-heading" />
          <path
            d="M36 120h14l10-26 12 52 10-26h16"
            fill="none"
            class="stroke-surface-base"
            stroke-width="10"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>

        <div
          class="text-text-body mx-auto mt-6 flex max-w-2xl flex-col gap-4 text-base leading-relaxed md:text-lg"
        >
          <p>{{ t("welcome.letter.p1") }}</p>
          <p>{{ t("welcome.letter.p2") }}</p>
          <p>{{ t("welcome.letter.p3") }}</p>
          <p>
            {{ t("welcome.letter.p4a") }}
            <a
              href="https://github.com/openobserve/openobserve"
              class="rounded-default text-text-heading focus-visible:ring-text-heading underline underline-offset-4 transition-colors duration-150 outline-none hover:no-underline focus-visible:ring-2 focus-visible:ring-offset-2"
              rel="noopener"
              target="_blank"
              >{{ t("welcome.letter.p4link") }}</a
            >{{ t("welcome.letter.p4b") }}
          </p>
          <p>{{ t("welcome.letter.p5") }}</p>
        </div>

        <div class="mx-auto mt-8 max-w-2xl">
          <p class="text-text-heading text-lg font-medium" data-test="landing-letter-signoff">
            {{ t("welcome.letter.signoff") }}
          </p>
          <p class="text-compact text-text-secondary mt-1">{{ t("welcome.letter.role") }}</p>
        </div>
        <aside class="border-border-subtle mx-auto mt-10 max-w-4xl border-t pt-6" data-reveal>
          <p class="text-compact text-text-body uppercase">{{ t("welcome.letter.factsTitle") }}</p>
          <dl
            class="divide-border-subtle border-border-subtle mt-4 flex flex-col divide-y border-t"
          >
            <div class="flex flex-col gap-1 py-1">
              <dt class="text-text-body text-sm">{{ t("welcome.letter.f1") }}</dt>
              <dd class="text-text-heading font-mono text-xs">OpenObserve</dd>
            </div>
            <div class="flex flex-col gap-1 py-1">
              <dt class="text-text-body text-sm">{{ t("welcome.letter.f2") }}</dt>
              <dd class="text-text-heading font-mono text-xs">AGPL-3.0</dd>
            </div>
            <div class="flex flex-col gap-1 py-1">
              <dt class="text-text-body text-sm">{{ t("welcome.letter.f3") }}</dt>
              <dd class="text-text-heading font-mono text-xs">1 binary</dd>
            </div>
            <div class="flex flex-col gap-1 py-1">
              <dt class="text-text-body text-sm">{{ t("welcome.letter.f4") }}</dt>
              <dd class="text-text-heading font-mono text-xs">:5080</dd>
            </div>
          </dl>
        </aside>
      </article>
    </div>
  </section>
</template>
