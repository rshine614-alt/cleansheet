---
doc: prd
status: draft
---

# CleanSheet — Product Requirements

A one-page web tool that cleans a messy CSV with a reviewable, undoable change for every fix, for freelancers and small online sellers.
Source: `scope.md > The Unique Kernel`, `scope.md > The Core Loop`.

> Authorship note: the learner delegated product decisions to the agent. Items under "Product Decisions" are agent proposals awaiting the learner's approval.

## The Core Journey
1. Open `index.html`. See one card: "Bring your file".
2. Drop a CSV or press "Try the sample order export". The first rows appear in a preview table.
3. Type a plain-English instruction (or pick an example). Press "Make a cleaning plan".
4. See a list of cleaning steps, each with a checkbox, a label (You asked / General clean / Always safe / Optional) and a one-sentence reason. Switch steps on or off. Press "Run cleaning".
5. Review: four counters, then tabs for cell changes, removed rows, items needing attention, and a result preview.
6. Undo any change, restore any removed row, type a correction for any flagged cell, or mark a flag "looks fine".
7. Download the cleaned CSV and the change report.

## Screens and Layout
A single scrolling page with four numbered cards (file, instruction, plan, review). Later cards appear as earlier steps complete. No navigation.

## Look and Feel
Warm paper background, dark green accent, serif headings, system sans body text, monospace for before/after values. Before values are struck through in red, after values are green. Flagged cells have an amber outline. Works at phone width. Tone: plain, honest, short sentences.

## Features and Behavior

### Reading the instruction
- Keyword rules decide which steps are on. Duplicates, missing values, names, emails, phones, dates, and amounts are recognized. "Clean everything" turns on all steps.
- Always shows what it understood. States that this is not an AI model.
  - [ ] Typing the sample sentence turns on Remove duplicates, Flag missing, Phones, Dates and Trim.
  - [ ] An empty or unrecognized instruction still gives a plan the user can switch on manually.

### Cleaning and review
- Every cell change lists the rule and the reason. Duplicate removals say which row was kept and why.
  - [ ] Undo restores the original value in the result preview and in the download.
  - [ ] Restore row brings a removed row back.
- Ambiguous dates (03/09/2026) are flagged, never silently decided. A day above 12 elsewhere in the column decides the order.
- Missing values and placeholders such as "N/A" are flagged, never filled.
- Typing a correction marks the cell "fixed by you" and records it in the report.

### Export
- Cleaned CSV with only the rows kept. Change report CSV listing every change, removal, flag, and the user's decision.
  - [ ] Opening both files in a spreadsheet shows correct columns and values.

## States and Boundaries
- **No file yet** — only card 1 is visible.
- **Unreadable or empty file** — red message "No data rows found. Is this a CSV with a header row?".
- **Unresolved flags at download** — a yellow notice; the report marks them "Needs review".
- **Persistence** — nothing is saved. Closing the page clears everything. Files never leave the browser.

## Product Decisions
- Rule-based instruction reader, honestly labeled — the learner requires a $0 budget and no paid API; claiming AI would be untrue.
- Flag instead of guess — builds trust; the kernel.
- Browser only, no server — nothing to host, nothing private uploaded.

## What We're Building
Everything in Core Journey and Features above.

## Deferred From the POC
- Saved recipes: needs storage and naming; later.
- Excel files: needs a parsing library; later.

## Possible Later Enhancements
A language model for reading instructions; bulk files; team sharing.

## Non-Goals
No PDFs or images, no accounts, no payments, no guarantee that cleaned data is correct: the user stays the reviewer.

## Open Questions
None blocking. Whether the learner wants a different project name can wait.
