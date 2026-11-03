let isSpeakingState = false;
let speechCooldownTimer: ReturnType<typeof setTimeout> | null = null;
let currentAudio: HTMLAudioElement | null = null;
let currentSpeechId = 0;
let lastSpokenText = '';
let lastSpokenAt = 0;

const ttsSyncChannel: BroadcastChannel | null =
  typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('officepet_tts_sync')
    : null;

if (ttsSyncChannel) {
  ttsSyncChannel.onmessage = (event) => {
    const data = event.data;
    if (!data) return;
    if (data.type === 'TTS_STARTED' && typeof data.text === 'string') {
      lastSpokenText = data.text;
      lastSpokenAt = data.timestamp || Date.now();
      isSpeakingState = true;
      notifyTtsListeners(true);
    } else if (data.type === 'TTS_STOPPED') {
      if (!currentAudio) {
        isSpeakingState = false;
        notifyTtsListeners(false);
      }
    }
  };
}

type TtsListener = (speaking: boolean) => void;
const ttsListeners = new Set<TtsListener>();

export function onTtsStateChange(listener: TtsListener): () => void {
  ttsListeners.add(listener);
  return () => {
    ttsListeners.delete(listener);
  };
}

function notifyTtsListeners(speaking: boolean) {
  ttsListeners.forEach(fn => {
    try { fn(speaking); } catch {}
  });
}

export function isTtsSpeaking(): boolean {
  return isSpeakingState;
}

export function setTtsSpeaking(speaking: boolean) {
  isSpeakingState = speaking;
  notifyTtsListeners(speaking);
}

export function stopTtsSpeech() {
  currentSpeechId++;
  if (currentAudio) {
    const audioToStop = currentAudio;
    currentAudio = null;
    try {
      audioToStop.onended = null;
      audioToStop.onerror = null;
      audioToStop.pause();
      audioToStop.removeAttribute('src');
    } catch {}
  }
  if (speechCooldownTimer) {
    clearTimeout(speechCooldownTimer);
    speechCooldownTimer = null;
  }
  isSpeakingState = false;
  notifyTtsListeners(false);
  try {
    ttsSyncChannel?.postMessage({ type: 'TTS_STOPPED' });
  } catch {}
}

export function getTtsUrl(text: string): string {
  const enc = encodeURIComponent(text);
  if (typeof window !== 'undefined') {
    // In Electron, file protocol, or dev mode on port 5173/5174:
    if (
      (window as any).officePet ||
      window.location.protocol === 'file:' ||
      (window.location.hostname === 'localhost' && window.location.port !== '4000')
    ) {
      return `http://localhost:4000/api/pet/tts?text=${enc}`;
    }
  }
  return `/api/pet/tts?text=${enc}`;
}

/**
 * Play authentic Vietnamese speech audio with Google TTS backend proxy and Web Speech fallback.
 * Automatically manages isTtsSpeaking state to block microphone self-echo and prevents duplicate playback.
 */
export function playTtsSpeech(text: string, onEnd?: () => void): Promise<void> {
  return new Promise((resolve) => {
    const cleanText = text.replace(/[^\p{L}\p{N}\s,.!?-]/gu, '').trim();
    if (!cleanText) {
      resolve();
      return;
    }

    const now = Date.now();
    // Deduplicate identical or near-simultaneous TTS calls across handlers/windows within 1600ms
    if (cleanText === lastSpokenText && now - lastSpokenAt < 1600) {
      if (onEnd) onEnd();
      resolve();
      return;
    }
    lastSpokenText = cleanText;
    lastSpokenAt = now;

    const mySpeechId = ++currentSpeechId;

    try {
      if (currentAudio) {
        const prevAudio = currentAudio;
        currentAudio = null;
        prevAudio.onended = null;
        prevAudio.onerror = null;
        prevAudio.pause();
        prevAudio.removeAttribute('src');
      }
    } catch {}

    if (speechCooldownTimer) {
      clearTimeout(speechCooldownTimer);
      speechCooldownTimer = null;
    }

    isSpeakingState = true;
    notifyTtsListeners(true);
    try {
      ttsSyncChannel?.postMessage({ type: 'TTS_STARTED', text: cleanText, timestamp: now });
    } catch {}

    let maxSafetyTimeout: ReturnType<typeof setTimeout> | null = null;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      if (maxSafetyTimeout) {
        clearTimeout(maxSafetyTimeout);
        maxSafetyTimeout = null;
      }
      if (mySpeechId !== currentSpeechId) {
        resolve();
        return;
      }
      if (speechCooldownTimer) clearTimeout(speechCooldownTimer);
      speechCooldownTimer = setTimeout(() => {
        if (mySpeechId !== currentSpeechId) return;
        isSpeakingState = false;
        speechCooldownTimer = null;
        notifyTtsListeners(false);
        try {
          ttsSyncChannel?.postMessage({ type: 'TTS_STOPPED' });
        } catch {}
      }, 300);
      if (onEnd) onEnd();
      resolve();
    };

    // Safety watchdog: Max 10 seconds per speech utterance
    maxSafetyTimeout = setTimeout(() => {
      if (mySpeechId === currentSpeechId && isSpeakingState) {
        finish();
      }
    }, 10000);

    try {
      const audioUrl = getTtsUrl(cleanText);
      const audio = new Audio(audioUrl);
      currentAudio = audio;

      audio.onended = () => {
        if (mySpeechId !== currentSpeechId) return;
        currentAudio = null;
        finish();
      };

      audio.onerror = () => {
        if (mySpeechId !== currentSpeechId) return;
        currentAudio = null;
        finish();
      };

      audio.play().catch(() => {
        if (mySpeechId !== currentSpeechId) return;
        currentAudio = null;
        finish();
      });
    } catch {
      finish();
    }
  });
}
