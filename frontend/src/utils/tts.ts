let isSpeakingState = false;
let speechCooldownTimer: ReturnType<typeof setTimeout> | null = null;
let currentAudio: HTMLAudioElement | null = null;

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
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.removeAttribute('src');
    } catch {}
    currentAudio = null;
  }
  if (speechCooldownTimer) {
    clearTimeout(speechCooldownTimer);
    speechCooldownTimer = null;
  }
  isSpeakingState = false;
  notifyTtsListeners(false);
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
 * Automatically manages isTtsSpeaking state to block microphone self-echo.
 */
export function playTtsSpeech(text: string, onEnd?: () => void): Promise<void> {
  return new Promise((resolve) => {
    const cleanText = text.replace(/[^\p{L}\p{N}\s,.!?-]/gu, '').trim();
    if (!cleanText) {
      resolve();
      return;
    }

    try {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.removeAttribute('src');
        currentAudio = null;
      }
    } catch {}

    if (speechCooldownTimer) {
      clearTimeout(speechCooldownTimer);
      speechCooldownTimer = null;
    }

    isSpeakingState = true;
    notifyTtsListeners(true);

    let maxSafetyTimeout: ReturnType<typeof setTimeout> | null = null;

    const finish = () => {
      if (maxSafetyTimeout) {
        clearTimeout(maxSafetyTimeout);
        maxSafetyTimeout = null;
      }
      if (speechCooldownTimer) clearTimeout(speechCooldownTimer);
      speechCooldownTimer = setTimeout(() => {
        isSpeakingState = false;
        speechCooldownTimer = null;
        notifyTtsListeners(false);
      }, 1200);
      if (onEnd) onEnd();
      resolve();
    };

    // Safety watchdog: Max 10 seconds per speech utterance
    maxSafetyTimeout = setTimeout(() => {
      if (isSpeakingState) {
        finish();
      }
    }, 10000);

    try {
      const audioUrl = getTtsUrl(cleanText);
      const audio = new Audio(audioUrl);
      currentAudio = audio;

      audio.onended = () => {
        currentAudio = null;
        finish();
      };

      audio.onerror = () => {
        currentAudio = null;
        finish();
      };

      audio.play().catch(() => {
        currentAudio = null;
        finish();
      });
    } catch {
      finish();
    }
  });
}
