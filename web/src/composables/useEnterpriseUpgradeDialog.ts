// Copyright 2026 OpenObserve Inc.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import { ref } from "vue";
import { hidesPaidFeatures } from "@/utils/enterpriseFeatures";

/**
 * Module-scoped singleton (same pattern as ONavGroup's `openGroupKey`): every
 * caller of this composable shares the SAME ref, so a single
 * `<EnterpriseUpgradeDialog>` mounted once (in Header.vue) can be opened from
 * anywhere — a locked nav tile, a locked Settings tab — without each one
 * needing its own dialog instance or a prop/event chain back up to Header.
 *
 * `open()` is a no-op while `PAID_FEATURE_POLICY` is `"hide"`: the upsell modal
 * is not part of a single-edition product. Entry points are hidden upstream.
 */
const isEnterpriseUpgradeDialogOpen = ref(false);

/** A locked affordance survived the hide policy, so its click can only offer nothing. */
function reportLockedAffordanceUnderHide() {
  if (!import.meta.env.DEV) return;
  console.error(
    '[useEnterpriseUpgradeDialog] a locked control was clicked while PAID_FEATURE_POLICY is "hide", so it did nothing. Render it only when showsLockedAffordances is true, or gate it on FeatureAccess.visible.',
  );
}

export function useEnterpriseUpgradeDialog() {
  return {
    isOpen: isEnterpriseUpgradeDialogOpen,
    open: () => {
      if (hidesPaidFeatures) {
        reportLockedAffordanceUnderHide();
        return;
      }
      isEnterpriseUpgradeDialogOpen.value = true;
    },
    close: () => {
      isEnterpriseUpgradeDialogOpen.value = false;
    },
  };
}
