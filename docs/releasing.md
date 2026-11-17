# Releasing Lokus, and telling people about it

How a new version reaches the people who already have Lokus, and how news reaches them.
Nothing here depends on an app store.

## What a person sees

1. A pop-up in the corner: "A new version of Lokus is ready", with **Update now**.
2. A progress bar while it downloads. They can keep working.
3. On Mac and Linux, "The update is installed", with **Restart now**. It says Lokus will close
   and open again by itself, and what to do if it does not (open it again; nothing is lost).
   On Windows, the installer closes and reopens Lokus automatically after **Update now**.
4. Lokus comes back as the new version and opens "What's new" on that version's post, with its
   video.

"Later" puts the pop-up away; an **Update** button stays at the foot of the sidebar. Settings,
Updates has the version and a "Check for updates" button. The megaphone at the foot of the
sidebar opens everything published, with a dot when something is unread.

## The pieces

| Piece | Where | What it does |
|---|---|---|
| Update check | relay, `GET /v1/app/update/{target}/{arch}/{version}` | Answers one computer: the newest build for its platform, or nothing |
| News | relay, `GET /v1/app/news` | The posts every copy of the app reads, every half hour |
| Publishing | `lokus release`, `lokus news` | Checks, then tells the relay. Needs `LOKUS_PUBLISH_KEY` |
| The app's side | `apps/desktop/src/updates.rs`, `ui/src/features/updates/` | Check, download, verify, install, restart |
| Signing key | outside the repo | Every update file is signed with it; the app refuses anything that is not |

The build files themselves can live anywhere with an https address (a GitHub pre-release, a
bucket). The relay only stores where they are and their signatures.

## The three things that must be set

| What | Where | Note |
|---|---|---|
| `LOKUS_PUBLISH_KEY` | the relay's environment, 24 characters or more | Without it nothing can be published |
| `VITE_LOKUS_UPDATES` | set when the app is built | The relay's address. Falls back to `VITE_LOKUS_RELAY`. A build with neither does not check for updates |
| The signing key | `TAURI_SIGNING_PRIVATE_KEY` when building a release | Its public half is in `apps/desktop/tauri.conf.json` |

**The signing key cannot be replaced.** Copies already installed trust only this key. If it is
lost, they can never be updated again and everyone has to download Lokus by hand. Keep it in a
password manager and in the CI secrets, nowhere else.

## Publishing a version

**A version goes out when a pull request is merged into `main`.** Nobody runs anything.

1. In the pull request, change the one line in the file `VERSION` (say to `2.0.1`).
2. Add `news/2-0-1.md` if there is something to tell people (see below).
3. Merge it. `.github/workflows/release.yml` builds both kinds of Mac (signed and notarized),
   a Windows installer and a Linux AppImage (`deploy/release/desktop.sh`; no certificate, only
   our update signature), puts the files on a GitHub pre-release, posts the news, and tells
   installed copies. The Windows installer and the AppImage are installed and opened on the
   machine that built them first; if one platform fails to build or does not stay open,
   nothing is put out.

A merge that leaves `VERSION` alone releases nothing. Who can release is who can merge into
`main`. The keys are in the repository's `release` environment, which only a run on `main` can
use, so a workflow on another branch or in a fork's pull request cannot read them.

It is always a PRE-release, never "latest": Lokus 1 updates itself from this repository's
"latest" release.

### By hand, from a Mac (if the pipeline is down)

```sh
#    Once per Mac: xcrun notarytool store-credentials lokus --key … --key-id … --issuer …
sh deploy/release/mac.sh 2.0.1 https://relay.lokusmd.com            # Apple Silicon
sh deploy/release/mac.sh 2.0.1 https://relay.lokusmd.com x86_64     # Intel
gh release create v2.0.1 --prerelease --latest=false --target main dist-release/2.0.1/Lokus_*
lokus news file=news/2-0-1.md server=https://relay.lokusmd.com
lokus release version=2.0.1 server=https://relay.lokusmd.com \
  darwin-aarch64=https://…/Lokus_aarch64.app.tar.gz \
  darwin-x86_64=https://…/Lokus_x86_64.app.tar.gz
```

`lokus release` refuses to publish when:

- a file cannot be downloaded from the address given, or its signature was not made with our key
- the signature does not say which version it was signed for (the app refuses those)
- the release has no build for a platform the release before it had (pass `partial=true` only
  if that is meant)

A release that turns out to be bad: `lokus release.pull version=2.0.1 server=…`. Nobody is
offered it from then on. Copies that already took it stay on it until the next version.

A version with a label (`2.1.0-beta.1`) goes only to people already on a labelled version.

## Writing news

A post is a markdown file in `news/`. The file's name is its id; publishing the same file again
corrects the post already out.

```markdown
---
title: Tasks that fill themselves in
summary: One or two sentences. This is also what the update pop-up says.
version: 2.0.1          # leave out for an announcement that is not about a version
video: https://…        # an .mp4, or a YouTube or Loom link
image: https://…        # shown when there is no video, and as the small picture in the list
link: https://…         # optional button
link_label: Read more
show: popup             # popup: opens by itself once. quiet: only in the list
---
The longer text, in markdown.
```

A post with a `version` opens by itself for someone the first time they run that version. A
`popup` post without one opens once for everyone, within half an hour. Someone opening Lokus
for the first time ever sees only the newest pop-up, not a queue of old ones.

## Why it is built this way

Lokus 1's updates stopped reaching Mac users. Its release wrote one file listing every platform
from whichever build jobs finished; when the Mac job failed, v1.3.0 shipped with no Mac entry
and nothing complained. Its first update address had also stopped answering. So here: each
platform is answered separately, publishing checks every file the way an installed copy would,
and a release that drops a platform is refused.

## Tested (2026-11-13, macOS, Apple Silicon)

Three real builds (2.0.0-alpha.1, .2, .3) served from a relay and a file server on this
computer; alpha.1 installed by hand, then updated twice from inside the app.

| Case | Result |
|---|---|
| First open shows the newest pop-up post with its video | works |
| 1 → 2: pop-up, download, install, Restart now, comes back by itself on 2, opens that version's post | works |
| 2 → 3 through Settings "Check for updates", then Later, then the sidebar button | works |
| A note in the open folder after both updates | unchanged |
| Download altered after signing | refused, plain message, stays on its version |
| An old genuine build relabelled as a newer version | refused |
| Release pulled | no longer offered |
| Relay unreachable | "could not reach the update server" when asked by hand; silent otherwise |
| Publishing with a wrong key, an unsigned file, or a missing platform | each refused |

## Tested over the internet (2026-11-14, the first public release)

2.0.0-alpha.2, published as a GitHub pre-release and offered by `relay.lokusmd.com`. A copy at
2.0.0-alpha.1, asking the production relay:

| Step | Result |
|---|---|
| Asked the relay, was offered alpha.2 with its "what's new" | works |
| Update now: downloaded the file from GitHub, checked its signature and version | works |
| What was left on disk | the notarized alpha.2 app, accepted by macOS |
| Restart now | closed and came back by itself as a new process within 6 seconds |
| Intel build | notarized, starts under Rosetta, offered to `darwin-x86_64` |
| Lokus 1's `latest.json` after all of it | still 1.3.0 |

Found on the way, and now checked by `lokus release`: an update file re-signed after
notarizing had lost the version in its signature, and every installed copy would have refused
it.

Windows and Linux: every pull request into `main` (a release), and any other one labelled
`desktop`, starts the real app on a Windows and a Linux machine of GitHub's and uses it alone and in a team against a relay started beside it (notes both ways,
typing, an attachment, rename, delete, the relay going away and coming back, catching up after
being closed) (`checks/desktop-smoke.mjs`, the `desktop` job in `.github/workflows/ci.yml`).
The installer and the AppImage are built and opened by the release itself, before anything is
put out, and by that job only when it is run by hand (Actions, CI, Run workflow): the way to
try a change to `deploy/release/desktop.sh` without releasing. Not tested there: a person's own
Windows or Linux computer, an update from one published version to the next, sign-in through
the browser.

Not tested: a download through a browser on someone else's Mac;
an app sitting in `/Applications` owned by another user.

## Published Windows and Linux builds (2026-11-16)

The [alpha.11 release workflow](https://github.com/lokus-ai/lokus/actions/runs/43810784896)
built all four platforms, installed and opened the Windows installer, and opened the Linux
AppImage before publishing. Both Mac builds were signed and notarized.

A separate [published-update run](https://github.com/lokus-ai/lokus/actions/runs/43815532107)
opened the published alpha.10 builds on Windows and Linux and used their in-app update flow.
Windows reopened automatically after Update now; Linux used Restart now. Both verified that a
new process opened showing alpha.11. Windows also reported
alpha.11 in the installed executable's version; the Linux AppImage hash matched the published
alpha.11 file. This was a one-off check on GitHub runners, not a check every release runs.
It proves that alpha.10-to-alpha.11 update, not publication or update acceptance of alpha.12
or any later version.
