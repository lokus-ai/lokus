---
title: The assistant works with an OpenAI key again
summary: Questions asked with your own OpenAI key failed on the newest models. They answer now, and the model list shows the newest ones first.
version: 2.0.0-alpha.9
show: quiet
---
**Fixed**

- **The assistant answers with an OpenAI key.** OpenAI's newest models refused every question that used a tool; they are now asked the way OpenAI requires
- Your model stays chosen when you move between a ChatGPT plan and your own key
- With an OpenAI key the model list is newest first, without speech, picture and embedding models. Any name can still be typed
- A ChatGPT plan with no model chosen takes the one the plan recommends
