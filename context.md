# Cupid Lab: technical context

Last reviewed against the repository: October 10, 2026.

## October 14 backend update

A functional SQLite backend now exists in `cupid/backend/`, served under `/api/` by `server.mjs`. The account testing UI is `/accounts.html`. It persists separate accounts, hashed passwords/sessions, scoped answers, ratings, trees, and reciprocal matches. Both tree completion and each owner's attraction threshold are required. Public profile fields are returned for matched accounts; private fields and other users' trees/answers remain server-side. Existing browser-local editor state is preserved and imported explicitly through tree export/upload. See `cupid/backend/README.md` for API details, constraints, and setup. The sections below describe the original local prototype unless otherwise noted; their statements about the absence of a database/accounts no longer describe the new connected mode. Photos and direct editor synchronization are still pending. All 29 tests passed after this addition, including SQL persistence/revocation and HTTP authentication checks.

This document explains the implementation, algorithms, design decisions, and remaining limitations of Cupid Lab. It is intended as a technical handoff for collaborators and future development. It describes the current source rather than treating every previously discussed feature as implemented.

## 1. Purpose and current scope

Cupid is a personal proof of concept for expressing nuanced dating preferences as an explicit compatibility graph. Its central ideas are customizable questions, conditional tradeoffs, and keeping private preferences out of public profiles. Appearance ratings are a separate signal, although the engine can optionally read them inside a scalar node.

The immediate project priority is feedback from friends on tree-building usability. This is not yet a multi-user dating platform. The running application simulates two people, “You” and “Alex,” in one browser. New installations start with blank trees; sample profile text, answers, and attraction ratings still exist. A populated demonstration tree remains available programmatically for tests through `initialState({demo:true})`.

The application has five areas:

- **My tree:** visual graph editing, advanced JSON editing, import/export, and completion threshold settings.
- **My profile:** name, biography, public/private hobbies, and a local photo.
- **Attraction:** a directional 1–10 appearance rating, with Pass, Interested, and Clear shortcuts.
- **Questions:** one currently needed question at a time.
- **Matches:** anonymous incoming/outgoing progress summaries and the same question feed.

Broad personal-information fields, real accounts, discovery, messaging, model inference, and a production profile-reveal mechanism are not implemented.

## 2. Stack and development tools

The app is deliberately dependency-free at runtime:

| Layer | Implementation |
| --- | --- |
| UI | Plain JavaScript ES modules, HTML, and CSS |
| Graph nodes | Absolutely positioned HTML elements |
| Graph connections | SVG cubic Bézier paths |
| Interaction | Browser Pointer Events, pointer capture, DOM measurements, animation frames |
| Persistence | Browser `localStorage`, JSON serialization |
| File exchange | File input, `File.text()`, Blob downloads, object URLs |
| Photos | `FileReader` producing local data URLs |
| Local server | Node.js built-in HTTP and filesystem modules |
| Automated tests | Node's built-in test runner and assertions |
| Sharing/development | Git, GitHub, npm scripts, Windows/macOS launchers |
| Typography | Patrick Hand and DM Sans via Google Fonts, with fallback fonts |

There is no React, Vue, graph-editor library, Express, database, bundler, TypeScript compilation, Electron, or native installer. Despite its name, `cupid/dist/` contains the directly maintained application source, not generated build output. Port 4173 is a convention here; it does not imply Vite is being used.

Development has involved direct source edits, Node regression tests, and browser inspection of the local preview. Browser checks have been especially useful for connection dragging, viewport behavior, popup placement, and confirming that the displayed page actually loaded the latest modules. These manual checks are distinct from the automated test suite.

## 3. Repository map

| File | Responsibility |
| --- | --- |
| `package.json` | Root start, serve, and test entry points |
| `Start Cupid.cmd`, `Start Cupid.command` | Root convenience launchers |
| `cupid/server.mjs` | Local static HTTP server |
| `cupid/dist/index.html` | App container, stylesheets, module entry point |
| `cupid/dist/app.js` | Page rendering, profile/answer/rating interactions, persistence |
| `cupid/dist/engine.js` | Validation, graph evaluation, question selection, hobby matching, legacy mutual matching |
| `cupid/dist/graph-model.js` | Connections, migration, edge mutation, automatic layout |
| `cupid/dist/editor.js` | Visual and JSON editors, drag/drop, popup controls, undo |
| `cupid/dist/containers.js` | Typed question containment and release |
| `cupid/dist/matching.js` | Anonymous question-feed projection and mutual tree count |
| `cupid/dist/progress.js` | Path-aware completion and aggregate progress |
| `cupid/dist/style.css`, `editor.css` | App styling and graph-editor styling |
| `cupid/tests/` | Focused algorithm and server regression tests |
| `cupid/FEEDBACK.md` | Friend-testing workflow |

Some older README sections and UI descriptions reflect the previous trace-based match lab. When descriptions conflict, inspect the current call sites; the important differences are explicitly recorded below.

## 4. Graph representation

“Tree” is the user-facing term. Technically, the structure is a directed acyclic graph: multiple branches can converge on a shared node or outcome. There are also typed data dependencies between questions and organizational blocks.

A tree contains `start`, an array of `nodes`, and optionally `completionThreshold` (1–100, default 100). A node has a stable `id`, `type`, `label`, and nonnegative canvas coordinates `x` and `y`. Branch destinations reference IDs rather than positions or labels.

| Type | Important fields | Meaning |
| --- | --- | --- |
| `boolean` | `key`, `yes`, `no` | Branch on a boolean answer |
| `scale` | `key`, `min`, `max`, `ranges` | Route an integer into an inclusive interval |
| `category` | `key`, `options` | Route an exact categorical answer |
| `count` | `inputs`, `threshold`, `yes`, `no` | Require at least N true binary inputs |
| `sum` | `inputs`, `threshold`, `yes`, `no` | Require a scalar total strictly greater than a threshold |
| `hobbies` | `yes`, `no` | Compute a local profile-to-profile hobby comparison |
| `terminal` | `outcome` | End with `match`, `friends`, or `reject` |

Questions use a `key` to look up answers in `candidate.answers`. An ID identifies a graph node; an answer key identifies a reusable answer. Reusing a key can avoid duplicate questions, but the author must currently ensure that its wording, meaning, answer type, and bounds agree. There is no semantic question registry or automatic deduplication by meaning.

Binary and scalar questions can have `mode: "input"`. They supply values to a block without requiring outgoing flow branches. A scalar can additionally use `source: "attraction"`, which reads `owner.attraction[candidate.id]` instead of the candidate's questionnaire answer.

### Flow versus data

**Flow edges** determine which decision executes next. **Data edges** tell a block which question values to read. These are intentionally different. A scalar on one branch can supply a sum block, while a scalar contained inside a sum block contributes a value without becoming a separate flow step.

Data references do not mean “this node must already have been visited.” Blocks read the referenced questions' values directly. Consequently, a block can need an answer from a source whose flow node was not traversed.

## 5. Validation and safe editing

`validateTree()` supports two contexts:

- **Draft editing:** `allowUnconnected: true` permits empty destinations and input slots, including an entirely blank tree.
- **Evaluation:** strict validation requires complete connections before traversal starts.

Validation covers duplicate/missing IDs, valid node types, labels and coordinates, answer keys, a valid start node, dangling destinations, scalar intervals, category uniqueness, typed block inputs, thresholds, and fixed outcomes. Trees are capped at 100 nodes; blocks accept 2–8 distinct question inputs. Scalar endpoints must be integers, with a span from 1 to 100.

Scalar ranges must partition every integer in the declared domain exactly once. For a 1–10 scale, `1–3`, `4–7`, `8–10` is valid; overlapping intervals or gaps are rejected. Input-only questions cannot be the start or receive flow edges.

Cycle detection uses a depth-first traversal with visiting and visited sets over both flow and data connections, including disconnected parts of the graph. This prevents circular dependencies as well as obvious flow loops.

Validation applies to the whole graph, not just the reachable path. An incomplete disconnected component can therefore keep strict evaluation invalid. Draft validity should not be confused with match readiness.

Editor mutations clone the JSON tree, validate the candidate edit, and commit it. Undo stores one preceding tree snapshot, not an unlimited history. Clear tree requires confirmation and replaces the tree with `{start: "", nodes: []}`; that also removes a custom completion threshold, returning it to the default.

## 6. Deterministic evaluation algorithm

`evaluate(tree, owner, candidate)` validates first, starts at `tree.start`, and follows one flow path. It returns a status and an internal trace. Possible statuses are `invalid`, `pending`, `match`, `friends`, and `reject`.

For ordinary questions, the evaluator reads the candidate's answer and checks its type/domain. A missing, malformed, or out-of-range answer produces `pending`, not false or rejection. Boolean answers must actually be booleans; scalar answers must actually be integers; categories must match a declared option.

Known values select a destination: yes/no for boolean-like conditions, the containing range for scalars, or the matching category option. A terminal ends evaluation. Each trace step records its node, explanatory detail, and selected destination; a pending step is marked explicitly. Traces remain internal to computation and are no longer rendered in Matches.

### At least N

Let `Y` be the number of true inputs, `U` the number of unknown inputs, and `N` the threshold:

```text
if Y >= N:       true
else if Y+U < N: false
else:           pending
```

This resolves as soon as the available facts are sufficient. A two-of-three block passes after two yes answers even if the third is unknown. It fails after two no answers because the remaining answer cannot reach two yeses.

### Sum score

A sum block requires every scalar input to be known, then tests:

```text
sum(values) > threshold
```

The comparison is strictly greater than, not greater than or equal. The current implementation does not use input bounds to resolve a sum early. Contained and externally connected scalar questions use the same evaluation logic.

### Performance characteristics

The conceptual traversal follows one path through an acyclic graph. However, the implementation repeatedly searches arrays for nodes and filters connections during validation; it should not be described as an optimized linear-time graph engine. That is acceptable for the 100-node prototype. Indexed adjacency lists, cached validation, and shared evaluation results would be sensible optimizations if the matching pool grows.

## 7. Completion percentages and matching

`treeProgress()` computes progress toward a compatible outcome rather than counting every visited node indiscriminately. Outcomes and contained input questions do not count as decision steps; their containing block counts once.

Its memoized remaining-distance calculation is:

```text
remaining(Compatible) = 0
remaining(Reject or Friends) = negative infinity
remaining(decision) = 1 + max(remaining(each outgoing destination))
```

As evaluation follows selected branches, the algorithm updates:

```text
total = decisions already passed + longest remaining compatible route
```

A decision only increments the passed count if its chosen destination still has a compatible continuation. This is a path-based progress measure, not a personality similarity score. Its denominator can change when a branch is chosen. Invalid/blank graphs report 0/0.

Qualification occurs when evaluation reaches `match`, or when it is `pending` and `passed / total * 100` meets the configured completion threshold. Explicit `reject` and `friends` results remain final, even if an earlier partial state met the percentage. Thus partial qualification is not an irrevocable acceptance: further answers can change it.

`progressSummary()` compares the user against the other profiles in both directions. “Highest” currently means the greatest absolute passed-node count, with the smaller positive denominator used to break ties. It does not choose the highest percentage.

### Current versus legacy matching paths

There are currently two distinct implementations:

- `matchingFeed()` counts pairs whose trees both qualify under `treeProgress()`. It does **not** apply attraction thresholds. Its count is calculated but the current Matches page displays progress summaries rather than this count.
- The older `mutual()` helper requires both evaluations to reach `match` and both directional attraction scores to be at least 6. It remains in the engine and tests, but does not govern the current Matches screen.

Some Attraction page copy still describes the older behavior. A unified rule such as “70% tree completion AND 6/10 attraction,” configurable per person, has been discussed but is not implemented. Avoid treating these two code paths as an already unified matching policy.

## 8. Anonymous question delivery

`matchingFeed()` evaluates each other person's tree against the current user. Only pending trees contribute questions. `questionsFor()` identifies the unresolved flow node or the unknown inputs of its unresolved block. Appearance-source questions are excluded from the candidate questionnaire.

The feed deduplicates by answer key, applies a per-user in-memory skip set, and returns only question content: key, label, type, scalar bounds, or category values. It omits owner identity, branch destinations, and traces. The UI displays the first available question. Answering saves the value and recomputes the feed; a rejected or completed tree stops contributing, so the UI can move to another tree without announcing the outcome.

This is deterministic ordering, not a learned scheduler or information-gain optimizer. Skips last for the current page session. Labels are used as written; they are not translated into respondent-facing language. Progress aggregates can still convey indirect information, so removing named cards is not a formal anonymity guarantee.

## 9. Hobby comparison

`hobbyOverlap()` combines each profile's public and private hobbies, splits comma/semicolon/newline-separated terms, trims them, and lowercases them. It checks exact matches or membership in a small hand-written related-interest dictionary, such as LoL/League of Legends or hiking/trail walking.

No interests on either side yields unknown. Known overlap yields true; no recognized overlap yields false. Returned explanations are generic and do not include private hobby strings.

This is not an LLM, embedding search, or learned similarity model. Some groups represent broad related interests rather than strict synonyms. It is useful for demonstrating the interaction, but can miss overlap or overstate compatibility.

## 10. Editor geometry and interaction

The editor combines HTML cards with an SVG connection layer. Coordinates are stored in unscaled graph space. Port positions are measured from the live DOM, translated back through the current zoom, and used to construct cubic Bézier curves. Measuring actual ports keeps wires aligned when cards change size or fonts finish loading.

Important interaction work includes:

- Live wire redraw during node dragging.
- Dragging from an output toward compatible inputs, with a curved preview.
- Validating prospective destinations before highlighting them.
- Snapping within 30 screen pixels and committing on release.
- Cancelling with Escape or an empty-space drop.
- Auto-scrolling near canvas boundaries while drawing a connection.
- Separate flow and typed value ports; count accepts binary values and sum accepts scalar values.
- Red disconnected indicators, green connected indicators, and neutral optional outputs/start inlets.
- Wide invisible SVG hit paths so thin visible wires are easy to select and delete.
- Keyboard activation of ports and edges as an alternative to pointer dragging.

Wheel input zooms around the pointer between 30% and 150%. It computes the graph coordinate beneath the cursor before scaling, then adjusts scroll offsets so that coordinate remains under the cursor. Left-dragging empty grid pans the viewport.

New nodes are placed near the current viewport center after converting scroll offsets and zoom into graph coordinates. Tree rerenders preserve canvas and page scroll positions to reduce the disorienting jumps previously seen after edge deletion.

Node settings are floating dialogs placed beside the selected card where possible. Their dimensions and position are clamped to the visible intersection of the editor and browser viewport. The header is draggable; long content scrolls inside the popup. Scalar ranges now use numeric From/To fields and destination dropdowns instead of requiring handwritten range syntax. Category editing still uses a text representation.

### Organizational containers

Count and sum blocks provide slots into which compatible questions can be dragged. Contained questions stay as separate records in the graph but render within their block. Containment prevents using the start node or a question with existing flow wiring; this avoids silently destroying graph structure.

Moving a question into a slot changes it to input mode and clears previous block references to that question. Releasing it places it back on the canvas but leaves it in input mode; release does not invent flow branches. External data connections remain a separate supported mechanism.

## 11. Automatic layout algorithm

“Clean up tree” uses a custom layered layout heuristic rather than a third-party layout engine:

1. Exclude contained input questions from standalone layout.
2. Build visible flow/data links and assign ranks using topological processing. Destinations are placed at least one rank below their predecessors.
3. Insert temporary virtual nodes along edges that span multiple ranks. This lets crossing calculations consider each intervening layer.
4. Build ordering constraints from outgoing flow-port order, preserving yes-before-no and low-to-high scalar branches where possible.
5. Run ten alternating downward/upward barycentric sweeps. Each node is ordered by the average position of its neighbors in the adjacent layer.
6. Reapply branch-order constraints and retain the arrangement with the best measured adjacent-layer crossing count.
7. Assign coordinates with 280-pixel column spacing, centered rows, and vertical spacing based on the tallest measured card in the preceding row plus 55 pixels.

Conflicting constraints from shared destinations fall back to stable ordering. Virtual nodes affect spacing but are not persisted as actual tree nodes. This is crossing reduction, not a guarantee of zero overlaps or an optimal drawing. Crossing counts compare segment order; they are not a full collision test of the final curved SVG paths against card rectangles.

The algorithm deliberately favors understandable branch order and shorter vertical gaps. More compact packing, obstacle-aware routing, and better shared-destination placement remain possible improvements.

## 12. Persistence, migration, and privacy boundary

The complete two-person state is stored under `cupid-lab-v1` in localStorage. State includes profiles, trees, answers, photos, and directional attraction ratings. Loading checks version 1, exactly two profiles, draft-valid trees, and the presence of answer/rating containers. Storage failures produce a toast encouraging export.

Legacy count blocks stored inline `items`. Migration creates separate binary input nodes while retaining answer keys and labels. Before migration, a one-time backup is saved under `cupid-before-blocks`.

Tree export downloads only the graph JSON, not the whole profile. Advanced import reads a file under 200 KB into the JSON editor; Apply performs parsing, migration, validation, and commit. Photo input accepts PNG/JPEG/WebP under 2 MB and stores a data URL locally.

Browser storage is origin-specific: changing browser, host spelling, or port can appear to lose saved work. The static server does not receive these edits. There is no authentication, authorization, encrypted private-profile store, server-side matching, or synchronization. The person switcher can access both sides. Current privacy is UI separation within a local demo, not a security boundary between real users.

## 13. Running and distributing the project

From the repository root, with Node.js 22 or newer:

```sh
npm start
npm run serve
npm test
```

`start` runs the server and opens the default browser; `serve` omits browser opening. No dependency install or build step is required. Windows and macOS scripts forward to the same server. The macOS launcher still needs a real-Mac smoke test.

The server resolves `dist/` relative to its own module URL, so it does not depend on the shell's working directory. It binds to `127.0.0.1`, defaults to port 4173, accepts GET/HEAD, checks resolved paths remain under the app directory, sends MIME types, and returns `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`. It is a static preview server, not an API backend.

An already loaded browser page does not automatically replace its running JavaScript when a source file changes. There is no hot reload. A previous stale-preview issue was resolved by reloading the tab and verifying the new Matches DOM, rather than assuming a successful source edit meant the browser had updated.

## 14. Verification coverage

The repository contains focused tests for:

- Blank initial trees and draft/evaluation distinctions.
- Scalar endpoints, gaps, overlaps, invalid answers, and categorical routing.
- Unknown-answer handling and count short-circuiting.
- Typed block inputs, sum evaluation, containment, and release.
- Cycles, dangling references, and malformed graph data.
- Directional attraction and the legacy mutual helper.
- Hobby aliases and generic explanations.
- Branch ordering and vertical spacing in automatic layout.
- Anonymous feed projection, rejection progression, and blank match counts.
- Partial-completion thresholds and explicit rejection precedence.
- Static-server behavior, including launching outside its directory.

These are regression checks, not proof of production security, semantic question quality, or usability. Browser interaction checks supplement them. This documentation update does not claim a fresh full test run or changes to runtime behavior.

## 15. Deferred decisions and known gaps

Question translation is explicitly on the back burner, not forgotten. A future design may separate an author's private label from approved respondent-facing wording, flag questions only the author can judge, reuse voluntary profile fields, and optionally use a local LLM to propose translations. No model has been trained or connected. Ambiguous compound questions must not be silently rewritten into different matching rules.

The author's personal example exposed the difference between self-reported facts, preferences, pair-specific chemistry, and owner judgments. “Do you watch anime?” can be asked directly; “Do I find this person fun to talk to?” cannot be answered equivalently by the other person. Current code does not automatically distinguish these cases.

Other open work includes:

- Reconciling current completion-based qualification with attraction requirements and stale explanatory copy.
- Deciding whether appearance remains entirely separate or is optionally usable in advanced trees.
- Exploring quick attraction choices versus a private customizable scorecard; dimensions, weights, and unsure/revisit workflows are not implemented.
- Adding richer optional profile fields and genuine account-level privacy before real multi-user use.
- Handling answer-key collisions and incompatible schemas across independently authored trees.
- Reducing repeated evaluation and validation if the prototype grows beyond two people.
- Consolidating accumulated CSS overrides and removing obsolete trace-era state/imports.
- Expanding tests around branching progress denominators, feed ordering, category handling, and UI behavior.

The current direction is to gather friends' feedback before choosing the next large redesign. Preserve existing browser saves and the distinction between implemented behavior, experimental mechanisms, and future product ideas.
