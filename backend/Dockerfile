FROM python:3.11-slim

WORKDIR /app

# System deps for psycopg/bcrypt wheels on slim images.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir "bcrypt==4.0.1"  # pin: newer bcrypt breaks passlib's version probe

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
