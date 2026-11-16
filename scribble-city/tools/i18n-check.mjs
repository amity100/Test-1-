// (ROADMAP 24) Every i18n call tr(he, en) reaches the imported tr: the file imports it, and no local tr hides it there. After
// tools/i18n.mjs rewrote the game's Hebrew, six files had a local variable named tr and were left without the import - the
// page stopped with "tr is not defined". usage: node tools/i18n-check.mjs (from scribble-city; exits 1 on a problem)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'v5');
// (the parser as tools/i18n.mjs finds it: acorn from the machine's tools, or ACORN / ACORN_WALK)
const acorn = await import(process.env.ACORN || '/opt/node-tools/node_modules/acorn/dist/acorn.mjs');
const walk = await import(process.env.ACORN_WALK || '/opt/node-tools/node_modules/acorn-walk/dist/walk.mjs');
const files = [];
(function rec(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) rec(p); else if (p.endsWith('.js')) files.push(p); } })(path.join(ROOT, 'js'));
let bad = 0;
const isStr = (a) => a && ((a.type === 'Literal' && typeof a.value === 'string') || a.type === 'TemplateLiteral' || a.type === 'BinaryExpression' || a.type === 'ConditionalExpression' || a.type === 'CallExpression');
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  if (!/\btr\(/.test(src)) continue;
  let ast;
  try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true }); } catch (e) { console.log('PARSE', f, e.message); bad++; continue; }
  let imported = false;
  for (const n of ast.body) if (n.type === 'ImportDeclaration') for (const s of n.specifiers) if (s.local.name === 'tr') imported = true;
  const scopes = []; // local declarations of tr: [start, end] of their scope
  walk.fullAncestor(ast, (n, st, anc) => {
    const dec = (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.id.name === 'tr') || (n.type === 'FunctionDeclaration' && n.id && n.id.name === 'tr');
    const par = (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression') && n.params.some((p) => p.type === 'Identifier' && p.name === 'tr');
    if (par) scopes.push([n.start, n.end, n.loc.start.line]);
    if (dec) { for (let i = anc.length - 2; i >= 0; i--) { const a = anc[i]; if (['BlockStatement', 'Program', 'ForStatement', 'ForOfStatement', 'ForInStatement', 'SwitchCase'].includes(a.type)) { scopes.push([a.start, a.end, n.loc.start.line]); break; } } }
  });
  walk.fullAncestor(ast, (n) => {
    if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'tr' && n.arguments.length === 2 && isStr(n.arguments[0]) && isStr(n.arguments[1])) {
      const sh = scopes.find((s) => n.start >= s[0] && n.end <= s[1]);
      if (!imported) { console.log('NOT IMPORTED', f, n.loc.start.line); bad++; }
      else if (sh) { console.log('SHADOWED', f, n.loc.start.line, 'by the tr of line', sh[2]); bad++; }
    }
  });
}
console.log(files.length, 'files,', bad, 'problems');
if (bad) process.exit(1);
