#!/usr/bin/env node
/**
 * Convert a JavaScript cube definition to YAML.
 *
 *   node scripts/js2yaml.mjs model/cubes/OrderFacts.js            # print
 *   node scripts/js2yaml.mjs model/cubes/OrderFacts.js --write    # write .yml
 *
 * WHY A CONVERTER AND NOT HAND-EDITING
 *
 * Cube ships no JS->YAML converter (the only conversion tool in the org is
 * lkml2cube, LookML->Cube; `cubejs generate` scaffolds from database tables and
 * would discard every line of hand-written SQL). That leaves converting 22
 * files and ~5,100 lines by hand, most of it iDempiere SQL, where a single
 * mis-indented line inside a YAML block scalar corrupts a query SILENTLY.
 *
 * A script is not faster than hand-editing so much as CHECKABLE: it is
 * repeatable, reviewable as a diff, and it moves SQL as opaque text rather than
 * retyping it.
 *
 * HOW IT READS THE JS
 *
 * Not by parsing. The file is EXECUTED in a VM whose global object answers to
 * any identifier, so template literals resolve themselves and the SQL comes out
 * already interpolated:
 *
 *   ${CUBE}                                   -> {CUBE}
 *   ${Client}.ad_client_id                    -> {Client}.ad_client_id
 *   ${linenetamt} - ${linepricelimit}         -> {linenetamt} - {linepricelimit}
 *   ${FILTER_PARAMS.X.date.filter('o.d')}     -> {FILTER_PARAMS.X.date.filter('o.d')}
 *
 * All four are valid YAML syntax unchanged, which is what makes this tractable.
 *
 * Member references need to come out two different ways depending on where they
 * land - braced inside SQL, bare in a pre-aggregation member list - so refs
 * carry their dotted path and are rendered by context, not by string matching.
 *
 * WHAT IT WILL NOT DO FOR YOU
 *
 *   - helpers.js imports are inlined by executing them, so the YAML holds the
 *     EXPANDED SQL. Correct, but it loses the shared abstraction: a change to
 *     transformToBoolean will no longer reach converted cubes.
 *   - files defining several cubes emit several documents; splitting them into
 *     separate files is a manual decision.
 *   - access_policy is NOT generated. Adding it is the entire point of moving
 *     to YAML, but it is a security decision, not a mechanical translation.
 *
 * ALWAYS run `cubejs validate`, then scripts/validate.mjs, after converting.
 * A converted cube that compiles is not a converted cube that is correct.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const REF = Symbol('ref');

/** A stand-in for any identifier the cube file mentions. */
function makeRef(pathStr) {
  const fn = function () {};
  fn[REF] = pathStr;
  return new Proxy(fn, {
    get(target, prop) {
      if (prop === REF) return pathStr;
      if (prop === Symbol.toPrimitive) return () => `{${pathStr}}`;
      if (prop === 'toString') return () => `{${pathStr}}`;
      if (typeof prop === 'symbol') return undefined;
      return makeRef(`${pathStr}.${String(prop)}`);
    },
    // supports FILTER_PARAMS.Cube.dim.filter('col')
    apply(target, _this, args) {
      const rendered = args
        .map(a => (typeof a === 'string' ? `'${a}'` : String(a)))
        .join(', ');
      return makeRef(`${pathStr}(${rendered})`);
    },
  });
}

const isRef = v => v !== null && typeof v === 'object' && v[REF] !== undefined
  || typeof v === 'function' && v[REF] !== undefined;

/** Keys Cube spells with underscores in YAML. */
const KEY_MAP = {
  primaryKey: 'primary_key',
  timeDimension: 'time_dimension',
  drillMembers: 'drill_members',
  refreshKey: 'refresh_key',
  partitionGranularity: 'partition_granularity',
  buildRangeStart: 'build_range_start',
  buildRangeEnd: 'build_range_end',
  sqlAlias: 'sql_alias',
  preAggregations: 'pre_aggregations',
  updateWindow: 'update_window',
  subQuery: 'sub_query',
  propagateFiltersToSubQuery: 'propagate_filters_to_sub_query',
  rollups: 'rollups',
  unionWithSourceData: 'union_with_source_data',
};
const yamlKey = k => KEY_MAP[k] ?? k;

/** Members inside these keys are written bare: Orderfacts.linecount */
const MEMBER_LISTS = new Set([
  'measures', 'dimensions', 'segments', 'drill_members', 'rollups', 'columns',
]);

/**
 * Keys holding a SINGLE member reference, also written bare.
 *
 * Braces matter here beyond style: YAML reads a value starting with `{` as a
 * flow mapping, so `time_dimension: {Orderfacts.dateordered}` parses as a map
 * with a null value rather than a member reference.
 */
const MEMBER_SCALARS = new Set(['time_dimension']);

function scalar(v) {
  if (isRef(v)) return `{${v[REF]}}`;
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  const s = String(v);
  if (s.includes('\n')) return null;            // caller uses a block scalar
  if (/^[A-Za-z_][\w .%-]*$/.test(s) && !/^(true|false|null|yes|no|on|off)$/i.test(s)) return s;
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function block(value, indent) {
  const pad = ' '.repeat(indent);
  const body = String(value).replace(/^\s*\n/, '').replace(/\s+$/, '').split('\n')
    .map(l => (l.trim() ? pad + l.replace(/^\s{0,6}/, '') : ''))
    .join('\n');
  return `|\n${body}`;
}

function emit(obj, indent, parentKey) {
  const pad = ' '.repeat(indent);
  const out = [];

  for (const [rawKey, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    const key = yamlKey(rawKey);

    // single member reference -> bare dotted path
    if (MEMBER_SCALARS.has(key) && isRef(value)) {
      out.push(`${pad}${key}: ${value[REF]}`);
      continue;
    }

    // member lists -> bare dotted references
    if (MEMBER_LISTS.has(key) && Array.isArray(value)) {
      out.push(`${pad}${key}:`);
      for (const m of value) out.push(`${pad}  - ${isRef(m) ? m[REF] : String(m)}`);
      continue;
    }

    // { sql: `...` } wrappers (build_range_start, refresh_key)
    if (value && typeof value === 'object' && !Array.isArray(value) && !isRef(value)) {
      // named collections: measures/dimensions/joins/pre_aggregations objects
      const named = ['measures', 'dimensions', 'segments', 'joins', 'pre_aggregations', 'hierarchies'];
      if (named.includes(key)) {
        out.push(`${pad}${key}:`);
        for (const [name, def] of Object.entries(value)) {
          out.push(`${pad}  - name: ${name}`);
          out.push(emit(def, indent + 4, key));
        }
        continue;
      }
      out.push(`${pad}${key}:`);
      out.push(emit(value, indent + 2, key));
      continue;
    }

    const s = scalar(value);
    out.push(s === null
      ? `${pad}${key}: ${block(value, indent + 2)}`
      : `${pad}${key}: ${s}`);
  }
  return out.filter(Boolean).join('\n');
}

// ---------------------------------------------------------------- run

const file = process.argv[2];
const write = process.argv.includes('--write');
if (!file) {
  console.error('\n  usage: node scripts/js2yaml.mjs <cube.js> [--write]\n');
  process.exit(2);
}

let src = fs.readFileSync(file, 'utf8');
const helpersUsed = [...src.matchAll(/import\s*\{([^}]+)\}\s*from\s*'\.\/helpers'/g)]
  .flatMap(m => m[1].split(',').map(s => s.trim()));
src = src.replace(/^import[^\n]*\n/gm, '');

const helpers = await import(path.resolve(path.dirname(file), '..', 'helpers.js'));

const cubes = [];
const sandbox = new Proxy({
  cube: (name, def) => cubes.push({ name, def }),
  view: (name, def) => cubes.push({ name, def, isView: true }),
  ...helpers,
  console,
}, {
  has: () => true,                                   // every identifier resolves
  get(target, prop) {
    if (prop in target) return target[prop];
    if (typeof prop === 'symbol') return undefined;
    return makeRef(String(prop));
  },
});

vm.runInNewContext(src, sandbox, { filename: file });

const docs = cubes.map(({ name, def, isView }) => {
  const { sql, ...rest } = def;
  const ordered = { name, ...(sql !== undefined ? { sql } : {}), ...rest };
  return emit(ordered, 4, null)
    .replace(/^ {4}name:/, '  - name:');
});

const header = `# GENERATED from ${path.basename(file)} by scripts/js2yaml.mjs
#
# Converted, NOT reviewed. Two things this cannot decide for you:
#   - access_policy is absent. Adding it is the reason to be in YAML at all,
#     but it is a security decision and has to be written deliberately.
#   - helpers (${helpersUsed.join(', ') || 'none'}) are EXPANDED inline, so the shared
#     abstraction is gone and edits to helpers.js no longer reach this file.
#
# Verify with \`cubejs validate\`, then scripts/validate.mjs. Compiling is not
# the same as returning the same numbers.

cubes:`;

const out = [header, ...docs].join('\n');

if (write) {
  const target = file.replace(/\.js$/, '.yml');
  fs.writeFileSync(target, out + '\n');
  console.log(`  wrote ${target}  (${cubes.length} cube(s), ${out.split('\n').length} lines)`);
  console.log(`  the .js is left in place - delete it only after validating`);
} else {
  console.log(out);
}
