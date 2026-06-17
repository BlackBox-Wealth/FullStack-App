FROM python:3.11-slim

WORKDIR /app

# 🔧 Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Run seed at startup (environment vars will be available then)
CMD sh -c "python -m app.seed && uvicorn app.app:app --host 0.0.0.0"
