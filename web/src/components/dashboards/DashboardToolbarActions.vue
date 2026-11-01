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
  THE HEADER-ACTION RULE (N-F1). Written here so any page toolbar can apply it.

  1. The object's name outranks its commands: the actions row never grows into
     the width the page title needs to print in full.
  2. A verb stays inline only while it carries its word. At most three verbs stay
     inline — the ones that create, re-run or change the object. An icon with no
     label is a command nobody can read.
  3. A control that belongs to a value stays bound to that value: range steppers
     stay on the time picker, the options caret stays on Refresh, the back
     chevron stays on the title. Those are affordances and keep icon form; each
     still carries an accessible name.
  4. Every other action goes into ONE overflow whose rows are labelled in the
     object's own words, one open and one select away — two interactions from the
     header at any width, keyboard-reachable, focus-visible intact.

  In code: this component is part 4 (one overflow, labelled rows, a named and
  tooltip-ed trigger); the page owns parts 1–3 by which actions it renders in
  the header's `#actions` and which it hands here. Below `md` the page header
  already folds its overflow slot behind "More", so `flat` paints the same rows
  as labelled buttons for that tray instead of a menu inside a menu.
-->
<script setup lang="ts">
import { ref } from "vue";
import OButton from "@/lib/core/Button/OButton.vue";
import OIcon from "@/lib/core/Icon/OIcon.vue";
import ODropdown from "@/lib/overlay/Dropdown/ODropdown.vue";
import ODropdownItem from "@/lib/overlay/Dropdown/ODropdownItem.vue";
import OTooltip from "@/lib/overlay/Tooltip/OTooltip.vue";

export interface ToolbarAction {
  id: string;
  label: string;
  icon: string;
  disabled?: boolean;
  destructive?: boolean;
}

withDefaults(
  defineProps<{
    actions: ToolbarAction[];
    /** Accessible name and tooltip of the overflow trigger. */
    triggerLabel: string;
    /** Phone mode: paint the rows for a host tray instead of opening a menu. */
    flat?: boolean;
  }>(),
  { flat: false },
);

const emit = defineEmits<{ (e: "select", id: string): void }>();

// Rows a caller supplies own their own action (a share row copies, then the
// menu should get out of the way), so they get the close handle.
const open = ref(false);
const close = () => {
  open.value = false;
};
</script>

<template>
  <div v-if="flat" class="flex w-full flex-col gap-1" data-test="dashboard-toolbar-flat">
    <slot name="before" :close="close" />
    <OButton
      v-for="action in actions"
      :key="action.id"
      variant="ghost"
      size="sm"
      block
      class="justify-start"
      :disabled="action.disabled"
      :data-test="`dashboard-toolbar-action-${action.id}`"
      @click="emit('select', action.id)"
    >
      <template #icon-left><OIcon :name="action.icon" size="sm" /></template>
      {{ action.label }}
    </OButton>
    <slot name="after" />
  </div>

  <ODropdown v-else v-model:open="open" side="bottom" align="end">
    <template #trigger>
      <OButton
        variant="outline"
        size="icon-toolbar"
        icon-left="more-vert"
        :aria-label="triggerLabel"
        data-test="dashboard-more-actions-btn"
      >
        <OTooltip :content="triggerLabel" />
      </OButton>
    </template>
    <slot name="before" :close="close" />
    <ODropdownItem
      v-for="action in actions"
      :key="action.id"
      :icon-left="action.icon"
      :disabled="action.disabled"
      :variant="action.destructive ? 'destructive' : 'default'"
      :data-test="`dashboard-toolbar-action-${action.id}`"
      @select="emit('select', action.id)"
    >
      {{ action.label }}
    </ODropdownItem>
    <slot name="after" :close="close" />
  </ODropdown>
</template>
