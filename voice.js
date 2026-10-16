// Web Speech API wrapper. Chrome ends a session after silence, so we restart while "on".

export function createVoice({ onFinal, onInterim, onState, onError }) {
  const SR = self.SpeechRecognition || self.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = navigator.language || 'en-US';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 4;
  let on = false;

  const start = () => { try { rec.start(); } catch { /* already running */ } };
  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) onFinal([...r].map((a) => a.transcript));
      else onInterim(r[0].transcript);
    }
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      on = false;
      onError('Microphone blocked. Click the camera/mic icon in the address bar or chrome://settings/content/microphone to allow it.');
    } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
      onError(`Voice error: ${e.error}`);
    }
  };
  rec.onend = () => (on ? start() : onState(false));

  return {
    get on() { return on; },
    toggle() {
      on = !on;
      if (on) start(); else rec.stop();
      onState(on);
    },
  };
}

export function speak(text) {
  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}
