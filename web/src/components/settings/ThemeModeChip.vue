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

<!-- One accent color control: shows the mode's accent and opens its picker. -->
<template>
  <button
    type="button"
    :data-test="dataTest"
    :aria-label="ariaLabel"
    class="focus-visible:ring-focus-ring-accent inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3 whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none max-md:min-h-11"
    :class="
      active
        ? 'border-accent bg-surface-subtle-hover'
        : 'border-border-control bg-surface-subtle hover:border-border-strong hover:bg-surface-subtle-hover'
    "
    @click="emit('edit')"
  >
    <!-- The dark swatch carries the `dark` scope so its ground token resolves to the dark canvas here. -->
    <span
      class="color-circle ring-border-strong rounded-default relative inline-flex size-6 shrink-0 overflow-hidden ring-1 ring-inset"
      :class="mode === 'dark' ? 'dark' : undefined"
      aria-hidden="true"
    >
      <span class="absolute inset-0" :style="{ backgroundColor: ground }" />
      <span class="absolute inset-x-0 bottom-0 h-2.5" :style="{ backgroundColor: accent }" />
    </span>
    <span class="chip-label text-text-heading text-2xs font-semibold">{{ label }}</span>
    <span class="chip-accent-value sr-only">{{ accent }}</span>
    <OIcon v-if="active" name="check" size="sm" class="chip-mark text-text-heading shrink-0" />
    <OTooltip :content="ariaLabel" side="top" />
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import OIcon from "@/lib/core/Icon/OIcon.vue";
import OTooltip from "@/lib/overlay/Tooltip/OTooltip.vue";
import { useI18nTyped, type I18nText } from "@/types/i18n";

const { t } = useI18nTyped();

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

// An accent-only swatch read inverted, so the field is the mode's ground and the accent is its rule.
const GROUND: Record<"light" | "dark", string> = {
  light: "var(--color-white)",
  dark: "var(--color-surface-base)",
};

const ground = computed(() => GROUND[props.mode]);

// The chip opens a picker; `active` is which mode is on screen, not a toggle state.
const ariaLabel = computed(() =>
  t(props.active ? "settings.accentPickerAriaCurrent" : "settings.accentPickerAria", {
    mode: props.label,
  }),
);
</script>
