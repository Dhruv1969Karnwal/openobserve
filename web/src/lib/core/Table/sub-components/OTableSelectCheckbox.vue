<!-- Copyright 2026 OpenObserve Inc. -->

<script setup lang="ts">
import { computed } from "vue";
import OCheckbox from "@/lib/forms/Checkbox/OCheckbox.vue";
import type { I18nText } from "@/types/i18n";
import type { CheckboxModelValue } from "@/lib/forms/Checkbox/OCheckbox.types";

const props = defineProps<{
  modelValue: boolean;
  indeterminate?: boolean;
  rowId?: string;
  disabled?: boolean;
  label?: I18nText;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

const checkboxModel = computed<CheckboxModelValue>(() => {
  if (props.indeterminate) return "indeterminate";
  return props.modelValue;
});

function handleUpdate(val: CheckboxModelValue) {
  if (props.disabled) return;
  if (typeof val === "boolean") {
    emit("update:modelValue", val);
  } else {
    emit("update:modelValue", true);
  }
}
</script>

<template>
  <div class="o2-table-select-hit">
    <OCheckbox
      :model-value="checkboxModel"
      :data-test="`o2-table-select-${rowId ?? 'header'}`"
      size="sm"
      :aria-label="label"
      :disabled="disabled"
      @update:model-value="handleUpdate"
    />
  </div>
</template>

<style scoped>
/* keep(lib-override): SC 2.5.8 — the tick paints 14px and the selection cell is 24px,
   so the focusable box is grown into that dead space rather than into the column. */
.o2-table-select-hit :deep([role="checkbox"]) {
  position: relative;
}

.o2-table-select-hit :deep([role="checkbox"])::after {
  content: "";
  position: absolute;
  inset: -0.4375rem;
}
</style>
