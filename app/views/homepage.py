from starlette.endpoints import HTTPEndpoint
from starlette.responses import FileResponse


class Homepage(HTTPEndpoint):
    async def get(self, request):
        return FileResponse('static/index.html')
