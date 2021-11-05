import os

_cpu_count = os.cpu_count()

bind        = os.getenv('GUNICORN_BIND', '0.0.0.0')
loglevel    = os.getenv('GUNICORN_LOGLEVEL', 'info')
preload_app = os.getenv('GUNICORN_PRELOAD_APP', True)
reload      = os.getenv('GUNICORN_RELOAD', False)
workers     = os.getenv('GUNICORN_WORKERS', 2 * _cpu_count + 1)
worker_class    = os.getenv('GUNICORN_WORKER_CLASS', 'uvicorn.workers.UvicornWorker')
