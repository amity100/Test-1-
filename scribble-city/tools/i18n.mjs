// (ROADMAP 24) The game in English first (core/lang.js): every word the player reads written tr('עברית', 'English') where it
// is used. This finds the Hebrew in the game's code that is not yet so - string and template literals with Hebrew in them,
// read by a parser (acorn), comments not counted - and puts the translations in.
//   node tools/i18n.mjs scan [files...]          what is left, file by file (a literal per line, its kind)
//   node tools/i18n.mjs extract <out.json>       every untranslated text, once each: { "עברית": "" } - to be filled in
//   node tools/i18n.mjs apply <in.json> [--dry]  each untranslated display literal wrapped tr('עברית', 'English'), its file
//                                                given the import of tr; a literal used as a key (an object's key, compared,
//                                                looked for) left as it is and listed
// A literal's kinds: 'tr' (the Hebrew of a tr() already), 'pair' (in an object with an en / en* field, or a he: field beside
// en:), 'key' (an object's key, compared ===, in a case, looked for with includes / indexOf / startsWith / split / RegExp),
// 'text' (anything else: what is shown). Only 'text' is wrapped.
// The parser: acorn, from the machine's tools (ACORN=<path to acorn.mjs> to say where else).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ACORN = process.env.ACORN || '/opt/node-tools/node_modules/acorn/dist/acorn.mjs';
const WALK = process.env.ACORN_WALK || '/opt/node-tools/node_modules/acorn-walk/dist/walk.mjs';
const acorn = await import(ACORN);
const walk = await import(WALK);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../v5/js');
const LANG = path.join(ROOT, 'core/lang.js');
const HEB = /[֐-׿]/;
// (the developer's own screens: not the game a player plays - left in Hebrew)
const SKIP = new Set(['core/lang.js', 'game/perf.js', 'game/facelab.js', 'ui/admin.js',
  // (with their own tables of both languages: the story's cards, its objectives and thoughts, its lines, the start screen's words)
  'game/prologue/howto.js', 'game/prologue/i18n.js', 'game/prologue/lines.js', 'ui/startlang.js']);

function files(args) {
  if (args.length) return args.map((f) => path.resolve(f));
  const out = [];
  const go = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'vendor') go(p);
      } else if (e.name.endsWith('.js') && !SKIP.has(path.relative(ROOT, p).split(path.sep).join('/'))) out.push(p);
    }
  };
  go(ROOT);
  return out.sort();
}

// a template literal's text with its ${...} as {0}, {1}...
function tplText(node, src) {
  let s = '';
  node.quasis.forEach((q, i) => {
    s += q.value.cooked;
    if (i < node.expressions.length) s += `{${i}}`;
  });
  return s;
}

const isEnKey = (k) => k && (k === 'en' || /^en[A-Z_]/.test(k) || /_en$/.test(k) || /En$/.test(k));
const keyName = (p) => (p.key && (p.key.type === 'Identifier' ? p.key.name : p.key.type === 'Literal' ? String(p.key.value) : null)) || null;

export function scanFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  if (!HEB.test(src)) return { file, src, items: [] };
  let ast;
  try {
    ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true, allowHashBang: true });
  } catch (e) {
    return { file, src, items: [], error: String(e.message) };
  }
  const items = [];
  walk.fullAncestor(ast, (node, state, anc) => {
    let text = null;
    if (node.type === 'Literal' && typeof node.value === 'string' && HEB.test(node.value)) text = node.value;
    else if (node.type === 'TemplateLiteral' && node.quasis.some((q) => HEB.test(q.value.cooked || ''))) text = tplText(node, src);
    if (text === null) return;
    const parent = anc[anc.length - 2];
    const gp = anc[anc.length - 3];
    // (a tagged template's quasi, a template inside a template: the outer one is what counts)
    if (parent && parent.type === 'TaggedTemplateExpression') return;
    let kind = 'text';
    let en = null;
    const inTr = (p, g) => p && p.type === 'CallExpression' && p.callee.type === 'Identifier' && p.callee.name === 'tr';
    // (up through the expression it is part of - a sum, an object, a choice - to the call or the choice it is in)
    const latinish = (n) => n && ((n.type === 'Literal' && typeof n.value === 'string') || n.type === 'TemplateLiteral') && !HEB.test(src.slice(n.start, n.end)) && /[A-Za-z]/.test(src.slice(n.start, n.end)) && /[\s!?.<,:A-Z-]/.test(src.slice(n.start + 1, n.end - 1));
    let up = null;
    let child = node;
    for (let k = anc.length - 2; k >= 0; k--) {
      const a = anc[k];
      if (a.type === 'CallExpression' || a.type === 'NewExpression') {
        if (a.callee.type === 'Identifier' && a.callee.name === 'tr' && a.arguments[0] === child) up = 'tr';
        else {
          // (a helper that takes the two: meh('עברית', 'English'))
          const i = a.arguments.indexOf(child);
          if (i >= 0 && latinish(a.arguments[i + 1])) up = 'pair';
        }
        break;
      }
      if (a.type === 'ConditionalExpression' && child !== a.test && /lang\(\)|'en'|"en"|\bhe\b|\ben\b/.test(src.slice(a.test.start, a.test.end))) {
        up = 'cond';
        break;
      }
      if (/Statement|Declaration|Function|Program|SwitchCase/.test(a.type) && a.type !== 'VariableDeclarator') break;
      child = a;
    }
    if (up === 'tr' && !inTr(parent)) kind = 'tr';
    else if (up === 'cond' || up === 'pair') kind = up;
    else if (inTr(parent)) kind = 'tr';
    else if (parent && parent.type === 'Property' && parent.key === node) kind = 'key';
    else if (parent && parent.type === 'Property' && parent.value === node) {
      const k = keyName(parent);
      const obj = gp;
      const keys = obj && obj.type === 'ObjectExpression' ? obj.properties.map(keyName) : [];
      // (its English beside it: en for he, kEn / k_en for k, or an en of the object's own)
      const props = obj && obj.type === 'ObjectExpression' ? obj.properties : [];
      const find = (n) => props.find((q) => keyName(q) === n && q.value && q.value.type === 'Literal' && typeof q.value.value === 'string');
      const sib = k === 'he' || k === 'heb' ? find('en') : find(k + 'En') || find(k + '_en') || (k === 'name' || k === 'label' || k === 'text' || k === 'title' ? find('en') : null);
      if (sib) {
        kind = 'pair';
        en = sib.value.value;
        // (a name written in capitals for a title: its words' first letters only)
        if (en.length > 3 && en === en.toUpperCase() && /[A-Z]/.test(en)) en = en.toLowerCase().replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
      } else if (k === 'he' || k === 'heb' || /^he[A-Z_]/.test(k || '')) kind = 'pair';
    }
    // (in a choice by the language - lang() === 'en' ? 'English' : 'עברית' - or a thought, put in English where it is shown)
    else if (parent && parent.type === 'ConditionalExpression' && /lang\(\)|'en'|"en"|\ben\b/.test(src.slice(parent.test.start, parent.test.end))) kind = 'cond';
    else if (parent && parent.type === 'CallExpression' && parent.callee.type === 'MemberExpression' && parent.callee.property && parent.callee.property.name === 'thought') kind = 'cond'; else if (parent && parent.type === 'BinaryExpression' && /^(===|!==|==|!=)$/.test(parent.operator)) kind = 'key';
    else if (parent && parent.type === 'SwitchCase' && parent.test === node) kind = 'key';
    else if (parent && parent.type === 'CallExpression' && parent.callee.type === 'MemberExpression' && parent.arguments.includes(node)) {
      const m = parent.callee.property && parent.callee.property.name;
      if (/^(includes|indexOf|lastIndexOf|startsWith|endsWith|split|replace|replaceAll|match|search|has|get|set|delete)$/.test(m || '')) kind = 'key';
    } else if (parent && parent.type === 'NewExpression' && parent.callee.name === 'RegExp') kind = 'key';
    else if (parent && parent.type === 'MemberExpression' && parent.property === node && parent.computed) kind = 'key';
    // (a he/en pair written as an array: ['עברית', 'English'] - the Hebrew first, a Latin-only string beside it)
    else if (parent && parent.type === 'ArrayExpression' && parent.elements.length === 2 && parent.elements[0] === node) {
      const o = parent.elements[1];
      // (not a tag beside it - a gender, m / f / p, a kind: a translation has a space, a capital, or is a word of three letters or more)
      if (o && o.type === 'Literal' && typeof o.value === 'string' && !HEB.test(o.value) && /[A-Za-z]{3,}|[A-Z ]/.test(o.value)) kind = 'pair';
    }
    items.push({ kind, text, en, start: node.start, end: node.end, line: node.loc.start.line, node, tpl: node.type === 'TemplateLiteral' });
  });
  // (a template literal inside another one's ${}: only the outer is rewritten)
  items.sort((a, b) => a.start - b.start);
  const out = [];
  for (const it of items) {
    const o = out.find((x) => x.start <= it.start && x.end >= it.end && x !== it);
    if (o) {
      it.inner = true;
      continue;
    }
    out.push(it);
  }
  return { file, src, items: out, all: items };
}

function rel(f) {
  return path.relative(ROOT, f).split(path.sep).join('/');
}

const cmd = process.argv[1] && process.argv[1].endsWith('i18n.mjs') ? process.argv[2] : null;
const rest = process.argv.slice(3);
if (cmd === 'scan') {
  let n = 0;
  const byKind = {};
  const per = [];
  for (const f of files(rest.filter((a) => !a.startsWith('--')))) {
    const r = scanFile(f);
    if (r.error) console.log(`!! ${rel(f)}: ${r.error}`);
    const left = r.items.filter((i) => i.kind === 'text' || i.kind === 'key');
    for (const i of r.items) byKind[i.kind] = (byKind[i.kind] || 0) + 1;
    if (!left.length) continue;
    per.push([left.filter((i) => i.kind === 'text').length, left.filter((i) => i.kind === 'key').length, rel(f)]);
    if (rest.includes('--list')) for (const i of left) console.log(`${rel(f)}:${i.line} [${i.kind}] ${i.text.slice(0, 110).replace(/\n/g, '\\n')}`);
    n += left.length;
  }
  per.sort((a, b) => b[0] - a[0]);
  if (!rest.includes('--list')) for (const p of per) console.log(`${String(p[0]).padStart(4)} text ${String(p[1]).padStart(3)} key  ${p[2]}`);
  console.log(`\n${n} left;  by kind:`, JSON.stringify(byKind));
} else if (cmd === 'extract') {
  const out = rest[0];
  const old = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};
  const T = {};
  for (const f of files([])) {
    for (const i of scanFile(f).items) if (i.kind === 'text') T[i.text] = old[i.text] || '';
  }
  fs.writeFileSync(out, JSON.stringify(T, null, 1));
  console.log(`${Object.keys(T).length} texts, ${Object.values(T).filter((v) => !v).length} not yet translated -> ${out}`);
} else if (cmd === 'apply') {
  const T = JSON.parse(fs.readFileSync(rest[0], 'utf8'));
  const dry = rest.includes('--dry');
  let done = 0;
  let miss = 0;
  let filesN = 0;
  for (const f of files(rest.slice(1).filter((a) => !a.startsWith('--')))) {
    const r = scanFile(f);
    const keys = rest.includes('--keys');
    for (const i of r.items) if (i.kind === 'pair' && i.en && !T[i.text]) T[i.text] = i.en;
    const todo = r.items.filter((i) => (i.kind === 'text' || (i.kind === 'pair' && i.en) || (keys && i.kind === 'key' && !i.node.type.startsWith('Prop'))) && T[i.text]);
    miss += r.items.filter((i) => i.kind === 'text' && !T[i.text]).length;
    if (!todo.length) continue;
    let s = r.src;
    for (const it of todo.sort((a, b) => b.start - a.start)) {
      const orig = r.src.slice(it.start, it.end);
      let en;
      if (it.tpl) {
        // ({0}, {1}... back to the template's own expressions)
        const ex = it.node.expressions.map((e) => r.src.slice(e.start, e.end));
        const body = T[it.text].replace(/[`\\]/g, (c) => '\\' + c).replace(/\$\{/g, '\\${').replace(/\{(\d+)\}/g, (m, k) => (ex[+k] !== undefined ? '${' + ex[+k] + '}' : m));
        en = '`' + body + '`';
      } else {
        const q = orig[0] === '"' ? '"' : "'";
        en = q + T[it.text].replace(/\\/g, '\\\\').replace(new RegExp(q, 'g'), '\\' + q).replace(/\n/g, '\\n') + q;
      }
      s = s.slice(0, it.start) + `tr(${orig}, ${en})` + s.slice(it.end);
      done++;
    }
    // (tr imported, if it is not)
    if (!/import\s*\{[^}]*\btr\b[^}]*\}\s*from\s*['"][^'"]*core\/lang\.js['"]/.test(s) && !/\bconst tr\b|\bfunction tr\b/.test(s)) {
      let imp = path.relative(path.dirname(f), LANG).split(path.sep).join('/');
      if (!imp.startsWith('.')) imp = './' + imp;
      const m = /import\s*\{([^}]*)\}\s*from\s*(['"])([^'"]*core\/lang\.js)\2;?/.exec(s);
      if (m) s = s.replace(m[0], `import { ${m[1].trim()}, tr } from ${m[2]}${m[3]}${m[2]};`);
      else {
        // (after the last import at the top; or first)
        const ims = [...s.matchAll(/^import[^;]*;\s*$/gm)];
        const at = ims.length ? ims[ims.length - 1].index + ims[ims.length - 1][0].length : 0;
        s = s.slice(0, at) + (at ? '\n' : '') + `import { tr } from '${imp}';` + (at ? '' : '\n') + s.slice(at);
      }
    }
    try {
      acorn.parse(s, { ecmaVersion: 'latest', sourceType: 'module' });
    } catch (e) {
      console.log(`!! ${rel(f)}: would not parse after - ${e.message}; left as it was`);
      continue;
    }
    if (!dry) fs.writeFileSync(f, s);
    filesN++;
  }
  console.log(`${done} wrapped in ${filesN} files${dry ? ' (dry)' : ''}; ${miss} with no translation yet`);
} else {
  console.log('node tools/i18n.mjs scan [--list] [files] | extract <out.json> | apply <in.json> [files] [--dry]');
}
