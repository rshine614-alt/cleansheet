/*
 * CleanSheet engine: CSV parsing, plain-English instruction reading, cleaning rules,
 * and the review model (every change, removal and flag carries a reason).
 * Pure JavaScript, no dependencies. Works in the browser and in Node.
 * The instruction reader is keyword/rule based. It is NOT a language model.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CleanSheet = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ CSV */

  function detectDelimiter(text) {
    const firstLine = text.split(/\r?\n/, 1)[0] || '';
    let best = ',';
    let bestCount = -1;
    for (const d of [',', ';', '\t']) {
      let inQ = false;
      let n = 0;
      for (const ch of firstLine) {
        if (ch === '"') inQ = !inQ;
        else if (ch === d && !inQ) n++;
      }
      if (n > bestCount) { best = d; bestCount = n; }
    }
    return best;
  }

  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const delimiter = detectDelimiter(text);
    const all = [];
    let row = [];
    let field = '';
    let inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
        } else field += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === delimiter) { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = ''; all.push(row); row = [];
      } else field += ch;
    }
    if (field !== '' || row.length) { row.push(field); all.push(row); }
    const lines = all.filter(r => r.some(c => c.trim() !== ''));
    if (!lines.length) return { headers: [], rows: [], delimiter };
    const width = Math.max(...lines.map(r => r.length));
    const headers = [];
    for (let i = 0; i < width; i++) {
      const h = (lines[0][i] || '').trim();
      headers.push(h || 'Column ' + (i + 1));
    }
    const rows = lines.slice(1).map(r => {
      const x = r.slice();
      while (x.length < width) x.push('');
      return x;
    });
    return { headers, rows, delimiter };
  }

  function csvEscape(v) {
    v = v == null ? '' : String(v);
    return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  function toCSV(headers, rows) {
    return [headers].concat(rows).map(r => r.map(csvEscape).join(',')).join('\r\n') + '\r\n';
  }

  /* -------------------------------------------------------- column roles */

  function norm(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

  function detectColumns(headers) {
    const roles = { email: [], phone: [], id: [], date: [], numeric: [], name: [] };
    headers.forEach((h, i) => {
      const n = norm(h);
      if (/e ?mail/.test(n)) roles.email.push(i);
      else if (/phone|mobile|\btel\b|\bcell\b/.test(n)) roles.phone.push(i);
      else if (/(^| )id( |$)|^ref( |$)|number$|^no$/.test(n)) roles.id.push(i);
      else if (/date|created|ordered|updated|timestamp/.test(n)) roles.date.push(i);
      else if (/amount|total|price|qty|quantity|cost|revenue|balance/.test(n)) roles.numeric.push(i);
      else if (/name|customer|client|contact/.test(n) && !/user|company|file/.test(n)) roles.name.push(i);
    });
    return roles;
  }

  /* --------------------------------------------------------------- dates */

  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

  function monthNum(word) {
    if (!/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*$/i.test(word)) return 0;
    return MONTHS[word.slice(0, 3).toLowerCase()] || 0;
  }
  function validYMD(y, m, d) {
    if (m < 1 || m > 12 || d < 1) return false;
    return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
  }
  function isoDate(y, m, d) {
    return String(y).padStart(4, '0') + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }
  function fullYear(y) { y = +y; return y < 100 ? (y <= 69 ? 2000 + y : 1900 + y) : y; }

  // order: 'MDY' | 'DMY' (known from other values in the column) | anything else (unknown)
  function parseDate(raw, order) {
    const s = String(raw == null ? '' : raw).trim();
    if (!s) return null;
    let m;
    if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[ T].*)?$/))) {
      const y = +m[1], mo = +m[2], d = +m[3];
      return validYMD(y, mo, d) ? { iso: isoDate(y, mo, d), ambiguous: false } : null;
    }
    if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2}|\d{4})(?:[ T].*)?$/))) {
      const a = +m[1], b = +m[2], y = fullYear(m[3]);
      let mo, d, ambiguous = false;
      if (a > 12 && b > 12) return null;
      if (a > 12) { d = a; mo = b; }
      else if (b > 12) { mo = a; d = b; }
      else if (a === b) { mo = a; d = b; }
      else {
        ambiguous = order !== 'MDY' && order !== 'DMY';
        if (order === 'DMY') { d = a; mo = b; } else { mo = a; d = b; }
      }
      return validYMD(y, mo, d) ? { iso: isoDate(y, mo, d), ambiguous } : null;
    }
    let y, mo, d;
    if ((m = s.match(/^([A-Za-z]{3,9})\.?[ \-]+(\d{1,2})(?:st|nd|rd|th)?,?[ \-]+(\d{4})$/))) {
      mo = monthNum(m[1]); d = +m[2]; y = +m[3];
    } else if ((m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[ \-]+([A-Za-z]{3,9})\.?,?[ \-]+(\d{4})$/))) {
      d = +m[1]; mo = monthNum(m[2]); y = +m[3];
    } else return null;
    return mo && validYMD(y, mo, d) ? { iso: isoDate(y, mo, d), ambiguous: false } : null;
  }

  function inferDateOrder(values) {
    let dmy = 0, mdy = 0;
    for (const v of values) {
      const m = String(v).trim().match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2}|\d{4})/);
      if (!m) continue;
      const a = +m[1], b = +m[2];
      if (a > 12 && b <= 12) dmy++;
      if (b > 12 && a <= 12) mdy++;
    }
    if (dmy && !mdy) return 'DMY';
    if (mdy && !dmy) return 'MDY';
    if (dmy && mdy) return 'mixed';
    return 'ambiguous';
  }

  /* -------------------------------------------------- instruction reader */

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PLACEHOLDER_RE = /^(n\/?a|na|null|none|nil|unknown|tbd|-+|\?+|\.+)$/i;
  const ENTITY_WORDS = ['customer', 'client', 'contact'];
  const NORM_VERB = /\b(format|formats|formatting|standardi[sz]e|normali[sz]e|fix|clean|consistent|unify|lowercase|capitali[sz]e|capitalization|proper|title case|tidy)\b/;

  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function mentionedColumns(clause, headers, roles) {
    const cols = new Set();
    headers.forEach((h, i) => {
      const n = norm(h);
      if (!n || ENTITY_WORDS.includes(n)) return;
      if (new RegExp('\\b' + escRe(n) + 's?\\b').test(clause)) cols.add(i);
    });
    if (/e-?mail/.test(clause)) roles.email.forEach(i => cols.add(i));
    if (/\b(phone|mobile|telephone)\b/.test(clause)) roles.phone.forEach(i => cols.add(i));
    if (/\bnames?\b/.test(clause)) roles.name.forEach(i => cols.add(i));
    if (/\bdates?\b/.test(clause)) roles.date.forEach(i => cols.add(i));
    return [...cols].sort((a, b) => a - b);
  }

  function pickDateColumn(headers, roles) {
    if (!roles.date.length) return null;
    const pref = roles.date.find(i => /order|purchase|created|updated|last|latest/.test(norm(headers[i])));
    return pref != null ? pref : roles.date[0];
  }

  function listNames(headers, cols) { return cols.map(c => headers[c]).join(' + '); }

  function interpret(instruction, headers) {
    const text = String(instruction || '').toLowerCase();
    const roles = detectColumns(headers);
    const notes = [];
    const clauses = text.split(/[,.;]\s*|\s+and\s+(?=(?:flag|find|remove|fix|check|keep|show|mark|highlight|delete|merge|standardi[sz]e|clean|trim)\b)/).filter(Boolean);
    const generic = !text.trim() || /\b(clean|tidy|standardi[sz]e|normali[sz]e|everything|polish|messy)\b/.test(text);

    const dupClauses = clauses.filter(c => /\b(dup|duplicate|duplicates|same|repeat|repeated|twice|unique|double)\w*/.test(c));
    const missClauses = clauses.filter(c => /\b(missing|blank|empty|incomplete|lacking|without)\b/.test(c));
    const wantsDedupe = dupClauses.length > 0;
    const wantsMissing = missClauses.length > 0;
    const keep = /\b(newest|latest|most recent|most recently)\b/.test(text) ? 'newest'
      : /\b(oldest|earliest)\b|keep the first\b/.test(text) ? 'oldest' : 'first';

    const steps = [];
    const add = s => steps.push(Object.assign({ enabled: false, params: {} }, s));

    add({
      id: 'trim', group: 'safe', enabled: true,
      title: 'Trim extra spaces',
      why: 'Removes leading, trailing and doubled spaces in every cell. Always safe, and it makes duplicates easier to match.'
    });

    // Normalisation steps: on when asked for or when the request is a general "clean".
    const norms = [
      { id: 'names', topic: /\bnames?\b/, has: roles.name.length, title: 'Fix name capitalization',
        why: 'Only changes names written entirely in capitals or entirely in lowercase ("BOB SMITH" becomes "Bob Smith"). Mixed-case names such as "McDonald" are left alone.' },
      { id: 'email', topic: /e-?mail/, has: roles.email.length, title: 'Lowercase emails and flag invalid ones',
        why: 'Lowercases email addresses and flags any that do not look like name@domain.com. Invalid addresses are flagged, never guessed or repaired.' },
      { id: 'phone', topic: /\b(phone|mobile|telephone)\b/, has: roles.phone.length, title: 'Standardize phone numbers',
        why: 'Rewrites 10-digit numbers as 555-123-4567 (a leading 1 is dropped). Numbers with an unusual length are flagged instead of changed.' },
      { id: 'dates', topic: /\bdates?\b/, has: roles.date.length, title: 'Standardize dates to YYYY-MM-DD',
        why: 'Converts mixed date formats to one format. If a column could be day/month or month/day, other values in that column decide; if nothing decides, the date is flagged as ambiguous.' },
      { id: 'numbers', topic: /\b(amounts?|prices?|totals?|qty|quantit\w+|suspicious|outliers?)\b/, has: roles.numeric.length, title: 'Check amounts and quantities',
        why: 'Removes currency symbols and thousands separators, and flags values that are not numbers, are negative, or are more than 10 times the column median.' }
    ];
    norms.forEach(n => {
      if (!n.has) return;
      const asked = clauses.some(c => n.topic.test(c) && NORM_VERB.test(c) && !missClauses.includes(c) && !dupClauses.includes(c));
      const numbersAsked = n.id === 'numbers' && clauses.some(c => n.topic.test(c));
      add({
        id: n.id,
        group: asked || numbersAsked ? 'requested' : generic ? 'general' : 'extra',
        enabled: asked || numbersAsked || generic,
        title: n.title, why: n.why
      });
    });

    // Duplicates
    {
      let keyCols = mentionedColumns(dupClauses.join(' '), headers, roles).filter(i => !roles.date.includes(i) || /date/.test(dupClauses.join(' ')));
      let basis;
      if (keyCols.length) basis = 'you named';
      else if (roles.email.length) { keyCols = roles.email.slice(0, 1); basis = 'email is the most reliable customer identifier'; }
      else if (roles.name.length && roles.phone.length) { keyCols = [roles.name[0], roles.phone[0]]; basis = 'no email column, so name + phone'; }
      else if (roles.name.length) { keyCols = [roles.name[0]]; basis = 'no email column, so name'; }
      else { keyCols = headers.map((_, i) => i); basis = 'no obvious identifier, so whole rows'; }
      let dateCol = pickDateColumn(headers, roles);
      let effKeep = keep;
      if (keep !== 'first' && dateCol == null) {
        notes.push('No date column was found, so "' + keep + '" falls back to the ' + (keep === 'newest' ? 'last' : 'first') + ' row in the file.');
        effKeep = keep === 'newest' ? 'last' : 'first';
      }
      const requested = wantsDedupe || (generic && !text.trim() === false);
      add({
        id: 'dedupe',
        group: wantsDedupe ? 'requested' : generic ? 'general' : 'extra',
        enabled: wantsDedupe || generic,
        title: 'Remove duplicate rows',
        why: '',
        params: { keyCols, keep: effKeep, dateCol, basis },
        _requested: requested
      });
    }

    // Missing values
    {
      let cols = mentionedColumns(missClauses.join(' '), headers, roles);
      let scope = '';
      if (!cols.length) {
        const important = roles.email.concat(roles.name, roles.phone);
        cols = important.length ? important.slice().sort((a, b) => a - b) : headers.map((_, i) => i);
        scope = important.length ? ' (no column named, so the key contact columns)' : ' (all columns)';
      }
      add({
        id: 'missing',
        group: wantsMissing ? 'requested' : generic ? 'general' : 'extra',
        enabled: wantsMissing || generic,
        title: 'Flag missing values',
        why: '',
        params: { cols, scope }
      });
    }

    steps.forEach(s => { if (s.id === 'dedupe' || s.id === 'missing') s.why = describe(s, headers); });
    const order = { requested: 0, general: 1, safe: 2, extra: 3 };
    steps.sort((a, b) => order[a.group] - order[b.group]);
    return { instruction: String(instruction || ''), steps, notes };
  }

  function describe(step, headers) {
    const p = step.params;
    if (step.id === 'dedupe') {
      const keepText = { newest: 'the newest row (by ' + (p.dateCol != null ? headers[p.dateCol] : 'date') + ')', oldest: 'the oldest row (by ' + (p.dateCol != null ? headers[p.dateCol] : 'date') + ')', first: 'the first row in the file', last: 'the last row in the file' }[p.keep];
      return 'Rows with the same ' + listNames(headers, p.keyCols) + ' (' + p.basis + '; capitalization and spacing ignored) are duplicates. Keeps ' + keepText + ' and removes the rest. Each removal can be restored.';
    }
    return 'Flags empty cells and placeholders such as N/A in: ' + listNames(headers, p.cols) + p.scope + '. Missing values are flagged, never invented.';
  }

  /* ------------------------------------------------------------ run plan */

  function titleCase(s) {
    return s.toLowerCase().replace(/(^|[\s\-'’])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  }
  function keyNorm(v, digitsOnly) {
    const s = String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, ' ');
    return digitsOnly ? s.replace(/\D/g, '') : s;
  }
  function median(nums) {
    const a = nums.slice().sort((x, y) => x - y);
    const h = a.length >> 1;
    return a.length % 2 ? a[h] : (a[h - 1] + a[h]) / 2;
  }

  function run(headers, rows, plan) {
    const work = rows.map(r => r.slice());
    const roles = detectColumns(headers);
    const cellChanges = new Map();
    const flags = [];
    const stepOn = id => plan.steps.find(s => s.id === id && s.enabled);

    function setCell(r, c, val, rule, reason) {
      if (work[r][c] === val) return;
      const key = r + ':' + c;
      let ch = cellChanges.get(key);
      if (!ch) {
        ch = { id: 'c' + r + '_' + c, row: r, col: c, header: headers[c], before: rows[r][c], after: val, rules: [], reasons: [] };
        cellChanges.set(key, ch);
      }
      ch.after = val; ch.rules.push(rule); ch.reasons.push(reason);
      work[r][c] = val;
      if (ch.after === ch.before) cellChanges.delete(key);
    }
    function flag(r, c, issue, rule) { flags.push({ id: 'f' + flags.length, row: r, col: c, header: headers[c], issue, rule }); }

    if (stepOn('trim')) {
      work.forEach((row, r) => row.forEach((v, c) => {
        const t = v.replace(/\s+/g, ' ').trim();
        if (t !== v) setCell(r, c, t, 'Trim extra spaces', 'Removed extra spaces');
      }));
    }

    if (stepOn('names')) {
      roles.name.forEach(c => work.forEach((row, r) => {
        const v = row[c];
        if (!v || v.includes('@') || !/[a-z]/i.test(v)) return;
        if (v === v.toUpperCase() || v === v.toLowerCase()) setCell(r, c, titleCase(v), 'Fix name capitalization', 'Name was all ' + (v === v.toUpperCase() ? 'capitals' : 'lowercase'));
      }));
    }

    if (stepOn('email')) {
      roles.email.forEach(c => work.forEach((row, r) => {
        const v = row[c];
        if (!v) return;
        setCell(r, c, v.toLowerCase(), 'Lowercase emails', 'Email addresses are not case-sensitive in practice; lowercased for consistency');
        if (!EMAIL_RE.test(work[r][c]) && !PLACEHOLDER_RE.test(work[r][c])) flag(r, c, 'Invalid email format: "' + work[r][c] + '"', 'Lowercase emails and flag invalid ones');
      }));
    }

    if (stepOn('phone')) {
      roles.phone.forEach(c => work.forEach((row, r) => {
        const v = row[c];
        if (!v || PLACEHOLDER_RE.test(v)) return;
        let digits = v.replace(/\D/g, '');
        if (digits.length === 11 && digits[0] === '1') digits = digits.slice(1);
        if (digits.length === 10 && !/[a-z]/i.test(v)) {
          setCell(r, c, digits.slice(0, 3) + '-' + digits.slice(3, 6) + '-' + digits.slice(6), 'Standardize phone numbers', 'Rewrote as 3-3-4 digits');
        } else flag(r, c, 'Unusual phone number length (' + digits.length + ' digits)', 'Standardize phone numbers');
      }));
    }

    if (stepOn('dates')) {
      roles.date.forEach(c => {
        const order = inferDateOrder(work.map(r => r[c]));
        const why = order === 'DMY' ? 'This column uses day/month/year (some values have a day above 12)'
          : order === 'MDY' ? 'This column uses month/day/year (some values have a day above 12)' : 'Converted to YYYY-MM-DD';
        work.forEach((row, r) => {
          const v = row[c];
          if (!v) return;
          const p = parseDate(v, order);
          if (!p) { flag(r, c, 'Unrecognized date: "' + v + '"', 'Standardize dates to YYYY-MM-DD'); return; }
          setCell(r, c, p.iso, 'Standardize dates', why);
          if (p.ambiguous) flag(r, c, 'Ambiguous date "' + v + '": could be month/day or day/month. Assumed month/day. Please confirm.', 'Standardize dates to YYYY-MM-DD');
        });
      });
    }

    if (stepOn('numbers')) {
      roles.numeric.forEach(c => {
        const nums = [];
        work.forEach((row, r) => {
          const v = row[c];
          if (!v) return;
          const cleaned = v.replace(/[$€£,\s]/g, '');
          if (!/^-?\d+(\.\d+)?$/.test(cleaned)) { if (!PLACEHOLDER_RE.test(v)) flag(r, c, 'Not a number: "' + v + '"', 'Check amounts and quantities'); return; }
          if (cleaned !== v) setCell(r, c, cleaned, 'Check amounts and quantities', 'Removed currency symbol or thousands separator');
          const n = parseFloat(cleaned);
          nums.push([r, n]);
          if (n < 0) flag(r, c, 'Negative value: ' + cleaned, 'Check amounts and quantities');
        });
        if (nums.length >= 5) {
          const med = median(nums.map(x => x[1]));
          if (med > 0) nums.forEach(([r, n]) => { if (n > med * 10) flag(r, c, 'Unusually large: ' + n + ' is ' + Math.round(n / med) + 'x the column median (' + med + ')', 'Check amounts and quantities'); });
        }
      });
    }

    // Duplicates
    const removals = [];
    const removedSet = new Set();
    const dd = stepOn('dedupe');
    if (dd) {
      const { keyCols, keep, dateCol } = dd.params;
      const dateOrder = dateCol != null ? inferDateOrder(work.map(r => r[dateCol])) : 'ambiguous';
      const dateOf = i => { const p = dateCol != null ? parseDate(work[i][dateCol], dateOrder) : null; return p ? p.iso : ''; };
      const groups = new Map();
      work.forEach((row, i) => {
        const parts = keyCols.map(c => keyNorm(row[c], roles.phone.includes(c)));
        if (parts.some(p => p === '' || PLACEHOLDER_RE.test(p))) return;
        const k = parts.join('\u0001');
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(i);
      });
      const label = listNames(headers, keyCols);
      for (const idxs of groups.values()) {
        if (idxs.length < 2) continue;
        let keeper = idxs[0];
        if (keep === 'last') keeper = idxs[idxs.length - 1];
        else if (keep === 'newest') keeper = idxs.reduce((a, b) => (dateOf(b) >= dateOf(a) ? b : a));
        else if (keep === 'oldest') {
          const key = i => dateOf(i) || '9999-99-99';
          keeper = idxs.reduce((a, b) => (key(b) < key(a) ? b : a));
        }
        for (const i of idxs) {
          if (i === keeper) continue;
          const differs = headers.filter((h, c) => !keyCols.includes(c) && keyNorm(work[i][c], roles.phone.includes(c)) !== keyNorm(work[keeper][c], roles.phone.includes(c)));
          let reason = 'Duplicate of row ' + (keeper + 2) + ' (same ' + label + ').';
          if (keep === 'newest' || keep === 'oldest') {
            reason += ' Kept row ' + (keeper + 2) + ' because it is the ' + keep + ' (' + (dateOf(keeper) || 'no date') + ' vs ' + (dateOf(i) || 'no date') + ').';
          } else reason += ' Kept the ' + (keep === 'last' ? 'last' : 'first') + ' occurrence.';
          removals.push({ id: 'r' + i, row: i, keptRow: keeper, reason, differs });
          removedSet.add(i);
        }
      }
      removals.sort((a, b) => a.row - b.row);
    }

    // Missing values
    const ms = stepOn('missing');
    if (ms) {
      ms.params.cols.forEach(c => work.forEach((row, r) => {
        const v = row[c].trim();
        if (v === '') flag(r, c, 'Missing ' + headers[c], 'Flag missing values');
        else if (PLACEHOLDER_RE.test(v)) flag(r, c, 'Placeholder "' + v + '" in ' + headers[c] + ' (treated as missing)', 'Flag missing values');
      }));
    }

    flags.sort((a, b) => a.row - b.row || a.col - b.col);
    flags.forEach((f, i) => { f.id = 'f' + i; });
    return { changes: [...cellChanges.values()].sort((a, b) => a.row - b.row || a.col - b.col), removals, flags, work };
  }

  /* ------------------------------------------------- decisions -> output */

  function finalize(headers, rows, result, decisions) {
    const d = decisions || {};
    const rejectedChanges = new Set(d.rejectedChanges || []);
    const rejectedRemovals = new Set(d.rejectedRemovals || []);
    const dismissedFlags = new Set(d.dismissedFlags || []);
    const edits = d.edits || {};

    const out = rows.map(r => r.slice());
    result.changes.forEach(ch => { if (!rejectedChanges.has(ch.id)) out[ch.row][ch.col] = ch.after; });
    Object.keys(edits).forEach(k => { const [r, c] = k.split(':').map(Number); out[r][c] = edits[k]; });

    const removedNow = new Set(result.removals.filter(x => !rejectedRemovals.has(x.id)).map(x => x.row));
    const keptIdx = [];
    const outRows = [];
    out.forEach((r, i) => { if (!removedNow.has(i)) { keptIdx.push(i); outRows.push(r); } });

    const flagState = f => {
      if (removedNow.has(f.row)) return 'Row removed';
      if (edits[f.row + ':' + f.col] !== undefined) return 'Fixed by you';
      if (dismissedFlags.has(f.id)) return 'Dismissed by you';
      return 'Needs review';
    };
    const unresolved = result.flags.filter(f => flagState(f) === 'Needs review');

    const report = [];
    result.changes.forEach(ch => report.push([
      'Changed', ch.row + 2, ch.header, ch.before, ch.after, ch.rules.join(' + '), ch.reasons.join('; '),
      rejectedChanges.has(ch.id) ? 'Undone by you' : 'Applied']));
    result.removals.forEach(x => report.push([
      'Removed', x.row + 2, '(whole row)', '', '', 'Remove duplicate rows',
      x.reason + (x.differs.length ? ' Values differed in: ' + x.differs.join(', ') + '.' : ''),
      rejectedRemovals.has(x.id) ? 'Restored by you' : 'Removed']));
    result.flags.forEach(f => report.push(['Flagged', f.row + 2, f.header, '', '', f.rule, f.issue, flagState(f)]));
    Object.keys(edits).forEach(k => {
      const [r, c] = k.split(':').map(Number);
      report.push(['Edited by you', r + 2, headers[c], result.work[r][c], edits[k], 'Manual edit', 'You typed this value during review', 'Applied']);
    });
    const typeOrder = { Changed: 0, Removed: 1, Flagged: 2, 'Edited by you': 3 };
    report.sort((a, b) => typeOrder[a[0]] - typeOrder[b[0]] || a[1] - b[1]);

    return { headers, rows: outRows, keptIdx, removedNow, unresolved, flagState, report };
  }

  const REPORT_HEADERS = ['Type', 'Spreadsheet row', 'Column', 'Before', 'After', 'Rule', 'Why', 'Status'];

  return { parseCSV, toCSV, detectColumns, parseDate, inferDateOrder, interpret, run, finalize, REPORT_HEADERS, EMAIL_RE };
});
