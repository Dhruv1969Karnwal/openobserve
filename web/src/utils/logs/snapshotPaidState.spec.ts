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
  PAID_SNAPSHOT_META_RULES,
  sanitizeSearchSnapshotMeta,
  type PaidSnapshotMetaKey,
  type SnapshotPaidAccess,
} from "./snapshotPaidState";
import { DEFAULT_LOGS_CONFIG } from "./constants";

/**
 * The entitlement axes are named separately on purpose: `patternsAllowed` gates the
 * panel toggle, `aiAssistantAllowed` gates the Ask-AI bar and `scheduledSearchAllowed`
 * gates the scheduled-result job context, so a cell that means "entitled" says WHICH
 * entitlement it means.
 */
const OSS: SnapshotPaidAccess = {
  patternsAllowed: false,
  aiAssistantAllowed: false,
  scheduledSearchAllowed: false,
};
const ENTITLED: SnapshotPaidAccess = {
  patternsAllowed: true,
  aiAssistantAllowed: true,
  scheduledSearchAllowed: true,
};
const PATTERNS_ONLY: SnapshotPaidAccess = {
  patternsAllowed: true,
  aiAssistantAllowed: false,
  scheduledSearchAllowed: false,
};
const AI_ONLY: SnapshotPaidAccess = {
  patternsAllowed: false,
  aiAssistantAllowed: true,
  scheduledSearchAllowed: false,
};
const SCHEDULER_ONLY: SnapshotPaidAccess = {
  patternsAllowed: false,
  aiAssistantAllowed: false,
  scheduledSearchAllowed: true,
};

/** A snapshot with the given meta, shaped like the JSON a saved view stores. */
const snapshotWith = (meta: unknown): any => ({
  meta,
  data: { stream: { selectedStream: ["app_logs"] } },
});

/** The boundary is a pure function: the sanitized COPY is what the call site merges. */
const sanitize = (meta: unknown, access: SnapshotPaidAccess = OSS): any =>
  sanitizeSearchSnapshotMeta(snapshotWith(meta), access);

/** A payload shape for each key that is NOT the value the rule has to produce. */
const PAYLOAD_PROBES: Record<PaidSnapshotMetaKey, unknown> = {
  showSearchScheduler: true,
  nlpMode: true,
  jobId: "job-of-another-session",
  jobRecords: 5000,
};

describe("sanitizeSearchSnapshotMeta", () => {
  it("coerces the paid scheduler flag the merge used to carry through", () => {
    expect(sanitize({ showSearchScheduler: true }).meta.showSearchScheduler).toBe(false);
  });

  it.each([true, 1, "yes", {}, [], "string"])(
    "coerces every truthy shape of showSearchScheduler ( %s )",
    (value) => {
      expect(sanitize({ showSearchScheduler: value }).meta.showSearchScheduler).toBe(false);
    },
  );

  /**
   * Bidirectional control: the same payload with the key ABSENT is untouched, so
   * the coercion is the sanitizer acting, not a side effect of the merge.
   */
  it("does not invent the key for a snapshot that never carried it", () => {
    expect(Object.hasOwn(sanitize({ sqlMode: true }).meta, "showSearchScheduler")).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // The Ask-AI bar's external control — a prop binding, not a watcher, so
  // the `immediate`-watcher grep that produced the first version of the table
  // missed it: logs/SearchBar.vue binds meta.nlpMode to the query editor, whose
  // `isAIMode` returns that prop alone under external control and drives the paid
  // bar's `v-if`.
  // ---------------------------------------------------------------------------
  it("coerces the Ask-AI bar's external control on an un-entitled build", () => {
    expect(sanitize({ nlpMode: true }).meta.nlpMode).toBe(false);
  });

  it.each([true, 1, "yes", {}, [], "on"])(
    "coerces every truthy shape of nlpMode ( %s )",
    (value) => {
      expect(sanitize({ nlpMode: value }).meta.nlpMode).toBe(false);
    },
  );

  /** Bidirectional control: an org that really has the assistant keeps its state. */
  it("preserves the Ask-AI bar for an org that has the assistant", () => {
    expect(sanitize({ nlpMode: true }, ENTITLED).meta.nlpMode).toBe(true);
  });

  /**
   * The restore branch is where the payload's TYPE used to survive: `restoreWhen`
   * answering true only means the org may have this state, it does not mean the
   * stored value is a boolean. A view that stored the bar OFF as `"false"` must not
   * open it on an entitled build — `Boolean("false")` is `true`, so the rule REJECTS
   * non-booleans to `hidden` instead of truthiness-coercing them. This is the
   * `SearchBar.vue :nlp-mode` → `QueryEditor isAIMode` truthiness chain.
   */
  it.each([
    ["false", false],
    ["0", false],
    ["", false],
    [[], false],
    [{}, false],
    [1, false],
    ["yes", false],
    [null, false],
    [undefined, false],
    [true, true],
    [false, false],
  ] as const)(
    "normalises a restored nlpMode of %p to %p on an entitled build",
    (value, expected) => {
      expect(sanitize({ nlpMode: value }, AI_ONLY).meta.nlpMode).toBe(expected);
    },
  );

  /**
   * The entitlement is the assistant's own, not "any paid feature at all", and the
   * axes are independent: patterns-only does not unlock the bar, and the
   * assistant does not unlock the patterns panel.
   */
  it("treats the two entitlements independently", () => {
    const patternsOnly = sanitize(
      { nlpMode: true, logsVisualizeToggle: "patterns" },
      PATTERNS_ONLY,
    );
    const assistantOnly = sanitize({ nlpMode: true, logsVisualizeToggle: "patterns" }, AI_ONLY);

    expect(patternsOnly.meta).toEqual({ nlpMode: false, logsVisualizeToggle: "patterns" });
    expect(assistantOnly.meta).toEqual({ nlpMode: true, logsVisualizeToggle: "logs" });
  });

  it("does not invent nlpMode for a snapshot that never carried it", () => {
    expect(Object.hasOwn(sanitize({ sqlMode: true }, ENTITLED).meta, "nlpMode")).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // The scheduled-result job context. Re-adjudicated under the payload attack: the
  // legit writer is route-gated, but a PAYLOAD jobId is not inert on a free build —
  // it re-points the next search at `search_jobs/{id}/result` (OSS backend: 403
  // "Not Supported") and the two `immediate` watchers in logs/SearchBar.vue turn it
  // into visible "Job Context have been removed" / "Histogram is not available for
  // scheduled search" UI, the latter also closing the free histogram panel.
  // ---------------------------------------------------------------------------
  it("drops the payload's job context on an un-entitled build", () => {
    const meta = sanitize({ jobId: "job-of-another-session", jobRecords: 5000 }, OSS).meta;

    expect(meta.jobId).toBe(DEFAULT_LOGS_CONFIG.meta.jobId);
    expect(meta.jobId).toBe("");
    expect(meta.jobRecords).toBe(DEFAULT_LOGS_CONFIG.meta.jobRecords);
  });

  /**
   * The two keys move TOGETHER, which is the reason `jobRecords` is in a table it
   * would otherwise not belong in: `useLogs.ts` reads `parseInt(jobRecords)` as the
   * free search's page size exactly when `jobId` is empty, so resetting only the id
   * would promote a payload-carried record count into the free request.
   */
  it("does not leave a payload record count in control of the free page size", () => {
    const meta = sanitize({ jobId: "job-of-another-session", jobRecords: "250000" }, OSS).meta;

    expect(meta.jobId).toBe("");
    expect(meta.jobRecords).not.toBe("250000");
    expect(parseInt(String(meta.jobRecords), 10)).toBe(100);
  });

  it("keeps the job context for an org that has scheduled search", () => {
    const meta = sanitize(
      { jobId: "job-of-another-session", jobRecords: 5000 },
      SCHEDULER_ONLY,
    ).meta;

    expect(meta.jobId).toBe("job-of-another-session");
    expect(meta.jobRecords).toBe(5000);
  });

  it.each([
    [["job"], ""],
    [{}, ""],
    [true, ""],
    [42, ""],
    ["   ", ""],
    ["", ""],
  ] as const)("normalises a restored jobId of %p to %p for an entitled org", (value, expected) => {
    expect(sanitize({ jobId: value }, SCHEDULER_ONLY).meta.jobId).toBe(expected);
  });

  it.each([
    ["1000", "1000"],
    [500, 500],
    ["0", DEFAULT_LOGS_CONFIG.meta.jobRecords],
    ["-5", DEFAULT_LOGS_CONFIG.meta.jobRecords],
    ["1e9", DEFAULT_LOGS_CONFIG.meta.jobRecords],
    ["abc", DEFAULT_LOGS_CONFIG.meta.jobRecords],
    [[], DEFAULT_LOGS_CONFIG.meta.jobRecords],
    [{}, DEFAULT_LOGS_CONFIG.meta.jobRecords],
    [1.5, DEFAULT_LOGS_CONFIG.meta.jobRecords],
  ] as const)(
    "normalises a restored jobRecords of %p to %p for an entitled org",
    (value, expected) => {
      expect(sanitize({ jobRecords: value }, SCHEDULER_ONLY).meta.jobRecords).toStrictEqual(
        expected,
      );
    },
  );

  /** Each paid axis is its own entitlement: the scheduler does not unlock the bar. */
  it("does not let the scheduler entitlement restore the Ask-AI bar", () => {
    const meta = sanitize({ nlpMode: true, jobId: "job-of-another-session" }, SCHEDULER_ONLY).meta;

    expect(meta.nlpMode).toBe(false);
    expect(meta.jobId).toBe("job-of-another-session");
  });

  it("rewrites only the paid keys of a legacy or shared view", () => {
    const meta = sanitize({
      nlpMode: true,
      showSearchScheduler: true,
      logsVisualizeToggle: "patterns",
      sqlMode: true,
      quickMode: true,
      showHistogram: false,
      rowsPerPage: 100,
    }).meta;

    expect(meta).toEqual({
      nlpMode: false,
      showSearchScheduler: false,
      logsVisualizeToggle: "logs",
      sqlMode: true,
      quickMode: true,
      showHistogram: false,
      rowsPerPage: 100,
    });
  });

  it("keeps every legitimate (non-paid) field of the snapshot", () => {
    const out = sanitize({
      sqlMode: true,
      quickMode: false,
      showHistogram: true,
      showTransformEditor: true,
      rowsPerPage: 100,
      resultGrid: { rowsPerPage: 20, wrapCells: true },
      regions: ["us-east"],
      scrollInfo: { offset: 12 },
      savedVisualizationConfig: { type: "line", config: {} },
      showSearchScheduler: true,
    });

    expect(out.meta).toEqual({
      sqlMode: true,
      quickMode: false,
      showHistogram: true,
      showTransformEditor: true,
      rowsPerPage: 100,
      resultGrid: { rowsPerPage: 20, wrapCells: true },
      regions: ["us-east"],
      scrollInfo: { offset: 12 },
      savedVisualizationConfig: { type: "line", config: {} },
      showSearchScheduler: false,
    });
    expect(out.data.stream.selectedStream).toEqual(["app_logs"]);
  });

  // ---------------------------------------------------------------------------
  // The gated panel toggle keeps its own entitlement-aware coercion
  // ---------------------------------------------------------------------------
  it("resolves a gated panel toggle to the free default when un-entitled", () => {
    expect(sanitize({ logsVisualizeToggle: "patterns" }).meta.logsVisualizeToggle).toBe("logs");
  });

  it("leaves the panel toggle alone for an entitled build", () => {
    expect(sanitize({ logsVisualizeToggle: "patterns" }, ENTITLED).meta.logsVisualizeToggle).toBe(
      "patterns",
    );
  });

  it.each(["build", "visualize", "drilldown", "logs", "PATTERNS", "", "🙃"])(
    "keeps the free/unknown toggle %p inside the closed set either way",
    (value) => {
      const toggle = sanitize({ logsVisualizeToggle: value }).meta.logsVisualizeToggle;

      expect(["logs", "visualize", "build", "drilldown", "patterns"]).toContain(toggle);
      expect(toggle).not.toBe("patterns");
    },
  );

  /** The toggle is COERCED, so a payload that does not mention it stays that way. */
  it("does not add a toggle a snapshot never stored", () => {
    expect(Object.hasOwn(sanitize({ sqlMode: true }).meta, "logsVisualizeToggle")).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // The boundary is a PURE FUNCTION. It used to mutate the payload and therefore
  // depended on the key being writable, while `applySearchSnapshot` JSON-clones the
  // payload before merging — and a JSON clone READS getters. A frozen or
  // accessor-shaped `meta` defeated the in-place version; the copy cannot be no-oped.
  // ---------------------------------------------------------------------------
  describe("the payload is never written", () => {
    it("returns a copy and leaves the snapshot it was handed untouched", () => {
      const snapshot = snapshotWith({ nlpMode: true, showSearchScheduler: true, jobId: "j-1" });

      const out = sanitizeSearchSnapshotMeta(snapshot, OSS);

      expect(out).not.toBe(snapshot);
      expect(out.meta).not.toBe(snapshot.meta);
      expect(snapshot.meta).toEqual({ nlpMode: true, showSearchScheduler: true, jobId: "j-1" });
      expect(out.meta).toEqual({ nlpMode: false, showSearchScheduler: false, jobId: "" });
    });

    /** `data` is layout the table says the view owns, so it is shared, not cloned. */
    it("copies `meta` one level deep and keeps the rest by reference", () => {
      const snapshot = snapshotWith({ nlpMode: true });

      const out = sanitizeSearchSnapshotMeta(snapshot, OSS);

      expect(out.data).toBe(snapshot.data);
    });

    it.each([
      [
        "Object.freeze on the meta",
        (meta: any, _snapshot: any) => {
          Object.freeze(meta);
        },
      ],
      [
        "Object.freeze on the snapshot",
        (_meta: any, snapshot: any) => {
          Object.freeze(snapshot);
        },
      ],
      [
        "both frozen",
        (meta: any, snapshot: any) => {
          Object.freeze(meta);
          Object.freeze(snapshot);
        },
      ],
    ])("sanitizes a payload with %s", (_label, freeze) => {
      const meta: any = { nlpMode: true, showSearchScheduler: true, jobId: "j-1" };
      const snapshot: any = { meta, data: {} };
      freeze(meta, snapshot);

      const out = sanitizeSearchSnapshotMeta(snapshot, OSS);

      expect(out.meta).toEqual({ nlpMode: false, showSearchScheduler: false, jobId: "" });
    });

    /**
     * The exact shape that defeated the in-place boundary: `Object.hasOwn` does not
     * invoke a getter and the write is swallowed, so the value only reappeared when
     * the merge JSON-cloned the payload. Copying reads the getter into a data
     * property and the paid keys are then overwritten.
     */
    it("sanitizes an accessor-shaped meta instead of reading it back later", () => {
      const meta: any = { sqlMode: true };
      Object.defineProperty(meta, "nlpMode", {
        get: () => true,
        set: () => {
          // the accessor's write is swallowed, which is the point of the cell
        },
        enumerable: true,
        configurable: true,
      });

      const out = sanitizeSearchSnapshotMeta({ meta, data: {} } as any, OSS);

      expect(out.meta.nlpMode).toBe(false);
      expect(JSON.parse(JSON.stringify(out)).meta.nlpMode).toBe(false);
    });

    it("sanitizes a Proxy-shaped meta whose set trap swallows writes", () => {
      const target: any = { nlpMode: true };
      const proxy = new Proxy(target, {
        set: () => true,
        defineProperty: () => true,
      });

      const out = sanitizeSearchSnapshotMeta({ meta: proxy, data: {} } as any, OSS);

      expect(out.meta.nlpMode).toBe(false);
      expect(target.nlpMode).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // The `meta` field itself is type-guarded, not incidentally saved by a throw
  // ---------------------------------------------------------------------------
  describe("non-object meta shapes", () => {
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

      let out: any;
      expect(() => {
        out = sanitizeSearchSnapshotMeta(snapshot, OSS);
      }).not.toThrow();
      expect(out.meta).toEqual({});
      expect(out.meta.logsVisualizeToggle).toBeUndefined();
      expect(out.meta.showSearchScheduler).toBeUndefined();
    });

    /**
     * The shipped `logsVisualizeToggle`-only guard ran on `extractedObj.meta` with
     * an `Object.hasOwn` check, so an array meta with a `length` could satisfy it —
     * the shape check now runs first and unconditionally.
     */
    it("treats an array meta as unusable rather than as a record", () => {
      const snapshot = snapshotWith([]);
      (snapshot.meta as unknown as any[]).push("patterns");

      expect(sanitizeSearchSnapshotMeta(snapshot, OSS).meta).toEqual({});
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

    const out = sanitizeSearchSnapshotMeta(snapshot, OSS);

    expect(({} as any).paid).toBeUndefined();
    expect(Object.getPrototypeOf(out.meta)).toBe(Object.prototype);
  });

  /**
   * The "set-driven, not whack-a-mole" contract is only as strong as the set, so
   * the guard is anti-vacuous: an empty table, a renamed field, or a dropped entry
   * all fail here. (`nlpMode` escaped the first enumeration precisely because
   * nothing pinned what the table has to CONTAIN, and `jobId`/`jobRecords` escaped
   * the classification because nothing pinned that a rule has to CHANGE something.)
   */
  it("is a NON-EMPTY table of real, currently-declared meta fields", () => {
    expect(PAID_SNAPSHOT_META_KEYS.length).toBeGreaterThanOrEqual(4);
    expect([...PAID_SNAPSHOT_META_KEYS].sort()).toEqual([
      "jobId",
      "jobRecords",
      "nlpMode",
      "showSearchScheduler",
    ]);
    // Derived from the very shape the merge writes into: a key that is renamed or
    // removed upstream stops being covered here rather than silently passing.
    const declaredMeta = Object.keys(DEFAULT_LOGS_CONFIG.meta);
    for (const key of PAID_SNAPSHOT_META_KEYS) {
      expect(declaredMeta, `meta.${key} is not a declared logs meta field`).toContain(key);
    }
  });

  it("gives every key of the table a rule, and applies it", () => {
    expect(Object.keys(PAID_SNAPSHOT_META_RULES).sort()).toEqual(
      [...PAID_SNAPSHOT_META_KEYS].sort(),
    );
    for (const key of PAID_SNAPSHOT_META_KEYS) {
      const rule = PAID_SNAPSHOT_META_RULES[key as PaidSnapshotMetaKey];
      const meta = sanitize({ [key]: PAYLOAD_PROBES[key] }).meta;
      expect(meta[key]).toStrictEqual(rule.hidden);
    }
  });

  /**
   * Anti-vacuity for the rule BODIES, both directions. A rule whose `hidden` equals
   * the value a payload would naturally carry does nothing and the loop above stays
   * green; a `restore` that is the identity is the same hole on the entitled branch.
   * So each key must (a) actually move its probe, (b) still be REJECTED by an
   * entitled build when the probe is of the wrong type, and (c) be PRESERVED by an
   * entitled build when the probe is a value the app itself would have written —
   * without (c) the whole table could be replaced by "always reset" unnoticed.
   */
  it("has a rule that CHANGES something on both branches, per key", () => {
    const WRONG_TYPE: Record<PaidSnapshotMetaKey, unknown> = {
      showSearchScheduler: "false",
      nlpMode: "false",
      jobId: 42,
      jobRecords: "many",
    };
    const LEGIT: Record<PaidSnapshotMetaKey, unknown> = {
      showSearchScheduler: false,
      nlpMode: true,
      jobId: "job-of-another-session",
      jobRecords: 500,
    };

    for (const key of PAID_SNAPSHOT_META_KEYS) {
      const rule = PAID_SNAPSHOT_META_RULES[key as PaidSnapshotMetaKey];
      const probe = PAYLOAD_PROBES[key];

      expect(rule.hidden, `meta.${key}: hidden must differ from the probe`).not.toStrictEqual(
        probe,
      );
      expect(sanitize({ [key]: probe }).meta[key], `meta.${key}: hidden branch is inert`).toBe(
        rule.hidden,
      );
      expect(
        sanitize({ [key]: WRONG_TYPE[key] }, ENTITLED).meta[key],
        `meta.${key}: the restore branch passes a value of the wrong type through`,
      ).toBe(rule.hidden);
    }

    const restored = sanitize({ ...LEGIT }, ENTITLED).meta;
    for (const key of PAID_SNAPSHOT_META_KEYS) {
      if (key === "showSearchScheduler") continue; // a one-shot trigger, never restored
      expect(restored[key], `meta.${key}: an entitled org lost the value it saved`).toStrictEqual(
        LEGIT[key],
      );
    }
  });

  /** Entitlement must never be able to widen the set of classified keys. */
  it("classifies the same key set whatever the entitlement says", () => {
    const meta = { nlpMode: true, showSearchScheduler: true, jobId: "j", jobRecords: 5 };
    const keys = (out: any) => Object.keys(out.meta).sort();

    expect(keys(sanitize(meta, OSS))).toEqual(keys(sanitize(meta, ENTITLED)));
  });
});
