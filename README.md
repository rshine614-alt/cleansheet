**🎬 [Watch the CleanSheet Demo on YouTube](https://www.youtube.com/watch?v=yJq7jfYcJ-w)**

# CleanSheet

Clean a messy CSV in your browser. Every change is explained, reviewable and undoable.

Built for the Devpost *Build With AI: Basics* hackathon using the Devpost Learn Skill Pack. Planning documents are in [`devpost/`](devpost/): `scope.md`, `prd.md`, `spec.md`, `checklist.md`.

## Try it

1. Open `index.html` in a browser (double-click it). No install, no server, no account.
2. Press **Try the sample order export**, then **Make a cleaning plan**, then **Run cleaning**.
3. Review changes (undo, restore, fix), then download the cleaned CSV and the change report.

Or run a local server: `python3 -m http.server` and visit http://localhost:8000.

## What it does

- Removes duplicate rows (keep newest, oldest or first) and says which row it kept and why.
- Trims spaces, fixes ALL-CAPS and lowercase names, lowercases emails, standardizes phone numbers and dates, strips currency symbols.
- Flags, never guesses: missing values, invalid emails, ambiguous dates (03/09/2026), negative or unusually large amounts.
- Lets you undo any change, restore any removed row, type a correction, or dismiss a flag.
- Exports the cleaned CSV and a change report listing every decision.

## Honest limits

- The instruction reader is **keyword rules, not an AI model**. It shows what it understood and lets you switch every step on or off.
- Files never leave your browser. Nothing is stored.
- You are still the reviewer: check flagged items before relying on the output.

## Tests

`node test.js` checks the cleaning engine (Node.js only; the app itself has no dependencies).

## Disclosure

`engine.js`, `test.js` and `sample-orders.csv` were created on 2026-10-22, inside the submission period; the interface, planning documents and everything else were created on 2026-10-24. Built with Claude as the AI coding assistant.

## License

MIT, see [LICENSE](LICENSE).
