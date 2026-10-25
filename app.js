/* CleanSheet interface. All data stays in the browser; the cleaning logic lives in engine.js. */
(function () {
  'use strict';
  const CS = window.CleanSheet;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const state = {
    fileName: 'data.csv', headers: [], rows: [], plan: null, result: null, tab: 'changes',
    dec: null
  };
  function freshDecisions() {
    return { rejectedChanges: new Set(), rejectedRemovals: new Set(), dismissedFlags: new Set(), edits: {} };
  }

  /* ----------------------------------------------------------- loading */

  function showError(msg) { const e = $('loadErr'); e.textContent = msg; e.hidden = !msg; }

  function loadText(text, name) {
    showError('');
    let parsed;
    try { parsed = CS.parseCSV(text); } catch (e) { showError('That file could not be read as a CSV.'); return; }
    if (!parsed.headers.length || !parsed.rows.length) { showError('No data rows found. Is this a CSV with a header row?'); return; }
    state.fileName = name || 'data.csv';
    state.headers = parsed.headers;
    state.rows = parsed.rows;
    state.plan = null; state.result = null; state.dec = freshDecisions();
    $('s3').hidden = true; $('s4').hidden = true;
    $('s2').hidden = false;
    $('fileMeta').textContent = state.fileName + ' · ' + state.rows.length + ' rows · ' + state.headers.length + ' columns' +
      (state.rows.length > 8 ? ' · showing the first 8' : '');
    renderTable($('previewTable'), state.headers, state.rows.slice(0, 8).map((r, i) => ({ n: i + 2, cells: r })));
    $('s2').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function readFile(file) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { showError('That file is over 20 MB. Please try a smaller export.'); return; }
    const fr = new FileReader();
    fr.onload = () => loadText(String(fr.result), file.name);
    fr.onerror = () => showError('Could not read that file.');
    fr.readAsText(file);
  }

  const drop = $('drop'), fileInput = $('file');
  drop.addEventListener('click', () => fileInput.click());
  drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
  fileInput.addEventListener('change', () => { readFile(fileInput.files[0]); fileInput.value = ''; });
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => readFile(e.dataTransfer.files[0]));
  $('useSample').addEventListener('click', () => {
    loadText(window.SAMPLE_CSV, 'sample-orders.csv');
    $('instruction').value = $('chips').querySelector('.chip').textContent;
  });

  /* ------------------------------------------------------------ tables */

  function renderTable(el, headers, rowObjs, marks) {
    let h = '<thead><tr><th class="rn">Row</th>' + headers.map(x => '<th>' + esc(x) + '</th>').join('') + '</tr></thead><tbody>';
    rowObjs.forEach(ro => {
      h += '<tr><td class="rn">' + ro.n + '</td>';
      ro.cells.forEach((v, c) => {
        const cls = (marks && marks(ro, c)) || '';
        const isEmpty = String(v).trim() === '';
        h += '<td class="' + (cls + (isEmpty ? ' empty' : '')).trim() + '"' + (ro.titles && ro.titles[c] ? ' title="' + esc(ro.titles[c]) + '"' : '') + '>' + (isEmpty ? 'empty' : esc(v)) + '</td>';
      });
      h += '</tr>';
    });
    el.innerHTML = h + '</tbody>';
  }

  /* -------------------------------------------------------------- plan */

  document.querySelectorAll('#chips .chip').forEach(b => b.addEventListener('click', () => {
    $('instruction').value = b.textContent; $('instruction').focus();
  }));

  $('makePlan').addEventListener('click', () => {
    state.plan = CS.interpret($('instruction').value, state.headers);
    state.result = null; state.dec = freshDecisions();
    $('s4').hidden = true;
    renderPlan();
    $('s3').hidden = false;
    $('s3').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  const GROUP_LABEL = { requested: 'You asked', general: 'General clean', safe: 'Always safe', extra: 'Optional' };

  function renderPlan() {
    $('notes').innerHTML = state.plan.notes.length ? '<div class="notes">' + state.plan.notes.map(n => '<div class="note">' + esc(n) + '</div>').join('') + '</div>' : '';
    $('planList').innerHTML = state.plan.steps.map((s, i) =>
      '<label class="step' + (s.enabled ? ' on' : '') + '">' +
      '<input type="checkbox" data-i="' + i + '"' + (s.enabled ? ' checked' : '') + '>' +
      '<div><h3>' + esc(s.title) + ' <span class="badge ' + esc(s.group) + '">' + esc(GROUP_LABEL[s.group] || s.group) + '</span></h3>' +
      '<p>' + esc(s.why) + '</p></div></label>').join('');
    $('planList').querySelectorAll('input').forEach(cb => cb.addEventListener('change', () => {
      const s = state.plan.steps[+cb.dataset.i];
      s.enabled = cb.checked;
      cb.closest('.step').classList.toggle('on', cb.checked);
    }));
  }

  $('runPlan').addEventListener('click', () => {
    state.result = CS.run(state.headers, state.rows, state.plan);
    state.dec = freshDecisions();
    state.tab = state.result.flags.length ? 'flags' : state.result.changes.length ? 'changes' : 'result';
    $('s4').hidden = false;
    renderReview();
    $('s4').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ------------------------------------------------------------ review */

  function fin() { return CS.finalize(state.headers, state.rows, state.result, state.dec); }

  function toggle(set, id) { set.has(id) ? set.delete(id) : set.add(id); renderReview(); }

  function renderReview() {
    const f = fin(), r = state.result, d = state.dec;
    const applied = r.changes.length - d.rejectedChanges.size;
    const removed = f.removedNow.size;
    const open = f.unresolved.length;

    $('stats').innerHTML =
      '<div class="stat"><b>' + applied + '</b><span>cells cleaned</span></div>' +
      '<div class="stat"><b>' + removed + '</b><span>duplicate rows removed</span></div>' +
      '<div class="stat ' + (open ? 'warn' : 'good') + '"><b>' + open + '</b><span>' + (open ? 'items still need your eyes' : 'items need review. All clear.') + '</span></div>' +
      '<div class="stat"><b>' + f.rows.length + '</b><span>rows in the cleaned file (from ' + state.rows.length + ')</span></div>';

    $('cChanges').textContent = r.changes.length;
    $('cRemoved').textContent = r.removals.length;
    $('cFlags').textContent = open + '/' + r.flags.length;
    document.querySelectorAll('#tabs .tab').forEach(t => t.classList.toggle('on', t.dataset.tab === state.tab));

    const p = $('panel');
    if (state.tab === 'changes') p.innerHTML = changesPanel();
    else if (state.tab === 'removed') p.innerHTML = removedPanel();
    else if (state.tab === 'flags') p.innerHTML = flagsPanel(f);
    else p.innerHTML = resultPanel(f);
    wirePanel(f);

    const note = $('exportNote');
    if (open) {
      note.className = 'export-note warn';
      note.textContent = open + ' flagged item' + (open === 1 ? ' is' : 's are') + ' still unresolved. You can download now. They are listed as "Needs review" in the change report.';
    } else {
      note.className = 'export-note';
      note.textContent = 'Everything is reviewed. The change report records each change, removal and decision.';
    }
  }

  function changesPanel() {
    const r = state.result, d = state.dec;
    if (!r.changes.length) return '<div class="empty-msg">No cell changes were needed for the rules you turned on.</div>';
    return '<div class="list">' + r.changes.map(ch => {
      const undone = d.rejectedChanges.has(ch.id);
      return '<div class="item' + (undone ? ' undone' : '') + '"><div>' +
        '<div class="where">Row ' + (ch.row + 2) + ' · ' + esc(ch.header) + '</div>' +
        '<div class="what"><span class="from">' + esc(ch.before === '' ? 'empty' : ch.before) + '</span><span class="arrow">→</span><span class="to">' + esc(ch.after === '' ? 'empty' : ch.after) + '</span></div>' +
        '<div class="why">' + esc(ch.reasons.join('; ')) + (undone ? ' (undone)' : '') + '</div></div>' +
        '<button class="mini" data-act="chg" data-id="' + esc(ch.id) + '">' + (undone ? 'Redo' : 'Undo') + '</button></div>';
    }).join('') + '</div>';
  }

  function removedPanel() {
    const r = state.result, d = state.dec;
    if (!r.removals.length) return '<div class="empty-msg">No duplicate rows were found, or the duplicate step is off.</div>';
    return '<div class="list">' + r.removals.map(x => {
      const restored = d.rejectedRemovals.has(x.id);
      const row = state.rows[x.row];
      return '<div class="item' + (restored ? ' undone' : '') + '"><div>' +
        '<div class="where">Row ' + (x.row + 2) + (restored ? ' · restored' : ' · removed') + '</div>' +
        '<div class="what">' + esc(row.filter(v => v.trim()).join(' · ')) + '</div>' +
        '<div class="why">' + esc(x.reason) + (x.differs.length ? ' Values differed in: ' + esc(x.differs.join(', ')) + '.' : '') + '</div></div>' +
        '<button class="mini" data-act="rem" data-id="' + esc(x.id) + '">' + (restored ? 'Remove again' : 'Restore row') + '</button></div>';
    }).join('') + '</div>';
  }

  function flagsPanel(f) {
    const r = state.result, d = state.dec;
    if (!r.flags.length) return '<div class="empty-msg">Nothing was flagged. Your data passed every check you turned on.</div>';
    return '<div class="list">' + r.flags.map(fl => {
      const st = f.flagState(fl);
      const cur = d.edits[fl.row + ':' + fl.col] !== undefined ? d.edits[fl.row + ':' + fl.col] : (r.work[fl.row][fl.col]);
      const needs = st === 'Needs review';
      return '<div class="item flagged"><div>' +
        '<div class="where">Row ' + (fl.row + 2) + ' · ' + esc(fl.header) + '</div>' +
        '<div class="what">' + esc(fl.issue) + '</div>' +
        '<div class="why">Rule: ' + esc(fl.rule) + '</div>' +
        (st === 'Row removed' ? '' :
          '<div class="fixrow"><input type="text" value="' + esc(cur) + '" data-fix="' + esc(fl.id) + '" aria-label="Corrected value for row ' + (fl.row + 2) + ' ' + esc(fl.header) + '">' +
          '<button class="mini" data-act="fix" data-id="' + esc(fl.id) + '" data-r="' + fl.row + '" data-c="' + fl.col + '">Save fix</button>' +
          '<button class="mini" data-act="ok" data-id="' + esc(fl.id) + '">' + (d.dismissedFlags.has(fl.id) ? 'Un-dismiss' : 'Looks fine') + '</button></div>') +
        '</div><span class="state ' + (needs ? 'review' : 'done') + '">' + esc(st) + '</span></div>';
    }).join('') + '</div>';
  }

  function resultPanel(f) {
    const r = state.result, d = state.dec;
    const changed = new Set(r.changes.filter(c => !d.rejectedChanges.has(c.id)).map(c => c.row + ':' + c.col));
    const flagged = new Set(r.flags.filter(x => f.flagState(x) === 'Needs review').map(x => x.row + ':' + x.col));
    const edited = new Set(Object.keys(d.edits));
    const rows = f.rows.map((cells, k) => {
      const idx = f.keptIdx[k];
      const titles = cells.map((_, c) => {
        const ch = r.changes.find(x => x.row === idx && x.col === c && !d.rejectedChanges.has(x.id));
        return ch ? 'Was: ' + (ch.before === '' ? 'empty' : ch.before) : '';
      });
      return { n: idx + 2, idx, cells, titles };
    });
    const tmp = document.createElement('table');
    renderTable(tmp, f.headers, rows.slice(0, 300), (ro, c) => {
      const key = ro.idx + ':' + c;
      return flagged.has(key) ? 'flag' : edited.has(key) ? 'edited' : changed.has(key) ? 'chg' : '';
    });
    return '<div class="legend"><span><i style="background:var(--accent-soft)"></i>cleaned (hover to see the original)</span>' +
      '<span><i style="background:var(--amber-soft);box-shadow:inset 0 0 0 2px var(--amber)"></i>needs your eyes</span>' +
      '<span><i style="background:var(--blue-soft)"></i>fixed by you</span></div>' +
      '<div class="tablewrap">' + tmp.outerHTML + '</div>' +
      (rows.length > 300 ? '<p class="hint">Showing the first 300 rows. The download contains all of them.</p>' : '');
  }

  function wirePanel() {
    $('panel').querySelectorAll('button[data-act]').forEach(b => b.addEventListener('click', () => {
      const act = b.dataset.act, id = b.dataset.id, d = state.dec;
      if (act === 'chg') toggle(d.rejectedChanges, id);
      else if (act === 'rem') toggle(d.rejectedRemovals, id);
      else if (act === 'ok') toggle(d.dismissedFlags, id);
      else if (act === 'fix') {
        const input = $('panel').querySelector('input[data-fix="' + id + '"]');
        const key = b.dataset.r + ':' + b.dataset.c;
        const orig = state.result.work[+b.dataset.r][+b.dataset.c];
        if (input.value === orig) delete d.edits[key]; else d.edits[key] = input.value;
        renderReview();
      }
    }));
  }

  $('tabs').addEventListener('click', e => {
    const t = e.target.closest('.tab');
    if (!t) return;
    state.tab = t.dataset.tab;
    renderReview();
  });

  /* ---------------------------------------------------------- download */

  function baseName() { return state.fileName.replace(/\.[^.]+$/, '') || 'data'; }

  function download(name, text) {
    const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  $('dlClean').addEventListener('click', () => { const f = fin(); download(baseName() + '-clean.csv', CS.toCSV(f.headers, f.rows)); });
  $('dlReport').addEventListener('click', () => { const f = fin(); download(baseName() + '-change-report.csv', CS.toCSV(CS.REPORT_HEADERS, f.report)); });
  $('startOver').addEventListener('click', () => {
    state.headers = []; state.rows = []; state.plan = null; state.result = null; state.dec = freshDecisions();
    ['s2', 's3', 's4'].forEach(id => { $(id).hidden = true; });
    $('instruction').value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  window.__cleansheet = { state, fin };  // handy for the browser smoke test
})();
