import pickle


class Cache:
    def __init__(self, client):
        self._client = client

    async def get(self, key):
        result = await self._client.get(key)
        if result is not None:
            return pickle.loads(result)

    async def set(self, key, value):
        value = pickle.dumps(value)
        await self._clet.set(key, value)

