<script setup lang="ts">
// Copyright 2026 OpenObserve Inc.

// The open-source section as a first-person letter (direction: "Founder's
// letter"). No portrait photo exists, so the lead mark is the brand's own
// glyph. Sign-off is a name, not italic (the brand bans styled accents).
import { useI18nTyped } from "@/types/i18n";

const { t } = useI18nTyped();
</script>

<template>
  <section id="open-source" aria-labelledby="letter-h" class="bg-surface-panel scroll-mt-24">
    <div class="mx-auto max-w-2xl px-6 py-20 md:px-8 md:py-24">
      <h2 id="letter-h" class="sr-only">{{ t("welcome.letter.heading") }}</h2>

      <svg
        viewBox="14 72 96 96"
        class="size-11 rounded-full"
        role="img"
        :aria-label="t('welcome.letter.mark')"
        data-reveal
      >
        <rect x="14" y="72" width="96" height="96" rx="48" class="fill-text-heading" />
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
        class="text-text-body mt-7 flex flex-col gap-5 text-base leading-relaxed md:text-lg"
        data-reveal
        data-reveal-step="1"
      >
        <p>{{ t("welcome.letter.p1") }}</p>
        <p>{{ t("welcome.letter.p2") }}</p>
        <p>{{ t("welcome.letter.p3") }}</p>
        <p>
          {{ t("welcome.letter.p4a") }}
          <a
            href="https://github.com/openobserve/openobserve"
            class="text-text-heading focus-visible:outline-focus-ring-accent underline underline-offset-4 transition-colors duration-150 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
            rel="noopener"
            target="_blank"
            >{{ t("welcome.letter.p4link") }}</a
          >{{ t("welcome.letter.p4b") }}
        </p>
        <p>{{ t("welcome.letter.p5") }}</p>
      </div>

      <div class="mt-10" data-reveal data-reveal-step="2">
        <p class="text-text-heading text-xl font-medium" data-test="landing-letter-signoff">
          {{ t("welcome.letter.signoff") }}
        </p>
        <p class="text-compact text-text-secondary mt-1">{{ t("welcome.letter.role") }}</p>
      </div>
    </div>
  </section>
</template>
