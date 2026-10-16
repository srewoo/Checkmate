// Peer-to-peer play between two extension users. No backend: WebRTC data channel,
// signalling done by copy-pasting two codes (invite -> reply) over any chat app.
// ponytail: manual code exchange; add a signalling relay (e.g. PeerJS) if room codes are wanted.

const ICE = [{ urls: 'stun:stun.l.google.com:19302' }]; // public STUN, only used for NAT discovery

async function pack(desc) {
  const json = JSON.stringify({ type: desc.type, sdp: desc.sdp });
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return btoa(String.fromCharCode(...bytes));
}

async function unpack(code, expectedType) {
  try {
    const bytes = Uint8Array.from(atob(code.trim()), (c) => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const d = JSON.parse(await new Response(stream).text());
    if (d.type !== expectedType || typeof d.sdp !== 'string') throw new Error();
    return d;
  } catch {
    throw new Error(`That doesn't look like a valid ${expectedType === 'offer' ? 'invite' : 'reply'} code.`);
  }
}

const iceDone = (pc) => new Promise((resolve) => {
  if (pc.iceGatheringState === 'complete') return resolve();
  const t = setTimeout(resolve, 4000);
  pc.addEventListener('icegatheringstatechange', () => {
    if (pc.iceGatheringState === 'complete') { clearTimeout(t); resolve(); }
  });
});

/** Shared plumbing. `onMessage(obj)` gets parsed JSON; `onState('open'|'closed')`. */
function peer({ onMessage, onState }) {
  const pc = new RTCPeerConnection({ iceServers: ICE });
  let channel;
  const wire = (ch) => {
    channel = ch;
    ch.onopen = () => onState('open');
    ch.onclose = () => onState('closed');
    ch.onmessage = (e) => {
      if (typeof e.data !== 'string' || e.data.length > 2000) return;
      try { onMessage(JSON.parse(e.data)); } catch { /* ignore junk from peer */ }
    };
  };
  pc.onconnectionstatechange = () => {
    if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) onState('closed');
  };
  return {
    pc,
    wire,
    send: (obj) => channel?.readyState === 'open' && channel.send(JSON.stringify(obj)),
    close: () => pc.close(),
  };
}

/** Host side: returns {inviteCode, acceptReply(code), send, close}. Host plays white. */
export async function hostGame(handlers) {
  const p = peer(handlers);
  p.wire(p.pc.createDataChannel('chess'));
  await p.pc.setLocalDescription(await p.pc.createOffer());
  await iceDone(p.pc);
  return {
    inviteCode: await pack(p.pc.localDescription),
    acceptReply: async (code) => p.pc.setRemoteDescription(await unpack(code, 'answer')),
    send: p.send,
    close: p.close,
  };
}

/** Guest side: takes the invite, returns {replyCode, send, close}. Guest plays black. */
export async function joinGame(inviteCode, handlers) {
  const p = peer(handlers);
  p.pc.ondatachannel = (e) => p.wire(e.channel);
  await p.pc.setRemoteDescription(await unpack(inviteCode, 'offer'));
  await p.pc.setLocalDescription(await p.pc.createAnswer());
  await iceDone(p.pc);
  return { replyCode: await pack(p.pc.localDescription), send: p.send, close: p.close };
}
