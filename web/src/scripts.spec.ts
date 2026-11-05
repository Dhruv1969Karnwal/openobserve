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
 * Guards over the developer-facing scripts in web/scripts + their package.json
 * entries. Both of these exist because the thing they protect is invisible to
 * `git status`: `type-check:changes` writes a generated tsconfig that is
 * gitignored, so a run killed by SIGTERM/SIGKILL (a `timeout`, a `systemctl stop`,
 * the OOM killer) leaves a program describing the PREVIOUS diff sitting in the
 * tree, and the `lint:design:strict` name promised an assurance level the script
 * did not implement.
 */

import { describe, expect, it, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CONFIG = join(process.cwd(), "tsconfig.changes.tmp.json");
const TYPE_CHECK_SCRIPT = "scripts/type-check-changes.mjs";
const DESIGN_SCRIPT = "scripts/check-design-consistency.mjs";
const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));

// `--files` skips the git diff and `--list` returns before any compiler is spawned,
// so this exercises the script's startup path without type-checking anything.
const runTypeCheckScript = () =>
  execFileSync(
    process.execPath,
    [TYPE_CHECK_SCRIPT, "--files=src/__type-check-changes-spec__.ts", "--list"],
    { cwd: process.cwd(), encoding: "utf8" },
  );

describe("type-check:changes leaves no residue behind", () => {
  afterEach(() => {
    // Whatever a cell left, the tree must not keep it: this file is gitignored, so
    // a leak here is exactly the invisible residue the startup cleanup exists for.
    rmSync(CONFIG, { force: true });
  });

  it("deletes a stale generated tsconfig at startup", () => {
    writeFileSync(
      CONFIG,
      JSON.stringify(
        { extends: "./tsconfig.app.json", include: ["src/previous-wave.ts"] },
        null,
        2,
      ),
    );
    expect(existsSync(CONFIG)).toBe(true);

    const out = runTypeCheckScript();

    expect(out).toContain("__type-check-changes-spec__.ts");
    expect(existsSync(CONFIG)).toBe(false);
  });

  it("is idempotent: a second run with nothing left behind still succeeds", () => {
    expect(existsSync(CONFIG)).toBe(false);

    expect(runTypeCheckScript()).toContain("1 file(s)");
    expect(existsSync(CONFIG)).toBe(false);
  });
});

describe("the design guard's script names say what they run", () => {
  const strict = String(pkg.scripts["lint:design:strict"]);
  const base = String(pkg.scripts["lint:design"]);

  it("runs the design-consistency guard under BOTH names", () => {
    expect(base).toContain(DESIGN_SCRIPT);
    expect(strict).toContain(DESIGN_SCRIPT);
  });

  it("passes --strict to the strict name, so the name is not decorative", () => {
    expect(strict).toContain("--strict");
    expect(base).not.toContain("--strict");
  });

  it("implements the flag the script name advertises", () => {
    const source = readFileSync(join(process.cwd(), DESIGN_SCRIPT), "utf8");
    expect(source).toContain('process.argv.includes("--strict")');
    // The old comment documented the flag as ignored; the mode now has a job.
    expect(source).not.toMatch(/is accepted and ignored/);
  });
});

describe("the runtime-contrast gate's script names run the gate", () => {
  const RUNTIME_SCRIPT = "scripts/check-runtime-contrast.mjs";
  const strict = String(pkg.scripts["lint:runtime-contrast:strict"]);
  const base = String(pkg.scripts["lint:runtime-contrast"]);

  it("runs the census script under BOTH names, --strict only under the strict one", () => {
    expect(base).toContain(RUNTIME_SCRIPT);
    expect(strict).toContain(RUNTIME_SCRIPT);
    expect(strict).toContain("--strict");
    expect(base).not.toContain("--strict");
    expect(base).not.toContain("--selftest");
  });

  it("--strict runs the FULL census, not only the selftest (RS10-03)", () => {
    // Behavior, not grep: the census line and the self-spec line must BOTH appear, in order.
    const out = execFileSync(process.execPath, [RUNTIME_SCRIPT, "--strict"], {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    expect(out).toContain("runtime contrast:");
    expect(out).toContain("self-spec OK");
    expect(out.indexOf("runtime contrast:")).toBeLessThan(out.indexOf("self-spec OK"));
  }, 180_000);
});
