# SQL matching backend

Requires Node **22.13 or newer** (22.17 tested). Uses built-in `node:sqlite`, which may print an experimental-feature warning on Node 22. No dependency installation is needed.

Run `npm start` from the repository root and sign in on the main page. Use separate browser profiles or sign out/in to test separate accounts. The editor saves your tree to your account. A tree saved in the browser before accounts existed is offered for one-click import; it is never uploaded automatically.

The first connected UI supports registration/login, profile editing, tree import, anonymous questions, test candidate ratings, and actual persisted mutual matches. Photo upload and live visual-editor synchronization are not connected yet. Candidate IDs are shown for testing; names, biographies, and public hobbies are returned only after matching. Private hobbies, other people's trees, and their answers are not returned.

SQLite lives at `cupid/data/cupid.sqlite`, outside the served directory and ignored by Git. Set `CUPID_DB` to override its location. Back up the database with SQLite's backup tools or stop the server before copying database files. Tests use temporary databases or memory.

Tables: users, identities, responses, blocks, reports, sessions, answers, ratings, prompts, matches. `identities` maps a sign-in method (provider + subject) to one user, so one account can later link Google, Discord or LinkedIn; today every account has a `password` identity. SQL parameters are bound. Passwords use salted scrypt hashes; sessions use random bearer tokens stored hashed in SQL and expire after seven days. The UI keeps its token in sessionStorage. Mutating API calls require JSON; cross-origin requests are rejected. Login/registration has a basic per-address in-process rate limit.

Answers are scoped by respondent, tree owner, and answer key. A stored question-definition fingerprint prevents answers from being reused after wording/type/bounds changes. Opaque question tokens are scoped to the authenticated respondent, and submitting obsolete questions is rejected. There is no LLM translation.

Both directions must qualify under the existing completion algorithm AND meet each owner's attraction threshold (default 6). Explicit reject/friends outcomes cannot qualify. Matches use canonically ordered user IDs with a unique primary key. Recalculation inserts missing pairs and removes pairs that no longer qualify; match timestamps survive unchanged qualifications. Tree/profile/answer/rating mutations trigger recalculation. Recalculation is transactional; the triggering edit is saved before that transaction. This distinction should be revisited for stronger failure atomicity.

API (authenticated except register/login):

| Method | Path | Body/result |
| --- | --- | --- |
| POST | /api/register, /api/login | username, password → token, id |
| POST | /api/logout | revoke current session |
| GET | /api/me | own profile, tree, settings and linked sign-in methods |
| PUT | /api/profile | name, bio, publicHobbies, privateHobbies, attractionThreshold |
| PUT | /api/tree | tree JSON; drafts accepted, incomplete trees cannot qualify |
| GET | /api/questions | anonymous currently needed questions with opaque tokens |
| POST | /api/answers | token, value |
| GET | /api/candidates | public profiles (ID, username, picture) and your ratings |
| PUT | /api/rating | targetId, score (1–10 or null to remove) |
| GET | /api/matches | matched profiles: username, picture, name, bio, public hobbies |
| GET | /api/responses/sent | your open-ended responses with status (pending, approved, rejected) and the asker's public profile |
| GET | /api/responses/inbox | pending responses to your open-ended questions |
| POST | /api/responses/decide | id, approve (boolean) |
| POST | /api/block | userId; hides both people from each other |
| POST | /api/report | userId, reason (stored for later moderation) |
| GET | /api/progress | furthest progress in your tree (incoming) and others' (outgoing) |

This is a functional local backend, not an internet-ready deployment. It still binds only to localhost. TLS, password recovery, durable abuse controls, account deletion, photo storage, database migration versioning, pagination, and discovery restrictions remain future work. Recalculation scans all pairs and synchronous SQLite/scrypt operations block the Node event loop; this is appropriate for a small test pool, not a large service. No email verification or real-world identity verification is claimed.
