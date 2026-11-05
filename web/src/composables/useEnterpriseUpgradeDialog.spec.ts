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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  resetPaidFeaturePolicy,
  setPaidFeaturePolicy,
} from "@/test/unit/helpers/paidFeaturePolicy";

// Both sides of the policy are asserted below, so the shipped constant must be switchable here.
vi.mock("@/utils/enterpriseFeatures", async (importOriginal) =>
  (await import("@/test/unit/helpers/paidFeaturePolicy")).withPaidFeaturePolicy(importOriginal),
);

import { useEnterpriseUpgradeDialog } from "./useEnterpriseUpgradeDialog";

describe("useEnterpriseUpgradeDialog", () => {
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetPaidFeaturePolicy();
    error = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    const { isOpen } = useEnterpriseUpgradeDialog();
    isOpen.value = false;
    error.mockRestore();
  });

  describe('policy "lock"', () => {
    it("opens the shared dialog", () => {
      setPaidFeaturePolicy("lock");
      const { isOpen, open } = useEnterpriseUpgradeDialog();

      open();

      expect(isOpen.value).toBe(true);
      expect(error).not.toHaveBeenCalled();
    });
  });

  describe('policy "hide"', () => {
    it("never opens the upsell modal", () => {
      setPaidFeaturePolicy("hide");
      const { isOpen, open } = useEnterpriseUpgradeDialog();

      open();

      expect(isOpen.value).toBe(false);
    });

    it("reports the dead click instead of swallowing it silently", () => {
      setPaidFeaturePolicy("hide");
      const { open } = useEnterpriseUpgradeDialog();

      open();

      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0][0]).toContain("PAID_FEATURE_POLICY");
      expect(error.mock.calls[0][0]).toContain("showsLockedAffordances");
    });
  });
});
