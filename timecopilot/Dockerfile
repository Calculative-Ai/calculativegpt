FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    CMDSTANPY_FORCE_DOWNLOAD=1 \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential wget unzip && \
    rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --shell /bin/bash appuser && \
    python -m venv /opt/venv && \
    chown -R appuser:appuser /opt/venv

COPY --chown=appuser:appuser requirements.txt .

USER appuser

RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=appuser:appuser . .

RUN pip install --no-cache-dir -e .

EXPOSE 8000

CMD ["uvicorn", "timecopilot.service.api:app", "--host", "0.0.0.0", "--port", "8000"]

