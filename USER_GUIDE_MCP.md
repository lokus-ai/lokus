# Lokus MCP Setup - User Guide

## What is MCP?

MCP (Model Context Protocol) lets AI assistants like Desktop and CLI access your Lokus notes to help you with writing, research, and organization.

## Super Simple 3-Step Setup

### Step 1: Start the Server (5 seconds)
1. Open **Lokus**
2. Go to **Preferences** (⌘+, on Mac)
3. Click **"MCP Integration"** in the sidebar
4. Click the big **"Start"** button
5. Wait for the green "Running" indicator

### Step 2: Configure Your AI Apps (5 seconds)
1. Click **"Auto-Configure AI Apps"** button
2. Wait for success message
3. Done! Both Desktop and CLI are now configured

### Step 3: Use Your AI Apps
1. **Restart** Desktop app (completely quit and reopen)
2. **Restart** VS Code if using CLI
3. Your AI assistants can now access your Lokus notes!

## That's It!

No command-line. No editing files. No technical knowledge needed.

---

## Testing Your Setup

### Quick Test in Lokus
1. In the MCP Integration settings
2. Click **"Test Connection"**
3. Should show: ✅ "Server is healthy and responding"

### Test in Desktop
1. Open Desktop app
2. Look for "lokus" in available MCP servers
3. Should show as connected

### Test in CLI
1. Open VS Code
2. Look for "lokus" in available MCP servers
3. Should show as connected

---

## Common Questions

### Does it work for both apps at the same time?
**Yes!** Both Desktop and CLI can use your notes simultaneously.

### Do I need to keep Lokus open?
**Yes.** The MCP server runs inside Lokus, so keep it running while using your AI apps.

### What if I restart my computer?
Just open Lokus and click "Start" again. Takes 5 seconds.

### Can I use a different port?
Yes! Go to Advanced Settings and change the port number if needed.

### What if something goes wrong?
1. Click "Restart" in the MCP Integration settings
2. Try "Test Connection" to diagnose
3. Check the error message for guidance

---

## Troubleshooting

### "Address already in use" error
**Solution:** Another program is using port 3456.
1. Click Advanced Settings
2. Change port to 3457 or 3458
3. Click "Auto-Configure AI Apps" again
4. Restart your AI apps

### AI app doesn't see "lokus" server
**Solution:** Restart required.
1. Completely quit your AI app (Desktop or VS Code)
2. Wait 5 seconds
3. Reopen the app
4. Should now see "lokus" server

### "Server is not responding" in test
**Solution:** Server not running.
1. Check if status shows "Running"
2. If not, click "Start"
3. Wait for green indicator
4. Try test again

---

## What Your AI Can Do With Lokus

Once connected, your AI assistants can:
- **Read your notes** to answer questions
- **Search your notes** to find information
- **Help organize** your knowledge
- **Suggest connections** between notes
- **Draft new content** based on your existing notes

All while keeping your data local and private!

---

## Advanced: Auto-Start (Optional)

Want the server to start automatically when you open Lokus?

1. Go to MCP Integration settings
2. Expand "Advanced Settings"
3. Check "Auto-start with Lokus"
4. Done! Server will start automatically from now on

---

## Need Help?

If you're stuck:
1. Try clicking "Restart" in MCP Integration settings
2. Try "Test Connection" to see if server is working
3. Check the error message - it usually tells you what's wrong
4. Make sure you restarted your AI apps after configuration

---

**Remember:** The MCP Integration settings in Lokus are your control center for everything. All controls are there in one place!
