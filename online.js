// Settings-dialog UI for online play. Wraps net.js; host = white, guest = black.
import { hostGame, joinGame } from './net.js';

const $ = (id) => document.getElementById(id);

export function setupOnline({ onOpen, onClose, onMessage }) {
  let conn = null;
  const state = { color: null, open: false };
  const status = (t) => { $('netStatus').textContent = t; };
  const handlers = {
    onMessage,
    onState(s) {
      const was = state.open;
      state.open = s === 'open';
      if (state.open && !was) { status('Connected!'); onOpen(state.color); }
      if (!state.open && was) { status('Connection closed.'); onClose(); }
    },
  };
  const reset = () => { conn?.close(); conn = null; state.open = false; };

  const busy = async (btn, fn) => {
    btn.disabled = true;
    try { await fn(); } catch (err) { status(err.message); } finally { btn.disabled = false; }
  };

  $('hostBtn').onclick = (e) => busy(e.currentTarget, async () => {
    reset();
    $('joinBox').hidden = true;
    $('hostBox').hidden = false;
    $('invite').value = '';
    status('Creating invite…');
    conn = await hostGame(handlers);
    state.color = 'w';
    $('invite').value = conn.inviteCode;
    status('Send the invite, then paste their reply below.');
  });

  $('connectBtn').onclick = (e) => busy(e.currentTarget, async () => {
    if (!conn?.acceptReply) throw new Error('Host a game first.');
    await conn.acceptReply($('replyIn').value);
    status('Connecting…');
  });

  $('joinBtn').onclick = () => {
    reset();
    $('hostBox').hidden = true;
    $('joinBox').hidden = false;
    status('Paste the invite code from the host.');
  };

  $('makeReplyBtn').onclick = (e) => busy(e.currentTarget, async () => {
    reset();
    status('Creating reply…');
    conn = await joinGame($('inviteIn').value, handlers);
    state.color = 'b';
    $('reply').value = conn.replyCode;
    status('Send this reply to the host. The game starts when they connect.');
  });

  for (const btn of document.querySelectorAll('[data-copy]')) {
    btn.onclick = async () => {
      try {
        await navigator.clipboard.writeText($(btn.dataset.copy).value);
        btn.textContent = 'Copied';
      } catch {
        $(btn.dataset.copy).select();
        btn.textContent = 'Press Ctrl/Cmd+C';
      }
      setTimeout(() => { btn.textContent = btn.dataset.copy === 'invite' ? 'Copy invite' : 'Copy reply'; }, 1500);
    };
  }

  return {
    get color() { return state.color; },
    get open() { return state.open; },
    send: (msg) => conn?.send(msg),
    disconnect: reset,
  };
}
