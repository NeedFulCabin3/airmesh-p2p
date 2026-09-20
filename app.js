const CHUNK_SIZE = 16 * 1024;

let pc = null;
let channel = null;
let mode = null; // 'host' or 'join'
let stage = 'idle';

const logBox = document.getElementById('log');
function log(msg) {
  logBox.textContent += msg + '\n';
  logBox.scrollTop = logBox.scrollHeight;
}

function makePeerConnection() {
  const conn = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });
  conn.onconnectionstatechange = () => {
    log('connection state: ' + conn.connectionState);
    if (conn.connectionState === 'connected') {
      document.getElementById('filePanel').style.display = 'block';
      document.getElementById('connStatus').textContent = 'connected!';
    }
  };
  return conn;
}

// waits for ice gathering to wrap up so we can ship one blob of sdp text
// instead of trickling candidates one by one (way simpler for manual copy-paste signaling)
function waitForIce(conn) {
  return new Promise(resolve => {
    if (conn.iceGatheringState === 'complete') {
      resolve();
      return;
    }
    function check() {
      if (conn.iceGatheringState === 'complete') {
        conn.removeEventListener('icegatheringstatechange', check);
        resolve();
      }
    }
    conn.addEventListener('icegatheringstatechange', check);
  });
}

function setupChannelEvents(ch) {
  ch.binaryType = 'arraybuffer';
  let incomingMeta = null;
  let receivedChunks = [];
  let receivedBytes = 0;

  ch.onopen = () => log('data channel open');
  ch.onclose = () => log('data channel closed');

  ch.onmessage = (e) => {
    if (typeof e.data === 'string') {
      const msg = JSON.parse(e.data);
      if (msg.type === 'meta') {
        incomingMeta = msg;
        receivedChunks = [];
        receivedBytes = 0;
        log(`receiving "${msg.name}" (${msg.size} bytes)`);
      } else if (msg.type === 'done') {
        const blob = new Blob(receivedChunks);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = incomingMeta.name;
        a.textContent = 'download ' + incomingMeta.name;
        document.getElementById('transferStatus').innerHTML = '';
        document.getElementById('transferStatus').appendChild(a);
        log('transfer complete');
      }
      return;
    }

    receivedChunks.push(e.data);
    receivedBytes += e.data.byteLength;
    if (incomingMeta) {
      const pct = Math.min(100, Math.round((receivedBytes / incomingMeta.size) * 100));
      document.getElementById('progressBar').style.width = pct + '%';
    }
  };

  channel = ch;
}

document.getElementById('hostBtn').addEventListener('click', async () => {
  mode = 'host';
  pc = makePeerConnection();
  const dc = pc.createDataChannel('fileChannel');
  setupChannelEvents(dc);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIce(pc);

  document.getElementById('localSDP').value = JSON.stringify(pc.localDescription);
  document.getElementById('signalPanel').style.display = 'block';
  stage = 'waiting-for-answer';
  log('offer created, send the code to the other person');
});

document.getElementById('joinBtn').addEventListener('click', () => {
  mode = 'join';
  pc = makePeerConnection();
  pc.ondatachannel = (e) => {
    setupChannelEvents(e.channel);
  };
  document.getElementById('signalPanel').style.display = 'block';
  stage = 'waiting-for-offer-paste';
  log('paste the offer code you received, then hit connect');
});

document.getElementById('connectBtn').addEventListener('click', async () => {
  const remoteText = document.getElementById('remoteSDP').value.trim();

  try {
    if (mode === 'join' && stage === 'waiting-for-offer-paste') {
      const offer = JSON.parse(remoteText);
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForIce(pc);
      document.getElementById('localSDP').value = JSON.stringify(pc.localDescription);
      log('answer created, send this code back to the sender');
      stage = 'done';
    } else if (mode === 'host' && stage === 'waiting-for-answer') {
      const answer = JSON.parse(remoteText);
      await pc.setRemoteDescription(answer);
      log('got the answer, connecting...');
      stage = 'done';
    } else {
      log('nothing to do here, check you pasted the right code');
    }
  } catch (err) {
    log('signal error: ' + err.message);
  }
});

document.getElementById('fileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file || !channel || channel.readyState !== 'open') {
    log('pick a file after the connection is open');
    return;
  }

  channel.send(JSON.stringify({ type: 'meta', name: file.name, size: file.size }));

  const buffer = await file.arrayBuffer();
  let offset = 0;

  function sendNextChunk() {
    if (offset >= buffer.byteLength) {
      channel.send(JSON.stringify({ type: 'done' }));
      document.getElementById('transferStatus').textContent = 'sent!';
      return;
    }

    const chunk = buffer.slice(offset, offset + CHUNK_SIZE);
    channel.send(chunk);
    offset += chunk.byteLength;

    const pct = Math.min(100, Math.round((offset / buffer.byteLength) * 100));
    document.getElementById('progressBar').style.width = pct + '%';

    // back off a bit if the send buffer is getting full so we don't flood the channel
    if (channel.bufferedAmount > 8 * CHUNK_SIZE) {
      setTimeout(sendNextChunk, 20);
    } else {
      sendNextChunk();
    }
  }

  sendNextChunk();
});
