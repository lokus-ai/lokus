# Releasing Lokus, and telling people about it

How a new version reaches the people who already have Lokus, and how news reaches them.
Nothing here depends on an app store.

## What a person sees

1. A pop-up in the corner: "A new version of Lokus is ready", with **Update now**.
2. A progress bar while it downloads. They can keep working.
3. "The update is installed", with **Restart now**. It says Lokus will close and open again by
   itself, and what to do if it does not (open it again; nothing is lost).
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

```sh
# 1. Build with the signed update files. On this Mac (signs, notarizes when credentials are stored):
sh deploy/release/mac.sh 2.0.1 https://relay…
#    Other platforms: the "Release build" workflow, or by hand:
TAURI_SIGNING_PRIVATE_KEY=… VITE_LOKUS_UPDATES=https://relay… \
  pnpm tauri build --config apps/desktop/release.conf.json

# 2. Put the files somewhere with an https address, each with its .sig beside it

# 3. Write what is new (see below) and publish it first, so the pop-up can show it
lokus news file=news/2-0-1.md server=https://relay…

# 4. Publish the version
lokus release version=2.0.1 server=https://relay… \
  darwin-aarch64=https://…/Lokus.app.tar.gz \
  darwin-x86_64=https://…/Lokus_x64.app.tar.gz \
  windows-x86_64=https://…/Lokus_2.0.1_x64-setup.exe \
  linux-x86_64=https://…/Lokus_2.0.1_amd64.AppImage
```

`lokus release` refuses to publish when:

- a file cannot be downloaded from the address given, or its signature was not made with our key
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

Not tested: Windows and Linux; a signed and notarized Mac build downloaded through a browser;
an app sitting in `/Applications` owned by another user; the release workflow in CI.
