# Quick Start: Get Lokus Listed (Do This Today!)

This is your **action plan for the next 2 hours** to get immediate visibility.

---

## ⚡ Immediate Actions (Next 2 Hours)

### 1. Add GitHub Topics (5 minutes) ✅

**Go to:** https://github.com/lokus-ai/lokus

**Click:** "About" section (gear icon on the right side)

**Add these topics:**
```
knowledge-management
note-taking
note-taking-app
notes-app
tauri
desktop-app
markdown
pkm
second-brain
obsidian-alternative
notion-alternative
local-first
rust
react
tiptap
productivity
wiki
knowledge-graph
database
ai-integration
```

**Click:** "Save changes"

**Why this matters:** People browse GitHub topics to discover projects. This is instant, free visibility.

---

### 2. Submit to AlternativeTo (15 minutes) ✅

**Go to:** https://alternativeto.net (create account if needed)

**Click:** "Suggest Application" or similar button

**Fill in:**
- **Name:** Lokus
- **Website:** https://github.com/lokus-ai/lokus
- **Category:** Productivity Software → Note Taking
- **Tagline:** "Local-first markdown note-taking app with database views and AI integration"
- **Description:** Use this:

```
Lokus is a next-generation note-taking app that combines Notion-style database views with Obsidian's local-first approach. Built with Rust and React for maximum performance.

Key Features:
• Database views (like Notion) built-in - no plugins needed
• Interactive 2D/3D knowledge graphs
• AI integration via MCP server (68+ tools)
• 100x faster search with Quantum architecture
• Obsidian compatible - point it at your existing vault
• 10MB app size (vs 100MB alternatives)
• <1 second startup time
• Completely free and open source (MIT license)

All data stays on your device. No cloud required. No vendor lock-in.

Perfect for developers, writers, and knowledge workers who want the power of Notion with the speed and privacy of local-first software.

Cross-platform: Windows, macOS, Linux
```

- **License:** Open Source (MIT)
- **Platforms:** Windows, Mac, Linux
- **Price:** Free
- **Alternatives to:** Notion, Obsidian, Evernote, OneNote, Roam Research

**Upload:** Screenshot from `assets/screenshots/screenshot-1.png`

**Submit!**

**Why this matters:** People actively search "alternatives to Notion" and "alternatives to Obsidian" here. High-intent traffic.

---

### 3. Submit to OpenAlternative.co (10 minutes) ✅

**Go to:** https://openalternative.co

**Look for:** "Submit" or "Add Alternative" button (or check their GitHub repo)

**Use same information as AlternativeTo above**

**Why this matters:** Specifically targets open source enthusiasts.

---

### 4. Create WinGet Package Manifest (30 minutes) ✅

**Prerequisites:**
```bash
# Install wingetcreate (Windows only)
# Or manually create the manifest files
```

**If on Windows:**
```bash
wingetcreate new https://github.com/lokus-ai/lokus/releases/latest/download/Lokus_1.3.3_x64_en-US.msi
```

**If manual creation needed:**
Create folder structure:
```
manifests/
  l/
    LokusAI/
      Lokus/
        1.3.3/
          LokusAI.Lokus.installer.yaml
          LokusAI.Lokus.locale.en-US.yaml
          LokusAI.Lokus.yaml
```

**Files content:**

`LokusAI.Lokus.yaml`:
```yaml
PackageIdentifier: LokusAI.Lokus
PackageVersion: 1.3.3
DefaultLocale: en-US
ManifestType: version
ManifestVersion: 1.6.0
```

`LokusAI.Lokus.installer.yaml`:
```yaml
PackageIdentifier: LokusAI.Lokus
PackageVersion: 1.3.3
Installers:
  - Architecture: x64
    InstallerType: wix
    InstallerUrl: https://github.com/lokus-ai/lokus/releases/download/v1.3.3/Lokus_1.3.3_x64_en-US.msi
    InstallerSha256: [GET THIS BY RUNNING: certutil -hashfile Lokus_1.3.3_x64_en-US.msi SHA256]
ManifestType: installer
ManifestVersion: 1.6.0
```

`LokusAI.Lokus.locale.en-US.yaml`:
```yaml
PackageIdentifier: LokusAI.Lokus
PackageVersion: 1.3.3
PackageLocale: en-US
Publisher: LokusAI
PackageName: Lokus
License: MIT
ShortDescription: Local-first markdown note-taking app with database views and AI integration
Tags:
  - note-taking
  - markdown
  - knowledge-management
  - obsidian
  - notion
  - local-first
  - rust
  - tauri
ManifestType: defaultLocale
ManifestVersion: 1.6.0
```

**Then:**
1. Fork https://github.com/microsoft/winget-pkgs
2. Add your manifest files
3. Submit PR
4. Wait for review (~1-2 weeks)

**Why this matters:** Windows users can install with `winget install LokusAI.Lokus` - huge distribution channel.

---

### 5. Submit to Awesome Lists (45 minutes) ✅

**Target 3-5 lists today:**

#### awesome-knowledge-management
```bash
git clone https://github.com/YOUR_USERNAME/awesome-knowledge-management.git
# (fork it first on GitHub)
```

**Find the right section** (e.g., "Desktop Apps" or "Note Taking")

**Add:**
```markdown
- [Lokus](https://github.com/lokus-ai/lokus) - Local-first markdown note-taking app with database views, 3D knowledge graphs, and AI integration. Built with Rust + React.
```

**Commit and submit PR**

#### Repeat for:
- awesome-note-taking: https://github.com/tehtbl/awesome-note-taking
- Awesome-desktop-notes: https://github.com/arkydon/Awesome-desktop-notes
- best-foss-alternatives: https://github.com/geraldohomero/best-foss-alternatives

**Why this matters:** Developers discover tools through Awesome lists. High-quality, targeted audience.

---

## 📊 After 2 Hours, You'll Have:

- ✅ GitHub topics added (discoverable by thousands browsing topics)
- ✅ Listed on AlternativeTo (people searching for alternatives)
- ✅ Listed on OpenAlternative (open source community)
- ✅ WinGet package in review (Windows users)
- ✅ 3-5 PRs to Awesome Lists (developer audience)

**Estimated reach:** 10,000+ potential users will be able to discover Lokus through these channels.

---

## 🎯 Tomorrow: Community Engagement

After completing the above, engage with communities:

1. **Join Tauri Discord:** https://discord.com/invite/tauri
   - Share in #showcase channel
   - Ask for feedback

2. **Join relevant subreddits:** r/opensource, r/PKMS, r/ObsidianMD
   - Participate in discussions (don't promote yet)
   - Build karma and credibility

3. **Twitter/X:** Share a quick thread about building Lokus
   - Use hashtags: #buildinpublic #opensource #tauri
   - Tag @TauriApps

---

## 📅 Next Week: Launch Preparation

See `PLATFORM_LISTING_GUIDE.md` for the complete launch plan including:
- Product Hunt launch
- Hacker News Show HN
- Reddit announcements
- Dev.to article
- YouTube demo video

---

## ❓ Questions?

- Check the comprehensive guide: `docs/PLATFORM_LISTING_GUIDE.md`
- Need help with WinGet? See: https://github.com/microsoft/winget-pkgs/tree/master/doc
- Need help with Awesome Lists? Check each repo's CONTRIBUTING.md

---

**Let's get Lokus the visibility it deserves! 🚀**
