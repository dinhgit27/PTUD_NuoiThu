import { safeJsonParse } from './jsonHelper';

export const DEFAULT_PET_CALL_NAME = 'bạn';
export const DEFAULT_PET_SELF_NAME = 'em';

export interface PetAddressingConfig {
  callName: string;
  ttsCallName: string;
  selfName: string;
  voiceVolume: number;
  desktopShowBubble: boolean;
  desktopAutoRoam: boolean;
  aiEmotionScanEnabled: boolean;
  emotionScanInterval: number;
}

/**
 * Sanitize free-text addressing term so it is safe inside prompts, UI, and TTS URLs.
 */
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

/**
 * Sanitize optional phonetic TTS pronunciation (allows empty string when unset).
 */
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

/**
 * Extract normalized addressing + voice/desktop settings from UserPreference row.
 */
export function getAddressingFromPreference(preference: any): PetAddressingConfig {
  const settingsObj: Record<string, any> =
    typeof preference?.settings === 'string'
      ? safeJsonParse<Record<string, any>>(preference.settings, {}) || {}
      : preference?.settings && typeof preference.settings === 'object'
      ? preference.settings
      : {};

  const addr = settingsObj.petAddressing && typeof settingsObj.petAddressing === 'object'
    ? settingsObj.petAddressing
    : {};

  const rawVol = Number(addr.voiceVolume);
  const voiceVolume = Number.isFinite(rawVol) ? Math.min(1, Math.max(0.2, rawVol)) : 1;

  return {
    callName: sanitizeAddressingTerm(addr.callName, DEFAULT_PET_CALL_NAME, 30),
    ttsCallName: sanitizeOptionalTtsTerm(addr.ttsCallName, 40),
    selfName: sanitizeAddressingTerm(addr.selfName, DEFAULT_PET_SELF_NAME, 20),
    voiceVolume,
    desktopShowBubble: addr.desktopShowBubble !== undefined ? Boolean(addr.desktopShowBubble) : true,
    desktopAutoRoam: addr.desktopAutoRoam !== undefined ? Boolean(addr.desktopAutoRoam) : true,
    aiEmotionScanEnabled: addr.aiEmotionScanEnabled !== undefined ? Boolean(addr.aiEmotionScanEnabled) : false,
    emotionScanInterval: Number.isFinite(Number(addr.emotionScanInterval)) ? Math.min(600, Math.max(10, Math.round(Number(addr.emotionScanInterval)))) : 30
  };
}

/**
 * Unicode-safe replacement for any hardcoded "đại ca" / "Đại ca" in AI/template text
 * so the LLM or legacy strings always respect the user's configured addressing.
 */
export function applyCallAddressing(text: string, callName: string, selfName = DEFAULT_PET_SELF_NAME): string {
  if (!text) return text;
  const normalizedCall = sanitizeAddressingTerm(callName, DEFAULT_PET_CALL_NAME, 30);
  const capCall = capitalizeStart(normalizedCall);
  const normalizedSelf = sanitizeAddressingTerm(selfName, DEFAULT_PET_SELF_NAME, 20);
  const capSelf = capitalizeStart(normalizedSelf);

  let result = text
    .replace(/\{Call\}/g, capCall)
    .replace(/\{call\}/g, normalizedCall)
    .replace(/\{Self\}/g, capSelf)
    .replace(/\{self\}/g, normalizedSelf);

  if (normalizedCall.toLowerCase() !== 'đại ca') {
    result = result
      .replace(/(^|[^\p{L}\p{N}])Đại ca(?=[^\p{L}\p{N}]|$)/gu, `$1${capCall}`)
      .replace(/(^|[^\p{L}\p{N}])đại ca(?=[^\p{L}\p{N}]|$)/giu, `$1${normalizedCall}`);
  }

  return result;
}
