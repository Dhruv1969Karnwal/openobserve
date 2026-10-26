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

import { describe, it, expect } from "vitest";
import {
  PAID_SNAPSHOT_META_KEYS,
  PAID_SNAPSHOT_META_DEFAULTS,
  sanitizeSearchSnapshotMeta,
} from "./snapshotPaidState";

const OSS = { patternsAllowed: false };
const ENTITLED = { patternsAllowed: true };

/** A snapshot with the given meta, shaped like the JSON a saved view stores. */
const snapshotWith = (meta: unknown): any => ({
  meta,
  data: { stream: { selectedStream: ["app_logs"] } },
});

describe("sanitizeSearchSnapshotMeta (F-98)", () => {
  it("coerces the paid scheduler flag the merge used to carry through", () => {
    const snapshot = snapshotWith({ showSearchScheduler: true });

    sanitizeSearchSnapshotMeta(snapshot, OSS);

    expect(snapshot.meta.showSearchScheduler).toBe(false);
  });

  it.each([true, 1, "yes", {}, [], "string"])(
    "coerces every truthy shape of showSearchScheduler ( %# )",
    (value) => {
      const snapshot = snapshotWith({ showSearchScheduler: value });

      sanitizeSearchSnapshotMeta(snapshot, OSS);

      expect(snapshot.meta.showSearchScheduler).toBe(false);
    },
  );

  /**
   * Bidirectional control: the same payload with the key ABSENT is untouched, so
   * the coercion is the sanitizer acting, not a side effect of the merge.
   */
  it("does not invent the key for a snapshot that never carried it", () => {
    const snapshot = snapshotWith({ sqlMode: true });

    sanitizeSearchSnapshotMeta(snapshot, OSS);

    expect(Object.hasOwn(snapshot.meta, "showSearchScheduler")).toBe(false);
  });

  it("keeps every legitimate (non-paid) field of the snapshot", () => {
    const snapshot = snapshotWith({
      sqlMode: true,
      quickMode: false,
      showHistogram: true,
      showTransformEditor: true,
      rowsPerPage: 100,
      resultGrid: { rowsPerPage: 20, wrapCells: true },
      regions: ["us-east"],
      scrollInfo: { offset: 12 },
      showSearchScheduler: true,
    });

    sanitizeSearchSnapshotMeta(snapshot, OSS);

    expect(snapshot.meta).toEqual({
      sqlMode: true,
      quickMode: false,
      showHistogram: true,
      showTransformEditor: true,
      rowsPerPage: 100,
      resultGrid: { rowsPerPage: 20, wrapCells: true },
      regions: ["us-east"],
      scrollInfo: { offset: 12 },
      showSearchScheduler: false,
    });
    expect(snapshot.data.stream.selectedStream).toEqual(["app_logs"]);
  });

  // ---------------------------------------------------------------------------
  // The gated panel toggle keeps its own entitlement-aware coercion (F-43/F-66)
  // ---------------------------------------------------------------------------
  it("resolves a gated panel toggle to the free default when un-entitled", () => {
    const snapshot = snapshotWith({ logsVisualizeToggle: "patterns" });

    sanitizeSearchSnapshotMeta(snapshot, OSS);

    expect(snapshot.meta.logsVisualizeToggle).toBe("logs");
  });

  it("leaves the panel toggle alone for an entitled build", () => {
    const snapshot = snapshotWith({ logsVisualizeToggle: "patterns" });

    sanitizeSearchSnapshotMeta(snapshot, ENTITLED);

    expect(snapshot.meta.logsVisualizeToggle).toBe("patterns");
  });

  it.each(["build", "visualize", "drilldown", "logs", "PATTERNS", "", "🙃"])(
    "keeps the free/unknown toggle %p inside the closed set either way",
    (value) => {
      const snapshot = snapshotWith({ logsVisualizeToggle: value });

      sanitizeSearchSnapshotMeta(snapshot, OSS);

      expect(["logs", "visualize", "build", "drilldown", "patterns"]).toContain(
        snapshot.meta.logsVisualizeToggle,
      );
      expect(snapshot.meta.logsVisualizeToggle).not.toBe("patterns");
    },
  );

  /** The toggle is COERCED, so a payload that does not mention it stays that way. */
  it("does not add a toggle a snapshot never stored", () => {
    const snapshot = snapshotWith({ sqlMode: true });

    sanitizeSearchSnapshotMeta(snapshot, OSS);

    expect(Object.hasOwn(snapshot.meta, "logsVisualizeToggle")).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // EDGE-03: `meta` itself is type-guarded, not incidentally saved by a throw
  // ---------------------------------------------------------------------------
  describe("non-object meta shapes (EDGE-03)", () => {
    it.each([
      ["string", "abc"],
      ["number", 42],
      ["boolean", true],
      ["null", null],
      ["undefined", undefined],
      ["array", ["logsVisualizeToggle", "patterns"]],
      ["function", () => undefined],
    ])("replaces a %p meta with a plain object before anything can merge it", (_label, meta) => {
      const snapshot = snapshotWith(meta);

      expect(() => sanitizeSearchSnapshotMeta(snapshot, OSS)).not.toThrow();
      expect(snapshot.meta).toEqual({});
      expect(snapshot.meta.logsVisualizeToggle).toBeUndefined();
      expect(snapshot.meta.showSearchScheduler).toBeUndefined();
    });

    /**
     * The shipped `logsVisualizeToggle`-only guard ran on `extractedObj.meta` with
     * an `Object.hasOwn` check, so an array meta with a `length` could satisfy it —
     * the shape check now runs first and unconditionally.
     */
    it("treats an array meta as unusable rather than as a record", () => {
      const snapshot = snapshotWith([]);
      (snapshot.meta as unknown as any[]).push("patterns");

      sanitizeSearchSnapshotMeta(snapshot, OSS);

      expect(snapshot.meta).toEqual({});
    });

    it.each([null, undefined, "abc", 7, []])("survives a non-object snapshot (%#)", (value) => {
      expect(() => sanitizeSearchSnapshotMeta(value as any, OSS)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Prototype pollution and other crafted keys
  // ---------------------------------------------------------------------------
  it("does not let a crafted key reach Object.prototype", () => {
    const snapshot = JSON.parse('{"meta":{"__proto__":{"paid":true}}}');

    sanitizeSearchSnapshotMeta(snapshot, OSS);

    expect(({} as any).paid).toBeUndefined();
  });

  it("is driven by the PAID_SNAPSHOT_META_KEYS table, which is the audit trail", () => {
    // Every key in the table has a default, so adding a key cannot silently
    // leave it undefined-ish; the defaults are the free-edition values.
    for (const key of PAID_SNAPSHOT_META_KEYS) {
      expect(PAID_SNAPSHOT_META_DEFAULTS).toHaveProperty(key);
      const snapshot = snapshotWith({ [key]: true });
      sanitizeSearchSnapshotMeta(snapshot, OSS);
      expect(snapshot.meta[key]).toBe(PAID_SNAPSHOT_META_DEFAULTS[key]);
    }
  });
});
