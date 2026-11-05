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

/**
 * The alerts row's second line: what the rule watches and what it fires on.
 * Every segment is a field the list payload already carries — nothing here comes
 * from a request the page did not make.
 */

const PLACEHOLDERS = new Set(["", "--", "—", "-"]);

export interface RuleFact {
  text: string;
  /** Identifiers and expressions compare character by character. */
  mono?: boolean;
  /** Prose ABOUT the rule, so it never reads as part of the expression it follows. */
  prose?: boolean;
}

type Translate = (key: string, named?: Record<string, unknown>) => string;

const isBlank = (value: unknown): boolean =>
  value === null || value === undefined || PLACEHOLDERS.has(String(value).trim());

const printValue = (value: unknown): string => {
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  const text = String(value).trim();
  return `"${text}"`;
};

/** `column operator value`, from a threshold or a single-condition rule. */
function comparisonFact(node: any): RuleFact | null {
  if (isBlank(node?.column) || isBlank(node?.operator)) return null;
  const parts = [String(node.column).trim(), String(node.operator).trim()];
  if (!isBlank(node?.value)) parts.push(printValue(node.value));
  return { text: parts.join(" "), mono: true };
}

/** The rule's own expression; a multi-condition rule has no single-line form. */
export function conditionFact(condition: any): RuleFact | null {
  if (!condition || typeof condition !== "object") return null;
  if (!isBlank(condition.column)) return comparisonFact(condition);
  if (Array.isArray(condition.conditions) && condition.conditions.length === 1) {
    return comparisonFact(condition.conditions[0]);
  }
  if (typeof condition.promql === "string" && !isBlank(condition.promql)) {
    return { text: condition.promql.trim(), mono: true };
  }
  return null;
}

export function streamFact(row: any): RuleFact | null {
  if (isBlank(row?.stream_name)) return null;
  return { text: String(row.stream_name).trim(), mono: true };
}

/** "every 5 minutes" for an interval rule, the raw schedule for a cron one. */
export function cadenceFact(row: any, t: Translate): RuleFact | null {
  if (isBlank(row?.frequency)) return null;
  if (String(row.frequency_type) === "cron") return { text: String(row.frequency), mono: true };
  const count = Number(row.frequency);
  if (!Number.isFinite(count) || count <= 0) return null;
  return {
    text: t("alerts.ruleEvery", { duration: t("alerts.summary.minuteCount", { n: count }) }),
    prose: true,
  };
}

/** A rule with no cadence checks continuously; without this the family is a 12px glyph. */
export function familyFact(row: any, t: Translate): RuleFact | null {
  if (!row?.is_real_time || !isBlank(row?.frequency)) return null;
  return { text: t("alerts.realTime"), prose: true };
}

/** Composite rows print the backend's resolved expression; every other kind builds from its fields. */
export function ruleFacts(row: any, t: Translate): RuleFact[] {
  if (!row) return [];
  if (row.alert_type === "Composite") {
    return isBlank(row.conditions) ? [] : [{ text: String(row.conditions), mono: false }];
  }
  const cadence = cadenceFact(row, t);
  const facts = [
    streamFact(row),
    conditionFact(row.rawCondition),
    cadence ?? familyFact(row, t),
  ].filter((fact): fact is RuleFact => fact !== null);
  return facts;
}

/** 12px mono advance and the " · " separator, in px. */
const FACT_CHAR_PX = 7.2;
const FACT_SEP_PX = 10;

/** Keep the leading facts the line can hold: dropping one beats ellipsising three, because `node_sys…` names nothing. */
export function fitFacts(facts: RuleFact[], budgetPx: number): RuleFact[] {
  if (budgetPx <= 0) return facts;
  const out: RuleFact[] = [];
  let used = 0;
  for (const fact of facts) {
    const cost = fact.text.length * FACT_CHAR_PX + (out.length ? FACT_SEP_PX : 0);
    if (out.length && used + cost > budgetPx) break;
    out.push(fact);
    used += cost;
  }
  return out;
}
