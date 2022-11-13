import logging

from redis.asyncio import Redis
from starlette.applications import Starlette
from starlette.routing import Route, WebSocketRoute, Mount
from starlette.staticfiles import StaticFiles

from views.homepage import Homepage
from views.wschat import Websocket
from views.anonymouschat import AnonymousChatWS
from utils import Cache


routes = [
    Route('/', Homepage),
    WebSocketRoute('/ws2', AnonymousChatWS),
    WebSocketRoute('/ws', Websocket),
    Mount('/static', app=StaticFiles(directory='static'), name='static')
]

app = Starlette(
    routes=routes
)

app.state.logger = logging.getLogger('gunicorn.error')

app.state.redis = Redis(host='redis')
app.state.cache = Cache(app.state.redis)

