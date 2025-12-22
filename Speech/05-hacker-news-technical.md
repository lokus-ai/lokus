# Lokus Hacker News Technical Demo Script
**Duration:** 2-3 minutes
**Platform:** Linked from Show HN post
**Tone:** Technical, no-BS, developer-to-developer
**Audience:** Hacker News (skeptical developers, open source advocates)

---

## HOOK (0:00 - 0:10)
*[VISUAL: Clean code editor showing Lokus repo structure]*

> "Lokus is a note-taking app built with Tauri, React, and TipTap. Fully open source. Let me show you what makes it different."

---

## ARCHITECTURE (0:10 - 0:35)
*[VISUAL: Code/architecture diagram]*

> "The backend is Rust with Tauri — not Electron. Memory usage sits around fifty megabytes versus the three hundred plus you'd see with Electron apps."

*[VISUAL: Show Activity Monitor / Task Manager comparison if available]*

> "Frontend is React with TipTap for the editor. TipTap gives us ProseMirror under the hood, which means proper collaborative editing primitives if we want them later."

*[VISUAL: Show file system structure]*

> "All notes are plain markdown files. No database. No SQLite. Just files in a folder. Open them in Vim, VS Code, whatever."

---

## THE EDITOR (0:35 - 1:05)
*[VISUAL: Editor with markdown rendering]*

> "The editor does markdown with extensions. Wiki links use double-bracket syntax with fuzzy autocomplete."

*[VISUAL: Type [[note]] and show autocomplete]*

> "Math rendering with KaTeX — both inline and block. Code blocks with Shiki syntax highlighting."

*[VISUAL: Show code block and math equation]*

> "Task lists go beyond checkboxes. We have eighteen states — todo, in-progress, urgent, question, delegated, all the states you actually need for project management."

*[VISUAL: Show task state dropdown]*

---

## TEMPLATE SYSTEM (1:05 - 1:30)
*[VISUAL: Template file with YAML frontmatter]*

> "The template system is probably overkill. Ninety plus features. Variables, conditionals, loops, seventy date operations, sixty text filters."

*[VISUAL: Show template being processed]*

> "Templates are markdown files with YAML frontmatter. Syntax is inspired by Nunjucks. You can do things like 'today plus seven days formatted as MMMM Do'."

*[VISUAL: Show date calculation in action]*

> "There's a sandboxed JavaScript execution environment if you need custom logic. It's isolated — no DOM access, no network."

---

## GRAPH VIEW (1:30 - 1:50)
*[VISUAL: Graph view with nodes and connections]*

> "Graph view uses D3 force simulation. Nodes are color-coded — documents, tags, folders, placeholders for broken links."

*[VISUAL: Interact with graph — drag nodes, zoom]*

> "Performance holds up to a few thousand nodes. Beyond that you'd want virtualization, which is on the roadmap."

---

## WHAT'S COMING (1:50 - 2:10)
*[VISUAL: GitHub issues / roadmap]*

> "We're working on peer-to-peer sync using Iroh — that's the library from n0 Computer. The goal is device-to-device sync without a central server. Still experimental."

*[VISUAL: Abstract network diagram]*

> "Plugin system is next. MCP integration for AI tools. The architecture supports it, just needs the API surface."

---

## CLOSING (2:10 - 2:30)
*[VISUAL: GitHub repo, license file]*

> "It's MIT licensed. The repo is at github.com/lokus-ai/lokus. Issues and PRs are welcome."

*[VISUAL: Show some open issues labeled "good first issue"]*

> "If you want to contribute, there are good first issues tagged. The codebase is documented in CLAUDE.md — yes, we use Claude for development."

*[VISUAL: Download links]*

> "Binaries for Mac, Windows, Linux. Or build from source — it's just 'npm run tauri build'."

---

## PRODUCTION NOTES

### Vibe
- No marketing speak
- Talk like you're explaining to a senior engineer
- Acknowledge limitations honestly
- Don't oversell features that aren't ready

### HN-Specific Rules
- NEVER say "disrupting" or "revolutionary"
- Acknowledge prior art (TipTap, Tauri, D3)
- Be specific about numbers (memory, node count)
- Mention trade-offs and limitations

### What HN Cares About
1. "Why not just use Obsidian?" — address directly
2. Tech stack choices and why
3. Performance characteristics
4. Licensing (MIT is good)
5. Contribution process

### Text Overlays (Minimal)
- Tech stack labels
- Memory/performance numbers
- GitHub URL
- Command: `npm run tauri build`

### Music
- None or very subtle ambient
- HN audience doesn't need music
- Keep it focused on content

### Length
- 2-3 minutes max
- Dense information, no filler
- They'll watch at 2x speed anyway
