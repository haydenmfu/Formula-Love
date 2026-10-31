# Cupid Lab

## Connected SQL matching preview

With Node **22.13+**, run `npm start` and open [Connected matching](http://127.0.0.1:4173/accounts.html). Restart an already running server after pulling backend updates. Create separate accounts, import exported trees, answer questions, and set test attraction ratings. SQLite persists reciprocal matches across restarts. The original editor remains browser-local; uploads are explicit. Photo support is not connected to accounts yet. See [backend details and API](cupid/backend/README.md).

A personal prototype for drawing your own compatibility rules. This build is for feedback on the tree editor, not a live dating service. New users start with a blank tree; existing browser saves are preserved.

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

Click **Add your first node**. Click a node to edit, drag dots to connect, scroll to zoom, and drag empty paper to pan. Scalar questions use From/To fields and destination dropdowns. Blue questions are binary, green questions scalar, and purple blocks combine answers. A two-of-three block takes binary questions; a Sum score block takes scalar questions.

**Clean up tree** rearranges the layout. **Clear tree** removes all nodes after confirmation; Undo restores the previous edit. **Export tree** saves your work as JSON; Advanced editor can import it.

Edits are local to the same browser and address (`http://127.0.0.1:4173/`). They are not uploaded or shared automatically. Export before clearing browser data. Exported rules may contain private preferences, so review them before sharing. Other tabs simulate two people and are not privacy boundaries.

## Feedback

Try the [ten-minute feedback guide](cupid/FEEDBACK.md), then [open an issue](https://github.com/haydenmfu/Cupid-Lab/issues) with what you tried, what was confusing, and your OS/browser. Screenshots or tree exports are optional.

## Development

Run `npm test` for tests or `npm run serve` to start without opening a browser. Source lives in `cupid/dist/` (plain JavaScript, HTML and CSS). See [the detailed README](cupid/README.md) for the graph format and troubleshooting. Fonts load from Google Fonts and fall back to local fonts offline.
