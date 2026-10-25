---
doc: scope
status: draft
---

# CleanSheet

A browser tool that turns a messy CSV into a clean one, and shows the reason for every change so you can undo any of them.

> Authorship note: the learner delegated the idea to the agent ("you know the idea then create it and finish it"). The idea, kernel and cuts below are the agent's proposals, based on constraints the learner stated: finishable in a few days, no paid AI API, useful to freelancers and small businesses. They become the learner's plan when approved.

## The Unique Kernel
Every change is explained and reversible. The tool never silently "fixes" data. It shows before and after with a reason, never invents a missing value, and flags anything it cannot decide (an ambiguous date, a missing email) for a person to settle. A separate change report travels with the cleaned file.

## Who It's For
A freelancer or small online seller who gets customer lists and order exports from shops, forms and spreadsheets: duplicated customers, "03/05/2026" that could mean two dates, phone numbers in five styles. Today they fix it by hand in a spreadsheet and hope they caught everything.

## The Core Loop
Open the page, drop in a CSV, type what they want in plain English, check a short plan of what will happen, run it, review each change (undo, fix, or accept), download the clean file and the report.

## Inspiration & Identity
Calm, ledger-like and trustworthy: warm paper background, dark green accents, serif headings, plain language. It should feel like a careful bookkeeper, not a flashy AI toy.

## Why This Matters to the Learner
The learner wants a real, working project to show, built with free tools, that could grow into a small paid product (saved cleaning rules, bigger files) later.

## What "Working" Looks Like
In under a minute on screen: load the sample order export, type one sentence, see the plan, run it, see duplicates removed with the reason ("kept the newest order"), see flagged items such as a missing email, fix one by typing, undo one change, download the cleaned CSV and open it, then open the change report.

## The POC Boundary
In: CSV upload (or sample), plain-English instruction read by keyword rules, an editable plan, rules for trimming, name capitalization, email, phone, date and amount checks, duplicate removal with "keep newest/oldest/first", missing-value flags, per-item undo, manual fix of flagged cells, cleaned-CSV and change-report downloads. Runs fully in the browser.

## Later
Saved cleaning recipes, Excel files, very large files, a real language model for reading instructions, user accounts.

## Explicitly Cut
- PDFs, images and scans: unreliable without a paid model, and not needed to prove the kernel.
- Accounts, payments, databases: nothing here needs a server.
- Claiming AI: the instruction reader is rule-based and says so on screen.
