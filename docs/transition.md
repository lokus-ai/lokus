# Replacing Lokus 1 with Lokus 2

What has to happen for `next` to become `main`, in order. Each step says who can do it and what
breaks if it is skipped. Nothing here has been done yet unless it says so. Written 2026-11-13.

## Before anything is merged

| # | Step | Why | Who |
|---|---|---|---|
| 1 | **Commit the work on `next`.** Done 2026-11-14 | Everything built since the rewrite began exists only in one working folder on one laptop | Owner says go; then anyone |
| 2 | **Check the tag `v1-legacy` on the day of the switch.** Today it already holds everything on `main` (checked 2026-11-13); if `main` gains a commit before the switch, tag it again | So the last Lokus 1 can always be rebuilt | Owner |
| 3 | **Rotate the Supabase secret key and the password** pasted into a chat on 2026-11-13 | They were shown in plain text | Owner |
| 4 | **Decide what happens to outside contributors' open issues and pull requests** against Lokus 1 | They were left open on purpose; after the switch they point at code that is gone | Owner |

## Things that will bite Lokus 1 users

| # | Problem | What to do |
|---|---|---|
| 5 | **Lokus 2 has the same app identity as Lokus 1** (`io.lokus.app`). Installed side by side they share one settings folder and one set of saved sign-ins | Either give Lokus 2 a new identity until it replaces 1 for good, or accept that it takes over Lokus 1's place on that computer. Decide before the first installer |
| 6 | **Lokus 1 updates itself from this repository.** It looks at `config.lokusmd.com/api/updates/latest.json` and at the `latest.json` attached to the newest GitHub release here. A Lokus 2 release published as "latest" with that file would move every Lokus 1 user onto an alpha, with no way back | Publish Lokus 2 builds as pre-releases, without a `latest.json`, until it is ready for all of them. Lokus 2 now has its own updater, which asks the relay and never reads this repository (`docs/releasing.md`) |
| 7 | **Lokus 1's cloud sync stops meaning anything.** Lokus 2 syncs through its own relay and does not read Lokus 1's storage | Notes are safe (they are files on disk). Tell Lokus 1 users, before the switch, to make sure each device has its notes locally; then they turn sync on again in Lokus 2 |
| 8 | **Files Lokus 2 does not show:** `.kanban`, `.canvas`, and anything from the calendar, Gmail and terminal features | They stay on disk untouched. Lokus 2's tasks are notes in `tasks/`; a Lokus 1 `.kanban` board is not converted. Say so in the release notes; a converter is not built |
| 9 | **The Mac App Store listing** is Lokus 1 | Leave it alone until Lokus 2 has a signed, sandbox-checked build; the review fixes listed for Lokus 1 do not apply to Lokus 2's code |

## Before anyone outside can use Lokus 2

| # | Step | State today |
|---|---|---|
| 10 | **Signed, notarized installers** for macOS, and builds for Windows and Linux | The updater is built and tested with three local releases (`docs/releasing.md`). The release workflow is rewritten for signed update files but has not been run in CI; notarization is untested |
| 11 | **The hosted relay brought up to date** and given a real name | Brought up to date on 2026-11-14 (data-push door, releases and news, a publish key). Still under a temporary `sslip.io` name. Daily backups are on; restoring one has never been tried |
| 12 | **One Supabase project chosen for production**, with Google sign-in set to the production return address | The app points at a project made for testing |
| 13 | **The Slack app published** in the Slack Marketplace | It works only in the workspace it was made in. GitHub and Google need the same kind of registration and have not been started |
| 14 | **The app pointed at the hosted relay** in a release build (`VITE_LOKUS_RELAY`) | The development copy points at a relay on the developer's laptop |
| 15 | **A decision on usage counts** (PostHog): on, off, or asked at first run | The key is empty, so nothing is sent today |

## Known gaps in Lokus 2 itself

Not blockers for making it `main`, but users will meet them:

- The assistant acts when asked. It does not yet watch for new customer messages and update the
  board by itself.
- Light theme has not been checked on the screens built since the rewrite's first pass.
- A deleted customer takes the people filed under it by name match.
- Web links in a note do not open on click; links to notes do.
- The assistant's sign-in to a connected service was checked for Linear, Notion, Granola and
  Slack. Sentry, Atlassian, Stripe, Intercom and Zapier are listed but untried.
- Attachments are kept inside the relay's database rather than in file storage.
- No end-to-end encryption: whoever runs the relay can read the notes.

## The switch itself

Once the tables above are settled:

1. Merge or fast-forward `main` to `next` (the rewrite's first commit already removes the old
   tree, so this is a replacement, not a merge of two code bases).
2. Make `next`'s checks the required ones on `main`.
3. Publish the release notes with the "Coming from Lokus 1" section of the README.
4. Only then publish an installer, and only then touch the update address.
