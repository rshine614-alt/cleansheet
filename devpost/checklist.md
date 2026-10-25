---
doc: checklist
status: draft
---

# Build Checklist

Build mode: fast (the learner asked the agent to build it end to end)

## Slices

- [x] **1. The engine cleans a CSV and explains every change**
  Becomes usable: `node test.js` parses the sample, reads a sentence into a plan, cleans, removes duplicates, flags problems, and round-trips the CSV.
  Why now: The kernel (explained, reversible changes) lives here.
  PRD ref: `prd.md > Features and Behavior`
  Spec ref: `spec.md > Components`
  Build: `engine.js`, `test.js`, `sample-orders.csv`.
  Verify (mechanical): `node test.js` prints ALL ASSERTIONS PASSED.
  Learner check: Run `node test.js` and read the REMOVE/FLAG/CHG lines.
  Commit: `Add cleaning engine, tests and sample data`

- [x] **2. You can clean a file in the browser and download it**
  Becomes usable: Upload or sample, instruction, plan, review with undo/restore/fix, result preview, two downloads.
  Why now: Completes the core journey.
  PRD ref: `prd.md > The Core Journey`
  Spec ref: `spec.md > Components`, `spec.md > File Structure`
  Build: `index.html`, `style.css`, `app.js`, `sample.js`.
  Verify (mechanical): Browser test (Playwright): sample loads, plan has 8 steps on, run gives 21 cells cleaned and 2 rows removed, restore/remove changes row count by one, fix is recorded in the report, both downloads parse, no console errors, no horizontal overflow at 390 px width.
  Learner check: Open `index.html`, press the sample link, make the plan, run it, download both files and open them.
  Commit: `Add browser interface: upload, plan, review, download`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — shared with the final review (single-session build)
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete
- [ ] Optional edit and transfer reflection addressed
- [x] `devpost/app-map.html` generated from finished code, checked offline with scripts disabled (reference route only; not toured by the learner)

## Revisions

- Demo instruction lengthened to include dates and phones — the shorter sentence cleaned only one cell, which made a weak demo.
- Mobile layout fixed — a browser test at 390 px showed sideways overflow.
