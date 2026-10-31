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
  EmptyStateIngestionCard — shared action card used across ingestion / onboarding
  empty states (LogsNoDataState, TracesNoDataState, HomeNoDataState, etc.).
  Consolidates the repeated .nd-card / .ns-card / .tnd-card / .hnd-card CSS.
-->
<template>
  <button
    type="button"
    class="es-ing-card group rounded-default border-border-default bg-surface-base hover:border-accent hover:bg-tabs-hover-bg focus-visible:ring-accent/40 relative flex min-h-16 max-w-72 min-w-0 flex-1 basis-56 cursor-pointer items-center gap-3 border py-2.5 ps-3 pe-3.5 text-left transition-[color,background-color,border-color,box-shadow] duration-150 outline-none hover:shadow-md focus-visible:ring-2 max-md:min-h-0 max-md:max-w-full max-md:basis-full max-md:py-2"
    @click="emit('click')"
  >
    <span
      v-if="image"
      class="es-ing-card__icon rounded-default inline-flex h-10 w-10 shrink-0 items-center justify-center max-md:size-8"
      :class="iconClass"
    >
      <img :src="image" class="h-6 w-6 object-contain max-md:size-5" alt="" />
    </span>
    <span
      v-else
      class="es-ing-card__icon rounded-default group-hover:bg-button-primary group-hover:text-button-primary-foreground inline-flex h-10 w-10 shrink-0 items-center justify-center transition-[background-color,color] duration-150 max-md:size-8"
      :class="iconClass"
    >
      <OIcon v-if="icon" :name="icon" size="md" />
    </span>
    <span class="es-ing-card__body flex min-w-0 flex-1 flex-col gap-0.5">
      <OTruncatedText class="text-compact text-text-heading font-semibold">{{
        label
      }}</OTruncatedText>
      <span v-if="sublabel" class="text-text-secondary text-xs leading-[1.4]">{{ sublabel }}</span>
    </span>
    <OIcon
      name="chevron-right"
      size="sm"
      class="es-ing-card__chevron text-text-disabled group-hover:text-accent shrink-0 transition-[transform,color] duration-150 group-hover:translate-x-0.5"
    />
  </button>
</template>

<script setup lang="ts">
import type { I18nText } from "@/types/i18n";
import { computed } from "vue";
import OIcon from "@/lib/core/Icon/OIcon.vue";
import OTruncatedText from "@/lib/core/Typography/OTruncatedText.vue";
import type { IconName } from "@/lib/core/Icon/OIcon.icons";

type IconVariant = "default" | "blue" | "teal" | "purple" | "amber" | "orange";

const props = withDefaults(
  defineProps<{
    icon?: IconName;
    image?: string;
    label: I18nText;
    sublabel?: I18nText;
    iconVariant?: IconVariant;
  }>(),
  { iconVariant: "default" },
);

const emit = defineEmits<{ click: [] }>();

// All variants render one neutral chip: the onboarding empty-states are a
// monochrome family, and provider-hue icon chips read as off-palette.
const ICON_VARIANT_CLASS: Record<IconVariant, string> = {
  default: "bg-icon-chip-primary-bg text-icon-chip-primary-text",
  blue: "bg-icon-chip-primary-bg text-icon-chip-primary-text",
  teal: "bg-icon-chip-primary-bg text-icon-chip-primary-text",
  purple: "bg-icon-chip-primary-bg text-icon-chip-primary-text",
  amber: "bg-icon-chip-primary-bg text-icon-chip-primary-text",
  orange: "bg-icon-chip-primary-bg text-icon-chip-primary-text",
};

const iconClass = computed(() => ICON_VARIANT_CLASS[props.iconVariant]);
</script>
