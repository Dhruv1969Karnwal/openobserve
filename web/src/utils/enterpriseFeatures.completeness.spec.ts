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

// Guards the one failure mode this whole file exists to prevent: a
// `FeatureKey` that nothing actually checks (a typo'd string at the one call
// site that was supposed to use it, or a gate someone defined and then never
// wired up — exactly what happened to the `enterprise` key's Service Graph
// tab, registered with its own doc comment naming that exact tab, but never
// called from it). This can't catch a WRONG key — only a key with zero
// callers anywhere in the app, which a type system already can't catch
// either (string-keyed `Record` access doesn't fail at compile time if a
// caller passes a different valid key than intended).

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { ALL_FEATURE_KEYS } from "./enterpriseFeatures";

const SRC_ROOT = resolve(__dirname, "..");
const SKIP_DIRS = new Set(["node_modules", "dist", ".git"]);
const SOURCE_EXTENSIONS = [".ts", ".vue"];
/**
 * A key that is only ever named by a TEST is exactly the orphan this guard exists
 * to catch — an assertion about `withFeatureGate("x")` is not a surface that
 * spends the key — so spec files are out of the scanned set entirely.
 */
const SPEC_FILE = /(\.spec|\.test|\.stories)\.[cm]?[jt]s$|\.spec\.vue$/;

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      if (SPEC_FILE.test(entry.name)) continue;
      files.push(full);
    }
  }
  return files;
}

// Read once for every test in this file — the repo has thousands of source
// files, and re-walking per `it()` would make this test suite the slow one.
const SOURCE_FILES = walk(SRC_ROOT);
const SOURCE_TEXT = new Map<string, string>(SOURCE_FILES.map((f) => [f, readFileSync(f, "utf-8")]));

/**
 * Every shape a `FeatureKey` can legitimately be spent through: a direct
 * function-call literal, or a `featureKey: "x"` entry in a declarative table
 * (e.g. `AI_OBSERVABILITY_SECTIONS`) that some generic code later passes to
 * `checkFeatureAccess`/`withFeatureGate` as a variable — a real call site,
 * just not a literal one this regex-based scan can follow through a
 * variable. Tables shaped like that are the intended, recommended pattern
 * for a module with many sections (see useAIObservabilityRoutes.ts), not a
 * loophole to close.
 */
function callSitePatterns(key: string): RegExp[] {
  return [
    new RegExp(`checkFeatureAccess\\(\\s*["']${key}["']`),
    new RegExp(`withFeatureGate\\(\\s*["']${key}["']`),
    new RegExp(`useLockedAffordance\\(\\s*["']${key}["']`),
    new RegExp(`featureKey:\\s*["']${key}["']`),
  ];
}

describe("FEATURE_GATES completeness", () => {
  it("every registered FeatureKey has at least one real call site", () => {
    const orphaned: string[] = [];
    for (const key of ALL_FEATURE_KEYS) {
      const patterns = callSitePatterns(key);
      const hasCallSite = SOURCE_FILES.some((file) => {
        const text = SOURCE_TEXT.get(file)!;
        return patterns.some((p) => p.test(text));
      });
      if (!hasCallSite) orphaned.push(key);
    }
    expect(
      orphaned,
      `FeatureKey(s) with no checkFeatureAccess/withFeatureGate/useLockedAffordance call site anywhere in web/src — either wire them up or remove the registry entry: ${orphaned.join(", ")}`,
    ).toEqual([]);
  });

  /**
   * The other half of the same coin: a key that IS spent, spent wrongly. `rbac` is the only
   * registry key whose predicate reads a runtime flag (`zoConfig.rbac_enabled`), and
   * `buildFeatureGateContext()` with no argument fails that flag CLOSED. `withFeatureGate`
   * defaults its context to exactly that no-arg call, so an RBAC route gate that passes only
   * two arguments would lock an entitled admin's page to home. The five production gates
   * survive today only because `useEnterpriseRoutes.ts` shadows the import with a shim that
   * supplies a store-reading context; a sixth gate written anywhere else — `router.ts`,
   * `useManagementRoutes.ts`, `useAIObservabilityRoutes.ts` all import `withFeatureGate`
   * directly — would fail silently, and nothing but this assertion says so.
   */
  it("never gates an RBAC-reading key through the default no-context withFeatureGate", () => {
    const SHIMMED = "composables/shared/useEnterpriseRoutes.ts";
    const offenders: string[] = [];
    for (const file of SOURCE_FILES) {
      const relative = file.slice(SRC_ROOT.length + 1).replace(/\\/g, "/");
      if (relative === SHIMMED) continue;
      const text = SOURCE_TEXT.get(file)!;
      for (const match of text.matchAll(/withFeatureGate\(\s*["']rbac["']/g)) {
        // Walk the balanced call arguments so a third argument anywhere settles it.
        const open = text.indexOf("(", (match.index ?? 0) + "withFeatureGate".length);
        let depth = 0;
        let end = -1;
        for (let i = open; i < text.length; i++) {
          if (text[i] === "(") depth += 1;
          else if (text[i] === ")") {
            depth -= 1;
            if (depth === 0) {
              end = i;
              break;
            }
          }
        }
        const args = end === -1 ? "" : text.slice(open + 1, end);
        let commas = 0;
        let nesting = 0;
        for (const ch of args) {
          if ("([{".includes(ch)) nesting += 1;
          else if (")]}".includes(ch)) nesting -= 1;
          else if (ch === "," && nesting === 0) commas += 1;
        }
        if (commas < 2)
          offenders.push(`${relative}:${text.slice(0, match.index ?? 0).split("\n").length}`);
      }
    }
    expect(
      offenders,
      `withFeatureGate("rbac", …) without an explicit context — the default reads no zoConfig, so the route locks an entitled admin out: ${offenders.join(", ")}`,
    ).toEqual([]);
    // Anti-vacuity: the rule is about real gates, and they exist in the shimmed module.
    const shimmed = SOURCE_FILES.filter((f) => f.endsWith("useEnterpriseRoutes.ts"));
    const rbacGates =
      (SOURCE_TEXT.get(shimmed[0]) ?? "").match(/withFeatureGate\(\s*"rbac"/g) ?? [];
    expect(rbacGates.length).toBeGreaterThan(0);
  });
});
