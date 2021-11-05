import logging

from starlette.applications import Starlette
from starlette.routing import Route, WebSocketRoute, Mount
from starlette.staticfiles import StaticFiles

from app.views import Homepage, Websocket


routes = [
    Route('/', Homepage),
    WebSocketRoute('/ws', Websocket),
    Mount('/static', app=StaticFiles(directory='static'), name='static')
]

app = Starlette(
    routes=routes
)

app.state.logger = logging.getLogger('gunicorn.error')

