import io
import os
from typing import Any

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from timecopilot import TimeCopilot


def _get_llm_model() -> str:
    return os.environ.get("TIME_COPILOT_LLM", "openai:gpt-4o-mini")


def _get_retries() -> int:
    try:
        return int(os.environ.get("TIME_COPILOT_RETRIES", "3"))
    except ValueError:
        return 3


def _create_agent() -> TimeCopilot:
    return TimeCopilot(llm=_get_llm_model(), retries=_get_retries())


app = FastAPI(title="TimeCopilot Forecast API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("API_CORS_ALLOW_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


def _validate_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    required_columns = {"unique_id", "ds", "y"}
    if not required_columns.issubset(df.columns):
        missing = required_columns - set(df.columns)
        raise HTTPException(
            status_code=400,
            detail=f"CSV must include columns: {', '.join(required_columns)}. Missing: {', '.join(missing)}",
        )

    df = df.copy()
    try:
        df["ds"] = pd.to_datetime(df["ds"])
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Column 'ds' must contain valid datetime values.") from exc

    try:
        df["y"] = pd.to_numeric(df["y"], errors="coerce")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Column 'y' must contain numeric values.") from exc

    if df["y"].isna().any():
        raise HTTPException(status_code=400, detail="Column 'y' contains non-numeric values.")

    return df


def _serialize_dataframe(df: pd.DataFrame | None) -> list[dict[str, Any]] | None:
    if df is None:
        return None
    return df.to_dict(orient="records")


@app.post("/forecast")
async def forecast(  # noqa: PLR0913
    file: UploadFile = File(...),
    freq: str | None = None,
    horizon: int | None = None,
    seasonality: int | None = None,
    query: str | None = None,
) -> dict[str, Any]:
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as exc:  # noqa: BLE001
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
        raise HTTPException(status_code=500, detail=f"Forecast failed: {exc}") from exc

    payload: dict[str, Any] = {
        "output": result.output.model_dump(),
        "forecast": _serialize_dataframe(getattr(result, "fcst_df", None)),
        "features": _serialize_dataframe(getattr(result, "features_df", None)),
        "evaluation": _serialize_dataframe(getattr(result, "eval_df", None)),
        "anomalies": _serialize_dataframe(getattr(result, "anomalies_df", None)),
    }

    return payload


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

