import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Volume2, VolumeX, Sparkles, HelpCircle, ChevronDown, ChevronUp, Radio, X } from 'lucide-react';
import { AnimationState } from '../types';
import { isTtsSpeaking, playTtsSpeech } from '../utils/tts';
import { api } from '../services/api';

export type NavTab = 'PET' | 'SHOP' | 'GARDEN' | 'FOCUS' | 'AI_CHAT' | 'MUSIC' | 'LEADERBOARD' | 'QUESTS' | 'ADMIN';
export type RoomTheme = 'cafe' | 'garden' | 'office' | 'beach' | 'room';
export type ModalTarget = 'FRIENDS' | 'GUIDE' | 'BREATHING' | 'PET_SELECTOR';

interface VoiceAssistantProps {
  petName: string;
  onFeed: () => void;
  onDrink: () => void;
  onStroke: () => void;
  onLevelUp: () => void;
  onAction: (state: AnimationState, message: string) => void;
  onChangeRoom?: (theme: RoomTheme) => void;
  onChangeScale?: (scale: 'SMALL' | 'MEDIUM' | 'LARGE') => void;
  onNavigate?: (tab: NavTab) => void;
  onOpenModal?: (modal: ModalTarget) => void;
  onSpeechBubble?: (text: string) => void;
  onPlayMusic?: (query: string, autoPlay: boolean) => void;
  onStopMusic?: () => void;
  onResumeBgm?: () => void;
  onStartTimer?: (
    minutes: number,
    autoStart: boolean,
    action?: 'START' | 'PAUSE' | 'RESET' | 'STOP_ALARM' | 'SET_CLOCK_ALARM',
    alarmTime?: string,
    alarmLabel?: string
  ) => void;
  compact?: boolean;
  embedded?: boolean;
  autoStart?: boolean;
  onClosePanel?: () => void;
}

// Phonetic variations of "HEY ANY" / "ANY" in Vietnamese & English Speech-to-Text
// Ordered longest-first so full wake phrases (e.g. "hey any ơi", "hey any") are matched before shorter ones ("any")
const WAKE_WORDS = [
  'hey any ơi',
  'hey ani ơi',
  'hây any ơi',
  'hê any ơi',
  'ê any ơi',
  'hey any',
  'hey ani',
  'hey annie',
  'hey enny',
  'hey eni',
  'hey sunny',
  'hey honey',
  'hi any',
  'hi ani',
  'hi annie',
  'hây any',
  'hê any',
  'hay any',
  'hây ani',
  'hê ani',
  'hay ani',
  'hây a ni',
  'hê a ni',
  'hay a ni',
  'hây a ny',
  'hê a ny',
  'hay a ny',
  'hây a ly',
  'hê a ly',
  'hay a ly',
  'hây a mi',
  'hê a mi',
  'hây e ni',
  'hê e ni',
  'hay e ni',
  'hây en ni',
  'hê en ni',
  'hay en ni',
  'hây an ni',
  'hê an ni',
  'hay an ni',
  'ây a ni',
  'ây any',
  'ây ani',
  'ê a ni',
  'ê a ny',
  'ê any',
  'ê ani',
  'ê e ni',
  'any ơi',
  'ani ơi',
  'a ni ơi',
  'a ny ơi',
  'annie ơi',
  'enny ơi',
  'eni ơi',
  'bé cưng ơi',
  'thú cưng ơi',
  'bé ơi',
  'pet ơi',
  'a ni',
  'a ny',
  'an ni',
  'an ny',
  'e ni',
  'en ni',
  'any',
  'ani',
  'annie',
  'enny',
  'eni',
  'hanny'
];

function findWakeWordInPhrase(phrase: string): { wakeWord: string; commandAfterWake: string } | null {
  const normalized = phrase.toLowerCase().trim();
  for (const wake of WAKE_WORDS) {
    const escaped = wake.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|\\s|[.,!?])${escaped}(?=\\s|[.,!?]|$)`, 'i');
    const match = normalized.match(regex);
    if (match && match.index !== undefined) {
      const afterIndex = match.index + match[0].length;
      const rawAfter = normalized.slice(afterIndex).replace(/^[.,!?\s]+/, '');
      const commandAfterWake = rawAfter.replace(/^(?:ơi|à|ạ|nha|nhé|nào|hãy)\s+/i, '').trim();
      return { wakeWord: wake, commandAfterWake };
    }
  }
  return null;
}

// Check if a spoken chunk is just an incomplete prefix (e.g., "hãy mở", "mở cho tôi", "cho pet")
// waiting for the user to finish saying the target noun (e.g., "...cửa hàng", "...ăn")
function isIncompleteCommandPrefix(cmd: string): boolean {
  const cleaned = cmd.replace(/[.,!?]/g, '').trim();
  const incompletePrefixes = [
    'mở',
    'bật',
    'phát',
    'nghe',
    'vào',
    'hãy',
    'hãy mở',
    'hãy bật',
    'hãy phát',
    'hãy vào',
    'hãy cho',
    'mở cho',
    'mở cho tôi',
    'mở cho mình',
    'mở giúp',
    'mở giúp tôi',
    'bật cho',
    'bật cho tôi',
    'bật cho mình',
    'phát cho',
    'phát cho tôi',
    'phát cho mình',
    'cho',
    'cho tôi',
    'cho mình',
    'cho pet',
    'cho bét',
    'cho pét',
    'cho bết',
    'cho tét',
    'cho tết',
    'cho bé',
    'cho bé cưng',
    'cho thú',
    'cho thú cưng',
    'cho em',
    'cho nó',
    'bảo',
    'bảo pet',
    'kêu',
    'kêu pet',
    'chuyển',
    'chuyển sang',
    'đi tới',
    'đi vào',
    'xem',
    'cho tôi xem'
  ];
  return incompletePrefixes.includes(cleaned);
}

// Parse Vietnamese spoken numbers or digits for timer minutes (e.g. "15 phút", "mười lăm phút")
function extractMinutesFromCommand(cmd: string): number | null {
  const digitMatch = cmd.match(/(\d+)\s*(?:phút|p|tiếng|giờ)?/);
  if (digitMatch) {
    const val = parseInt(digitMatch[1], 10);
    if (cmd.includes('tiếng') || (cmd.includes('giờ') && !cmd.includes('hẹn giờ'))) {
      return Math.min(180, val * 60);
    }
    if (val >= 1 && val <= 180) return val;
  }

  const wordMap: Array<[string, number]> = [
    ['một tiếng rưỡi', 90],
    ['hai tiếng', 120],
    ['một tiếng', 60],
    ['nửa tiếng', 30],
    ['chín mươi', 90],
    ['sáu mươi', 60],
    ['năm mươi', 50],
    ['bốn mươi lăm', 45],
    ['bốn lăm', 45],
    ['bốn mươi', 40],
    ['ba mươi lăm', 35],
    ['ba lăm', 35],
    ['ba mươi', 30],
    ['hai mươi lăm', 25],
    ['hai lăm', 25],
    ['hai mươi', 20],
    ['mười lăm', 15],
    ['mười hai', 12],
    ['mười', 10],
    ['chín', 9],
    ['tám', 8],
    ['bảy', 7],
    ['sáu', 6],
    ['năm', 5],
    ['bốn', 4],
    ['ba', 3],
    ['hai', 2],
    ['một', 1]
  ];

  for (const [word, mins] of wordMap) {
    if (cmd.includes(word)) {
      return mins;
    }
  }
  return null;
}

// Parse clock-time alarm commands like "cài 3h chiều báo tôi" -> { time24: "15:00", hour24: 15, minute: 0, label: "Báo thức 15:00 (3h chiều)" }
function extractClockAlarmFromCommand(
  cmd: string
): { time24: string; hour24: number; minute: number; label: string } | null {
  // Do not treat pure countdown phrases like "5 phút" or "1 tiếng" (without "giờ"/"h" clock time) as clock alarms
  if (cmd.includes('tiếng') || cmd.includes('đếm ngược')) return null;

  let normalized = cmd.toLowerCase();
  // Remove verb phrases containing "giờ" so they don't confuse hour extraction
  normalized = normalized
    .replace(/hẹn\s+giờ/g, 'hẹn')
    .replace(/cài\s+giờ/g, 'cài')
    .replace(/đặt\s+giờ/g, 'đặt')
    .replace(/bấm\s+giờ/g, 'bấm');

  // Convert Vietnamese spoken number words before "giờ" into digits
  const spokenHourMap: Array<[RegExp, string]> = [
    [/\bhai\s+mươi\s+ba\s+giờ/g, '23 giờ'],
    [/\bhai\s+mươi\s+hai\s+giờ/g, '22 giờ'],
    [/\bhai\s+mươi\s+mốt\s+giờ/g, '21 giờ'],
    [/\bhai\s+mươi\s+giờ/g, '20 giờ'],
    [/\bmười\s+chín\s+giờ/g, '19 giờ'],
    [/\bmười\s+tám\s+giờ/g, '18 giờ'],
    [/\bmười\s+bảy\s+giờ/g, '17 giờ'],
    [/\bmười\s+sáu\s+giờ/g, '16 giờ'],
    [/\bmười\s+lăm\s+giờ/g, '15 giờ'],
    [/\bmười\s+bốn\s+giờ/g, '14 giờ'],
    [/\bmười\s+ba\s+giờ/g, '13 giờ'],
    [/\bmười\s+hai\s+giờ/g, '12 giờ'],
    [/\bmười\s+một\s+giờ/g, '11 giờ'],
    [/\bmười\s+giờ/g, '10 giờ'],
    [/\bchín\s+giờ/g, '9 giờ'],
    [/\btám\s+giờ/g, '8 giờ'],
    [/\bbảy\s+giờ/g, '7 giờ'],
    [/\bsáu\s+giờ/g, '6 giờ'],
    [/\bnăm\s+giờ/g, '5 giờ'],
    [/\bbốn\s+giờ/g, '4 giờ'],
    [/\bba\s+giờ/g, '3 giờ'],
    [/\bhai\s+giờ/g, '2 giờ'],
    [/\bmột\s+giờ/g, '1 giờ']
  ];
  for (const [regex, replacement] of spokenHourMap) {
    normalized = normalized.replace(regex, replacement);
  }

  // Match patterns like "3h", "3 giờ", "3h30", "3 giờ 15", "3 giờ rưỡi", "15:00", "15h"
  const match = normalized.match(/\b(\d{1,2})\s*(?:giờ|h|:)\s*(?:(\d{1,2})\s*(?:phút|p)?|(rưỡi))?/);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = match[3] === 'rưỡi' ? 30 : match[2] ? parseInt(match[2], 10) : 0;

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  const hasAfternoonEvening = /\b(chiều|tối|đêm)\b/.test(normalized);
  const hasMorning = /\b(sáng|khuya)\b/.test(normalized);
  const hasNoon = /\b(trưa)\b/.test(normalized);

  if (hasAfternoonEvening && hour >= 1 && hour <= 11) {
    hour += 12; // e.g., 3h chiều -> 15:00, 8h tối -> 20:00
  } else if (hasNoon && hour >= 1 && hour <= 2) {
    hour += 12; // e.g., 1h trưa -> 13:00
  } else if (!hasMorning && hour >= 1 && hour <= 6) {
    // When user says "3h báo tôi" or "cài 3 giờ báo tôi" without "sáng", default to afternoon 15:00
    hour += 12;
  }

  const time24 = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const periodLabel =
    hasAfternoonEvening || hour >= 13
      ? `${hour > 12 ? hour - 12 : hour}h${minute > 0 ? minute : ''} chiều/tối`
      : `${hour}h${minute > 0 ? minute : ''} sáng`;

  return {
    time24,
    hour24: hour,
    minute,
    label: `Báo thức ${time24} (${periodLabel})`
  };
}

// Strictly extract song title ONLY when the command explicitly contains music/song nouns ("bài hát", "bài", "nhạc", "ca khúc")
function extractSongQuery(cmd: string): string | null {
  // Never extract a song if the command mentions non-music web features
  const nonMusicFeatures = [
    'cửa hàng',
    'shop',
    'sóp',
    'xóp',
    'mua đồ',
    'mua sắm',
    'nhiệm vụ',
    'xếp hạng',
    'phòng chung',
    'khu vườn',
    'quán cafe',
    'quán cà phê',
    'vườn xuân',
    'góc zen',
    'bãi biển',
    'sàn gỗ',
    'pomodoro',
    'momodo',
    'hẹn giờ',
    'đếm ngược',
    'hít thở',
    'tập thở',
    'bạn bè',
    'hướng dẫn',
    'trợ lý',
    'yêu thích',
    'playlist',
    'play list',
    'lây lít',
    'danh sách',
    'lịch sử'
  ];
  if (nonMusicFeatures.some(w => cmd.includes(w))) {
    return null;
  }

  const patterns = [
    // 1. mở / bật / phát / nghe / tìm / chơi / đổi / chuyển... [bài hát/bài/nhạc/ca khúc]... [là/thành/sang] [tên bài]
    /(?:mở|bật|phát|nghe|tìm|chơi|đổi|chuyển)\s+(?:sang|qua|thành)?\s*(?:cho\s+(?:tôi|mình|anh|chị|em|bạn|đại\s*ca|chủ\s*nhân)\s+)?(?:nghe\s+)?(?:bài\s+hát|bài\s+nhạc|bản\s+nhạc|ca\s+khúc|bài|nhạc)\s+(?:là\s+|thành\s+|sang\s+|qua\s+)?(.+)/i,
    // 2. đổi sang / chuyển sang / đổi thành / chuyển thành [tên bài] (không cần chữ "bài", VD: "đổi sang Sơn Tùng")
    /(?:đổi|chuyển)\s+(?:sang|qua|thành)\s+(?:bài\s+hát\s+|bài\s+|nhạc\s+)?(?:là\s+|thành\s+)?(.+)/i,
    // 3. đổi bài / chuyển bài [tên bài] hoặc đổi bài là [tên bài]
    /(?:đổi|chuyển)\s+(?:bài\s+hát|bài\s+nhạc|ca\s+khúc|bài|nhạc)\s+(?:là\s+|thành\s+|sang\s+|qua\s+)?(.+)/i,
    // 4. cho tôi nghe bài [tên bài]
    /(?:cho\s+(?:tôi|mình|anh|chị|em|đại\s*ca|chủ\s*nhân)\s+nghe)\s+(?:bài\s+hát|bài\s+nhạc|bài|nhạc)\s+(?:là\s+|thành\s+)?(.+)/i,
    // 5. bắt đầu bằng bài hát / bài nhạc / ca khúc...
    /^(?:bài\s+hát|bài\s+nhạc|ca\s+khúc)\s+(?:là\s+|thành\s+)?(.+)/i
  ];

  const genericNextPrevWords = [
    'khác',
    'khác đi',
    'mới',
    'tiếp',
    'tiếp theo',
    'kế tiếp',
    'sau',
    'trước',
    'cũ',
    'nào',
    'gì'
  ];

  for (const regex of patterns) {
    const match = cmd.match(regex);
    if (match && match[1]) {
      let cleaned = match[1]
        .replace(/\b(nha|nhé|đi|với|ạ|nào|luôn|cho\s+tôi|cho\s+mình|cho\s+đại\s+ca)\b$/gi, '')
        .trim();
      cleaned = cleaned.replace(/^(?:là|thành|sang|qua)\s+/i, '').trim();
      if (cleaned.length >= 2 && !genericNextPrevWords.includes(cleaned.toLowerCase())) {
        return cleaned;
      }
    }
  }
  return null;
}

// Play retro 8-bit sound effect using Web Audio API
const playRetroTone = (type: 'wake' | 'success' | 'sleep') => {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playNote = (freq: number, startOffset: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.05, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration);
    };

    if (type === 'wake') {
      playNote(523.25, 0, 0.09);
      playNote(783.99, 0.09, 0.14);
    } else if (type === 'success') {
      playNote(523.25, 0, 0.07);
      playNote(659.25, 0.07, 0.07);
      playNote(1046.5, 0.14, 0.16);
    } else {
      playNote(587.33, 0, 0.1);
      playNote(440.0, 0.1, 0.15);
    }
  } catch {
    // Ignore audio context restriction errors
  }
};

const matchesAny = (cmd: string, keywords: string[]): boolean => {
  return keywords.some(kw => cmd.includes(kw));
};

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
  petName,
  onFeed,
  onDrink,
  onStroke,
  onLevelUp,
  onAction,
  onChangeRoom = () => {},
  onChangeScale = () => {},
  onNavigate = () => {},
  onOpenModal = () => {},
  onSpeechBubble = () => {},
  onPlayMusic = () => {},
  onStopMusic = () => {},
  onResumeBgm = () => {},
  onStartTimer = () => {},
  compact = false,
  embedded = false,
  autoStart = false,
  onClosePanel
}) => {
  const [isListening, setIsListening] = useState(autoStart);
  const [isAwake, setIsAwake] = useState(false);
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(true);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [lastExecuted, setLastExecuted] = useState<string | null>(null);
  const [showCommandGuide, setShowCommandGuide] = useState(false);
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);
  const [browserSupported, setBrowserSupported] = useState(true);

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(autoStart);
  const isAwakeRef = useRef(false);
  const awakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPrefixRef = useRef<string>('');
  const lastCommandTimeRef = useRef<number>(0);
  const lastExecutedCmdRef = useRef<string>('');
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const sessionStartIndexRef = useRef<number>(0);
  const silenceDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    if (autoStart && browserSupported && !isListeningRef.current) {
      setIsListening(true);
      isListeningRef.current = true;
      try {
        recognitionRef.current?.start();
      } catch {
        // Ignore already started
      }
    }
  }, [autoStart, browserSupported]);

  useEffect(() => {
    isAwakeRef.current = isAwake;
  }, [isAwake]);

  // Speak authentic Vietnamese audio via backend Google TTS proxy (with Web Speech fallback)
  const speakVietnamese = useCallback(
    (text: string) => {
      if (!voiceReplyEnabled) return;
      void playTtsSpeech(text);
    },
    [voiceReplyEnabled]
  );

  const wakeGreetingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Trigger wake state ("HEY ANY" / "ANY" detected)
  const triggerWakeState = useCallback(
    (silentVoice = false) => {
      setIsAwake(true);
      isAwakeRef.current = true;
      pendingPrefixRef.current = '';
      if (aiFallbackTimerRef.current) clearTimeout(aiFallbackTimerRef.current);
      if (wakeGreetingTimerRef.current) clearTimeout(wakeGreetingTimerRef.current);

      if (!silentVoice) {
        playRetroTone('wake');
        const wakeMsg = 'Em đây đại ca! Đại ca cần em làm gì ạ?';
        onAction('WAVING', wakeMsg);
        speakVietnamese('Em đây đại ca');
      }

      if (awakeTimeoutRef.current) clearTimeout(awakeTimeoutRef.current);
      awakeTimeoutRef.current = setTimeout(() => {
        setIsAwake(false);
        isAwakeRef.current = false;
        pendingPrefixRef.current = '';
        setLiveTranscript('');
      }, 14000);
    },
    [onAction, speakVietnamese]
  );

  // Execute parsed command (returns true if a known deterministic command matched, false otherwise)
  const executeKnownCommand = useCallback(
    (rawCommand: string, includeWakeGreeting = false): boolean => {
      const cmd = rawCommand.toLowerCase().trim();
      if (!cmd || cmd.length < 2) return false;

      const now = Date.now();
      if (now - lastCommandTimeRef.current < 2800) return true;
      if (
        lastExecutedCmdRef.current &&
        (cmd === lastExecutedCmdRef.current || cmd.includes(lastExecutedCmdRef.current)) &&
        now - lastCommandTimeRef.current < 4500
      ) {
        return true;
      }

      const confirmSuccess = (label: string, speechText?: string) => {
        lastCommandTimeRef.current = Date.now();
        lastExecutedCmdRef.current = cmd;
        pendingPrefixRef.current = '';
        if (aiFallbackTimerRef.current) clearTimeout(aiFallbackTimerRef.current);
        if (wakeGreetingTimerRef.current) clearTimeout(wakeGreetingTimerRef.current);
        playRetroTone('success');
        setLastExecuted(label);
        setIsAwake(false);
        isAwakeRef.current = false;
        if (awakeTimeoutRef.current) clearTimeout(awakeTimeoutRef.current);
        if (speechText) {
          speakVietnamese(speechText);
        } else if (includeWakeGreeting) {
          speakVietnamese('Dạ đại ca!');
        }
      };

      // =========================================================================
      // 1. STOP MUSIC / RESUME BACKGROUND MUSIC ("tắt nhạc", "tắc nhạc", "dừng nhạc", "bật nhạc nền")
      // =========================================================================
      if (
        matchesAny(cmd, [
          'tắt nhạc',
          'tắc nhạc',
          'dừng nhạc',
          'ngừng nhạc',
          'ngưng nhạc',
          'tắt bài',
          'tắc bài',
          'dừng bài',
          'tắt âm thanh',
          'im lặng'
        ])
      ) {
        onStopMusic();
        onSpeechBubble('Em đã tắt nhạc cho đại ca rồi ạ!');
        confirmSuccess('Đã tắt nhạc', 'Dạ, em đã tắt nhạc cho đại ca rồi ạ!');
        return true;
      }

      if (matchesAny(cmd, ['bật nhạc nền', 'mở nhạc nền', 'tiếp tục nhạc', 'phát nhạc nền'])) {
        onResumeBgm();
        onSpeechBubble('Em đã bật lại nhạc nền thư giãn cho đại ca!');
        confirmSuccess('Bật nhạc nền Web', 'Dạ, em đã bật lại nhạc nền cho đại ca rồi ạ!');
        return true;
      }

      // =========================================================================
      // 2. WEB NAVIGATION & MODALS (Checked BEFORE music so "mở cửa hàng" NEVER triggers music!)
      // =========================================================================
      if (
        matchesAny(cmd, [
          'cửa hàng',
          'mở shop',
          'vào shop',
          'qua shop',
          'sóp',
          'xóp',
          'mở tiệm',
          'mua đồ',
          'mua sắm',
          'mua vật phẩm',
          'mua phụ kiện',
          'mua quần áo'
        ])
      ) {
        onNavigate('SHOP');
        onSpeechBubble('Em đã mở Cửa Hàng vật phẩm cho đại ca rồi ạ!');
        confirmSuccess('Mở Cửa Hàng', 'Dạ, em mở cửa hàng cho đại ca mua sắm ạ!');
        return true;
      }
      if (matchesAny(cmd, ['nhiệm vụ', 'mở nhiệm vụ', 'làm nhiệm vụ', 'xem nhiệm vụ', 'nhận thưởng'])) {
        onNavigate('QUESTS');
        onSpeechBubble('Em đã mở danh sách Nhiệm Vụ cho đại ca!');
        confirmSuccess('Mở Nhiệm Vụ', 'Dạ, em mở danh sách nhiệm vụ cho đại ca ạ!');
        return true;
      }
      if (matchesAny(cmd, ['xếp hạng', 'bảng xếp hạng', 'đua top', 'xem top', 'hạng mấy'])) {
        onNavigate('LEADERBOARD');
        onSpeechBubble('Em đã mở Bảng Xếp Hạng cho đại ca!');
        confirmSuccess('Mở Bảng Xếp Hạng', 'Dạ, em mở bảng xếp hạng cho đại ca xem ạ!');
        return true;
      }
      if (matchesAny(cmd, ['phòng chung', 'không gian chung', 'phòng ban', 'vườn chung', 'khu vườn chung'])) {
        onNavigate('GARDEN');
        onSpeechBubble('Em đưa đại ca vào Phòng Chung ạ!');
        confirmSuccess('Mở Phòng Chung', 'Dạ, em đưa đại ca vào phòng chung ạ!');
        return true;
      }
      if (matchesAny(cmd, ['trợ lý ai', 'trợ lý', 'ây ai', 'phòng chat', 'nhắn tin ai'])) {
        onNavigate('AI_CHAT');
        onSpeechBubble('Em đã mở phòng Trợ Lý AI cho đại ca!');
        confirmSuccess('Mở Trợ Lý AI', 'Dạ, em mở mục trò chuyện AI cho đại ca ạ!');
        return true;
      }
      if (matchesAny(cmd, ['bảng điều khiển', 'mở dashboard', 'mở ứng dụng', 'mở app', 'màn hình chính'])) {
        if (typeof window !== 'undefined' && (window as any).officePet?.showDashboard) {
          (window as any).officePet.showDashboard();
        }
        onNavigate('PET');
        confirmSuccess('Mở Bảng Điều Khiển', 'Dạ, em mở bảng điều khiển chính cho đại ca ạ!');
        return true;
      }
      if (matchesAny(cmd, ['bạn bè', 'tin nhắn', 'kết bạn'])) {
        onOpenModal('FRIENDS');
        confirmSuccess('Mở Bạn Bè & Tin Nhắn', 'Dạ, em mở danh sách bạn bè và tin nhắn ạ!');
        return true;
      }
      if (matchesAny(cmd, ['hướng dẫn', 'trợ giúp', 'cách dùng'])) {
        onOpenModal('GUIDE');
        confirmSuccess('Mở Hướng Dẫn', 'Dạ, đây là bảng hướng dẫn sử dụng ạ!');
        return true;
      }
      if (matchesAny(cmd, ['hít thở', 'tập thở', 'thiền'])) {
        onOpenModal('BREATHING');
        confirmSuccess('Mở Bài Tập Hít Thở', 'Dạ, đại ca cùng hít thở sâu và thư giãn với em nhé!');
        return true;
      }
      if (matchesAny(cmd, ['đổi thú', 'chọn thú', 'đổi pet'])) {
        onOpenModal('PET_SELECTOR');
        confirmSuccess('Mở Chọn Thú Cưng', 'Dạ, đại ca muốn chọn bé thú cưng nào ạ?');
        return true;
      }

      // =========================================================================
      // 3. ROOM BACKGROUND THEMES
      // =========================================================================
      if (matchesAny(cmd, ['quán cafe', 'quán cà phê', 'cà phê', 'ca fe', 'ca phê', 'tiệm cafe'])) {
        onNavigate('PET');
        onChangeRoom('cafe');
        onSpeechBubble('Em đã chuyển sang không gian Quán Cafe ấm cúng cho đại ca!');
        confirmSuccess('Đổi phòng: Quán Cafe', 'Dạ, mình vào quán cà phê ấm cúng rồi ạ!');
        return true;
      }
      if (matchesAny(cmd, ['vườn xuân', 'ra vườn', 'phòng vườn'])) {
        onNavigate('PET');
        onChangeRoom('garden');
        onSpeechBubble('Em đã chuyển ra Vườn Xuân thoáng đãng!');
        confirmSuccess('Đổi phòng: Vườn Xuân', 'Dạ, mình ra vườn xuân mát mẻ rồi ạ!');
        return true;
      }
      if (matchesAny(cmd, ['góc zen', 'phòng zen', 'góc gen', 'phòng gen', 'góc den', 'văn phòng'])) {
        onNavigate('PET');
        onChangeRoom('office');
        onSpeechBubble('Em đã chuyển vào Góc Zen tĩnh lặng!');
        confirmSuccess('Đổi phòng: Góc Zen', 'Dạ, em đã chuyển sang góc Zen yên tĩnh ạ!');
        return true;
      }
      if (matchesAny(cmd, ['bãi biển', 'ra biển', 'đi biển'])) {
        onNavigate('PET');
        onChangeRoom('beach');
        onSpeechBubble('Em đã chuyển ra Bãi Biển ngắm hoàng hôn!');
        confirmSuccess('Đổi phòng: Bãi Biển', 'Dạ, mình ra bãi biển ngắm hoàng hôn thôi ạ!');
        return true;
      }
      if (matchesAny(cmd, ['sàn gỗ', 'phòng gỗ'])) {
        onNavigate('PET');
        onChangeRoom('room');
        onSpeechBubble('Em đã chuyển về Phòng Sàn Gỗ cổ điển!');
        confirmSuccess('Đổi phòng: Sàn Gỗ', 'Dạ, mình về phòng sàn gỗ rồi ạ!');
        return true;
      }
      if (matchesAny(cmd, ['phòng thú cưng', 'về phòng', 'trang chủ', 'về nhà'])) {
        onNavigate('PET');
        confirmSuccess('Về Phòng Thú Cưng', 'Dạ, em đưa đại ca về phòng thú cưng ạ!');
        return true;
      }

      // =========================================================================
      // 4. TIMER / HẸN GIỜ / BÁO THỨC / POMODORO COMMANDS
      // =========================================================================
      if (matchesAny(cmd, ['tắt chuông', 'dừng chuông', 'tắt báo thức', 'ngừng chuông'])) {
        onStartTimer(0, false, 'STOP_ALARM');
        onSpeechBubble('Em đã tắt nhạc chuông báo thức cho đại ca rồi ạ!');
        confirmSuccess('Tắt chuông báo thức', 'Dạ, em đã tắt chuông báo thức cho đại ca rồi ạ!');
        return true;
      }

      // Clock-Time Alarm (e.g., "cài 3h chiều báo tôi", "3h báo tôi", "đặt báo thức 15h")
      const clockAlarm = extractClockAlarmFromCommand(cmd);
      if (
        clockAlarm &&
        (matchesAny(cmd, [
          'báo tôi',
          'nhắc tôi',
          'báo thức',
          'nhắc hẹn',
          'cài',
          'đặt',
          'hẹn',
          'chiều',
          'sáng',
          'trưa',
          'tối',
          'lúc'
        ]) ||
          clockAlarm.hour24 >= 13)
      ) {
        onStartTimer(0, false, 'SET_CLOCK_ALARM', clockAlarm.time24, clockAlarm.label);
        const minuteSpeech = clockAlarm.minute > 0 ? ` ${clockAlarm.minute} phút` : '';
        onSpeechBubble(
          `⏰ Đã cài báo thức lúc ${clockAlarm.time24} cho đại ca! Đúng ${clockAlarm.time24} em sẽ mở nhạc chuông đánh thức đại ca nhé!`
        );
        confirmSuccess(
          `Đã cài báo thức lúc ${clockAlarm.time24}`,
          `Dạ, em đã cài báo thức lúc ${clockAlarm.hour24} giờ${minuteSpeech} cho đại ca rồi ạ!`
        );
        return true;
      }

      if (
        matchesAny(cmd, [
          'hẹn giờ',
          'cài giờ',
          'cài thời gian',
          'báo thức',
          'thông báo sau',
          'nghỉ giải lao',
          'đếm ngược',
          'đặt giờ',
          'bấm giờ',
          'đồng hồ',
          'pomodoro',
          'momodo',
          'mô mô đô',
          'pô mô đô',
          'bô mô đô',
          'cô mô đô',
          'tô mô đô',
          'komodo',
          'bomodoro',
          'po mo',
          'bo mo',
          'mo do',
          'mô đô',
          'modo',
          'pomo',
          'bomo',
          'momo',
          'tập trung'
        ]) ||
        /\d+\s*(?:phút|p\b)/.test(cmd)
      ) {
        if (matchesAny(cmd, ['tạm dừng', 'dừng lại', 'ngừng'])) {
          onStartTimer(25, false, 'PAUSE');
          onSpeechBubble('Em đã tạm dừng đồng hồ hẹn giờ cho đại ca!');
          confirmSuccess('Tạm dừng hẹn giờ', 'Dạ, em đã tạm dừng đồng hồ hẹn giờ ạ!');
          return true;
        }
        if (matchesAny(cmd, ['đặt lại', 'reset', 'hủy hẹn giờ', 'làm mới'])) {
          onStartTimer(25, false, 'RESET');
          onSpeechBubble('Em đã đặt lại đồng hồ hẹn giờ!');
          confirmSuccess('Đặt lại hẹn giờ', 'Dạ, em đã đặt lại đồng hồ hẹn giờ ạ!');
          return true;
        }

        const requestedMinutes = extractMinutesFromCommand(cmd) || 25;
        onStartTimer(requestedMinutes, true, 'START');
        onSpeechBubble(`Đã bắt đầu cài giờ ${requestedMinutes} phút! Hết giờ em sẽ mở nhạc chuông đánh thức đại ca nhé!`);
        confirmSuccess(
          `Cài giờ ${requestedMinutes} phút (Đang chạy)`,
          `Dạ, em đã cài giờ ${requestedMinutes} phút, hết giờ em sẽ bật nhạc chuông báo cho đại ca ạ!`
        );
        return true;
      }

      // =========================================================================
      // 5. PET CARE, ACTIONS & SCALE
      // =========================================================================
      if (matchesAny(cmd, ['ăn mừng', 'hoan hô', 'chiến thắng', 'chúc mừng'])) {
        onNavigate('PET');
        onAction('CELEBRATING', 'Hoan hô! Cùng ăn mừng thành quả tuyệt vời của đại ca nào!');
        confirmSuccess('Ăn mừng', 'Hoan hô, chúc mừng đại ca nha!');
        return true;
      }

      const isFeedCommand =
        !cmd.includes('ăn mừng') &&
        !matchesAny(cmd, ['bài hát', 'bài nhạc', 'ca khúc', 'mở bài', 'bật bài', 'phát bài']) &&
        (matchesAny(cmd, [
          'cho ăn',
          'cho pet ăn',
          'cho bét ăn',
          'cho pét ăn',
          'cho bết ăn',
          'cho tét ăn',
          'cho tết ăn',
          'cho phét ăn',
          'cho best ăn',
          'cho thú cưng ăn',
          'cho thú ăn',
          'cho bé ăn',
          'cho bé cưng ăn',
          'cho em ăn',
          'cho nó ăn',
          'cho con ăn',
          'cho mèo ăn',
          'cho chó ăn',
          'cho cún ăn',
          'pet ăn',
          'bét ăn',
          'pét ăn',
          'thú cưng ăn',
          'bé ăn',
          'bé cưng ăn',
          'em ăn',
          'ăn đi',
          'ăn cơm',
          'ăn bánh',
          'ăn uống',
          'ăn thôi',
          'ăn nhé',
          'ăn nha',
          'ăn nào',
          'ăn luôn',
          'ăn cá',
          'ăn thịt',
          'ăn cỏ',
          'ăn xương',
          'bón ăn',
          'đút ăn',
          'nạp thức ăn',
          'măm măm'
        ]) ||
          /\b(cho|đút|bón)\b.*\băn\b/.test(cmd) ||
          /\b(pet|pét|bét|bết|tét|tết|phét|best|bé|thú\s*cưng|thú|em|nó)\s+ăn\b/.test(cmd) ||
          cmd === 'ăn');

      if (isFeedCommand) {
        onNavigate('PET');
        onFeed();
        confirmSuccess('Cho thú cưng ăn', 'Măm măm, em cảm ơn đại ca đã cho em ăn ngon ạ!');
        return true;
      }

      if (
        matchesAny(cmd, [
          'uống nước',
          'cho uống',
          'cho pet uống',
          'cho bét uống',
          'cho pét uống',
          'cho thú cưng uống',
          'cho thú uống',
          'cho bé uống',
          'cho em uống',
          'pet uống',
          'bét uống',
          'uống đi',
          'uống thôi',
          'uống nhé',
          'uống nha',
          'uống trà',
          'khát nước',
          'uống sữa'
        ]) ||
        /\b(cho|đút)\b.*\buống\b/.test(cmd)
      ) {
        onNavigate('PET');
        onDrink();
        confirmSuccess('Cho thú cưng uống nước', 'Nước mát quá, em cảm ơn đại ca ạ!');
        return true;
      }
      if (matchesAny(cmd, ['vuốt ve', 'xoa đầu', 'cưng nựng', 'thương thương', 'nựng', 'âu yếm', 'vỗ về', 'xoa lưng'])) {
        onNavigate('PET');
        onStroke();
        confirmSuccess('Vuốt ve thú cưng', 'Hihi, được đại ca xoa đầu thích quá đi ạ!');
        return true;
      }
      if (matchesAny(cmd, ['thăng cấp', 'lên cấp', 'nâng cấp', 'tiến hóa'])) {
        onNavigate('PET');
        onLevelUp();
        confirmSuccess('Thăng cấp thú cưng', 'Dạ, để em kiểm tra bể chứa kinh nghiệm để thăng cấp ạ!');
        return true;
      }
      if (matchesAny(cmd, ['ngáp ngủ', 'ngáp đi', 'ngáp', 'buồn ngủ'])) {
        onNavigate('PET');
        onAction('YAWNING', 'Ngáp một hơi dài, em hơi buồn ngủ một chút...');
        confirmSuccess('Ngáp ngủ', 'Dạ, em hơi buồn ngủ một xíu ạ');
        return true;
      }
      if (
        matchesAny(cmd, [
          'đi ngủ',
          'ngủ đi',
          'ngủ thôi',
          'khò khò',
          'cho ngủ',
          'cho pet ngủ',
          'cho bét ngủ',
          'cho bé ngủ',
          'cho thú cưng ngủ',
          'pet ngủ',
          'ngủ nhé',
          'ngủ nha',
          'ngủ ngon'
        ]) ||
        /\bcho\b.*\bngủ\b/.test(cmd)
      ) {
        onNavigate('PET');
        onAction('SLEEPING', 'Em đi ngủ đây... Chúc đại ca một ngày tốt lành ạ!');
        confirmSuccess('Đi ngủ', 'Dạ, em đi ngủ đây ạ, khò khò');
        return true;
      }
      if (
        matchesAny(cmd, ['thức dậy', 'dậy đi', 'dậy thôi', 'tỉnh dậy', 'dậy nào', 'gọi dậy', 'kêu dậy', 'đánh thức', 'tỉnh giấc']) ||
        /\b(gọi|kêu|đánh\s*thức)\b.*\bdậy\b/.test(cmd)
      ) {
        onNavigate('PET');
        onAction('WAKING_UP', 'Em tỉnh dậy rồi, sẵn sàng đồng hành cùng đại ca!');
        confirmSuccess('Thức dậy', 'Dạ, em thức dậy rồi đây đại ca ơi!');
        return true;
      }
      if (matchesAny(cmd, ['đói bụng', 'đói quá', 'đói rồi', 'bụng đói', 'đói chưa'])) {
        onNavigate('PET');
        onAction('HUNGRY', 'Bụng em đói cồn cào rồi, đại ca cho em ăn nhé!');
        confirmSuccess('Biểu cảm Đói bụng', 'Đại ca ơi, bụng em đói cồn cào rồi ạ');
        return true;
      }
      if (matchesAny(cmd, ['đứng yên', 'đứng im', 'đứng lại', 'đứng ngoan', 'nghỉ ngơi', 'bình thường'])) {
        onNavigate('PET');
        onAction('IDLE', 'Em đứng ngoan nhìn đại ca làm việc ạ.');
        confirmSuccess('Đứng yên', 'Dạ, em đứng ngoan ở đây với đại ca ạ');
        return true;
      }
      if (matchesAny(cmd, ['làm việc', 'gõ phím', 'code đi', 'học bài', 'đánh máy', 'làm bài'])) {
        onNavigate('PET');
        onAction('TYPING', 'Tập trung gõ phím làm việc chăm chỉ cùng đại ca!');
        confirmSuccess('Làm việc chăm chỉ', 'Dạ, em cùng làm việc chăm chỉ với đại ca nhé!');
        return true;
      }
      if (matchesAny(cmd, ['tập thể dục', 'thể dục', 'vận động', 'thể thao', 'hít đất', 'tập gym', 'chạy bộ'])) {
        onNavigate('PET');
        onAction('EXERCISING', 'Vận động rèn luyện thể lực dẻo dai!');
        confirmSuccess('Tập thể dục', 'Một hai một hai, em tập thể dục cho khỏe mạnh ạ!');
        return true;
      }
      if (matchesAny(cmd, ['nhảy múa', 'nhảy đi', 'múa đi', 'quẩy lên', 'khiêu vũ', 'nhún nhảy', 'nhảy nhót'])) {
        onNavigate('PET');
        onAction('DANCING', 'Nhún nhảy theo giai điệu vui tươi phục vụ đại ca!');
        confirmSuccess('Nhảy múa', 'Dạ, để em nhảy múa cho đại ca xem nhé!');
        return true;
      }
      if (matchesAny(cmd, ['vui vẻ', 'cười lên', 'cười đi', 'cười tươi', 'hạnh phúc', 'vui tươi'])) {
        onNavigate('PET');
        onAction('HAPPY', 'Ở bên đại ca lúc nào em cũng vui vẻ hết ạ!');
        confirmSuccess('Biểu cảm Vui vẻ', 'Ở bên đại ca lúc nào em cũng vui hết ạ!');
        return true;
      }
      if (matchesAny(cmd, ['vẫy tay', 'chào đi', 'xin chào', 'hello', 'chào đại ca', 'tạm biệt', 'bye bye'])) {
        onNavigate('PET');
        onAction('WAVING', 'Em xin chào đại ca! Chúc đại ca một ngày làm việc thật hiệu quả!');
        confirmSuccess('Vẫy tay chào', 'Em xin chào đại ca ạ!');
        return true;
      }
      if (matchesAny(cmd, ['cảm ơn', 'cám ơn', 'ngoan quá', 'giỏi quá', 'thank you', 'cúi đầu'])) {
        onNavigate('PET');
        onAction('THANKING', 'Em cúi đầu cảm ơn đại ca vì luôn yêu thương em!');
        confirmSuccess('Cảm ơn đại ca', 'Dạ, em cảm ơn đại ca nhiều lắm ạ!');
        return true;
      }
      if (matchesAny(cmd, ['làm nũng', 'nhõng nhẽo', 'buồn quá', 'khóc', 'dỗi', 'tủi thân'])) {
        onNavigate('PET');
        onAction('SAD', 'Em đang buồn một chút, muốn được đại ca dỗ dành cơ...');
        confirmSuccess('Làm nũng', 'Đại ca dỗ dành em đi mà');
        return true;
      }
      if (matchesAny(cmd, ['phóng to', 'kích thước to', 'to lên'])) {
        onNavigate('PET');
        onChangeScale('LARGE');
        onSpeechBubble('Em đã phóng to kích thước rồi ạ!');
        confirmSuccess('Đổi kích thước: To', 'Dạ, em đã phóng to lên rồi ạ!');
        return true;
      }
      if (matchesAny(cmd, ['thu nhỏ', 'kích thước nhỏ', 'nhỏ lại'])) {
        onNavigate('PET');
        onChangeScale('SMALL');
        onSpeechBubble('Em đã thu nhỏ kích thước lại rồi ạ!');
        confirmSuccess('Đổi kích thước: Nhỏ', 'Dạ, em đã thu nhỏ lại rồi ạ!');
        return true;
      }
      if (matchesAny(cmd, ['kích thước vừa', 'cỡ vừa'])) {
        onNavigate('PET');
        onChangeScale('MEDIUM');
        onSpeechBubble('Em đã chỉnh kích thước về mức Vừa!');
        confirmSuccess('Đổi kích thước: Vừa', 'Dạ, kích thước vừa vặn rồi ạ!');
        return true;
      }

      // =========================================================================
      // 6. FAVORITE PLAYLIST, WATCH HISTORY, SPECIFIC SONG REQUESTS & TRACK SKIPPING
      // =========================================================================
      if (
        matchesAny(cmd, [
          'thêm vào yêu thích',
          'lưu vào yêu thích',
          'thêm vào playlist',
          'lưu vào playlist',
          'thêm vào danh sách yêu thích',
          'thả tim bài',
          'thả tim nhạc',
          'yêu thích bài này',
          'thích bài này'
        ])
      ) {
        onPlayMusic('__ADD_TO_FAVORITES__', false);
        onSpeechBubble('❤️ Em đã lưu bài hát đang phát vào Playlist Yêu Thích của đại ca!');
        confirmSuccess(
          'Đã thêm vào Playlist Yêu Thích',
          'Dạ, em đã lưu bài hát này vào playlist yêu thích của đại ca rồi ạ!'
        );
        return true;
      }

      if (
        matchesAny(cmd, [
          'playlist yêu thích',
          'play list yêu thích',
          'lây lít yêu thích',
          'pờ lây lít yêu thích',
          'bờ lây lít yêu thích',
          'list yêu thích',
          'lít yêu thích',
          'danh sách yêu thích',
          'nhạc yêu thích',
          'bài yêu thích',
          'bài hát yêu thích',
          'mục yêu thích',
          'kho yêu thích',
          'phát yêu thích',
          'mở yêu thích',
          'bật yêu thích',
          'nghe yêu thích',
          'phát playlist',
          'mở playlist',
          'bật playlist',
          'nghe playlist',
          'phát play list',
          'mở play list',
          'bật play list',
          'phát danh sách',
          'mở danh sách nhạc'
        ]) ||
        (cmd.includes('yêu thích') &&
          matchesAny(cmd, [
            'phát',
            'mở',
            'bật',
            'nghe',
            'chơi',
            'chuyển',
            'vào',
            'xem',
            'nhạc',
            'bài',
            'list',
            'lít',
            'playlist',
            'danh sách'
          ]))
      ) {
        onPlayMusic('__PLAY_FAVORITES__', true);
        onSpeechBubble('❤️ Em đang mở và phát Playlist Yêu Thích của đại ca!');
        confirmSuccess(
          'Phát Playlist Yêu Thích',
          'Dạ, em mở và phát playlist yêu thích cho đại ca nghe ngay ạ!'
        );
        return true;
      }

      if (
        matchesAny(cmd, [
          'lịch sử xem',
          'lịch sử nghe',
          'lịch sử nhạc',
          'phát lịch sử',
          'mở lịch sử',
          'bật lịch sử',
          'xem lịch sử',
          'nghe lại lịch sử',
          'bài vừa nghe',
          'bài đã xem'
        ])
      ) {
        onPlayMusic('__PLAY_HISTORY__', true);
        onSpeechBubble('🕒 Em đã mở Lịch Sử Xem và phát lại bài gần nhất cho đại ca!');
        confirmSuccess(
          'Phát Lịch Sử Xem',
          'Dạ, em mở lịch sử xem và phát bài gần nhất cho đại ca ngay ạ!'
        );
        return true;
      }

      if (matchesAny(cmd, ['bài trước', 'quay lại bài trước', 'lùi bài', 'nghe lại bài trước'])) {
        onPlayMusic('__PREV_TRACK__', true);
        onSpeechBubble('Em đã quay lại bài hát trước cho đại ca!');
        confirmSuccess('Quay lại bài trước', 'Dạ, em đã chuyển về bài hát trước cho đại ca rồi ạ!');
        return true;
      }

      const extractedSong = extractSongQuery(cmd);
      if (extractedSong) {
        const isGenericLofi = ['lofi', 'lô phi', 'lo fi', 'lô fi', 'thư giãn', 'chill'].includes(
          extractedSong.toLowerCase()
        );
        const finalQuery = isGenericLofi ? 'nhạc lofi chill học bài' : extractedSong;
        onPlayMusic(finalQuery, true);
        const isChangeIntent = cmd.includes('đổi') || cmd.includes('chuyển');
        const bubbleMsg = isChangeIntent
          ? `Đang tìm và đổi sang bài "${extractedSong}" cho đại ca!`
          : `Đang tìm và phát bài "${extractedSong}" cho đại ca!`;
        const speechMsg = isChangeIntent
          ? `Dạ, em đổi sang bài ${extractedSong} cho đại ca nghe ngay ạ!`
          : `Dạ, em mở bài ${extractedSong} cho đại ca nghe ngay ạ!`;
        onSpeechBubble(bubbleMsg);
        confirmSuccess(
          isChangeIntent ? `Đổi sang bài: ${extractedSong}` : `Phát bài: ${extractedSong}`,
          speechMsg
        );
        return true;
      }

      if (
        matchesAny(cmd, [
          'đổi bài khác',
          'đổi bài',
          'mở bài khác',
          'bật bài khác',
          'phát bài khác',
          'nghe bài khác',
          'chuyển bài khác',
          'chuyển bài',
          'qua bài khác',
          'qua bài',
          'bài tiếp theo',
          'bài kế tiếp',
          'bài sau',
          'next bài',
          'đổi nhạc khác',
          'đổi nhạc',
          'chuyển nhạc'
        ])
      ) {
        onPlayMusic('__NEXT_TRACK__', true);
        onSpeechBubble('Em đang đổi sang bài tiếp theo cho đại ca...');
        confirmSuccess('Đổi sang bài khác', 'Dạ, em đổi sang bài hát tiếp theo cho đại ca liền đây ạ!');
        return true;
      }

      // =========================================================================
      // 7. GENERAL MUSIC TAB NAVIGATION ("mở nhạc lofi", "bật nhạc")
      // =========================================================================
      if (
        matchesAny(cmd, [
          'nhạc lofi',
          'lô phi',
          'lo fi',
          'lô fi',
          'lâu phai',
          'bật nhạc',
          'mở nhạc',
          'nghe nhạc',
          'phát nhạc',
          'âm nhạc',
          'vào nhạc'
        ])
      ) {
        onPlayMusic('nhạc lofi chill học bài', true);
        confirmSuccess('Mở & Phát Nhạc Lofi', 'Dạ, em bật nhạc Lofi thư giãn cho đại ca nghe nhé!');
        return true;
      }

      return false;
    },
    [
      onFeed,
      onDrink,
      onStroke,
      onLevelUp,
      onAction,
      onChangeRoom,
      onChangeScale,
      onNavigate,
      onOpenModal,
      onSpeechBubble,
      onPlayMusic,
      onStopMusic,
      onResumeBgm,
      onStartTimer,
      speakVietnamese
    ]
  );

  // Send unrecognized natural language sentence to trained Backend AI
  const executeAIFallback = useCallback(
    async (rawCommand: string) => {
      const cmd = rawCommand.toLowerCase().trim();
      if (cmd.length < 4 || isIncompleteCommandPrefix(cmd)) return;

      const now = Date.now();
      if (now - lastCommandTimeRef.current < 1500) return;

      lastCommandTimeRef.current = now;
      pendingPrefixRef.current = '';
      playRetroTone('success');
      setLastExecuted(`AI xử lý: "${rawCommand}"`);
      setIsAwake(false);
      isAwakeRef.current = false;
      if (awakeTimeoutRef.current) clearTimeout(awakeTimeoutRef.current);

      onSpeechBubble('Em đang xử lý yêu cầu của đại ca...');
      try {
        const res = await api.chatWithAI(rawCommand);
        const data = res.data;

        if (data?.action) {
          if (data.action.type === 'NAVIGATE_TAB' && data.action.tab) {
            onNavigate(data.action.tab);
          } else if (data.action.type === 'STOP_MUSIC') {
            onStopMusic();
          } else if (data.action.type === 'START_POMODORO') {
            onStartTimer(data.action.duration || 25, true, 'START');
          } else if (data.action.type === 'START_BREATHING') {
            onOpenModal('BREATHING');
          } else if (data.action.type === 'PLAY_MEDIA' && data.musicAction?.query) {
            onPlayMusic(data.musicAction.query, true);
          } else if (data.action.type === 'PET_ACTION' && data.action.petAction) {
            onNavigate('PET');
            const act = data.action.petAction;
            if (act === 'FEED' || act === 'EATING') {
              onFeed();
            } else if (act === 'DRINK' || act === 'DRINKING') {
              onDrink();
            } else if (act === 'STROKE' || act === 'PETTING') {
              onStroke();
            } else if (act === 'LEVEL_UP' || act === 'EVOLVING') {
              onLevelUp();
            } else {
              onAction(act as AnimationState, data.reply || 'Em thực hiện ngay đây đại ca!');
            }
          }
        }

        if (data?.reply) {
          onSpeechBubble(data.reply);
          speakVietnamese(data.reply);
        }
      } catch {
        const fallbackMsg = 'Em đây đại ca, em luôn ở bên cổ vũ đại ca làm việc thật tốt nhé!';
        onSpeechBubble(fallbackMsg);
        speakVietnamese(fallbackMsg);
      }
    },
    [onNavigate, onStopMusic, onStartTimer, onOpenModal, onPlayMusic, onFeed, onDrink, onStroke, onLevelUp, onAction, onSpeechBubble, speakVietnamese]
  );

  // Setup Web Speech API
  useEffect(() => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setBrowserSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    recognition.onresult = (event: any) => {
      if (isTtsSpeaking()) {
        // Ignore mic input while the pet is speaking out loud or audio echo is settling
        return;
      }

      let interimTranscript = '';
      let finalTranscript = '';
      const allAlternativePhrases: string[] = [];

      const startIdx = Math.min(sessionStartIndexRef.current, event.results.length);
      for (let i = startIdx; i < event.results.length; i++) {
        const item = event.results[i];
        const transcript = item[0]?.transcript || '';
        if (item.isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
        for (let altIdx = 0; altIdx < item.length; altIdx++) {
          const altText = item[altIdx]?.transcript?.toLowerCase()?.trim();
          if (altText) allAlternativePhrases.push(altText);
        }
      }

      const isFinalResult = event.results[event.results.length - 1]?.isFinal || false;
      const rawCombined = `${finalTranscript} ${interimTranscript}`.toLowerCase().trim();
      if (!rawCombined) return;

      // Strip self-echo if mic hears the pet's own TTS greeting or replies
      const cleanedRaw = rawCombined
        .replace(/^(?:em đây\s+)?(?:đại ca|chủ nhân)(?:\s+dạ)?[.,!?\s]*/i, '')
        .replace(/^(?:dạ\s+)?(?:em đây\s+)?(?:đại ca|chủ nhân)[.,!?\s]*/i, '')
        .replace(/^(?:dạ|vâng)[.,!?\s]+/i, '')
        .trim();
      if (!cleanedRaw) return;

      // Combine with any buffered prefix
      const fullPhrase = pendingPrefixRef.current
        ? `${pendingPrefixRef.current} ${cleanedRaw}`.trim()
        : cleanedRaw;

      setLiveTranscript(fullPhrase);

      // Check if transcript (or any STT alternative) contains a wake word ("HEY ANY", "ANY", etc.)
      let wakeMatch = findWakeWordInPhrase(fullPhrase);
      if (!wakeMatch) {
        for (const alt of allAlternativePhrases) {
          const altMatch = findWakeWordInPhrase(alt);
          if (altMatch) {
            wakeMatch = altMatch;
            break;
          }
        }
      }

      if (wakeMatch) {
        const { commandAfterWake } = wakeMatch;

        // If user spoke "HEY ANY" / "ANY" + a command in one single breath (e.g. "any cho pet ăn")
        if (commandAfterWake.length >= 2) {
          if (wakeGreetingTimerRef.current) {
            clearTimeout(wakeGreetingTimerRef.current);
            wakeGreetingTimerRef.current = null;
          }

          if (isIncompleteCommandPrefix(commandAfterWake)) {
            if (!isAwakeRef.current) triggerWakeState(true);
            if (isFinalResult) pendingPrefixRef.current = commandAfterWake;
            return;
          }

          const runWakeCommand = () => {
            const matched = executeKnownCommand(commandAfterWake, true);
            if (matched) {
              sessionStartIndexRef.current = event.results.length;
              pendingPrefixRef.current = '';
              return;
            }
            if (isFinalResult) {
              sessionStartIndexRef.current = event.results.length;
              pendingPrefixRef.current = '';
              void executeAIFallback(commandAfterWake);
            }
          };

          if (isFinalResult) {
            runWakeCommand();
          } else {
            if (silenceDebounceTimerRef.current) clearTimeout(silenceDebounceTimerRef.current);
            silenceDebounceTimerRef.current = setTimeout(runWakeCommand, 750);
          }

          if (!isAwakeRef.current) {
            triggerWakeState(true);
          }
          return;
        }

        // User just said "HEY ANY" / "ANY" with no command words yet
        if (isFinalResult) {
          if (wakeGreetingTimerRef.current) {
            clearTimeout(wakeGreetingTimerRef.current);
            wakeGreetingTimerRef.current = null;
          }
          sessionStartIndexRef.current = event.results.length;
          pendingPrefixRef.current = '';
          triggerWakeState(false);
        } else if (!isAwakeRef.current) {
          // Wake silently on interim and wait 550ms before speaking "Em đây đại ca" so we don't talk over the user
          triggerWakeState(true);
          if (wakeGreetingTimerRef.current) clearTimeout(wakeGreetingTimerRef.current);
          wakeGreetingTimerRef.current = setTimeout(() => {
            wakeGreetingTimerRef.current = null;
            if (isAwakeRef.current) {
              playRetroTone('wake');
              onAction('WAVING', 'Em đây đại ca! Đại ca cần em làm gì ạ?');
              speakVietnamese('Em đây đại ca');
            }
          }, 550);
        }
        return;
      }

      // Process spoken command (works both after wake word and directly while Voice Assistant is active)
      if (isIncompleteCommandPrefix(fullPhrase)) {
        if (isFinalResult) {
          pendingPrefixRef.current = fullPhrase;
        }
        return;
      }

      const processSpokenPhrase = (phraseToRun: string, isFinalCall: boolean) => {
        if (!phraseToRun || phraseToRun.length < 2) return;
        if (isIncompleteCommandPrefix(phraseToRun)) return;

        const matched = executeKnownCommand(phraseToRun, false);
        if (matched) {
          sessionStartIndexRef.current = event.results.length;
          pendingPrefixRef.current = '';
          return;
        }

        // If not matched, send to AI when awake or when using voice assistant
        if (isAwakeRef.current || embedded || isListening) {
          if (isFinalCall) {
            sessionStartIndexRef.current = event.results.length;
            pendingPrefixRef.current = '';
            void executeAIFallback(phraseToRun);
          }
        }
      };

      if (silenceDebounceTimerRef.current) clearTimeout(silenceDebounceTimerRef.current);

      if (isFinalResult) {
        if (aiFallbackTimerRef.current) clearTimeout(aiFallbackTimerRef.current);
        processSpokenPhrase(fullPhrase, true);
      } else {
        // Debounce: if user pauses speaking for 800ms, execute the full spoken sentence
        silenceDebounceTimerRef.current = setTimeout(() => {
          processSpokenPhrase(fullPhrase, true);
        }, 800);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setIsListening(false);
        isListeningRef.current = false;
        alert('Vui lòng cấp quyền Micro trên trình duyệt để sử dụng tính năng gọi "HEY ANY"!');
      }
    };

    recognition.onend = () => {
      sessionStartIndexRef.current = 0;
      if (isListeningRef.current) {
        try {
          recognition.start();
        } catch {
          // Ignore already started error
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (awakeTimeoutRef.current) clearTimeout(awakeTimeoutRef.current);
      if (aiFallbackTimerRef.current) clearTimeout(aiFallbackTimerRef.current);
      if (wakeGreetingTimerRef.current) clearTimeout(wakeGreetingTimerRef.current);
      try {
        recognition.stop();
      } catch {
        // Ignore
      }
    };
  }, [triggerWakeState, executeKnownCommand, executeAIFallback, onAction, speakVietnamese]);

  const toggleListening = () => {
    if (!browserSupported) {
      alert('Trình duyệt hiện tại chưa hỗ trợ Web Speech API. Bạn hãy mở bằng Google Chrome hoặc Microsoft Edge nhé!');
      return;
    }

    if (isListening) {
      setIsListening(false);
      isListeningRef.current = false;
      setIsAwake(false);
      isAwakeRef.current = false;
      pendingPrefixRef.current = '';
      playRetroTone('sleep');
      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignore
      }
    } else {
      setIsListening(true);
      isListeningRef.current = true;
      setIsPanelMinimized(false);
      playRetroTone('wake');
      try {
        recognitionRef.current?.start();
      } catch {
        // Ignore
      }
    }
  };

  return (
    <>
      {/* TRIGGER BUTTON (Hidden when embedded) */}
      {!embedded && (
        compact ? (
          <button
            type="button"
            onClick={toggleListening}
            title={isListening ? 'Tắt nhận diện giọng nói "HEY ANY"' : 'Bật trợ lý giọng nói "HEY ANY"'}
            className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${
              !isListening
                ? 'text-white/80 hover:bg-white/20 hover:text-amber-400'
                : isAwake
                ? 'bg-amber-400 text-slate-950 animate-pulse'
                : 'bg-emerald-500 text-slate-950'
            }`}
          >
            <Mic size={14} className={isListening ? 'animate-pulse' : ''} />
          </button>
        ) : (
          <button
            type="button"
            onClick={toggleListening}
            title={isListening ? 'Tắt nhận diện giọng nói "HEY ANY"' : 'Bật trợ lý giọng nói "HEY ANY"'}
            className={`h-8 px-3 rounded-md text-xs font-black border-2 border-slate-950 shadow-[0_2px_0_#000] active:translate-y-[2px] active:shadow-none transition flex items-center gap-1.5 ${
              !isListening
                ? 'bg-[#231e36] hover:bg-[#332b4f] text-amber-300'
                : isAwake
                ? 'bg-amber-400 text-slate-950 animate-pulse'
                : 'bg-emerald-500 text-slate-950'
            }`}
          >
            {isListening ? (
              <>
                <Radio size={14} className="animate-spin" />
                <span>{isAwake ? 'Em nghe đây đại ca...' : 'Đang đợi "HEY ANY"'}</span>
              </>
            ) : (
              <>
                <Mic size={14} className="text-amber-300" />
                <span>Gọi "HEY ANY"</span>
              </>
            )}
          </button>
        )
      )}

      {/* VOICE ASSISTANT HUD PANEL (Floating or Embedded) */}
      {(isListening || embedded) && (
        <div
          className={
            embedded
              ? 'relative w-full h-full flex flex-col bg-[#181528] text-white rounded-2xl overflow-hidden select-none border border-slate-800/80 shadow-md'
              : 'fixed bottom-4 right-4 z-50 w-80 sm:w-96 bg-[#181528] text-white border-3 border-slate-950 rounded-2xl shadow-[5px_5px_0px_#000] overflow-hidden select-none'
          }
        >
          {/* Header Bar */}
          <div className="bg-[#231e36] px-3.5 py-2.5 border-b-2 border-slate-950 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full border border-slate-950 ${
                  isAwake ? 'bg-amber-400 animate-ping' : isListening ? 'bg-emerald-400' : 'bg-slate-500'
                }`}
              />
              <span className="font-black text-xs uppercase tracking-wider text-amber-300">
                Trợ lý giọng nói "HEY ANY"
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setVoiceReplyEnabled(prev => !prev)}
                title={voiceReplyEnabled ? 'Tắt giọng đọc tiếng Việt' : 'Bật giọng đọc tiếng Việt'}
                className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-amber-300 transition"
              >
                {voiceReplyEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>
              <button
                type="button"
                onClick={() => setShowCommandGuide(prev => !prev)}
                title="Xem danh sách câu lệnh mẫu"
                className={`p-1 rounded hover:bg-slate-800 transition ${
                  showCommandGuide ? 'text-amber-400' : 'text-slate-300'
                }`}
              >
                <HelpCircle size={14} />
              </button>
              {!embedded && (
                <button
                  type="button"
                  onClick={() => setIsPanelMinimized(prev => !prev)}
                  title={isPanelMinimized ? 'Mở rộng bảng' : 'Thu gọn bảng'}
                  className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
                >
                  {isPanelMinimized ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
              )}
              <button
                type="button"
                onClick={toggleListening}
                title={isListening ? 'Tắt nhận diện giọng nói' : 'Bật nhận diện giọng nói'}
                className={`px-2 py-0.5 ml-1 rounded text-[10px] font-black border border-slate-950 transition ${
                  isListening
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {isListening ? 'Tắt' : 'Bật'}
              </button>
              {onClosePanel && (
                <button
                  type="button"
                  onClick={onClosePanel}
                  title="Đóng bảng"
                  className="p-1 ml-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {(!isPanelMinimized || embedded) && (
            <div className="p-3.5 space-y-3 flex-1 overflow-y-auto">
              {!isListening ? (
                <div className="flex flex-col items-center justify-center p-6 text-center space-y-3 bg-[#25203d] rounded-xl border-2 border-slate-950">
                  <div className="w-12 h-12 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-400">
                    <Mic size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-200">Microphone đang tắt</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Bấm nút bên dưới để bắt đầu nói chuyện với Any</p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleListening}
                    className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl border-2 border-slate-950 shadow-[2px_2px_0_#000]"
                  >
                    Bật Micro ngay
                  </button>
                </div>
              ) : (
                <>
                  {/* Status Display Box */}
                  <div
                    className={`p-3 rounded-xl border-2 border-slate-950 transition-all ${
                      isAwake ? 'bg-amber-400 text-slate-950' : 'bg-[#25203d] text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-black uppercase tracking-wider">
                        {isAwake ? '"Em đây đại ca!" — Đang nghe lệnh' : 'Chế độ chờ gọi "HEY ANY"'}
                      </span>
                      {!isAwake && (
                        <button
                          type="button"
                          onClick={() => triggerWakeState(false)}
                          className="px-2 py-0.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[10px] rounded border border-slate-950 shadow-[1px_1px_0_#000]"
                        >
                          Gọi Any ngay
                        </button>
                      )}
                    </div>

                    <p className={`text-xs font-bold leading-snug ${isAwake ? 'text-slate-900' : 'text-amber-200/90'}`}>
                      {liveTranscript ? (
                        <span>Đang nghe: "{liveTranscript}"</span>
                      ) : isAwake ? (
                        'Đại ca hãy nói lệnh (VD: "Cho ăn", "Uống nước", "Hẹn giờ 15 phút", "Mở nhạc"...)'
                      ) : (
                        'Hãy nói "HEY ANY" — Bé cưng sẽ thưa "Em đây đại ca" và thực hiện lệnh!'
                      )}
                    </p>
                  </div>

                  {/* Last Executed Command Badge */}
                  {lastExecuted && (
                    <div className="flex items-start gap-1.5 px-3 py-1.5 bg-emerald-950/70 border border-emerald-500/40 rounded-lg text-[11px]">
                      <span className="text-emerald-300 font-bold flex items-center gap-1 shrink-0 mt-0.5">
                        <Sparkles size={12} />
                        Đã thực hiện:
                      </span>
                      <span className="font-black text-white break-words flex-1 leading-snug">{lastExecuted}</span>
                    </div>
                  )}

                  {/* Quick Command Guide Cheat-Sheet */}
                  {showCommandGuide && (
                    <div className="bg-[#120f1d] border-2 border-slate-800 rounded-xl p-2.5 text-[11px] space-y-1.5 max-h-48 overflow-y-auto">
                      <div className="font-black text-amber-300 uppercase tracking-wider text-[10px]">
                        Gợi ý câu lệnh sau khi gọi "HEY ANY":
                      </div>
                      <div className="text-slate-300">
                        <strong className="text-white">• Chăm sóc Pet:</strong> "Cho ăn", "Uống nước", "Vuốt ve", "Thăng cấp", "Nhảy múa", "Đi ngủ".
                      </div>
                      <div className="text-slate-300">
                        <strong className="text-white">• Âm nhạc:</strong> "Mở nhạc", "Tắt nhạc", "Phát bài [tên bài]", "Đổi bài khác".
                      </div>
                      <div className="text-slate-300">
                        <strong className="text-white">• Tập trung & Hẹn giờ:</strong> "Hẹn giờ 25 phút", "Mở Pomodoro", "Tắt chuông".
                      </div>
                      <div className="text-slate-300">
                        <strong className="text-white">• Ứng dụng:</strong> "Mở bảng điều khiển", "Mở cửa hàng", "Mở nhiệm vụ", "Xem bảng xếp hạng".
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};
