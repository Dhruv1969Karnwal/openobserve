'use strict';

// Copyright 2026 OpenObserve Inc.
/**
 * check-rendered-copy.js — the Playwright suite must quote copy the locale actually renders.
 *
 * Text assertions (`toContainText` / `toHaveText` / `getByText` / `hasText`) embed UI sentences
 * that ship from web/src/locales/languages/en-US.json, so two drifts are possible: an assertion
 * still quoting a sentence from before a rename, and an assertion quoting a sentence no locale
 * ever renders. Both are detected here by deriving the allowed and forbidden copy sets from the
 * locale file: brand placeholders filled with this product's name (allowed) or the upstream name.
 *
 * Usage: node scripts/check-rendered-copy.js [fileOrDir ...]   (default: playwright-tests + pages)
 * Exit 0 when every quoted literal agrees with the shipped locale, 1 with the list of offenders.
 */

const fs = require('fs');
const path = require('path');

const HERE = path.resolve(__dirname, '..');
const LOCALE = path.resolve(HERE, '../../web/src/locales/languages/en-US.json');
// The name this edition renders in a brand slot, per web/src/components/BrandWordmark.vue.
const PRODUCT = 'Retrace.ai';
// The upstream project name, forbidden only where the locale fills a brand slot with it.
const UPSTREAM = 'OpenObserve';
const BRAND_PLACEHOLDERS = ['product', 'brand', 'appName'];
const ASSERTION = /(?:toContainText|toHaveText|getByText|byText|hasText|includeText)\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;

const flatten = (node, prefix, into) => {
    for (const [key, value] of Object.entries(node)) {
        const name = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object') flatten(value, name, into);
        else if (typeof value === 'string') into.push([name, value]);
    }
    return into;
};

const fill = (text, brand) =>
    text.replace(/\{(\w+)\}/g, (whole, name) => (BRAND_PLACEHOLDERS.includes(name) ? brand : whole));

const entries = flatten(JSON.parse(fs.readFileSync(LOCALE, 'utf8')), '', []);
const shipped = entries.map(([, value]) => fill(value, PRODUCT));
const stale = [
    ...entries
        .filter(([, value]) => BRAND_PLACEHOLDERS.some((p) => value.includes(`{${p}}`)))
        .map(([, value]) => fill(value, UPSTREAM)),
    ...shipped.filter((text) => text.includes(PRODUCT)).map((text) => text.split(PRODUCT).join(UPSTREAM)),
];

const files = [];
const collect = (target) => {
    if (!fs.existsSync(target)) return;
    if (fs.statSync(target).isDirectory()) {
        for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
            if (entry.name === 'node_modules' || entry.name === 'playwright-results') continue;
            collect(path.join(target, entry.name));
        }
    } else if (/\.js$/.test(target)) files.push(target);
};
const roots = process.argv.slice(2);
const defaults = [path.join(HERE, 'playwright-tests'), path.join(HERE, 'pages')];
for (const root of roots.length ? roots : defaults) collect(path.resolve(root));

const problems = [];
let checked = 0;
for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
        const trimmed = line.trimStart();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
        for (const match of line.matchAll(ASSERTION)) {
            const literal = match[2];
            // URLs, package specifiers and SDK hosts name upstream on purpose; no locale renders them.
            if (literal.length < 12 || /https?:|www\.|npm i |@[a-z0-9-]+\//i.test(literal)) continue;
            checked += 1;
            const inShipped = shipped.some((text) => text.includes(literal));
            const inStale = stale.some((text) => text.includes(literal));
            const where = `${path.relative(HERE, file)}:${index + 1}`;
            if (inStale && !inShipped) problems.push(`${where} quotes pre-rename copy: ${literal}`);
            else if (!inStale && literal.includes(PRODUCT) && !inShipped)
                problems.push(`${where} quotes copy no locale renders: ${literal}`);
        }
    });
}

for (const problem of problems) console.error(`FAIL ${problem}`);
console.log(
    `checked ${checked} quoted literals against ${entries.length} en-US strings ` +
        `(${shipped.length} shipped / ${stale.length} pre-rename) in ${files.length} scanned files`,
);
process.exit(problems.length ? 1 : 0);
