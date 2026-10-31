# Formula:Love

Design your own matchmaking algorithm. You build a formula: questions that lead from Start to an End heart and decide who is compatible with you; your rules stay private.

A personal prototype, not a live dating service. With Node **22.13+**, run `npm start`, create an account, and build your formula. Accounts, formulas, answers, responses and matches are saved in a local SQLite database (`cupid/data/cupid.sqlite`). Everyone has a public profile (username and a preset picture); name, bio and hobbies are shown only after a mutual match. A formula saved in your browser before accounts existed is offered for one-click import. See [backend details and API](cupid/backend/README.md) and technical notes in `context.md`.

## Start on Windows or macOS

Install **Node.js 22 or newer**, then:

```sh
git clone https://github.com/haydenmfu/Cupid-Lab.git
cd Cupid-Lab
npm start
```

No dependency install, build step, account, or API key required. Your browser opens automatically. Keep the terminal open; Ctrl+C stops the app.

Alternatively, double-click **Start Cupid.cmd** on Windows. On macOS run `sh "Start Cupid.command"`; for Finder launching first run `chmod +x "Start Cupid.command"`. The Mac launcher still needs testing on a real Mac.

## Build a formula

Sign in, then click **Add first question**. A **Start** pill and an **End** heart come with it. Each answer is a row on its step with a dot on the right edge; an answer that goes nowhere yet shows a **+**. Click it to pick the next step from a short searchable menu, and it arrives already connected. Click any step to edit it in the panel on the right. Drag dots to rewire, scroll to zoom, and drag empty canvas to pan.

Question types: **Yes / no** (blue), **Number** (green: they type any number; you set optional limits, whole-numbers-only, and branches that each start at a value), and **Multiple choice** (amber: one branch per choice). **Open-ended** (rose) questions get a written response of up to 1,000 characters. It waits in your **Review** page, where you approve it or not; each choice is a branch, so send "Not approved" to a Reject outcome for an instant reject. The person who answered sees it as waiting, then approved or not. Review also lets you block or report someone. **Paths** shows everyone else's formula as a left-to-right path ending in a pixel heart: steps you have passed are filled, the rest stay blacked out, and your picture marks where you are. **Continue** asks that person's next question. On **My formula**, a stack of progress bars shows how far each visitor has come along your path. A match means you both reach Compatible on each other's paths. Purple blocks combine answers: at-least-N takes yes / no questions, Sum takes number questions. Formulas made before this version are converted automatically: several Compatible outcomes merge into the one End heart, and the layout is rearranged left to right once.

**Tidy** rearranges the layout. **Clear formula** removes all steps after confirmation; Undo restores the previous edit. **Export formula** saves your work as JSON; the **Advanced** tab can import it, and holds the completion setting and **Clear formula**.

Your formula saves to your account on this server each time you edit it. **Export formula** downloads a JSON backup. Exported rules may contain private preferences, so review them before sharing.

## Feedback

Try the [ten-minute feedback guide](cupid/FEEDBACK.md), then [open an issue](https://github.com/haydenmfu/Cupid-Lab/issues) with what you tried, what was confusing, and your OS/browser. Screenshots or formula exports are optional.

## Development

Run `npm test` for tests or `npm run serve` to start without opening a browser. Source lives in `cupid/dist/` (plain JavaScript, HTML and CSS). See [the detailed README](cupid/README.md) for the graph format and troubleshooting. Fonts load from Google Fonts and fall back to local fonts offline.
