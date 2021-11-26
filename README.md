# webrtc-signal-server
A WebRTC signaling server written in python using the Starlette ASGI Framework


Front end code pulled from https://github.com/webrtc/FirebaseRTC

The front end connects to the signaling server via a websocket.
The URL requires a single query argument, `channel`.

The websocket listens to the client and a pubsub channel (The channel from the query argument).

Messages received from the client are published to the channel in the `to` parameter of the message.
Messages received from the pubsub channel are sent back to the client.
