---
title: Model Context Explorer static hosting
date: 2026-10-22
---

Run `npm ci`, `npm run typecheck`, `npm test`, then `npm run build`. Publish only `dist/` to a static host when deployment is authorised. Cloudflare Pages can use build command `npm run build` and output directory `dist`; no environment variables, functions, proxy or Google Cloud hosting are required. Hash routes need no rewrite rules.

The app loads without credentials. Open API settings to enter a visitor Gemini API key. It stays in memory, is never persisted by settings, and is cleared on reload or with Clear key. Generation goes directly to Google's Gemini Developer API, using the visitor's quota. Existing conversation history and context inspection remain local and work without a key. Changing or clearing a key aborts active requests and invalidates later stages of the current operation.

No deployment, DNS change, Cloud Run retirement or real provider call was performed. Gemini remains the model provider; browser CORS, model access, search availability and live account errors require later authorised live verification.
