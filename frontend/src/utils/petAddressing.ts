import type { User } from '../types';

export const DEFAULT_PET_CALL_NAME = 'bạn';
export const DEFAULT_PET_SELF_NAME = 'em';

const STORAGE_KEY = 'officepet_addressing';
const ADDRESSING_EVENT = 'officepet-addressing-change';

export interface PetAddressingConfig {
  callName: string;
  ttsCallName: string;
  selfName: string;
  voiceVolume: number;
  desktopShowBubble: boolean;
  desktopAutoRoam: boolean;
  soundEnabled: boolean;
  quietMode: boolean;
  dndStartTime: string;
  dndEndTime: string;
  aiEmotionScanEnabled: boolean;
  emotionScanInterval: number; // in seconds (15, 30, 60, 120, 300)
}

export const DEFAULT_ADDRESSING_CONFIG: PetAddressingConfig = {
  callName: DEFAULT_PET_CALL_NAME,
  ttsCallName: '',
  selfName: DEFAULT_PET_SELF_NAME,
  voiceVolume: 1,
  desktopShowBubble: true,
  desktopAutoRoam: true,
  soundEnabled: true,
  quietMode: false,
  dndStartTime: '',
  dndEndTime: '',
  aiEmotionScanEnabled: false,
  emotionScanInterval: 30
};

export function sanitizeAddressingTerm(raw: unknown, fallback: string, maxLen = 30): string {
  if (typeof raw !== 'string') return fallback;
  const cleaned = raw
    .replace(/[<>{}\[\]`"'\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
    .trim();
  return cleaned || fallback;
}

export function sanitizeOptionalTtsTerm(raw: unknown, maxLen = 40): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[<>{}\[\]`"'\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
    .trim();
}

export function capitalizeStart(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeTimeStr(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  return /^\d{2}:\d{2}$/.test(trimmed) ? trimmed : '';
}

function normalizeConfig(input?: Partial<PetAddressingConfig> | null): PetAddressingConfig {
  const rawVol = Number(input?.voiceVolume);
  const voiceVolume = Number.isFinite(rawVol) ? Math.min(1, Math.max(0.2, rawVol)) : 1;
  return {
    callName: sanitizeAddressingTerm(input?.callName, DEFAULT_PET_CALL_NAME, 30),
    ttsCallName: sanitizeOptionalTtsTerm(input?.ttsCallName, 40),
    selfName: sanitizeAddressingTerm(input?.selfName, DEFAULT_PET_SELF_NAME, 20),
    voiceVolume,
    desktopShowBubble: input?.desktopShowBubble !== undefined ? Boolean(input.desktopShowBubble) : true,
    desktopAutoRoam: input?.desktopAutoRoam !== undefined ? Boolean(input.desktopAutoRoam) : true,
    soundEnabled: input?.soundEnabled !== undefined ? Boolean(input.soundEnabled) : true,
    quietMode: input?.quietMode !== undefined ? Boolean(input.quietMode) : false,
    dndStartTime: normalizeTimeStr(input?.dndStartTime),
    dndEndTime: normalizeTimeStr(input?.dndEndTime),
    aiEmotionScanEnabled: input?.aiEmotionScanEnabled !== undefined ? Boolean(input.aiEmotionScanEnabled) : false,
    emotionScanInterval: Number.isFinite(Number(input?.emotionScanInterval))
      ? Math.min(600, Math.max(10, Math.round(Number(input?.emotionScanInterval))))
      : 30
  };
}

let activeAddressing: PetAddressingConfig = (() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return normalizeConfig(JSON.parse(saved));
    }
  } catch {}
  return { ...DEFAULT_ADDRESSING_CONFIG };
})();

const addressingChannel =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('officepet_addressing_sync') : null;

if (addressingChannel) {
  addressingChannel.addEventListener('message', (ev: MessageEvent) => {
    if (ev.data?.type === 'SET_ADDRESSING' && ev.data.payload) {
      activeAddressing = normalizeConfig(ev.data.payload);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(activeAddressing));
      } catch {}
      window.dispatchEvent(new CustomEvent(ADDRESSING_EVENT, { detail: activeAddressing }));
    }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (ev: StorageEvent) => {
    if (ev.key === STORAGE_KEY && ev.newValue) {
      try {
        activeAddressing = normalizeConfig(JSON.parse(ev.newValue));
        window.dispatchEvent(new CustomEvent(ADDRESSING_EVENT, { detail: activeAddressing }));
      } catch {}
    }
  });
}

export function extractAddressingFromUser(user?: User | null): PetAddressingConfig {
  const settingsObj =
    typeof user?.preference?.settings === 'string'
      ? (() => {
          try {
            return JSON.parse(user.preference.settings);
          } catch {
            return {};
          }
        })()
      : user?.preference?.settings && typeof user.preference.settings === 'object'
      ? user.preference.settings
      : {};

  const addr = settingsObj?.petAddressing && typeof settingsObj.petAddressing === 'object'
    ? settingsObj.petAddressing
    : {};

  return normalizeConfig({
    ...addr,
    soundEnabled: user?.preference?.soundEnabled ?? addr.soundEnabled ?? true,
    quietMode: user?.preference?.quietMode ?? addr.quietMode ?? false,
    dndStartTime: user?.preference?.dndStartTime || addr.dndStartTime || '',
    dndEndTime: user?.preference?.dndEndTime || addr.dndEndTime || '',
    aiEmotionScanEnabled: addr.aiEmotionScanEnabled !== undefined ? Boolean(addr.aiEmotionScanEnabled) : false,
    emotionScanInterval: addr.emotionScanInterval !== undefined ? Number(addr.emotionScanInterval) : 30
  });
}

function parseMinutes(hhmm?: string): number | null {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function isWithinDndWindow(startHHMM?: string, endHHMM?: string, now = new Date()): boolean {
  const start = parseMinutes(startHHMM);
  const end = parseMinutes(endHHMM);
  if (start === null || end === null || start === end) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  if (start < end) {
    return cur >= start && cur < end;
  }
  // Overnight window (e.g. 22:00 - 07:00)
  return cur >= start || cur < end;
}

export function isDndActive(cfg: PetAddressingConfig = getActiveAddressing()): boolean {
  return Boolean(cfg.quietMode) || isWithinDndWindow(cfg.dndStartTime, cfg.dndEndTime);
}

export function isSoundAllowed(cfg: PetAddressingConfig = getActiveAddressing()): boolean {
  return Boolean(cfg.soundEnabled) && !isDndActive(cfg);
}

export function getActiveAddressing(): PetAddressingConfig {
  return activeAddressing;
}

export function setActiveAddressing(
  next: Partial<PetAddressingConfig>,
  broadcast = true
): PetAddressingConfig {
  activeAddressing = normalizeConfig({ ...activeAddressing, ...next });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activeAddressing));
  } catch {}
  if (broadcast && addressingChannel) {
    try {
      addressingChannel.postMessage({ type: 'SET_ADDRESSING', payload: activeAddressing });
    } catch {}
  }
  window.dispatchEvent(new CustomEvent(ADDRESSING_EVENT, { detail: activeAddressing }));
  return activeAddressing;
}

export function subscribeAddressing(callback: (cfg: PetAddressingConfig) => void): () => void {
  const handler = (ev: Event) => {
    const detail = (ev as CustomEvent<PetAddressingConfig>).detail;
    callback(detail || activeAddressing);
  };
  window.addEventListener(ADDRESSING_EVENT, handler);
  return () => window.removeEventListener(ADDRESSING_EVENT, handler);
}

/**
 * Format text for UI/chat using user's display callName and selfName.
 */
export function formatAddressing(
  text: string,
  customCallName?: string,
  customSelfName?: string
): string {
  if (!text) return text;
  const current = getActiveAddressing();
  const callName = sanitizeAddressingTerm(customCallName ?? current.callName, DEFAULT_PET_CALL_NAME, 30);
  const selfName = sanitizeAddressingTerm(customSelfName ?? current.selfName, DEFAULT_PET_SELF_NAME, 20);
  const capCall = capitalizeStart(callName);
  const capSelf = capitalizeStart(selfName);

  let result = text
    .replace(/\{Call\}/g, capCall)
    .replace(/\{call\}/g, callName)
    .replace(/\{Self\}/g, capSelf)
    .replace(/\{self\}/g, selfName);

  if (callName.toLowerCase() !== 'đại ca') {
    result = result
      .replace(/(^|[^\p{L}\p{N}])Đại ca(?=[^\p{L}\p{N}]|$)/gu, `$1${capCall}`)
      .replace(/(^|[^\p{L}\p{N}])đại ca(?=[^\p{L}\p{N}]|$)/giu, `$1${callName}`);
  }

  return result;
}

/**
 * Convert text into TTS-ready string using phonetic `ttsCallName` (if configured)
 * so Vietnamese TTS (`tl=vi`) pronounces foreign nicknames / abbreviations accurately.
 */
export function formatTextForTts(text: string, configOverride?: PetAddressingConfig): string {
  if (!text) return '';
  const cfg = configOverride || getActiveAddressing();
  const spokenCall = cfg.ttsCallName || cfg.callName;
  const selfName = cfg.selfName;

  let result = text
    .replace(/\{Call\}/g, capitalizeStart(spokenCall))
    .replace(/\{call\}/g, spokenCall)
    .replace(/\{Self\}/g, capitalizeStart(selfName))
    .replace(/\{self\}/g, selfName);

  if (spokenCall.toLowerCase() !== 'đại ca') {
    result = result
      .replace(/(^|[^\p{L}\p{N}])Đại ca(?=[^\p{L}\p{N}]|$)/gu, `$1${capitalizeStart(spokenCall)}`)
      .replace(/(^|[^\p{L}\p{N}])đại ca(?=[^\p{L}\p{N}]|$)/giu, `$1${spokenCall}`);
  }

  if (cfg.ttsCallName && cfg.callName && cfg.ttsCallName.toLowerCase() !== cfg.callName.toLowerCase()) {
    const escapedCall = escapeRegExp(cfg.callName);
    const callRegex = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapedCall})(?=[^\\p{L}\\p{N}]|$)`, 'giu');
    result = result.replace(callRegex, `$1${cfg.ttsCallName}`);
  }

  return result.replace(/[^\p{L}\p{N}\s,.!?-]/gu, '').replace(/\s+/g, ' ').trim();
}
