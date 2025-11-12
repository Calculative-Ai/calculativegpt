# AppSail Intelligence Backend

FastAPI-based intelligence service that powers the TimeCopilot demo dashboard on Zoho Catalyst AppSail. Upload a CSV, ask the TimeCopilot agent a question, and receive forecasts plus narrative analysis—entirely on Catalyst infrastructure.

## Capabilities

- `GET /healthz` — lightweight health check consumed by the web client.
- `POST /analyze` — accepts a time series CSV (`unique_id`, `ds`, `y`), optional frequency/horizon/seasonality parameters, and a natural-language query. Runs `timecopilot.TimeCopilot.analyze` and returns:
  - Agent output (selected model, reasoning, user-query response, analysis)
  - Preview of forecasts/features/evaluation/anomaly tables (configurable length)
  - Raw JSON payload for downstream consumers
- Structured logging with dynamic log level (`APP_LOG_LEVEL`).
- CORS configurable via `API_CORS_ALLOW_ORIGINS`.

## Required Environment

Set these environment variables in the AppSail configuration (avoid committing secrets):

| Variable                | Purpose                                                  |
|-------------------------|----------------------------------------------------------|
| `OPENAI_API_KEY`        | LLM credentials used by TimeCopilot (or vendor specific) |
| `TIME_COPILOT_LLM`      | LLM alias (default `openai:gpt-4o-mini`)                 |
| `TIME_COPILOT_RETRIES`  | Retry attempts for agent calls (default `3`)             |
| `API_CORS_ALLOW_ORIGINS`| Comma-separated origins for the web client               |
| `RESPONSE_PREVIEW_LIMIT`| Rows returned for preview tables (default `100`)         |
| `APP_LOG_LEVEL`         | Logging verbosity (`INFO`, `DEBUG`, etc.)                |

## Deployment Workflow

1. **Install dependencies (automatic)**
   - `app-config.json` predeploy command vendors requirements (`fastapi`, `uvicorn`, `timecopilot`, `pandas`, etc.) into the AppSail bundle.

2. **Deploy**
   ```bash
   catalyst deploy --only appsail
   ```
   AppSail executes `sh start.sh`, which bootstraps `uvicorn` bound to the Catalyst-provided port.

3. **Validate**
   - Open the AppSail invocation URL → `GET /healthz` should return `{"status":"ok","service":"calculativegpt01"}`
   - Use the web client dashboard to run an “Analyze with TimeCopilot” workflow (upload CSV + question).

No local run is necessary—the entire pipeline executes inside Zoho Catalyst. Make sure your LLM credentials and dataset sizes align with the selected environment resources (current memory allocation: 1024 MB).
