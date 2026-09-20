# Airmesh p2p

Browser-to-browser direct file transfers built on WebRTC DataChannels. No backend database, no relay server storing payloads, and no automated signaling backend. 

## Overview
Transferring files directly between two web browsers often relies on complex signaling servers, WebSocket orchestrators, or TURN relay infrastructure. `airmesh-p2p` strips away those cloud dependencies by using WebRTC RTCDataChannel connections initialized through manual SDP offer/answer exchanges.

You open the page, generate a connection payload containing all gathered ICE candidates, copy it to the peer through any out-of-band messaging channel, and stream raw ArrayBuffers directly between clients.

## How it Works
1. **Host Initialization:** The sender creates an `RTCPeerConnection` instance configured with Google's public STUN server and opens an `RTCDataChannel` named `fileChannel`.
2. **ICE Gathering Wait State:** Instead of sending trickle ICE candidates over a WebSocket server, the app waits for `iceGatheringState === 'complete'`. This bundles the SDP offer and all network candidates into a single JSON object.
3. **Manual Handshake:** The receiving client pastes the offer payload into their browser, generates an answer payload, and returns it to the sender.
4. **Binary Chunk Streaming:** Once connected, files are sliced into 16 KB ArrayBuffer chunks using `File.arrayBuffer()`. Chunks stream over the data channel with client-side buffer throttling to prevent browser memory exhaustion.

## Key Features
* **Zero Storage Footprint:** Payloads pass directly between client memory buffers without intermediate storage.
* **Manual SDP Signaling:** Connection tokens bundle ICE candidates to eliminate real-time signaling backend requirements.
* **Buffered Backpressure Control:** Monitors `channel.bufferedAmount` to pause chunk transmission when network congestion hits threshold limits.
* **In-Memory Reassembly:** Incoming binary chunks accumulate in array buffers before compiling into downloadable browser Blobs.

## Tech Stack Breakdown
* **HTML5:** Standard DOM layout structure for connection management controls.
* **CSS3:** Custom styles utilizing CSS custom properties and flexible box layout without external UI libraries.
* **JavaScript (ES6+):** Vanilla script driving WebRTC APIs (`RTCPeerConnection`, `RTCDataChannel`), Promises, and `ArrayBuffer` operations.

## Prerequisites & Web-Based Quick Start

Since `airmesh-p2p` is built entirely with client-side web technologies, you do not need Node.js, npm, or terminal builds.

### Option A: Using GitHub Codespaces (Browser Only)
1. Click the **Code** button at the top right of this GitHub repository.
2. Select **Codespaces** -> **Create codespace on main**.
3. Once the environment boots in your browser, install the "Live Preview" extension or run a simple server to open `index.html`.

### Option B: Local Browser Setup
1. Clone or download the repository files.
2. Open `index.html` directly inside Google Chrome, Mozilla Firefox, or Apple Safari.
3. Open a second browser window (or open the file on a separate computer) to act as the peer receiver.

### Quick Connection Instructions
1. Sender clicks **I'm sending (create offer)**.
2. Sender copies the generated payload from **Your code** and sends it to the receiver via chat or email.
3. Receiver clicks **I'm receiving (paste offer)**, pastes the payload into **Their code**, and hits **Connect**.
4. Receiver copies their newly generated **Your code** payload back to the sender.
5. Sender pastes that answer payload into **Their code** and clicks **Connect**.
6. Select any file to begin direct peer-to-peer streaming.

## Project Structure

```text
airmesh-p2p/
├── .gitignore          │ Standard git exclusions for OS and editor artifacts
├── LICENSE             │ MIT open-source license
├── README.md           │ Project documentation and WebRTC protocol guide
├── app.js              │ WebRTC peer creation, SDP handling, and chunk streaming logic
├── index.html          │ Three-step UI interface layout
└── style.css           │ Visual styling and layout variables
```

## Roadmap

[ ] Add dynamic chunk sizing based on round-trip time measurements.

[ ] Implement end-to-end payload encryption using Web Crypto API keys.

[ ] Integrate optional QR code generation for faster SDP payload swapping across mobile devices.

[ ] Display real-time transfer speed metrics (MB/s) and remaining time estimates.