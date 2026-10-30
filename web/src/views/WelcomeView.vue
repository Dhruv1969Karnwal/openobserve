<script setup lang="ts">
// Copyright 2026 OpenObserve Inc.

// Public landing page (route /welcome, meta.public). Renders outside
// MainLayout; makes no API calls and touches no auth state. The document
// scroller is re-enabled while mounted because the app shell locks
// html/body overflow for its own internal scrolling layout — restored on
// unmount so authenticated routes keep their layout contract.
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useI18nTyped } from "@/types/i18n";
import LandingNav from "@/components/landing/LandingNav.vue";
import LandingHero from "@/components/landing/LandingHero.vue";
import LifeOfALine from "@/components/landing/LifeOfALine.vue";
import CapabilityBands from "@/components/landing/CapabilityBands.vue";
import IngestionStages from "@/components/landing/IngestionStages.vue";
import FoundersLetter from "@/components/landing/FoundersLetter.vue";
import ClosingCta from "@/components/landing/ClosingCta.vue";
import LandingFooter from "@/components/landing/LandingFooter.vue";
import { useLandingReveal } from "@/components/landing/useReveal";

const root = ref<HTMLElement | null>(null);
useLandingReveal(root);

const { t } = useI18nTyped();

const META: Array<[string, string, string]> = [
  [
    "name",
    "description",
    "Retrace.ai — logs, metrics, traces, dashboards and alerts in one open-source binary you self-host.",
  ],
  ["property", "og:title", "Retrace.ai — every signal, one box"],
  [
    "property",
    "og:description",
    "Logs, metrics, traces, dashboards and alerts in one open-source binary you self-host.",
  ],
  ["property", "og:type", "website"],
  ["name", "twitter:card", "summary"],
  ["name", "twitter:title", "Retrace.ai — every signal, one box"],
  [
    "name",
    "twitter:description",
    "Logs, metrics, traces, dashboards and alerts in one open-source binary you self-host.",
  ],
];

const written = new Map<string, string | null>();
function setMeta(kind: "name" | "property", key: string, value: string) {
  const sel = `meta[${kind}="${key}"]`;
  let el = document.head.querySelector<HTMLMetaElement>(sel);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(kind, key);
    document.head.appendChild(el);
    written.set(sel, null);
  } else {
    written.set(sel, el.getAttribute("content"));
  }
  el.setAttribute("content", value);
}

onMounted(() => {
  document.title = "Retrace.ai — every signal, one box";
  document.documentElement.style.overflow = "auto";
  document.body.style.overflow = "auto";
  for (const [kind, key, value] of META) setMeta(kind as "name" | "property", key, value);
});

onBeforeUnmount(() => {
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
  document.title = "Retrace.ai";
  for (const [sel, prev] of written) {
    const el = document.head.querySelector(sel);
    if (!el) continue;
    if (prev === null) el.remove();
    else if (prev !== null) el.setAttribute("content", prev);
  }
  written.clear();
});
</script>

<template>
  <div ref="root" class="landing-root bg-surface-base min-h-screen" data-test="landing-root">
    <a
      href="#main"
      class="focus:rounded-default focus:bg-button-primary focus:text-button-primary-foreground sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-200 focus:px-4 focus:py-2"
      >{{ t("welcome.view.skip") }}</a
    >
    <LandingNav />
    <main id="main">
      <LandingHero />
      <IngestionStages />
      <LifeOfALine />
      <CapabilityBands />
      <FoundersLetter />
      <ClosingCta />
    </main>
    <LandingFooter />
  </div>
</template>
