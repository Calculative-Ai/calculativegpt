import logging
import os
import sys
from io import BytesIO, StringIO
from pathlib import Path
from typing import Any, Dict, Tuple

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from timecopilot import TimeCopilot  # noqa: E402

LOGGER = logging.getLogger("appsail")


def configure_logging() -> None:
    log_level = os.getenv("APP_LOG_LEVEL", "INFO").upper()
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )


def get_listen_address() -> Tuple[str, int]:
    port = int(os.getenv("X_ZOHO_CATALYST_LISTEN_PORT", os.getenv("PORT", "9000")))
    return "0.0.0.0", port


def _create_agent() -> TimeCopilot:
    model = os.getenv("TIME_COPILOT_LLM", "openai:gpt-4o-mini")
    retries = int(os.getenv("TIME_COPILOT_RETRIES", "3"))
    LOGGER.info("Initializing TimeCopilot agent", extra={"model": model, "retries": retries})
    return TimeCopilot(llm=model, retries=retries)


def _validate_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    required_columns = {"unique_id", "ds", "y"}
    if not required_columns.issubset(df.columns):
        missing = required_columns - set(df.columns)
        raise HTTPException(
            status_code=400,
            detail=f"CSV must include columns: {', '.join(sorted(required_columns))}. Missing: {', '.join(sorted(missing))}",
        )

    df = df.copy()
    try:
        df["ds"] = pd.to_datetime(df["ds"])
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Column 'ds' must contain valid datetime values.") from exc

    df["y"] = pd.to_numeric(df["y"], errors="coerce")
    if df["y"].isna().any():
        raise HTTPException(status_code=400, detail="Column 'y' contains non-numeric values.")

    return df


def _serialize_dataframe(df: pd.DataFrame | None) -> list[dict[str, Any]] | None:
    if df is None:
        return None
    preview_limit = int(os.getenv("RESPONSE_PREVIEW_LIMIT", "100"))
    return df.head(preview_limit).to_dict(orient="records")


def create_app() -> FastAPI:
    configure_logging()

    app = FastAPI(
        title="TimeCopilot Intelligence API",
        description="Upload a CSV, ask a question, and receive intelligent forecasts + analysis.",
        version="1.0.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=os.getenv("API_CORS_ALLOW_ORIGINS", "*").split(","),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/healthz", response_model=dict[str, str])
    async def healthcheck() -> dict[str, str]:
        return {"status": "ok", "service": "calculativegpt01"}

    @app.post("/analyze")
    async def analyze(
        file: UploadFile = File(...),
        freq: str | None = None,
        horizon: int | None = None,
        seasonality: int | None = None,
        query: str | None = None,
    ) -> JSONResponse:
        if not file.filename or not file.filename.lower().endswith(".csv"):
            raise HTTPException(status_code=400, detail="Only CSV files are supported.")

        try:
            contents = await file.read()
            try:
                text_stream = StringIO(contents.decode())
                df = pd.read_csv(text_stream)
            except UnicodeDecodeError:
                df = pd.read_csv(BytesIO(contents))
        except Exception as exc:  # noqa: BLE001
            LOGGER.exception("Failed to read CSV", extra={"filename": file.filename})
            raise HTTPException(status_code=400, detail="Unable to read uploaded CSV file.") from exc

        df = _validate_dataframe(df)
        agent = _create_agent()

        try:
            result = agent.analyze(
                df=df,
                freq=freq,
                h=horizon,
                seasonality=seasonality,
                query=query,
            )
        except Exception as exc:  # noqa: BLE001
            LOGGER.exception("TimeCopilot analyze failed")
            raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}") from exc

        payload: Dict[str, Any] = {
            "output": result.output.model_dump(),
            "forecast": _serialize_dataframe(getattr(result, "fcst_df", None)),
            "features": _serialize_dataframe(getattr(result, "features_df", None)),
            "evaluation": _serialize_dataframe(getattr(result, "eval_df", None)),
            "anomalies": _serialize_dataframe(getattr(result, "anomalies_df", None)),
        }

        return JSONResponse(content=payload)

    return app


app = create_app()


def main() -> None:
    host, port = get_listen_address()
    LOGGER.info("Starting Uvicorn server", extra={"host": host, "port": port})
    import uvicorn

    uvicorn.run(app, host=host, port=port, log_level=logging.getLevelName(logging.getLogger().level).lower())


if __name__ == "__main__":
    main()
