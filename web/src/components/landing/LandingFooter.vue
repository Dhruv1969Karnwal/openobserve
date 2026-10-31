<script setup lang="ts">
// Copyright 2026 OpenObserve Inc.

// Footer as aligned page columns on the same 7xl grid as every section, and
// a low full-bleed wordmark echo closing the page.
import { useI18nTyped } from "@/types/i18n";
import { getPath } from "@/utils/queryUtils";

const { t } = useI18nTyped();
const base = getPath();

const LINKS = [
  { href: "#how-it-works", key: "welcome.nav.ingestion" },
  { href: "#one-line", key: "welcome.nav.logLine" },
  { href: "#capabilities", key: "welcome.nav.capabilities" },
] as const;

function reduced(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function go(href: string) {
  const el = document.querySelector(href);
  if (el) el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
}
</script>

<template>
  <footer
    :aria-label="t('welcome.footer.aria')"
    data-test="landing-footer"
    class="bg-surface-subtle"
  >
    <div
      class="mx-auto grid max-w-7xl grid-cols-1 gap-x-10 gap-y-10 px-6 py-16 md:grid-cols-12 md:px-10"
    >
      <div class="md:col-span-5">
        <p class="text-compact text-text-body uppercase">
          {{ t("welcome.footer.eyebrowProduct") }}
        </p>
        <p class="text-text-heading mt-4 max-w-md text-xl leading-snug font-medium">
          {{ t("welcome.footer.statement") }}
        </p>
        <p class="text-text-body mt-8 max-w-md text-xs leading-relaxed" data-test="landing-legal">
          {{ t("welcome.footer.legal") }}
        </p>
      </div>

      <nav :aria-label="t('welcome.footer.navAria')" class="md:col-span-3">
        <p class="text-compact text-text-body uppercase">{{ t("welcome.footer.eyebrow") }}</p>
        <ul class="mt-4 flex flex-col items-start gap-3 text-sm">
          <li v-for="l in LINKS" :key="l.href">
            <a
              :href="l.href"
              class="rounded-default text-text-body hover:text-text-heading focus-visible:ring-text-heading underline underline-offset-4 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              data-test="landing-footer-link"
              @click.prevent="go(l.href)"
              >{{ t(l.key) }}</a
            >
          </li>
          <li>
            <a
              href="https://github.com/openobserve/openobserve"
              class="rounded-default text-text-body hover:text-text-heading focus-visible:ring-text-heading underline underline-offset-4 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              rel="noopener"
              target="_blank"
              data-test="landing-footer-source"
              >{{ t("welcome.footer.source") }}</a
            >
          </li>
          <li>
            <a
              :href="`${base}login`"
              class="rounded-default text-text-body hover:text-text-heading focus-visible:ring-text-heading underline underline-offset-4 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              data-test="landing-footer-signin"
              >{{ t("welcome.nav.signin") }}</a
            >
          </li>
        </ul>
      </nav>

      <div class="md:col-span-4">
        <p class="text-text-heading mt-4 text-xl font-medium" data-test="landing-author">
          {{ t("welcome.footer.author") }}
        </p>
        <p class="text-text-body mt-3 max-w-sm text-sm leading-relaxed">
          {{ t("welcome.footer.authorNote") }}
        </p>
      </div>
    </div>

    <div class="bg-text-heading" data-test="landing-wordmark-strip">
      <div class="mx-auto flex h-16 max-w-7xl items-center gap-3 px-6 md:px-10">
        <svg
          viewBox="14 72 96 96"
          class="h-6 w-7 shrink-0"
          role="img"
          :aria-label="t('welcome.footer.wordmark')"
        >
          <rect x="14" y="72" width="96" height="96" rx="14" class="fill-surface-base" />
          <path
            d="M36 120h14l10-26 12 52 10-26h16"
            fill="none"
            class="stroke-text-heading"
            stroke-width="10"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="text-surface-base truncate text-2xl font-semibold tracking-tight">{{
          t("welcome.footer.wordmark")
        }}</span>
      </div>
    </div>
  </footer>
</template>
