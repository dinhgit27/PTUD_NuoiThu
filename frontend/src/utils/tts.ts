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
        currentAudio = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
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
      }, 350);
      if (onEnd) onEnd();
      resolve();
    };

    // Safety watchdog: Max 12 seconds per speech utterance to prevent permanent locks
    maxSafetyTimeout = setTimeout(() => {
      if (isSpeakingState) {
        finish();
      }
    }, 12000);

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
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(cleanText);
          utterance.lang = 'vi-VN';
          const voices = window.speechSynthesis.getVoices();
          const viVoice = voices.find(
            v => v.lang.toLowerCase().includes('vi') || v.name.toLowerCase().includes('viet')
          );
          if (viVoice) utterance.voice = viVoice;
          utterance.rate = 1.05;
          utterance.onend = finish;
          utterance.onerror = finish;
          window.speechSynthesis.speak(utterance);
        } else {
          finish();
        }
      };

      audio.play().catch(() => {
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(cleanText);
          utterance.lang = 'vi-VN';
          const voices = window.speechSynthesis.getVoices();
          const viVoice = voices.find(
            v => v.lang.toLowerCase().includes('vi') || v.name.toLowerCase().includes('viet')
          );
          if (viVoice) utterance.voice = viVoice;
          utterance.rate = 1.05;
          utterance.onend = finish;
          utterance.onerror = finish;
          window.speechSynthesis.speak(utterance);
        } else {
          finish();
        }
      });
    } catch {
      finish();
    }
  });
}
