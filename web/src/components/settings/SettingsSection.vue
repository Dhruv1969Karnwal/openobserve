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
  One section of a settings form: a label column says what is being set, the
  surface beside it is the panel that holds the controls, each with its label
  above it. Sections split by one rule with the same air above and below, so a
  page with three settings reads as a spine instead of as a block that stopped
  early. The panel is a tone step rather than a border: on one shared ground the
  control column is indistinguishable from the empty canvas beside it.
-->
<template>
  <section
    :data-test="dataTest"
    class="border-border-subtle mt-8 border-t pt-8 first:mt-0 first:border-t-0 first:pt-3 max-lg:flex max-lg:flex-col max-lg:gap-3 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start lg:gap-8"
  >
    <div class="flex flex-col gap-1.5">
      <h2
        :id="headingId"
        data-test="settings-section-title"
        class="text-text-heading text-base leading-6 font-semibold"
      >
        {{ title }}
      </h2>
      <p
        v-if="description"
        data-test="settings-section-help"
        class="text-text-secondary text-sm leading-5"
      >
        {{ description }}
      </p>
    </div>
    <div
      data-test="settings-section-panel"
      class="bg-surface-panel rounded-surface flex min-w-0 flex-col gap-4 p-4 lg:-mt-1.5"
    >
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, useId } from "vue";
import type { I18nText } from "@/types/i18n";

const props = defineProps<{
  title: I18nText;
  /** One sentence naming what this group of settings changes. */
  description?: I18nText;
  dataTest?: string;
  /** Passed in when a control group outside the section is labelled by it. */
  headingId?: string;
}>();

const generatedId = useId();
const headingId = computed(() => props.headingId ?? generatedId);
</script>
