import os
from starlette.config import Config


_config = Config()
_cpu_count = os.cpu_count()


bind            = _config.get('GUNICORN_BIND', default='0.0.0.0')
loglevel        = _config.get('GUNICORN_LOGLEVEL', default='info')
preload_app     = _config.get('GUNICORN_PRELOAD_APP', cast=bool, default=True)
reload          = _config.get('GUNICORN_RELOAD', cast=bool, default=False)
workers         = _config.get('GUNICORN_WORKERS', cast=int, default=2 * _cpu_count + 1)
worker_class    = _config.get('GUNICORN_WORKER_CLASS', default='uvicorn.workers.UvicornWorker')
