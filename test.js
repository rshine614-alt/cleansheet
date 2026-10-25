const CS = require('./engine.js');
const fs = require('fs');
const assert = require('assert');
const { headers, rows } = CS.parseCSV(fs.readFileSync('sample-orders.csv', 'utf8'));
assert.strictEqual(headers.length, 6); assert.strictEqual(rows.length, 11);

const plan = CS.interpret('Remove duplicate customers, keep the newest order, and flag missing email addresses.', headers);
console.log(plan.steps.map(s => `${s.enabled ? 'ON ' : 'off'} [${s.group}] ${s.id}: ${s.title}\n      ${s.why}`).join('\n'));
const on = id => plan.steps.find(s => s.id === id).enabled;
assert(on('dedupe') && on('missing') && on('trim'));
assert(!on('dates') && !on('phone'));
assert.deepStrictEqual(plan.steps.find(s=>s.id==='dedupe').params.keyCols, [1]);
assert.strictEqual(plan.steps.find(s=>s.id==='dedupe').params.keep, 'newest');

// Full clean plan: turn everything on
const full = CS.interpret('Clean everything', headers);
const res = CS.run(headers, rows, full);
console.log('\nchanges', res.changes.length, 'removals', res.removals.length, 'flags', res.flags.length);
res.removals.forEach(r => console.log('REMOVE', r.row + 2, r.reason));
res.flags.forEach(f => console.log('FLAG', f.row + 2, f.header, '-', f.issue));
res.changes.slice(0, 40).forEach(c => console.log('CHG', c.row + 2, c.header, JSON.stringify(c.before), '->', JSON.stringify(c.after)));

// demo instruction only
const r1 = CS.run(headers, rows, plan);
const fin = CS.finalize(headers, rows, r1, {});
console.log('\nDEMO: rows out', fin.rows.length, 'removed', [...fin.removedNow].map(i => i + 2), 'unresolved', fin.unresolved.map(f => f.row + 2 + ':' + f.issue));
// Sarah: row 2 (03/14) vs row 4 (April 2) -> newest is row 4. Mike: row 3 (2026-02-01) vs row 7 (03/09) -> row 7 kept
assert.deepStrictEqual([...fin.removedNow].map(i => i + 2).sort((a,b)=>a-b), [2, 3]);

// Undo a removal restores row
const fin2 = CS.finalize(headers, rows, r1, { rejectedRemovals: [r1.removals[0].id] });
assert.strictEqual(fin2.rows.length, fin.rows.length + 1);
// Round trip CSV
const csv = CS.toCSV(fin.headers, fin.rows);
const back = CS.parseCSV(csv);
assert.strictEqual(back.rows.length, fin.rows.length);
console.log('\nALL ASSERTIONS PASSED');
