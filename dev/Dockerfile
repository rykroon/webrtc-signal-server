FROM python:3.10-slim-buster
COPY . /app
WORKDIR /app
RUN apt-get update -y && \
    apt-get upgrade -y && \
    python -m pip install --upgrade pip && \
    pip install -r requirements.txt

EXPOSE 8000
CMD ["gunicorn", "--config", "dev/gunicorn.conf.py", "main:app"]
