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

import { describe, expect, it } from "vitest";
import { cadenceFact, conditionFact, fitFacts, ruleFacts, streamFact } from "./alertRuleFacts";

// Mirrors the two en-US messages the line is built from, including its plurals.
const t = (key: string, named?: Record<string, any>): string => {
  if (key === "alerts.summary.minuteCount")
    return named?.n === 1 ? "1 minute" : `${named?.n} minutes`;
  if (key === "alerts.ruleEvery") return `every ${named?.duration}`;
  return key;
};

describe("conditionFact", () => {
  it("prints a threshold rule as its own comparison", () => {
    expect(
      conditionFact({ type: "threshold", column: "duration_ms", operator: ">", value: 800 }),
    ).toEqual({ text: "duration_ms > 800", mono: true });
  });

  it("quotes a string value and drops an absent one", () => {
    expect(
      conditionFact({ type: "threshold", column: "level", operator: "=", value: "error" })?.text,
    ).toBe('level = "error"');
    expect(
      conditionFact({
        type: "threshold",
        column: "error.message",
        operator: "not_null",
        value: "",
      })?.text,
    ).toBe("error.message not_null");
  });

  it("unwraps a single nested condition and refuses to summarise several", () => {
    expect(
      conditionFact({
        type: "condition",
        conditions: [{ column: "a", operator: ">=", value: 1 }],
      })?.text,
    ).toBe("a >= 1");
    expect(
      conditionFact({
        type: "condition",
        conditions: [
          { column: "a", operator: ">=", value: 1 },
          { column: "b", operator: "<", value: 2 },
        ],
      }),
    ).toBeNull();
  });

  it("keeps a promql expression verbatim and prints nothing for a raw SQL rule", () => {
    expect(conditionFact({ type: "promql", promql: "sum(rate(x[5m])) > 100" })).toEqual({
      text: "sum(rate(x[5m])) > 100",
      mono: true,
    });
    expect(conditionFact({ type: "sql", sql: "select * from t where a > 1" })).toBeNull();
    expect(conditionFact({})).toBeNull();
    expect(conditionFact(null)).toBeNull();
  });
});

describe("streamFact / cadenceFact", () => {
  it("omits a stream the row does not name", () => {
    expect(streamFact({ stream_name: "--" })).toBeNull();
    expect(streamFact({ stream_name: "app_checkout" })).toEqual({
      text: "app_checkout",
      mono: true,
    });
  });

  it("says 'every N minutes' for an interval and the raw schedule for a cron rule", () => {
    expect(cadenceFact({ frequency: 5, frequency_type: "minutes" }, t)?.text).toBe(
      "every 5 minutes",
    );
    expect(cadenceFact({ frequency: 1, frequency_type: "minutes" }, t)?.text).toBe(
      "every 1 minute",
    );
    expect(cadenceFact({ frequency: "0 3 * * *", frequency_type: "cron" }, t)).toEqual({
      text: "0 3 * * *",
      mono: true,
    });
    expect(cadenceFact({ frequency: "", frequency_type: "minutes" }, t)).toBeNull();
  });
});

describe("ruleFacts", () => {
  it("lays out where the rule reads, what it fires on and how often it checks", () => {
    expect(
      ruleFacts(
        {
          alert_type: "Scheduled",
          stream_name: "app_checkout",
          rawCondition: { type: "threshold", column: "duration_ms", operator: ">", value: 800 },
          frequency: 5,
          frequency_type: "minutes",
        },
        t,
      ).map((fact) => fact.text),
    ).toEqual(["app_checkout", "duration_ms > 800", "every 5 minutes"]);
  });

  it("uses the backend's resolved expression for a composite and nothing for an SLO row", () => {
    expect(
      ruleFacts({ alert_type: "Composite", conditions: "a OR b", stream_name: "--" }, t),
    ).toEqual([{ text: "a OR b", mono: false }]);
    expect(ruleFacts({ alert_type: "Scheduled", stream_name: "--", rawCondition: {} }, t)).toEqual(
      [],
    );
    expect(ruleFacts(null, t)).toEqual([]);
  });
});

describe("fitFacts", () => {
  const facts = [
    { text: "node_syslog", mono: true },
    { text: 'message contains "disk pressure"', mono: true },
    { text: "every 30 minutes" },
  ];

  it("drops the tail that will not fit rather than ellipsising every fact", () => {
    expect(fitFacts(facts, 46 * 7.2).map((f) => f.text)).toEqual([
      "node_syslog",
      'message contains "disk pressure"',
    ]);
  });

  it("always keeps at least the first fact, and all of them with no measurement", () => {
    expect(fitFacts(facts, 20).map((f) => f.text)).toEqual(["node_syslog"]);
    expect(fitFacts(facts, 0)).toEqual(facts);
    expect(fitFacts([], 100)).toEqual([]);
  });
});
