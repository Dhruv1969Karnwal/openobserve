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
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { join } from "node:path";

// vitest runs specs with the `web/` package root as cwd; the assets under test are static
// files outside the component tree, so they are read from disk rather than imported.
const at = (rel: string) => readFileSync(join(process.cwd(), rel));

const html = at("index.html").toString("utf8");
const svg = at("public/favicon.svg").toString("utf8");
const ico = at("public/favicon.ico");
const wordmark = at("src/components/BrandWordmark.vue").toString("utf8");

function isNeutralHex(colour: string) {
  const m = /^#([0-9a-f]{6})$/i.exec(colour);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return Math.max(Math.abs(r - g), Math.abs(g - b)) <= 4;
}

interface IcoEntry {
  w: number;
  isPng: boolean;
  pixels: number[][];
}

function icoEntries(blob: Buffer): IcoEntry[] {
  const count = blob.readUInt16LE(4);
  return Array.from({ length: count }, (_, i) => {
    const dir = 6 + 16 * i;
    const w = blob[dir] || 256;
    const size = blob.readUInt32LE(dir + 8);
    const off = blob.readUInt32LE(dir + 12);
    const body = blob.subarray(off, off + size);
    const isPng = body.subarray(1, 4).toString("latin1") === "PNG";
    const pixels: number[][] = [];
    if (isPng) {
      let pos = 8;
      let idat = Buffer.alloc(0);
      let height = 0;
      let width = 0;
      while (pos + 8 <= body.length) {
        const len = body.readUInt32BE(pos);
        const type = body.subarray(pos + 4, pos + 8).toString("latin1");
        if (type === "IHDR") {
          width = body.readUInt32BE(pos + 8);
          height = body.readUInt32BE(pos + 12);
        } else if (type === "IDAT") {
          idat = Buffer.concat([idat, body.subarray(pos + 8, pos + 8 + len)]);
        }
        pos += 12 + len;
      }
      const raw = inflateSync(idat);
      const stride = width * 4;
      for (let y = 0; y < height; y++) {
        const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        for (let x = 0; x < width; x++) {
          pixels.push([row[4 * x], row[4 * x + 1], row[4 * x + 2], row[4 * x + 3]]);
        }
      }
    }
    return { w, isPng, pixels };
  });
}

const painted = (entry: IcoEntry) => entry.pixels.filter((p) => p[3] > 40);
const dark = (entry: IcoEntry) => painted(entry).filter((p) => p[0] < 80);

describe("shipped brand assets", () => {
  it("titles the document as this product and credits its author", () => {
    expect(html).toContain("<title>Retrace.ai</title>");
    expect(html).toContain('<meta name="author" content="Dhruv Karnwal" />');
    expect(html).not.toMatch(/openobserve/i);
  });

  it("serves the monochrome vector mark first with the raster as fallback", () => {
    expect(html).toMatch(/<link rel="icon"[^>]*href="\/favicon\.svg"/);
    expect(html).toMatch(/<link rel="alternate icon" href="\/favicon\.ico"/);
  });

  it("keeps the favicon glyph identical to the in-app wordmark glyph", () => {
    const inSvg = /\sd="([^"]+)"/s.exec(svg)?.[1];
    const inWordmark = /\sd="([^"]+)"/.exec(wordmark)?.[1];
    expect(inSvg).toBeTruthy();
    expect(inSvg).toBe(inWordmark);
  });

  it("paints the favicon with neutrals only — the rebrand removed the accent hues", () => {
    const colours = [...svg.matchAll(/(?:fill|stroke)="(#[0-9a-f]{6})"/g)].map((m) => m[1]);
    expect(colours.length).toBeGreaterThanOrEqual(3);
    for (const c of colours) expect(isNeutralHex(c)).toBe(true);
  });

  it("ships a readable multi-size ICO whose pixels carry no hue", () => {
    const entries = icoEntries(ico);
    const widths = entries.map((e) => e.w);
    expect(widths).toContain(16);
    expect(widths).toContain(32);
    expect(widths).toContain(48);
    for (const entry of entries) {
      expect(entry.isPng).toBe(true);
      expect(painted(entry).length).toBeGreaterThan(entry.w * entry.w * 0.4);
      expect(dark(entry).length).toBeGreaterThan(0);
      for (const [r, g, b] of painted(entry)) {
        expect(Math.max(Math.abs(r - g), Math.abs(g - b))).toBeLessThanOrEqual(4);
      }
    }
  });

  it("regenerates the committed raster from the vector, byte for byte", () => {
    const out = execFileSync(process.execPath, ["scripts/make-favicon.mjs", "--check"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(out).toContain("matches favicon.svg");
  });

  it("keeps the glyph legible at the smallest shipped size", () => {
    const smallest = icoEntries(ico).find((e) => e.w === 16)!;
    expect(dark(smallest).length).toBeGreaterThanOrEqual(8);
  });
});
