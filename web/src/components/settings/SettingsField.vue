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
  Label above control, description under it — the field shape `OFormInput` gives a
  bound field, for the settings controls that are not bound to a form (an upload,
  a colour chip, a value with its own inline actions). The label and hint classes
  are the ones OInput uses, so the two field kinds read as one form.
-->
<template>
  <div :data-test="dataTest" class="flex flex-col gap-1">
    <span
      class="text-input-label-text text-compact flex items-center gap-1 leading-tight font-medium"
    >
      {{ label }}<span v-if="required" aria-hidden="true" class="select-none">*</span>
    </span>
    <div class="flex min-w-0 flex-wrap items-center gap-2">
      <slot />
    </div>
    <span v-if="description" class="text-input-hint text-xs leading-none">{{ description }}</span>
  </div>
</template>

<script setup lang="ts">
import type { I18nText } from "@/types/i18n";

defineProps<{
  label: I18nText;
  /** What the control changes, or the constraint it accepts. */
  description?: I18nText;
  required?: boolean;
  dataTest?: string;
}>();
</script>
