#!/usr/bin/env node
/**
 * Cube v1.x rejects dimensions and measures whose SQL references another cube:
 *
 *   Member 'Orderfacts.bpartner' references foreign cubes: Businesspartner.
 *   Please split and move this definition to corresponding cubes.
 *
 * The documented replacement is a view with join_path + prefix, so this script
 * comments those members out and leaves a marker pointing at the view layer.
 *
 * IMPORTANT: joins: MUST reference other cubes - that is their purpose. Only
 * dimensions: and measures: are restricted. Earlier versions of this script
 * stripped joins and broke every cube; hence the explicit section scoping.
 *
 *   node scripts/strip-foreign-members.mjs model/cubes
 */
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('usage: strip-foreign-members.mjs <dir>'); process.exit(2); }

/** Cubes defined elsewhere in the model. A reference to one of these from a
 *  dimension or measure is what v1.x rejects. */
const FOREIGN = ['Client', 'Organization', 'Businesspartner', 'Dropshipcustomers',
  'Vendors', 'Product', 'Productcategory', 'User', 'Approver', 'Reference',
  'Bank', 'Bankaccount', 'Bankstatement', 'Warehouselayout', 'Warehouse'];

/** Only these sections are scoped; joins and preAggregations are left alone. */
const SECTIONS = ['dimensions', 'measures'];

/**
 * Return [start, end) of the INTERIOR of `name: { ... }`, by brace counting.
 * The interior excludes the header and the closing brace - otherwise the member
 * regex below matches the section itself and comments out every member at once.
 */
function sectionRange(src, name) {
  const m = new RegExp(`\\n[ \\t]*${name}:[ \\t]*\\{`).exec(src);
  if (!m) return null;
  const start = m.index + m[0].length;   // just past the opening brace
  let i = start, depth = 1;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    i++;
  }
  return [start, i - 1];                 // just before the closing brace
}

let total = 0;
for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
  const p = path.join(dir, file);
  let src = fs.readFileSync(p, 'utf8');
  const self = (src.match(/cube\(`(\w+)`/) || [])[1];
  let count = 0;

  for (const section of SECTIONS) {
    const range = sectionRange(src, section);
    if (!range) continue;
    const [start, end] = range;
    const body = src.slice(start, end);

    // Indentation-anchored member blocks. [ \t]* not \s* - \s swallows newlines.
    const memberRe = /\n([ \t]+)([a-zA-Z_]\w*):[ \t]*\{[\s\S]*?\n\1\},?/g;
    const patched = body.replace(memberRe, (block, indent) => {
      const refs = [...block.matchAll(/\$\{(\w+)\}/g)].map(x => x[1]);
      const foreign = [...new Set(refs.filter(r => FOREIGN.includes(r) && r !== self))];
      if (!foreign.length) return block;
      count++; total++;
      // Line comments only - block comments cannot nest.
      const commented = block.replace(/\n/g, `\n${indent}// `);
      return `\n${indent}// MIGRATION v1.x: a ${section.slice(0, -1)} may not reference `
           + `foreign cubes (${foreign.join(', ')}).\n`
           + `${indent}// Expose through a view using join_path + prefix.`
           + commented;
    });
    src = src.slice(0, start) + patched + src.slice(end);
  }

  if (count) {
    fs.writeFileSync(p, src);
    console.log(`${file.padEnd(22)} ${count} member(s) -> view layer`);
  }
}
console.log(`total: ${total}`);
