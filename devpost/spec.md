---
doc: spec
status: draft
---

# CleanSheet — Technical Spec

> Authorship note: the learner delegated technical choices to the agent. Everything below is the agent's recommendation until the learner approves.

## How This Works, In Plain Language
Three small pieces, all running inside the web page:
- **The engine** (`engine.js`) reads a CSV, turns a sentence into a list of cleaning steps, applies the steps to a copy of the data, and produces a list of changes, removals and flags, each with a reason.
- **The screen** (`index.html`, `style.css`, `app.js`) shows those lists, lets the user undo or fix things, and builds the downloads.
- **The sample** (`sample.js`) is a small messy order export so the demo works when the page is opened straight from a folder.

Why this shape: no server means nothing to deploy, nothing private is uploaded, and it works offline.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.
1. User drops a file → `app.js` reads it → `CleanSheet.parseCSV` returns headers and rows → preview table.
2. User types a sentence → `CleanSheet.interpret(sentence, headers)` returns `{steps, notes}` → plan cards.
3. User presses Run → `CleanSheet.run(headers, rows, plan)` returns `{changes, removals, flags, work}`; the original rows are never modified.
4. User undoes, restores, edits, dismisses → stored in a decisions object → `CleanSheet.finalize(...)` recomputes output rows and the report.
5. User downloads → `toCSV` builds text → the browser saves a file.

## Stack
Plain HTML, CSS and JavaScript. No framework, no build step, no dependencies. Node.js is used only to run `test.js`. Chosen because the learner is a beginner with a free-tools-only budget and the app needs no server.

## Where It Runs and How Someone Tries It
Any modern browser. Start: open `index.html` by double-clicking it, or run `python3 -m http.server` in the folder and visit http://localhost:8000. Demo: press "Try the sample order export", press "Make a cleaning plan", "Run cleaning". Tests: `node test.js`.
Submission needs a demo video and a public GitHub repository. Deployment is optional (any static host works).

## Look and Feel
Carried from `prd.md > Look and Feel`: warm paper, dark green, serif headings, monospace values. Honored fully because the stack is plain CSS.

## Components

### Engine (`engine.js`)
CSV parsing (quotes, BOM, comma/semicolon/tab), column role detection from header names, date parsing with order inference, the instruction reader, the cleaning run, and the decision-aware output. PRD ref: `prd.md > Features and Behavior`.

### Interface (`index.html`, `style.css`, `app.js`)
Four cards, tabs, undo/restore/fix controls, downloads. PRD ref: `prd.md > Screens and Layout`.

## Data Model
In memory only: `headers`, `rows` (original), `plan`, `result`, and `decisions` (`rejectedChanges`, `rejectedRemovals`, `dismissedFlags`, `edits`). Leaving the page clears everything.

## File Structure
```
cleansheet/
├── index.html        # page shell
├── style.css         # look and feel
├── app.js            # interface behavior
├── engine.js         # cleaning logic (also runs in Node)
├── sample.js         # sample CSV embedded for the demo
├── sample-orders.csv # same sample as a file
├── test.js           # engine checks: node test.js
├── devpost/          # Devpost learning workspace
└── README.md, LICENSE
```

## External Services and Dependencies
None.

## Important Failure Modes
- **Ambiguous dates** → flagged "Please confirm", never silently decided.
- **Unreadable file** → red message, nothing else changes.
- **Instruction not understood** → a plan with only the safe step on; user switches others on by hand.

## What Was Simplified and Why
- **Keyword rules** instead of a language model — $0 budget and honesty; a model would cost money or need a key.
- **Dates as day/month vs month/day only** — other calendars are out of scope.
- **Result preview limited to 300 rows**; downloads include all rows.

## Decisions and Open Issues
- Agent decisions (delegated): everything above. The learner's stated constraints were free tools, finishable fast, honest about AI.
- Genuine uncertainty: whether Devpost judges expect a model call inside the app. The official rules (checked 2026-10-24) require a Skill Pack-built working proof of concept with these planning documents; they do not require an AI API call. Flagged to the learner.
- Pre-existing work: `engine.js`, `test.js` and `sample-orders.csv` were created on 2026-10-22, inside the submission period, before the interface and these documents. Disclosed in the README.
