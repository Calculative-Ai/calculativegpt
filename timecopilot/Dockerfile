FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    CMDSTANPY_FORCE_DOWNLOAD=1

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential wget unzip && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN pip install --no-cache-dir -e .

EXPOSE 8000

CMD ["uvicorn", "timecopilot.service.api:app", "--host", "0.0.0.0", "--port", "8000"]

