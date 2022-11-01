import asyncio
import json
import uuid

from starlette.endpoints import HTTPEndpoint, WebSocketEndpoint
from starlette.responses import FileResponse


class Homepage(HTTPEndpoint):
    async def get(self, request):
        return FileResponse('static/index.html')


class RandomChatWS(WebSocketEndpoint):

    encoding = 'json'

    async def on_connect(self, ws):
        ws.state.redis = ws.app.state.redis
        ws.state.logger = ws.app.state.logger

        await ws.accept()

        ws.state.identifier = str(uuid.uuid4())
        pubsub = ws.state.redis.pubsub()
        ws.state.pubsub = pubsub
        await pubsub.subscribe(**{ws.state.identifier: get_handler(ws)})
        ws.state.pubsub_task = asyncio.create_task(
            pubsub.run(poll_timeout=.01)
        )

        # try to find an offer on the queue.
        offer = await ws.state.redis.rpop('offers')
        if offer is not None:
            ws.state.logger.info(offer)
            offer = json.loads(offer)
            offer['to'] = ws.state.identifier
            await ws.send_json(offer)

    async def on_receive(self, ws, data):
        type_ = data['type']
        assert type_ in ('offer', 'answer', 'ice-candidate'), "Invalid message type."

        data['from'] = ws.state.identifier

        if type_ == 'offer':
            # push the offer into the stack.
            await ws.state.redis.lpush('offers', json.dumps(data))

        if type_ in ('answer', 'ice-candidate'):
            await ws.state.redis.publish(
                data['to'],
                json.dumps(data)
            )


class Websocket(WebSocketEndpoint):

    encoding = 'json'

    async def on_connect(self, ws):
        app = ws.app
        logger = app.state.logger
        cache = app.state.cache

        # add redis stuff
        pubsub = app.state.redis.pubsub()
        ws.state.channel = ws.query_params['channel']
        await pubsub.subscribe(**{ws.state.channel: get_handler(ws)})
        ws.state.pubsub = pubsub

        #create pub sub task
        ws.state.pubsub_task = asyncio.create_task(ws.state.pubsub.run(poll_timeout=.01))

        await ws.accept()

        messages = await cache.get(ws.state.channel)
        if messages:
            for msg in messages:
                await ws.send_text(json.dumps(msg))
        await cache.delete(ws.state.channel)

    async def on_receive(self, ws, data):
        app = ws.app
        logger = app.state.logger
        redis = app.state.redis
        cache = app.state.cache

        to = data.pop('to')
        data['from'] = ws.state.channel

        numsub = await redis.pubsub_numsub(to)
        if numsub[0][1]:
            await redis.publish(to, json.dumps(data))

        else:
            messages = await cache.get(to) or []
            messages.append(data)
            await cache.set(to, messages)


    async def on_disconnect(self, ws, close_code):
        ws.state.pubsub_task.cancel()
        await ws.state.pubsub.unsubscribe(ws.state.channel)
        # await ws.close(code=close_code)


def get_handler(ws):
    async def handler(message):
        wsmsg = message['data'].decode()
        await ws.send_text(wsmsg)
    return handler
