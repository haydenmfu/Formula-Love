# Formula:Love

Design your own matchmaking algorithm. You build a tree of questions that decides who is compatible with you; your rules stay private.

A personal prototype, not a live dating service. With Node **22.13+**, run `npm start`, create an account, and build your tree. Accounts, trees, answers, ratings and matches are saved in a local SQLite database (`cupid/data/cupid.sqlite`). Everyone has a public profile (username and a preset picture); name, bio and hobbies are shown only after a mutual match. A tree saved in your browser before accounts existed is offered for one-click import. See [backend details and API](cupid/backend/README.md) and technical notes in `context.md`.

## Start on Windows or macOS

Install **Node.js 22 or newer**, then:

```sh
git clone https://github.com/haydenmfu/Cupid-Lab.git
cd Cupid-Lab
npm start
```

No dependency install, build step, account, or API key required. Your browser opens automatically. Keep the terminal open; Ctrl+C stops the app.

Alternatively, double-click **Start Cupid.cmd** on Windows. On macOS run `sh "Start Cupid.command"`; for Finder launching first run `chmod +x "Start Cupid.command"`. The Mac launcher still needs testing on a real Mac.

## Build a tree

Sign in, then click **Add first node**. Click a node to edit, drag dots to connect, scroll to zoom, and drag empty paper to pan. Scalar questions use From/To fields and destination dropdowns. Blue questions are binary, green questions scalar, and purple blocks combine answers. A two-of-three block takes binary questions; a Sum score block takes scalar questions.

**Tidy layout** rearranges the layout. **Clear tree** removes all nodes after confirmation; Undo restores the previous edit. **Export tree** saves your work as JSON; Advanced editor can import it.

Your tree saves to your account on this server each time you edit it. **Export tree** downloads a JSON backup. Exported rules may contain private preferences, so review them before sharing.

## Feedback

Try the [ten-minute feedback guide](cupid/FEEDBACK.md), then [open an issue](https://github.com/haydenmfu/Cupid-Lab/issues) with what you tried, what was confusing, and your OS/browser. Screenshots or tree exports are optional.

## Development

Run `npm test` for tests or `npm run serve` to start without opening a browser. Source lives in `cupid/dist/` (plain JavaScript, HTML and CSS). See [the detailed README](cupid/README.md) for the graph format and troubleshooting. Fonts load from Google Fonts and fall back to local fonts offline.
