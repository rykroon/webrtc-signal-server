FROM python:3.11-slim

WORKDIR /usr/local/src/app
COPY app .

RUN apt-get update && \
    apt-get upgrade -y && \
    rm -rf /var/lib/apt/lists/* && \
    python -m pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

EXPOSE 8000
CMD ["gunicorn", "--config", "gunicorn.conf.py", "main:app"]
