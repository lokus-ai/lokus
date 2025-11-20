# Platform Listing Guide for Lokus

This guide provides a comprehensive action plan for listing Lokus on major platforms to increase visibility and user discovery.

---

## 📋 Quick Action Checklist

### Phase 1: Immediate Actions (Week 1-2)
- [ ] Add GitHub topics to repository
- [ ] Submit to AlternativeTo
- [ ] Submit to OpenAlternative.co
- [ ] Submit to OpenSourceAlternative.to
- [ ] Submit to 5+ Awesome Lists on GitHub
- [ ] List on NoteApps.info
- [ ] Create WinGet package manifest
- [ ] Engage with communities (Reddit, Discord, Twitter)

### Phase 2: Launch Week (Week 3-4)
- [ ] Product Hunt launch (Tuesday-Thursday, 12:01 AM PT)
- [ ] Hacker News Show HN post
- [ ] Reddit posts (r/opensource, r/SideProject, r/PKMS)
- [ ] Dev.to announcement article
- [ ] Twitter/X announcement thread
- [ ] IndieHackers post

### Phase 3: Distribution (Week 4-6)
- [ ] Submit to WinGet (Windows)
- [ ] Create Homebrew tap (macOS)
- [ ] Package for Flathub (Linux)
- [ ] Submit to AUR (Arch Linux)
- [ ] Create AppImage build
- [ ] Submit to SourceForge

### Phase 4: Ongoing (Month 2+)
- [ ] BetaList submission
- [ ] Softpedia submission
- [ ] YouTube demo video
- [ ] LinkedIn announcement
- [ ] Snapcraft package

---

## 🎯 High Priority Platforms (Do These First!)

### 1. GitHub Topics
**Why:** Instant visibility, zero effort
**Time:** 5 minutes
**Impact:** High

**Action:**
```bash
# Go to: https://github.com/lokus-ai/lokus
# Click "About" settings (gear icon)
# Add these topics:
```

Recommended topics:
- `knowledge-management`
- `note-taking`
- `note-taking-app`
- `notes-app`
- `tauri`
- `desktop-app`
- `markdown`
- `pkm`
- `second-brain`
- `obsidian-alternative`
- `notion-alternative`
- `local-first`
- `rust`
- `react`
- `tiptap`

### 2. AlternativeTo
**URL:** https://alternativeto.net
**Time:** 15 minutes
**Impact:** Very High (people actively search for alternatives)

**Submission Details:**
- **Category:** Productivity Software > Note Taking
- **Position as alternative to:** Notion, Obsidian, Evernote, OneNote, Roam Research
- **Platform:** Windows, Mac, Linux
- **License:** MIT (Open Source)
- **Tagline:** "Local-first markdown note-taking app with database views and AI integration"

**Key Features to Highlight:**
- Database views like Notion
- 3D/2D knowledge graphs
- AI integration (MCP server)
- 100x faster search
- Obsidian compatible
- Local-first, no cloud required
- 10MB app size vs 100MB alternatives

### 3. OpenAlternative.co & OpenSourceAlternative.to
**URLs:**
- https://openalternative.co
- https://www.opensourcealternative.to

**Time:** 10 minutes each
**Impact:** High (open source focused audience)

**Action:** Check submission process on each site (may require PR to their GitHub repo)

### 4. Awesome Lists (GitHub)
**Time:** 1-2 hours total
**Impact:** High (targeted developer audience)

**Target Lists:**
1. **awesome-knowledge-management**
   - Repo: https://github.com/brettkromkamp/awesome-knowledge-management
   - Fork → Add Lokus → Submit PR

2. **awesome-note-taking**
   - Repo: https://github.com/tehtbl/awesome-note-taking
   - Fork → Add Lokus → Submit PR

3. **Awesome-desktop-notes**
   - Repo: https://github.com/arkydon/Awesome-desktop-notes
   - Fork → Add Lokus → Submit PR

4. **best-foss-alternatives**
   - Repo: https://github.com/geraldohomero/best-foss-alternatives
   - Fork → Add Lokus → Submit PR

**PR Template:**
```markdown
## Lokus

**Description:** Local-first markdown note-taking app with database views, 3D knowledge graphs, and AI integration. Built with Rust + React.

**Key Features:**
- Database views (like Notion) built-in
- Interactive 2D/3D knowledge graphs
- AI integration (MCP server with 68+ tools)
- 100x faster search (Quantum architecture)
- Obsidian compatible
- 10MB app size, <1s startup time

**Links:**
- GitHub: https://github.com/lokus-ai/lokus
- Download: https://github.com/lokus-ai/lokus/releases
- License: MIT
```

### 5. NoteApps.info
**URL:** https://noteapps.info
**Time:** 15 minutes
**Impact:** Medium-High (niche-specific)

**Action:** Contact via their submission process or GitHub if available

---

## 🚀 Launch Platforms (Coordinate These)

### Product Hunt
**URL:** https://www.producthunt.com/launch
**Best Day:** Tuesday-Thursday
**Best Time:** 12:01 AM Pacific Time

**Preparation (3 weeks before):**
1. Create Product Hunt account
2. Engage with community (upvote, comment on other products)
3. Build following
4. Create "Coming Soon" page

**Launch Day Materials:**
- **Tagline** (60 chars max): "Local-first note-taking with database views & AI"
- **Description** (260 chars max): "Lokus is a blazing-fast note-taking app with Notion-style database views, 3D knowledge graphs, and AI integration. Built with Rust + React. Obsidian compatible. All data stays on your device. 10MB app, 100x faster search."
- **First Comment:** Explain why you built it, what problem it solves
- **Media:**
  - Gallery: 3-5 screenshots from `assets/screenshots/`
  - Demo video: 30-60 seconds (HIGHLY RECOMMENDED)
  - Thumbnail: Eye-catching main screenshot

**Tips:**
- Don't use marketing speak ("revolutionary", "game-changing")
- Be modest and honest
- Respond to ALL comments quickly
- Have team/friends ready to engage
- Link to GitHub for open source credibility

### Hacker News (Show HN)
**URL:** https://news.ycombinator.com/showhn.html
**Best Day:** Same day as Product Hunt OR Tuesday-Wednesday

**Title Format:**
```
Show HN: Lokus – Open-source note-taking app with database views
```

**Submission:**
- URL: https://github.com/lokus-ai/lokus (OR your website if you have one)
- First comment: Brief context about why you built it, tech stack, what makes it different

**Guidelines:**
- Link directly to something people can try (GitHub, download page)
- No marketing language - technical and factual
- Be ready to answer technical questions
- Expect critical but insightful feedback
- Engage with comments for first 2-3 hours

### Reddit
**Subreddits to Target:**

1. **r/opensource** (~38k members)
   - Title: "I built Lokus - an open-source alternative to Notion/Obsidian with database views and AI integration"
   - Link to GitHub + screenshots

2. **r/SideProject**
   - Title: "Built a local-first note-taking app with database views (like Notion) - all open source"
   - Focus on the journey/technical challenges

3. **r/PKMS** (Personal Knowledge Management)
   - Title: "Lokus: Local-first PKM with database views, 3D graphs, and AI tools"
   - Highlight PKM-specific features

4. **r/ObsidianMD**
   - Title: "Built an Obsidian-compatible app with built-in database views (no plugins needed)"
   - Emphasize compatibility

**Reddit Tips:**
- Check each subreddit's rules about self-promotion
- Engage with commenters
- Don't post to all subs on same day (spread over 1 week)
- Be genuine, share learnings
- Respond to feedback professionally

---

## 📦 Package Managers (Critical for Distribution)

### WinGet (Windows)
**Guide:** https://github.com/microsoft/winget-pkgs
**Priority:** Critical

**Steps:**
1. Install `wingetcreate` tool
2. Generate manifest:
   ```bash
   wingetcreate new https://github.com/lokus-ai/lokus/releases/latest/download/lokus_setup.exe
   ```
3. Fork microsoft/winget-pkgs
4. Create manifest in manifests/l/LokusAI/Lokus/
5. Submit PR
6. Wait for automated validation + manual review (~1-2 weeks)

**Required Info:**
- Package identifier: LokusAI.Lokus
- Publisher: LokusAI
- Download URL: Direct link to .exe/.msi from GitHub releases
- License: MIT
- Short description, tags

### Homebrew (macOS)
**Priority:** Critical

**Option 1: Create a Tap (Recommended)**
```bash
# Create a new repo: homebrew-lokus
# Add Formula/lokus.rb:

class Lokus < Formula
  desc "Local-first markdown note-taking app with database views"
  homepage "https://github.com/lokus-ai/lokus"
  url "https://github.com/lokus-ai/lokus/releases/download/v1.3.3/lokus-macos.dmg"
  sha256 "CALCULATE_THIS"
  license "MIT"

  def install
    prefix.install Dir["*"]
  end

  test do
    system "#{bin}/lokus", "--version"
  end
end
```

**Users install with:**
```bash
brew install lokus-ai/lokus/lokus
```

**Option 2: Submit to homebrew-cask** (for GUI apps)
- More exposure but stricter requirements
- See: https://github.com/Homebrew/homebrew-cask/blob/master/CONTRIBUTING.md

### Flathub (Linux)
**Guide:** https://v2.tauri.app/distribute/flatpak/
**Priority:** High

**Steps:**
1. Create Flatpak manifest (see Tauri docs)
2. Test build locally
3. Submit to Flathub repository
4. Pass review process

**Note:** Technically involved but well-documented for Tauri apps

### AUR (Arch Linux)
**Guide:** https://v2.tauri.app/distribute/aur/
**Priority:** Medium-High

**Steps:**
1. Create PKGBUILD file
2. Test installation
3. Publish to AUR

**PKGBUILD Template:**
```bash
# See Tauri AUR distribution guide for details
pkgname=lokus
pkgver=1.3.3
pkgrel=1
pkgdesc="Local-first markdown note-taking app with database views"
arch=('x86_64')
url="https://github.com/lokus-ai/lokus"
license=('MIT')
# ... rest of PKGBUILD
```

---

## 📝 Submission Materials

### Elevator Pitch (30 words)
"Lokus is a local-first note-taking app combining Notion's database views with Obsidian's simplicity. Built with Rust, it's 100x faster, 90% smaller, and works offline. Open source and free."

### Short Description (100 words)
"Lokus is a next-generation note-taking app for developers, writers, and knowledge workers. It combines Notion-style database views with Obsidian's local-first approach. Features include interactive 2D/3D knowledge graphs, AI integration via MCP server (68+ tools), lightning-fast search (100x faster than alternatives), and full Obsidian compatibility. Built with Rust + React, Lokus is 90% smaller (10MB vs 100MB) and starts in under 1 second. All data stays on your device with no vendor lock-in. Open source (MIT license) and completely free."

### Taglines (Pick based on platform)
- "Local-first note-taking with database views & AI" (Product Hunt)
- "Open-source alternative to Notion and Obsidian" (AlternativeTo)
- "Knowledge management for developers who value speed and privacy" (Hacker News)
- "Notion's databases + Obsidian's local-first approach" (Reddit)

### Key Differentiators
1. **Built-in database views** (no plugins needed)
2. **100x faster search** (Quantum architecture)
3. **10MB app size** (vs 100MB alternatives)
4. **Local-first** (all data on your device)
5. **Obsidian compatible** (point at existing vault)
6. **AI integration** (native MCP server)
7. **Free & open source** (MIT license)
8. **Cross-platform** (Windows, Mac, Linux)

### Feature Highlights
- Rich markdown editor with TipTap
- Database views with 8 property types
- Interactive 2D/3D knowledge graphs
- AI integration (68+ tools via MCP)
- Quantum search architecture
- LaTeX math support
- Wiki links with autocomplete
- Canvas & Kanban boards
- Theme system
- Gmail integration
- Plugin system

---

## 🎬 Demo Video Script (60 seconds)

**0-10s:** Show app opening instantly, beautiful UI
**10-20s:** Quick note creation with markdown formatting
**20-30s:** Transform notes into database view, show filtering/sorting
**30-40s:** Open 3D knowledge graph, navigate between notes
**40-50s:** Search demonstration showing speed
**50-60s:** Show AI integration, end with tagline

**Tools to create video:**
- Screen recording: OBS Studio, QuickTime (Mac), Windows Game Bar
- Editing: DaVinci Resolve (free), iMovie, CapCut
- Add captions for accessibility

---

## 📊 Success Metrics to Track

Create a simple spreadsheet to track:
- GitHub stars (daily)
- Download counts by platform
- Website visitors (if you add analytics)
- Reddit/HN upvotes and comments
- Product Hunt ranking
- Package manager installations (WinGet, Homebrew)
- Community members (Discord, Reddit)

**Tools:**
- GitHub Insights (built-in)
- Google Analytics (if you have a website)
- Plausible Analytics (privacy-friendly alternative)

---

## 🗓️ Recommended Timeline

### Week 1: Preparation
- [ ] Add GitHub topics
- [ ] Create demo video (optional but highly recommended)
- [ ] Submit to Awesome Lists
- [ ] List on AlternativeTo, OpenAlternative
- [ ] Engage with communities (no promotion, just participate)

### Week 2: Community Building
- [ ] Submit to NoteApps.info
- [ ] Create WinGet manifest (start PR process)
- [ ] Set up Homebrew tap
- [ ] Join relevant Discord servers
- [ ] Build Twitter/X following

### Week 3: Launch Preparation
- [ ] Create Product Hunt account, engage with community
- [ ] Write Dev.to article draft
- [ ] Prepare Reddit posts
- [ ] Schedule launch day (Tuesday-Thursday)
- [ ] Notify any existing users/followers

### Week 4: Launch Week! 🚀
- [ ] **Tuesday 12:01 AM PT:** Launch on Product Hunt
- [ ] **Tuesday 9 AM:** Post to Hacker News
- [ ] **Tuesday afternoon:** Reddit posts (r/opensource, r/SideProject)
- [ ] **Wednesday:** Post to r/PKMS, r/ObsidianMD
- [ ] **Thursday:** Dev.to article, IndieHackers post
- [ ] **Throughout week:** Respond to ALL comments/questions

### Weeks 5-8: Distribution
- [ ] Monitor WinGet PR, address feedback
- [ ] Create Flathub package
- [ ] Submit to AUR
- [ ] Create AppImage
- [ ] Submit to SourceForge
- [ ] Create Snap package
- [ ] Follow up on all submissions

---

## 💡 Pro Tips

### Do's ✅
- Be honest and humble
- Respond to feedback quickly
- Show, don't tell (use GIFs/videos)
- Highlight what makes you different
- Be active on GitHub (shows project is alive)
- Credit inspirations (Obsidian, Notion)
- Make it easy to try (clear download links)
- Use consistent branding across platforms

### Don'ts ❌
- Don't use marketing hyperbole
- Don't ignore negative feedback
- Don't spam multiple platforms same day
- Don't ask for upvotes/stars directly
- Don't be defensive about criticism
- Don't overpromise features
- Don't neglect to respond to issues/questions

---

## 📚 Resources

### Design Assets Needed
- [ ] Logo (vector + PNG)
- [ ] App icon (various sizes)
- [ ] Screenshots (5-10 key features)
- [ ] Demo video (30-60 seconds)
- [ ] Banner image (for social sharing)
- [ ] GIFs showing key features

### Copy/Paste Templates
Save these for quick submissions:

**Short tagline:** "Local-first note-taking with database views & AI"

**One-liner:** "Lokus combines Notion's database views with Obsidian's local-first approach in a blazing-fast, open-source app."

**Technical stack:** "Built with React, TipTap, Rust, Tauri, Three.js, and TLDraw"

**License:** "MIT (Open Source)"

**Links:**
- GitHub: https://github.com/lokus-ai/lokus
- Releases: https://github.com/lokus-ai/lokus/releases
- Issues: https://github.com/lokus-ai/lokus/issues
- Discussions: https://github.com/lokus-ai/lokus/discussions

---

## 🎯 Next Steps

1. **Start with GitHub topics** (5 minutes, instant impact)
2. **Submit to AlternativeTo** (15 minutes, high ROI)
3. **Fork and PR to Awesome Lists** (1-2 hours, targeted audience)
4. **Create WinGet package** (enables easy Windows installation)
5. **Plan Product Hunt launch** (2-3 weeks out)

**Remember:** Quality over quantity. Better to do 5 platforms really well than 20 platforms poorly.

---

## 📞 Getting Help

If you get stuck or have questions:
- Tauri Discord: Ask about packaging/distribution
- Product Hunt Ship: Practice before launch
- IndieHackers: Get feedback from other makers
- Reddit r/SideProject: Share your journey

Good luck with the launch! 🚀
