#!/usr/bin/env node
// Copyright 2026 OpenObserve Inc.
//
// Local scoped guard: type/template check the files a branch actually touched.
//
// WHY THIS EXISTS: `type-check:app` compiles the whole app program and that
// program does not fit in memory here — it dies in V8 at ~6.1 GiB after ~165 s
// (EXIT 134), and 6-7 GiB cgroups OOM-kill it sooner. A program scoped to the
// diff finishes in seconds, and a planted TS2322 in a .ts file plus a TS2339 in a
// .vue template both fail it, so the guard does bite. Wide diffs can still OOM,
// so a heap failure retries in shrinking chunks instead of reporting "fail".
//
// HEAP: default 6144 MiB suits machines with >=8 GiB; inside a 6 GiB cgroup the
// slice OOM-kills that before V8 self-limits, so pass `--heap=4608` there. A
// SIGTERM/SIGKILL from outside (a `systemctl stop`, a `timeout`, the OOM killer)
// skips the `finally` below and leaves tsconfig.changes.tmp.json behind — it is
// gitignored, so `git status` will not show it. That is handled, not prevented:
// every run deletes the residue as its first act (see STALE_CONFIG), so a killed
// run can never hand the next one a program built from the PREVIOUS diff.

import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(__dirname, "..");

// The generated program lives at a fixed path, and `extends`/`include` resolve
// relative to it — so it has to sit in web/ next to tsconfig.app.json.
const CFG = join(WEB_ROOT, "tsconfig.changes.tmp.json");

// Startup cleanup, before any exit below. The `finally` at the end of the run
// handles normal exits (including a normal exit on type errors), but an external
// SIGTERM/SIGKILL never runs it: a `timeout`, a `systemctl stop`, or the cgroup
// OOM killer all leave the file behind, and it is gitignored, so a clean
// `git status` proves nothing about it. Deleting here makes the run idempotent —
// the residue can never be mistaken for this run's program, and the next
// invocation always regenerates it from ITS OWN diff.
rmSync(CFG, { force: true });

// Local bin, never `npx`: an npx miss resolves vue-tsc through the registry.
const VUE_TSC = join(WEB_ROOT, "node_modules", ".bin", "vue-tsc");

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const BASE = arg("base", "origin/feat/darknight");
const EXPLICIT = arg("files", "");
const CONFIG = join(WEB_ROOT, "tsconfig.app.json");
const HEAP = arg("heap", "6144");
const CHUNK = Number(arg("chunk", "0"));

// vue-tsc needs its own heap: it dies on node's ~2 GiB default well before the app graph ends.
const nodeOptions = () => {
  const flag = "--max-old-space-size=" + String(HEAP);
  const base = (process.env.NODE_OPTIONS || "").trim();
  return base ? base + " " + flag : flag;
};

const git = (args) =>
  execFileSync("git", args, { cwd: WEB_ROOT, encoding: "utf8" }).split("\n").filter(Boolean);

/** Paths relative to web/, of files this branch (or the working tree) changed. */
function changedFiles() {
  if (EXPLICIT) {
    return EXPLICIT.split(",")
      .map((f) => f.trim())
      .filter(Boolean);
  }
  const committed = git(["diff", "--name-only", "--diff-filter=ACMR", `${BASE}...HEAD`, "--"]);
  // Uncommitted work counts too: this is the pre-push loop, and a bare `git diff` reads the worktree.
  const dirty = git(["diff", "--name-only", "--diff-filter=ACMR", "HEAD", "--"]);
  const untracked = git(["ls-files", "--others", "--exclude-standard"]);
  const all = new Set([...committed, ...dirty, ...untracked]);
  const strip = (f) => (f.startsWith("web/") ? f.slice("web/".length) : f);
  return [...all].map(strip).filter((f) => f && !f.startsWith("public/"));
}

const CHECKABLE = (f) =>
  (f.endsWith(".ts") || f.endsWith(".vue") || f.endsWith(".tsx")) &&
  !f.includes("node_modules") &&
  !f.startsWith("dist/");

const files = changedFiles().filter(CHECKABLE);

if (files.length === 0) {
  console.log(`type-check:changes — nothing checkable changed vs ${BASE}.`);
  process.exit(0);
}

if (argv.includes("--list")) {
  console.log(`${files.length} file(s) vs ${BASE}:`);
  for (const f of files) console.log(`  ${f}`);
  process.exit(0);
}

// The ambient declarations stay in every program: without them .vue files lose
// global component knowledge and report a wall of errors unrelated to the diff.
const program = (subset) => ({
  extends: "./tsconfig.app.json",
  include: ["env.d.ts", "src/env.d.ts", "src/**/*.d.ts", ...subset],
  exclude: ["node_modules", "dist"],
  compilerOptions: { composite: false },
});

function runProgram(subset) {
  writeFileSync(CFG, JSON.stringify(program(subset), null, 2) + "\n");
  try {
    const out = execFileSync(VUE_TSC, ["--noEmit", "-p", CFG, "--composite", "false"], {
      cwd: WEB_ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, NODE_OPTIONS: nodeOptions() },
    });
    if (out.trim()) process.stdout.write(out);
    return { ok: true, oom: false };
  } catch (err) {
    const out = [err.stdout, err.stderr].filter(Boolean).join("\n");
    if (out.trim()) process.stdout.write(out + "\n");
    const oom =
      /Reached heap limit|JavaScript heap out of memory|out of memory/i.test(out) ||
      err.status === 134 ||
      err.signal === "SIGABRT";
    return { ok: false, oom, status: err.status ?? 1 };
  }
}

const chunks = (list, size) => {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

if (!existsSync(CONFIG)) {
  console.error(`type-check:changes — ${relative(WEB_ROOT, CONFIG)} not found.`);
  process.exit(2);
}

if (!existsSync(VUE_TSC)) {
  console.error(
    `type-check:changes — ${relative(WEB_ROOT, VUE_TSC)} not found; run \`npm ci\` in web/ first.`,
  );
  process.exit(2);
}

let unverified = [];
let failed = false;
let exitCode = 0;
try {
  console.log(`type-check:changes — ${files.length} changed file(s) vs ${BASE}`);
  const first = runProgram(files);
  if (first.ok) {
    console.log("type-check:changes — PASS");
  } else if (!first.oom) {
    console.error("type-check:changes — FAIL (type errors above)");
    exitCode = first.status || 1;
  } else {
    // The diff is too wide for one program, which says nothing about the types in it.
    console.log("whole-diff program exhausted the heap; retrying in chunks");
    const sizes = CHUNK > 0 ? [CHUNK, 1] : [16, 8, 4, 1];
    let queue = [files];
    for (const size of sizes) {
      const next = [];
      for (const group of queue) {
        for (const part of size >= group.length ? [group] : chunks(group, size)) {
          const res = runProgram(part);
          if (res.ok) continue;
          if (!res.oom) {
            // Keep going: one dirty file must not hide the state of the other chunks.
            failed = true;
            console.error("type-check:changes — FAIL in a chunk of " + part.length + ":");
            for (const f of part) console.error("  " + f);
          }
          if (part.length === 1) unverified.push(part[0]);
          else next.push(part);
        }
      }
      queue = next;
      if (!queue.length) break;
    }
    if (unverified.length) {
      console.error(
        "type-check:changes — UNVERIFIED (" +
          unverified.length +
          " file(s) could not be compiled even alone at " +
          HEAP +
          " MiB; run `type-check:app` where memory allows):",
      );
      for (const f of unverified) console.error("  " + f);
      exitCode = 2;
    } else if (failed) {
      console.error("type-check:changes — FAIL (type errors above, from the chunked retries)");
      exitCode = 1;
    } else {
      console.log("type-check:changes — PASS (chunked)");
    }
  }
} finally {
  rmSync(CFG, { force: true });
}

// `process.exit()` inside the try above would skip that `finally` and leak CFG.
process.exit(exitCode);
