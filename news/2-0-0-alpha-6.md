---
title: Sync that starts every time
summary: Lokus sometimes sat at "Connecting" after it was reopened and never synced. That is fixed.
version: 2.0.0-alpha.6
show: quiet
---
**Fixed**

- **Stuck at "Connecting".** After reopening Lokus, or after an update, sync could fail to start and stay at "Connecting" for good. It now connects every time
- If a connection ever does stall, Lokus gives up after 20 seconds and tries again by itself
