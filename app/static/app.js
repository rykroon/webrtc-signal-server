mdc.ripple.MDCRipple.attachTo(document.querySelector('.mdc-button'));

// DEfault configuration - Change these if you have a different STUN or TURN server.
const configuration = {
  iceServers: [
    {
      urls: [
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
      ],
    },
  ],
  iceCandidatePoolSize: 10,
};


class SignalingChannel extends EventTarget {
  constructor(url) {
    super()
    this.webSocket = new WebSocket(url)
    this.webSocket.onmessage = async (event) => {
      const message = JSON.parse(event.data)
      console.log(message)

      if (message.type === "offer") {
        const event = new Event('offer')
        this.dispatchEvent(event)
      }

      if (message.type === "answer") {
        const event = new Event('answer')
        this.dispatchEvent(event)
      }

      if (message.type === "ice-candidate") {
        const event = new Event('ice-candidate')
        this.dispatchEvent(event)
      }
    }
  }

  sendOffer(offer) {
    msg = {
      type: 'offer',
      data: offer.toJSON()
    }
    this.webSocket.send(JSON.stringify(msg))
  }

}

// let peerConnection = null;3
let roomDialog = null;
let roomId = null;
const url = new URL(window.location.href)

function init() {
  document.querySelector('#cameraBtn').addEventListener('click', openUserMedia);
  document.querySelector('#hangupBtn').addEventListener('click', hangUp);
  document.querySelector('#createBtn').addEventListener('click', createRoom);
  document.querySelector('#joinBtn').addEventListener('click', joinRoom);
  roomDialog = new mdc.dialog.MDCDialog(document.querySelector('#room-dialog'));
}


// create RTCPeerConnection
function createRTCPeerConnection() {
  console.log('Create PeerConnection with configuration: ', configuration);
  peerConnection = new RTCPeerConnection(configuration);
  registerPeerConnectionListeners();
  const localStream = document.querySelector('#localVideo').srcObject
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });
}


async function createRoom() {
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = true;

  createRTCPeerConnection();

  // Code for creating a room below
  const roomId = '1234'
  document.querySelector('#currentRoom').innerText = `Current room is ${roomId} - You are the caller!`

  let ws = new WebSocket(`ws://${url.host}/ws?channel=${roomId}:caller`)
  const offer = await peerConnection.createOffer()

  ws.onopen = async (event) => {
    const ws = event.target;
    msg = {
      type: 'offer',
      to: `${roomId}:callee`,
      data: offer.toJSON()
    }
    ws.send(JSON.stringify(msg))
  }

  ws.onmessage = (event) => {
    msg = JSON.parse(event.data)
    console.log(msg)

    if (msg.type == 'answer') {
      const answer = new RTCSessionDescription(msg.data)
      peerConnection.setLocalDescription(offer)
      peerConnection.setRemoteDescription(answer)
    }

    if (msg.type == 'ice-candidate') {
      const candidate = new RTCIceCandidate(msg.data)
      peerConnection.addIceCandidate(candidate)
    }
  }

  // Code for creating a room above

  // Code for collecting ICE candidates below
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      const candidate = event.candidate
      peerConnection.addIceCandidate(candidate)
      msg = {
        type: 'ice-candidate',
        to: `${roomId}:callee`,
        data: candidate.toJSON()
      }
      ws.send(JSON.stringify(msg))
    }
  };

  // Code for collecting ICE candidates above

}

function joinRoom() {
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = true;

  document.querySelector('#confirmJoinBtn').
      addEventListener('click', async () => {
        roomId = document.querySelector('#room-id').value;
        console.log('Join room: ', roomId);
        document.querySelector(
            '#currentRoom').innerText = `Current room is ${roomId} - You are the callee!`;
        await joinRoomById(roomId);
      }, {once: true});
  roomDialog.open();
}

async function joinRoomById(roomId) {

  if (roomId) {
    createRTCPeerConnection();
    let ws = new WebSocket(`ws://${url.host}/ws?channel=${roomId}:callee`)

    ws.onmessage = async (event) => {
      msg = JSON.parse(event.data)

      if (msg.type == 'offer') {
        const offer = new RTCSessionDescription(msg.data);
        peerConnection.setRemoteDescription(offer);
        const answer = await peerConnection.createAnswer();
        peerConnection.setLocalDescription(answer);

        outbound_msg = {
          type: 'answer',
          to: `${roomId}:caller`,
          data: answer.toJSON()
        }
        ws.send(JSON.stringify(outbound_msg));
      }

      if (msg.type == 'ice-candidate') {
        const candidate = new RTCIceCandidate(msg.data);
        peerConnection.addIceCandidate(candidate);
      }
    }

    // Code for collecting ICE candidates below
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const candidate = event.candidate;
        peerConnection.addIceCandidate(candidate);
        msg = {
          type: 'ice-candidate',
          to: `${roomId}:caller`,
          data: candidate.toJSON()
        }
        ws.send(JSON.stringify(msg));
      }
    };

    // Code for collecting ICE candidates above

  }
}

async function openUserMedia(e) {
  const stream = await navigator.mediaDevices.getUserMedia(
      {video: true, audio: true});
  document.querySelector('#localVideo').srcObject = stream;
  const remoteStream = new MediaStream();
  document.querySelector('#remoteVideo').srcObject = remoteStream;

  console.log('Stream:', document.querySelector('#localVideo').srcObject);
  document.querySelector('#cameraBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = false;
  document.querySelector('#createBtn').disabled = false;
  document.querySelector('#hangupBtn').disabled = false;
}

async function hangUp(e) {
  const tracks = document.querySelector('#localVideo').srcObject.getTracks();
  tracks.forEach(track => {
    track.stop();
  });

  const remoteStream = document.querySelector('#remoteVideo').srcObject;

  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop());
  }

  if (peerConnection) {
    peerConnection.close();
  }

  document.querySelector('#localVideo').srcObject = null;
  document.querySelector('#remoteVideo').srcObject = null;
  document.querySelector('#cameraBtn').disabled = false;
  document.querySelector('#joinBtn').disabled = true;
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#hangupBtn').disabled = true;
  document.querySelector('#currentRoom').innerText = '';

  document.location.reload(true);
}

function registerPeerConnectionListeners() {
  peerConnection.addEventListener('icegatheringstatechange', () => {
    console.log(
        `ICE gathering state changed: ${peerConnection.iceGatheringState}`);
  });

  peerConnection.addEventListener('connectionstatechange', () => {
    console.log(`Connection state change: ${peerConnection.connectionState}`);
  });

  peerConnection.addEventListener('signalingstatechange', () => {
    console.log(`Signaling state change: ${peerConnection.signalingState}`);
  });

  peerConnection.addEventListener('iceconnectionstatechange ', () => {
    console.log(
        `ICE connection state change: ${peerConnection.iceConnectionState}`);
  });

  peerConnection.addEventListener('track', event => {
    console.log('Got remote track:', event.streams[0]);
    const remoteStream = document.querySelector('#remoteVideo').srcObject;
    event.streams[0].getTracks().forEach(track => {
      console.log('Add a track to the remoteStream:', track);
      remoteStream.addTrack(track);
    });
  });

}

init();