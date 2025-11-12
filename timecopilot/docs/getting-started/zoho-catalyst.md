---
title: Deploying to Zoho Catalyst
status: stable
---

# Deploying to Zoho Catalyst

This guide walks through deploying the TimeCopilot demo stack (Flask backend + static web client) directly to Zoho Catalyst without running anything locally.

## Prerequisites

- [Catalyst CLI](https://www.zoho.com/catalyst/help/cli/installation.html) logged into the correct profile.
- Zoho Catalyst project already created (referenced as `calculativegpt01` in examples below).
- Repository cloned to your machine or a build runner that can execute `catalyst deploy`.

## Backend (AppSail) Deployment

**Location:** `timecopilot/appsail-python`

1. **Inspect configuration**  
  `app-config.json` is already tuned for production:
  - `command: "sh start.sh"` launches `uvicorn app:app` inside AppSail.
  - `scripts.predeploy` vendors dependencies (`fastapi`, `uvicorn`, `timecopilot`, `pandas`, etc.) into the bundle via `python3 -m pip … --target .` with a `python` fallback.
  - `memory` is set to `1024` MB to accommodate the TimeCopilot stack.
  - Env defaults include `TIME_COPILOT_LLM`, `TIME_COPILOT_RETRIES`, `API_CORS_ALLOW_ORIGINS`, `RESPONSE_PREVIEW_LIMIT`, and `APP_LOG_LEVEL`.  
    👉 Remember to add `OPENAI_API_KEY` (or your preferred LLM vendor keys) in the AppSail console before deploying.

2. **Deploy**
   ```bash
   catalyst deploy --only appsail
   ```

3. **Verify**
   - Open the AppSail invocation URL from the Catalyst console.
   - Hit `/healthz` for a quick status check (`{"status": "ok"}`).
   - Inspect logs via **Serverless → AppSail → Logs** if needed.

> ℹ️ Local execution is optional. Uvicorn listens on the Catalyst-provided port via `X_ZOHO_CATALYST_LISTEN_PORT`.

## Web Client Hosting Deployment

**Location:** `timecopilot/client`

Contents:

- `index.html` – Interactive dashboard (health, API console, CSV upload/analyze form).
- `main.css`, `main.js` – Styling + logic to call the AppSail intelligence API.
- `client-package.json` – Informs Catalyst where to route (`index.html` as homepage).

### Deploy via UI

1. Visit **Cloud Scale → Web Client Hosting** in the Catalyst console.
2. Select **Update App** and upload a zip containing the four files above (they can live at the root of the archive).
3. Once processed, open the generated client URL to verify the build.

### Deploy via CLI

1. Zip the client folder:
   ```bash
   cd timecopilot/client
   zip ../client-bundle.zip index.html main.css main.js client-package.json
   ```
2. Upload:
   ```bash
   catalyst deploy --only webapp --file ../client-bundle.zip
   ```

> ✅ The `client-package.json` ensures Catalyst serves `index.html` for the base route. You can expand it with additional routing rules if you add more pages.

## End-to-End Checklist

- [ ] `catalyst deploy --only appsail` completes without errors.
- [ ] `/healthz` returns `{"status":"ok","service":"calculativegpt01"}`.
- [ ] Web client is accessible via the Catalyst hosting URL.
- [ ] Uploading a CSV + query from the dashboard returns an agent response.

With these steps, any contributor can deploy the project straight to Zoho Catalyst in minutes—no local runtime required.

