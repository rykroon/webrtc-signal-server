import asyncio
import json
from os import close

import aioredis
from starlette.endpoints import HTTPEndpoint, WebSocketEndpoint
from starlette.responses import FileResponse

from app.utils import Cache


class Homepage(HTTPEndpoint):
    async def get(self, request):
        return FileResponse('static/index.html')


class Websocket(WebSocketEndpoint):

    encoding = 'json'

    async def on_connect(self, ws):
        app = ws.app
        logger = app.state.logger

        # add redis stuff
        ws.state.redis = aioredis.from_url('redis://redis')
        ws.state.cache = Cache(ws.state.redis)
        pubsub = ws.state.redis.pubsub()
        ws.state.channel = ws.query_params['channel']
        await pubsub.subscribe(ws.state.channel)
        ws.state.pubsub = pubsub

        #create pub sub task
        ws.state.pubsub_task = asyncio.create_task(listen_and_send(ws))

        await ws.accept()

        messages = await ws.state.cache.get(ws.state.channel)
        if messages:
            for msg in messages:
                await ws.send_text(json.dumps(msg))

    async def on_receive(self, ws, data):
        app = ws.app
        logger = app.state.logger

        to = data.pop('to')
        data['from'] = ws.state.channel

        numsub = await ws.state.redis.pubsub_numsub(to)
        if numsub[0][1]:
            await ws.state.redis.publish(to, json.dumps(data))

        else:
            messages = await ws.state.cache.get(to) or []
            messages.append(data)
            await ws.state.cache.set(to, messages)


    async def on_disconnect(self, ws, close_code):
        ws.state.pubsub_task.cancel()
        ws.state.pubsub.unsubscribe(ws.state.channel)
        ws.state.redis.close()
        await ws.close(code=close_code)


async def listen_and_send(ws):
    pubsub = ws.state.pubsub

    while True:
        psmsg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=.01)
        if psmsg:
            wsmsg = psmsg['data']
            await ws.send_text(wsmsg)

