import asyncio
import json
import uuid

from starlette.endpoints import WebSocketEndpoint


class AnonymousChatWS(WebSocketEndpoint):

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
        ws.state.logger.info(data)

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


def get_handler(ws):
    async def handler(message):
        wsmsg = message['data'].decode()
        ws.state.logger.info(wsmsg)
        await ws.send_text(wsmsg)
    return handler
