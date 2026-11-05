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

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import OTruncatedText from "@/lib/core/Typography/OTruncatedText.vue";
import { useI18nTyped } from "@/types/i18n";
import { fitFacts, ruleFacts } from "./alertRuleFacts";

const props = defineProps<{ row: any }>();

const { t } = useI18nTyped();

// The line measures itself: the identity column's width comes from the table's own fit and the mobile column cap.
const lineRef = ref<HTMLElement | null>(null);
const lineWidth = ref(0);
let observer: ResizeObserver | null = null;
onMounted(() => {
  lineWidth.value = lineRef.value?.clientWidth ?? 0;
  if (typeof ResizeObserver !== "undefined" && lineRef.value) {
    observer = new ResizeObserver(() => {
      lineWidth.value = lineRef.value?.clientWidth ?? 0;
    });
    observer.observe(lineRef.value);
  }
});
onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
});

const facts = computed(() => fitFacts(ruleFacts(props.row, t), lineWidth.value - 4));
</script>

<template>
  <div
    ref="lineRef"
    class="text-text-secondary flex min-w-0 items-baseline gap-1 overflow-hidden text-xs leading-snug"
    :data-test="`alert-list-${row.name}-rule-facts`"
  >
    <template v-for="(fact, index) in facts" :key="index">
      <span v-if="index > 0" class="text-text-muted shrink-0" aria-hidden="true">·</span>
      <OTruncatedText
        :as="fact.mono ? 'code' : 'span'"
        class="min-w-0"
        :class="fact.mono ? 'font-mono' : fact.prose ? 'font-medium' : ''"
        >{{ fact.text }}</OTruncatedText
      >
    </template>
  </div>
</template>
