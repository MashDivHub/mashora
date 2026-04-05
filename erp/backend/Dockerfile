FROM python:3.12-slim

WORKDIR /app

# System dependencies for psycopg2 and lxml
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev libxml2-dev libxslt1-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Mashora core (needed for ORM adapter)
COPY ../../mashora /opt/mashora/mashora
COPY ../../addons /opt/mashora/addons
COPY ../../setup.py /opt/mashora/setup.py

# Copy ERP backend app
COPY . .

ENV PYTHONPATH="/opt/mashora:${PYTHONPATH}"
ENV MASHORA_ROOT_PATH="/opt/mashora"

EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
