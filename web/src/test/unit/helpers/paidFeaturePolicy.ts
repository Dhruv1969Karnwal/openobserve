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

import type { PaidFeaturePolicyChoice } from "@/utils/enterpriseFeatures";

// Lets a spec exercise both sides of PAID_FEATURE_POLICY without a production seam.
export interface PaidFeaturePolicyCell {
  mode: PaidFeaturePolicyChoice;
}

// State lives on globalThis so a dynamically imported factory and the spec setter share one cell.
const cell: PaidFeaturePolicyCell = ((
  globalThis as Record<string, unknown>
).__paidFeaturePolicyCell ??= { mode: "hide" }) as PaidFeaturePolicyCell;

export const setPaidFeaturePolicy = (next: PaidFeaturePolicyChoice): void => {
  cell.mode = next;
};

/** Back to what this product ships: `"hide"`. */
export const resetPaidFeaturePolicy = (): void => {
  cell.mode = "hide";
};

export const paidFeaturePolicy = (): PaidFeaturePolicyChoice => cell.mode;

// LIMITATION: the spread keeps the real checkFeatureAccess/useLockedFeatureGate, which read the
// shipped constant from inside their own module. This flips what CONSUMERS see.
export const withPaidFeaturePolicy = async (
  importOriginal: () => Promise<Record<string, unknown>>,
): Promise<Record<string, unknown>> => {
  const actual = await importOriginal();
  return {
    ...actual,
    get PAID_FEATURE_POLICY(): PaidFeaturePolicyChoice {
      return cell.mode;
    },
    get hidesPaidFeatures(): boolean {
      return cell.mode === "hide";
    },
    get showsLockedAffordances(): boolean {
      return cell.mode === "lock";
    },
  };
};
