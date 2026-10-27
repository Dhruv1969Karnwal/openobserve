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

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/aws-exports", () => ({
  default: { isEnterprise: "false", isCloud: "false" },
}));

import config from "@/aws-exports";
import {
  ALL_FEATURE_KEYS,
  PAID_FEATURE_POLICY,
  buildFeatureGateContext,
  checkFeatureAccess,
  hidesPaidFeatures,
  isFeatureKey,
  withFeatureGate,
} from "@/utils/enterpriseFeatures";

describe("enterpriseFeatures", () => {
  beforeEach(() => {
    config.isEnterprise = "false";
    config.isCloud = "false";
  });

  describe("buildFeatureGateContext", () => {
    it("reads isEnterprise/isCloud from config as strict string comparisons", () => {
      config.isEnterprise = "true";
      expect(buildFeatureGateContext().isEnterprise).toBe(true);
      expect(buildFeatureGateContext().isCloud).toBe(false);
    });

    it("reads rbac from a LOADED zoConfig-shaped object, open until it says otherwise", () => {
      expect(buildFeatureGateContext({ rbac_enabled: true }).rbac).toBe(true);
      expect(buildFeatureGateContext({ rbac_enabled: false }).rbac).toBe(false);
      // A config object that exists but is silent is the documented cold-load case.
      expect(buildFeatureGateContext({}).rbac).toBe(true);
    });

    // No argument is not a cold load; it is a gate that never said where
    // its state came from. The fail-open default was the latent half of SEC-1.
    it("fails rbac CLOSED for a caller that passes no config at all", () => {
      expect(buildFeatureGateContext().rbac).toBe(false);
      expect(buildFeatureGateContext(undefined).rbac).toBe(false);
      expect(buildFeatureGateContext(null).rbac).toBe(false);
      config.isEnterprise = "true";
      expect(checkFeatureAccess("rbac", buildFeatureGateContext()).allowed).toBe(false);
      config.isEnterprise = "false";
    });
  });

  describe("PAID_FEATURE_POLICY", () => {
    it("hides paid features outright, matching the single-edition product", () => {
      expect(PAID_FEATURE_POLICY).toBe("hide");
      expect(hidesPaidFeatures).toBe(true);
    });

    it("never reports an allowed feature as hidden, whatever the edition", () => {
      config.isEnterprise = "true";
      const ctx = buildFeatureGateContext({ rbac_enabled: true });
      for (const key of ALL_FEATURE_KEYS) {
        const result = checkFeatureAccess(key, ctx);
        if (result.allowed) expect(result.visible).toBe(true);
      }
    });

    it("leaves un-gated feature strings for call sites to keep visible", () => {
      expect(isFeatureKey("databaseMonitoring")).toBe(false);
      expect(isFeatureKey("logs")).toBe(false);
    });

    /**
     * The registry assumes every Cloud build also ships `isEnterprise=true`
     * (enterpriseFeatures.ts, note above FEATURE_GATES) and nothing in this repository can
     * pin that — no `.env*` is tracked, `build-cloud-prod` is `--mode=production`. What IS
     * testable is the direction the assumption is allowed to be wrong in: a counterfactual
     * pure-Cloud context may only ever REFUSE more than the shipped Cloud shape, never
     * allow more. So the two cells below are a set relation over all 38 keys, not a sample.
     */
    describe("the unpinnable Cloud premise", () => {
      const pureCloud = () => {
        config.isEnterprise = "false";
        config.isCloud = "true";
        return buildFeatureGateContext({ rbac_enabled: true });
      };
      const shippedCloud = () => {
        config.isEnterprise = "true";
        config.isCloud = "true";
        return buildFeatureGateContext({ rbac_enabled: true });
      };

      it("makes a counterfactual pure-Cloud build a SUBSET of the shipped Cloud shape (loses affordances, never gains one)", () => {
        const pure = pureCloud();
        const shipped = shippedCloud();
        const pureAllowed = ALL_FEATURE_KEYS.filter((key) => checkFeatureAccess(key, pure).allowed);
        const shippedAllowed = new Set(
          ALL_FEATURE_KEYS.filter((key) => checkFeatureAccess(key, shipped).allowed),
        );
        for (const key of pureAllowed) {
          expect(
            shippedAllowed.has(key),
            `${key} is granted on Cloud only because the premise failed`,
          ).toBe(true);
        }
        // Anti-vacuity: the premise really is load-bearing, or the relation above is free.
        expect(pureAllowed.length).toBeGreaterThan(0);
        expect(pureAllowed.length).toBeLessThan(shippedAllowed.size);
      });

      it("makes every refusal on a counterfactual pure-Cloud build a silent hide, never a false Cloud upsell", () => {
        for (const key of ALL_FEATURE_KEYS) {
          const result = checkFeatureAccess(key, pureCloud());
          if (result.allowed) continue;
          expect(
            result.visible,
            `${key} must be omitted, not offered as a false Cloud upsell`,
          ).toBe(false);
          expect(result.message).toBe("");
        }
      });
    });
  });

  describe("checkFeatureAccess — isEnterprise-only keys", () => {
    it("hides an enterprise-only feature in OSS, with no message to render", () => {
      const ctx = buildFeatureGateContext();
      const result = checkFeatureAccess("cipherKeys", ctx);
      expect(result.allowed).toBe(false);
      expect(result.visible).toBe(false);
      expect(result.message).toBe("");
    });

    it("unlocks an enterprise-only feature in a self-hosted enterprise build", () => {
      config.isEnterprise = "true";
      const result = checkFeatureAccess("cipherKeys", buildFeatureGateContext());
      expect(result.allowed).toBe(true);
      expect(result.message).toBe("");
    });

    it("does NOT unlock an enterprise-only feature in a pure cloud build", () => {
      config.isCloud = "true";
      const result = checkFeatureAccess("cipherKeys", buildFeatureGateContext());
      expect(result.allowed).toBe(false);
    });

    // Cloud never offers this batch at all — a self-hosted admin's own node/
    // cipher-key/license management has no Cloud equivalent to "upgrade"
    // into, so pure Cloud must hide it entirely rather than show a false
    // upsell. Service Graph is the same shape, covered below via `cloudOffers`.
    it.each(["cipherKeys", "enterprise", "nodes", "license", "pipelineBackfill"] as const)(
      "hides %s entirely (not locked) on a pure cloud build",
      (key) => {
        config.isCloud = "true";
        const result = checkFeatureAccess(key, buildFeatureGateContext());
        expect(result.allowed).toBe(false);
        expect(result.visible).toBe(false);
        expect(result.message).toBe("");
      },
    );

    // This key exists so the Pipelines Backfill entry and its route share
    // one predicate; the pair is only as honest as the gate underneath it.
    it("hides the pipelineBackfill entry the route is gated on in OSS", () => {
      const result = checkFeatureAccess("pipelineBackfill", buildFeatureGateContext());
      expect(result.allowed).toBe(false);
      expect(result.visible).toBe(false);
      expect(result.message).toBe("");
    });

    it("unlocks pipelineBackfill in the same self-hosted enterprise build the page gate allows", () => {
      config.isEnterprise = "true";
      const result = checkFeatureAccess("pipelineBackfill", buildFeatureGateContext());
      expect(result.allowed).toBe(true);
      expect(result.visible).toBe(true);
    });

    it("hides an entitlement-gated feature on OSS, not merely locks it", () => {
      const result = checkFeatureAccess("cipherKeys", buildFeatureGateContext());
      expect(result.allowed).toBe(false);
      expect(result.visible).toBe(false);
      expect(result.message).toBe("");
    });

    it("is visible (not hidden) on an enterprise+cloud hybrid build", () => {
      config.isEnterprise = "true";
      config.isCloud = "true";
      const result = checkFeatureAccess("cipherKeys", buildFeatureGateContext());
      expect(result.allowed).toBe(true);
      expect(result.visible).toBe(true);
    });
  });

  describe("checkFeatureAccess — isEnterprise-or-isCloud keys", () => {
    it.each(["incidents", "workflows", "oncall"] as const)("locks %s in OSS", (key) => {
      expect(checkFeatureAccess(key, buildFeatureGateContext()).allowed).toBe(false);
    });

    it("unlocks workflows in a pure cloud build", () => {
      config.isCloud = "true";
      expect(checkFeatureAccess("workflows", buildFeatureGateContext()).allowed).toBe(true);
    });

    it("unlocks workflows in a self-hosted enterprise build", () => {
      config.isEnterprise = "true";
      expect(checkFeatureAccess("workflows", buildFeatureGateContext()).allowed).toBe(true);
    });

    // Under the hide policy the `cloudOffers` distinction no longer changes
    // visibility in OSS — nothing gated is rendered at all — but the
    // predicates still decide `allowed`, which is what guards read.
    it.each(["incidents", "workflows", "oncall", "rbac"] as const)(
      "hides %s when it is not allowed in OSS",
      (key) => {
        const result = checkFeatureAccess(key, buildFeatureGateContext({ rbac_enabled: true }));
        expect(result.allowed).toBe(false);
        expect(result.visible).toBe(false);
      },
    );
  });

  describe("checkFeatureAccess — rbac", () => {
    it("locks rbac in OSS even when the backend flag is on", () => {
      const ctx = buildFeatureGateContext({ rbac_enabled: true });
      expect(checkFeatureAccess("rbac", ctx).allowed).toBe(false);
    });

    it("locks rbac in an enterprise build when the backend flag is off", () => {
      config.isEnterprise = "true";
      const ctx = buildFeatureGateContext({ rbac_enabled: false });
      expect(checkFeatureAccess("rbac", ctx).allowed).toBe(false);
    });

    it("unlocks rbac only when the edition allows it AND the backend flag is on", () => {
      config.isEnterprise = "true";
      const ctx = buildFeatureGateContext({ rbac_enabled: true });
      expect(checkFeatureAccess("rbac", ctx).allowed).toBe(true);
    });

    // N1 regression: zoConfig is still {} on a cold load/refresh — this must
    // NOT bounce a real Enterprise/Cloud user with RBAC on to the locked page.
    it("unlocks rbac in an enterprise build when the loaded flag hasn't loaded yet", () => {
      config.isEnterprise = "true";
      // The store seeds `zoConfig` to `{}` (stores/index.ts), so this is every
      // real cold load; the no-config case above stays closed either way.
      expect(checkFeatureAccess("rbac", buildFeatureGateContext({})).allowed).toBe(true);
    });

    it("marks the upgrade CTA irrelevant when the edition already supports RBAC but the toggle is off", () => {
      config.isEnterprise = "true";
      const result = checkFeatureAccess("rbac", buildFeatureGateContext({ rbac_enabled: false }));
      expect(result.allowed).toBe(false);
      expect(result.ctaRelevant).toBe(false);
    });

    it("drops the upgrade CTA along with the feature when OSS is the reason rbac is unavailable", () => {
      const result = checkFeatureAccess("rbac", buildFeatureGateContext({ rbac_enabled: true }));
      expect(result.allowed).toBe(false);
      expect(result.visible).toBe(false);
      expect(result.ctaRelevant).toBe(false);
    });
  });

  describe("withFeatureGate", () => {
    it("calls the wrapped guard when the feature is allowed", () => {
      config.isEnterprise = "true";
      const guard = vi.fn();
      const next = vi.fn();
      withFeatureGate("cipherKeys", guard)({ query: {} }, {}, next);
      expect(guard).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it("bounces to the org home instead of a locked upsell page", () => {
      const guard = vi.fn();
      const next = vi.fn();
      const to = {
        query: { org_identifier: "o1" },
        fullPath: "/settings/cipher_keys?org_identifier=o1",
      };
      withFeatureGate("cipherKeys", guard)(to, {}, next);
      expect(guard).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith({
        name: "home",
        query: { org_identifier: "o1" },
      });
    });

    // The hole SEC-1 named: an RBAC-dependent key gated without a context used to
    // read `rbac: true` and let the navigation through on a flag-off org.
    it("refuses an rbac route whose gate passes no context, even entitled", () => {
      config.isEnterprise = "true";
      const guard = vi.fn();
      const next = vi.fn();
      withFeatureGate("rbac", guard)(
        { query: { org_identifier: "o1" }, fullPath: "/iam" },
        {},
        next,
      );
      expect(guard).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith({ name: "home", query: { org_identifier: "o1" } });
      config.isEnterprise = "false";
    });

    it("still serves an rbac route through the context the guards inject (mirror)", () => {
      config.isEnterprise = "true";
      const guard = vi.fn();
      const next = vi.fn();
      withFeatureGate("rbac", guard, () => buildFeatureGateContext({ rbac_enabled: true }))(
        { query: {}, fullPath: "/iam" },
        {},
        next,
      );
      expect(guard).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
      config.isEnterprise = "false";
    });

    it("never reaches the upsell page while the hide policy is in force", () => {
      const next = vi.fn();
      withFeatureGate("cipherKeys", vi.fn())({ query: {}, fullPath: "/x" }, {}, next);
      const target = next.mock.calls[0][0];
      expect(target.name).not.toBe("enterpriseFeatureLocked");
      expect(target.name).not.toBe("enterpriseFeatures");
    });
  });

  describe("isFeatureKey", () => {
    it("recognizes every registered key", () => {
      expect(isFeatureKey("cipherKeys")).toBe(true);
      expect(isFeatureKey("oncall")).toBe(true);
    });

    it("rejects an unrelated gate string", () => {
      expect(isFeatureKey("databaseMonitoring")).toBe(false);
      expect(isFeatureKey("streamPipelines")).toBe(false);
      expect(isFeatureKey("not-a-real-key")).toBe(false);
    });
  });
});
