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

let peerConnection = null;
let localStream = null;
let remoteStream = null;
let roomDialog = null;
let roomId = null;

function init() {
  document.querySelector('#cameraBtn').addEventListener('click', openUserMedia);
  document.querySelector('#hangupBtn').addEventListener('click', hangUp);
  document.querySelector('#createBtn').addEventListener('click', createRoom);
  document.querySelector('#joinBtn').addEventListener('click', joinRoom);
  roomDialog = new mdc.dialog.MDCDialog(document.querySelector('#room-dialog'));
}

async function createRoom() {
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = true;
  //const db = firebase.firestore();

  console.log('Create PeerConnection with configuration: ', configuration);
  peerConnection = new RTCPeerConnection(configuration);

  registerPeerConnectionListeners();
  
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // Code for creating a room below
  const roomId = '1234'
  document.querySelector('#currentRoom').innerText = `Current room is ${roomId} - You are the caller!`

  const url = new URL(window.location.href)
  const ws = new WebSocket(`wss://${url.host}/ws?channel=${roomId}:caller`)
  const offer = await peerConnection.createOffer()

  ws.onopen = async function(event) {
    msg = {
      type: 'offer',
      to: `${roomId}:callee`,
      data: offer.toJSON()
    }
    ws.send(JSON.stringify(msg))
  }

  ws.onmessage = function(event) {
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
  peerConnection.onicecandidate = function(event) {
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

  peerConnection.addEventListener('track', event => {
    console.log('Got remote track:', event.streams[0]);
    event.streams[0].getTracks().forEach(track => {
      console.log('Add a track to the remoteStream:', track);
      remoteStream.addTrack(track);
    });
  });
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
    console.log('Create PeerConnection with configuration: ', configuration);
    peerConnection = new RTCPeerConnection(configuration);
    registerPeerConnectionListeners();
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    const url = new URL(window.location.href)
    const ws = new WebSocket(`wss://${url.host}/ws?channel=${roomId}:callee`)

    ws.onmessage = async function(event) {
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
    peerConnection.onicecandidate = function(event) {
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

    peerConnection.addEventListener('track', event => {
      console.log('Got remote track:', event.streams[0]);
      event.streams[0].getTracks().forEach(track => {
        console.log('Add a track to the remoteStream:', track);
        remoteStream.addTrack(track);
      });
    });
  }
}

async function openUserMedia(e) {
  const stream = await navigator.mediaDevices.getUserMedia(
      {video: true, audio: true});
  document.querySelector('#localVideo').srcObject = stream;
  localStream = stream;
  remoteStream = new MediaStream();
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

  // Delete room on hangup
  if (roomId) {
    const db = firebase.firestore();
    const roomRef = db.collection('rooms').doc(roomId);
    const calleeCandidates = await roomRef.collection('calleeCandidates').get();
    calleeCandidates.forEach(async candidate => {
      await candidate.delete();
    });
    const callerCandidates = await roomRef.collection('callerCandidates').get();
    callerCandidates.forEach(async candidate => {
      await candidate.delete();
    });
    await roomRef.delete();
  }

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
}

init();