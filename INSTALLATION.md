# 📦 Lokus Installation Guide

## 🍎 macOS Installation

### Download
1. Download `Lokus_1.0.0_aarch64.dmg` from [GitHub Releases](https://github.com/lokus-ai/lokus/releases/tag/v1.0.0)
2. Double-click the DMG file to mount it
3. Drag Lokus to the Applications folder

### ⚠️ Security Notice (First Launch)
If you see "Lokus is damaged and can't be opened" error, this is due to macOS security for unsigned apps.

**Quick Fix:**
1. **Don't click "Move to Trash"** - click "Cancel" instead
2. Open **Terminal** (Applications → Utilities → Terminal)
3. Run this command:
   ```bash
   sudo xattr -rd com.apple.quarantine /Applications/Lokus.app
   ```
4. Enter your password when prompted
5. Now you can launch Lokus normally from Applications

**Alternative Method:**
1. Right-click on Lokus.app in Applications
2. Select "Open" 
3. Click "Open" when prompted about unidentified developer
4. Lokus will launch and remember your choice

### 🔒 Why This Happens
- Lokus v1.0.0 is not code-signed with an Apple Developer certificate
- This is normal for open-source software distributed outside the Mac App Store
- Future releases will include proper code signing for seamless installation

## 🚀 First Launch
1. Create your first document with `⌘ + N`
2. Explore the plugin system in the sidebar
3. Try wiki links: type `[[` and see autocomplete
4. Add math equations: `$E = mc^2$`
5. Customize themes in Preferences

## 💬 Need Help?
- [GitHub Issues](https://github.com/lokus-ai/lokus/issues) - Report bugs or ask questions
- [Discussions](https://github.com/lokus-ai/lokus/discussions) - Community help

---

*Lokus v1.0.0 - Modern Knowledge Management Platform*