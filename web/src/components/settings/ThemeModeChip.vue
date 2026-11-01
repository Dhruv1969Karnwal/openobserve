<!-- Copyright 2026 OpenObserve Inc.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
-->

<!--
  One theme-mode control: it switches the app to that mode and opens the accent
  picker.

  The swatch paints the mode's PAGE GROUND with its accent as the rule across the
  top, because the accent alone is unreadable on its own — the light mode's accent
  is near-black and the dark mode's is near-white, so a disc painted with the
  accent showed each mode's colours inverted. The ground is what says "light" or
  "dark"; the hex stays because it names the accent the swatch's band paints.
-->
<template>
  <button
    type="button"
    :data-test="dataTest"
    :aria-pressed="active"
    :class="active ? CHIP_ACTIVE : CHIP_IDLE"
    class="group/chip focus-visible:ring-accent/40 inline-flex cursor-pointer items-center gap-2 rounded-full border py-1.5 ps-1.5 pe-3 transition-all duration-200 hover:-translate-y-px hover:shadow-md focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none max-md:py-2.5"
    @click="emit('edit')"
  >
    <span
      class="color-circle rounded-default ring-border-strong relative inline-flex h-6 w-7.5 shrink-0 items-center justify-center overflow-hidden ring-1 ring-inset"
      :class="mode === 'dark' ? 'dark' : undefined"
    >
      <span class="absolute inset-0" :style="{ backgroundColor: ground }" />
      <span class="absolute inset-x-0 top-0 h-1.5" :style="{ backgroundColor: accent }" />
      <!-- eslint-disable local/no-hardcoded-px -- optical effect, not layout — scaling it with text makes elevation bloom -->
      <OIcon
        name="palette"
        size="xs"
        class="relative opacity-0 filter-[drop-shadow(0_1px_1px_color-mix(in_srgb,var(--color-black)_30%,transparent))] transition-opacity duration-200 group-hover/chip:opacity-90 group-focus-visible/chip:opacity-90 max-md:opacity-90"
      />
      <!-- eslint-enable local/no-hardcoded-px -->
    </span>
    <span class="chip-label text-text-secondary text-2xs font-semibold tracking-wider">{{
      label
    }}</span>
    <span class="chip-value text-text-body text-2xs font-mono font-medium tracking-tight">{{
      accent
    }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import OIcon from "@/lib/core/Icon/OIcon.vue";
import type { I18nText } from "@/types/i18n";

const props = defineProps<{
  mode: "light" | "dark";
  label: I18nText;
  /** The mode's accent, as the hex the picker writes. */
  accent: string;
  /** The mode the app is in right now. */
  active: boolean;
  dataTest: string;
}>();

const emit = defineEmits<{ edit: [] }>();

// The dark swatch carries the `dark` scope so its ground token resolves to the
// dark canvas even while the page itself is light.
const GROUND: Record<"light" | "dark", string> = {
  light: "var(--color-white)",
  dark: "var(--color-surface-base)",
};

const ground = computed(() => GROUND[props.mode]);

const CHIP_ACTIVE = "border-accent bg-surface-subtle-hover";
const CHIP_IDLE =
  "border-border-control bg-surface-subtle hover:border-accent hover:bg-surface-subtle-hover";
</script>
