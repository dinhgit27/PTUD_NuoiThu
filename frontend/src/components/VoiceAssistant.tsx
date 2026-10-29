import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Volume2, VolumeX, Sparkles, HelpCircle, ChevronDown, ChevronUp, Radio, Square, Loader2 } from 'lucide-react';
import { AnimationState } from '../types';
import { api } from '../services/api';
import { playTtsSpeech, stopTtsSpeech, onTtsStateChange, isTtsSpeaking } from '../utils/tts';

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

/**
 * Detect if a transcribed speech string is the pet's own acoustic echo
 * (e.g. pet responded through speakers and microphone captured the room sound).
 * Prevents runaway acoustic feedback loops.
 */
export function isPetSelfEcho(rawText: string): boolean {
  if (!rawText) return false;
  const text = rawText.toLowerCase().replace(/[.,!?;:"]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return false;

  // 1. Specific signature phrases produced by pet TTS responses
  const petSignatures = [
    'măm măm',
    'nước mát quá',
    'hihi thích quá',
    'xoa đầu thích quá',
    'được đại ca xoa đầu',
    'cảm ơn đại ca đã cho em',
    'cảm ơn đại ca đã nhắc',
    'cảm ơn đại ca đã vuốt ve',
    'cảm ơn đại ca vì luôn yêu thương',
    'cảm ơn đại ca nhiều lắm',
    'em cảm ơn đại ca',
    'đại ca cần em làm gì',
    'em đây đại ca',
    'em xin chào đại ca',
    'bé cưng đã lên cấp',
    'lên cấp rồi đại ca ơi',
    'em đi ngủ đây ạ',
    'em thức dậy rồi đây',
    'em đứng ngoan ở đây',
    'em cùng làm việc chăm chỉ',
    'em tập thể dục cho khỏe',
    'em nhảy múa cho đại ca',
    'em hơi buồn ngủ',
    'bụng em đói cồn cào rồi',
    'đại ca dỗ dành em đi',
    'một hai một hai em tập',
    'ở bên đại ca lúc nào em cũng',
    'đã tắt chuông báo thức cho đại ca',
    'đã tắt nhạc cho đại ca',
    'đã bật lại nhạc nền cho đại ca',
    'mở cửa hàng cho đại ca',
    'mở danh sách nhiệm vụ cho đại ca',
    'mở bảng xếp hạng cho đại ca',
    'đưa đại ca vào phòng',
    'đưa đại ca về phòng',
    'mở mục trò chuyện ai cho đại ca',
    'mở danh sách bạn bè',
    'bảng hướng dẫn sử dụng',
    'hít thở sâu và thư giãn với em',
    'đại ca muốn chọn bé thú cưng nào',
    'mình vào quán cà phê',
    'mình ra vườn xuân',
    'chuyển sang góc zen',
    'mình ra bãi biển',
    'mình về phòng sàn gỗ',
    'tạm dừng đồng hồ hẹn giờ',
    'đặt lại đồng hồ hẹn giờ',
    'hết giờ em sẽ bật nhạc chuông',
    'kiểm tra bể chứa kinh nghiệm',
    'đã phóng to lên rồi',
    'đã thu nhỏ lại rồi',
    'kích thước vừa vặn rồi',
    'chuyển về bài hát trước cho đại ca',
    'đổi sang bài hát khác cho đại ca',
    'bật nhạc lofi thư giãn',
    'đang phát bài',
    'em mở bài'
  ];

  for (const sig of petSignatures) {
    if (text.includes(sig)) {
      return true;
    }
  }

  // 2. Starts with pet submissive polite greetings: "dạ em...", "dạ để em...", "dạ mình...", "dạ đại ca..."
  if (/^dạ\s+(em|để\s+em|mình|đại\s+ca|đây\s+là)/i.test(text)) {
    return true;
  }

  // 3. Spoken sentences ending with "ạ" that address "đại ca" from "em" (pet speaking to master)
  if (/\b(em|bé)\b.*\bđại\s*ca\b.*\bạ$/i.test(text)) {
    return true;
  }

  return false;
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
    /(?:mở|bật|phát|nghe|tìm|chơi|đổi|chuyển)\s+(?:sang\s+|qua\s+)?(?:cho\s+(?:tôi|mình|anh|chị|em|bạn|chủ\s*nhân)\s+)?(?:nghe\s+)?(?:bài\s+hát|bài\s+nhạc|bản\s+nhạc|ca\s+khúc|bài|nhạc)\s+(.+)/i,
    /(?:cho\s+(?:tôi|mình|anh|chị|em|chủ\s*nhân)\s+nghe)\s+(?:bài\s+hát|bài\s+nhạc|bài|nhạc)\s+(.+)/i,
    /^(?:bài\s+hát|bài\s+nhạc|ca\s+khúc)\s+(.+)/i
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
    'cũ'
  ];

  for (const regex of patterns) {
    const match = cmd.match(regex);
    if (match && match[1]) {
      const cleaned = match[1]
        .replace(/\b(nha|nhé|đi|với|ạ|nào|luôn|cho\s+tôi|cho\s+mình)\b$/gi, '')
        .trim();
      if (cleaned.length >= 2 && !genericNextPrevWords.includes(cleaned.toLowerCase())) {
        return cleaned;
      }
    }
  }
  return null;
}

// Play retro 8-bit sound effect using Web Audio API (reusing singleton AudioContext to prevent renderer errors)
let sharedAudioCtx: AudioContext | null = null;
const playRetroTone = (type: 'wake' | 'success' | 'sleep') => {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      try {
        sharedAudioCtx = new AudioCtx();
      } catch {
        return;
      }
    }
    const ctx = sharedAudioCtx;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    const playNote = (freq: number, startOffset: number, duration: number) => {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + startOffset);
        gain.gain.setValueAtTime(0.04, now + startOffset);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + startOffset);
        osc.stop(now + startOffset + duration);
      } catch {
        // Ignore note error
      }
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
  const [recorderState, setRecorderState] = useState<'IDLE' | 'RECORDING' | 'TRANSCRIBING'>('IDLE');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isPanelOpen, setIsPanelOpen] = useState(autoStart);
  const [isAwake, setIsAwake] = useState(false);
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(true);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [lastExecuted, setLastExecuted] = useState<string | null>(null);
  const [showCommandGuide, setShowCommandGuide] = useState(false);
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);
  const [isContinuousMode, setIsContinuousMode] = useState<boolean>(false);
  const [isListeningActive, setIsListeningActive] = useState<boolean>(false);

  const isContinuousModeRef = useRef<boolean>(false);
  const isAudioPlayingRef = useRef<boolean>(false);
  const recognitionRef = useRef<any>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safeStartRecognitionRef = useRef<() => void>(() => {});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxRecordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPrefixRef = useRef<string>('');
  const lastCommandTimeRef = useRef<number>(0);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const isAwakeRef = useRef<boolean>(false);

  const propsRef = useRef({
    petName,
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
    onClosePanel
  });
  useEffect(() => {
    propsRef.current = {
      petName,
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
      onClosePanel
    };
  });

  useEffect(() => {
    isAwakeRef.current = isAwake;
  }, [isAwake]);

  // Synchronize with global TTS state (App.tsx, MusicPlayer.tsx, VoiceAssistant) to block mic self-echo
  useEffect(() => {
    const unsubscribe = onTtsStateChange((speaking) => {
      isAudioPlayingRef.current = speaking;
      isSpeakingRef.current = speaking;
      if (speaking) {
        // TTS active: pause/abort continuous recognition immediately so mic does not hear pet
        if (restartTimerRef.current) {
          clearTimeout(restartTimerRef.current);
          restartTimerRef.current = null;
        }
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch {}
        }
      } else {
        // TTS ended + 1200ms room echo cooldown completed: restart continuous recognition safely
        if (isContinuousModeRef.current) {
          if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
          restartTimerRef.current = setTimeout(() => {
            safeStartRecognitionRef.current();
          }, 250);
        }
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Speak authentic Vietnamese audio via centralized Google TTS proxy
  const speakVietnamese = useCallback(
    (text: string) => {
      if (!voiceReplyEnabled) return;
      const cleanText = text.replace(/[^\p{L}\p{N}\s,.!?-]/gu, '').trim();
      if (!cleanText) return;

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      void playTtsSpeech(cleanText);
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

      // Filter pet's own acoustic echo
      if (isPetSelfEcho(cmd)) {
        console.log('🔇 [executeKnownCommand] Dropped pet self-echo:', cmd);
        return true;
      }

      const now = Date.now();
      if (now - lastCommandTimeRef.current < 2500) return true;

      const confirmSuccess = (label: string, speechText?: string) => {
        lastCommandTimeRef.current = Date.now();
        pendingPrefixRef.current = '';
        if (aiFallbackTimerRef.current) clearTimeout(aiFallbackTimerRef.current);
        if (wakeGreetingTimerRef.current) clearTimeout(wakeGreetingTimerRef.current);
        playRetroTone('success');
        setLastExecuted(label);
        setIsAwake(false);
        isAwakeRef.current = false;
        if (awakeTimeoutRef.current) clearTimeout(awakeTimeoutRef.current);
        if (speechText) {
          const fullSpeech = includeWakeGreeting ? `Em đây đại ca. ${speechText}` : speechText;
          speakVietnamese(fullSpeech);
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
        confirmSuccess('Cho thú cưng ăn');
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
        confirmSuccess('Cho thú cưng uống nước');
        return true;
      }
      if (matchesAny(cmd, ['vuốt ve', 'xoa đầu', 'cưng nựng', 'thương thương', 'nựng', 'âu yếm', 'vỗ về', 'xoa lưng'])) {
        onNavigate('PET');
        onStroke();
        confirmSuccess('Vuốt ve thú cưng');
        return true;
      }
      if (matchesAny(cmd, ['thăng cấp', 'lên cấp', 'nâng cấp', 'tiến hóa'])) {
        onNavigate('PET');
        onLevelUp();
        confirmSuccess('Thăng cấp thú cưng');
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
        confirmSuccess('Quay lại bài trước');
        return true;
      }

      const extractedSong = extractSongQuery(cmd);
      if (extractedSong) {
        const isGenericLofi = ['lofi', 'lô phi', 'lo fi', 'lô fi', 'thư giãn', 'chill'].includes(
          extractedSong.toLowerCase()
        );
        const finalQuery = isGenericLofi ? 'nhạc lofi chill học bài' : extractedSong;
        onPlayMusic(finalQuery, true);
        onSpeechBubble(`Đang tìm và phát bài "${extractedSong}" cho đại ca!`);
        confirmSuccess(`Phát bài: ${extractedSong}`);
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
          'chuyển bài',
          'chuyển bài khác',
          'qua bài',
          'qua bài khác',
          'bài tiếp theo',
          'bài kế tiếp',
          'bài sau',
          'next bài',
          'đổi nhạc',
          'đổi nhạc khác',
          'chuyển nhạc'
        ])
      ) {
        onPlayMusic('__NEXT_TRACK__', true);
        onSpeechBubble('Em đã đổi sang bài hát khác cho đại ca rồi ạ!');
        confirmSuccess('Đổi sang bài khác');
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

      if (isPetSelfEcho(cmd)) {
        console.log('🔇 [executeAIFallback] Dropped pet self-echo:', cmd);
        return;
      }

      const now = Date.now();
      if (now - lastCommandTimeRef.current < 2500) return;

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
        let isAlreadySpokenByAction = false;

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
            isAlreadySpokenByAction = true;
          } else if (data.action.type === 'PET_ACTION' && data.action.petAction) {
            onNavigate('PET');
            const act = data.action.petAction;
            if (act === 'FEED' || act === 'EATING') {
              onFeed();
              isAlreadySpokenByAction = true;
            } else if (act === 'DRINK' || act === 'DRINKING') {
              onDrink();
              isAlreadySpokenByAction = true;
            } else if (act === 'STROKE' || act === 'PETTING') {
              onStroke();
              isAlreadySpokenByAction = true;
            } else if (act === 'LEVEL_UP' || act === 'EVOLVING') {
              onLevelUp();
              isAlreadySpokenByAction = true;
            } else {
              onAction(act as AnimationState, data.reply || 'Em thực hiện ngay đây đại ca!');
            }
          }
        }

        if (data?.reply) {
          onSpeechBubble(data.reply);
          if (!isAlreadySpokenByAction) {
            speakVietnamese(data.reply);
          }
        }
      } catch {
        const fallbackMsg = 'Em đây đại ca, em luôn ở bên cổ vũ đại ca làm việc thật tốt nhé!';
        onSpeechBubble(fallbackMsg);
        speakVietnamese(fallbackMsg);
      }
    },
    [onNavigate, onStopMusic, onStartTimer, onOpenModal, onPlayMusic, onFeed, onDrink, onStroke, onLevelUp, onAction, onSpeechBubble, speakVietnamese]
  );

  const handlersRef = useRef({
    triggerWakeState,
    executeKnownCommand,
    executeAIFallback,
    speakVietnamese
  });
  useEffect(() => {
    handlersRef.current = {
      triggerWakeState,
      executeKnownCommand,
      executeAIFallback,
      speakVietnamese
    };
  });

  // Stop recording helper
  const stopRecording = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (maxRecordingTimerRef.current) {
      clearTimeout(maxRecordingTimerRef.current);
      maxRecordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore
      }
    }
  }, []);

  // Start recording voice via HTML5 MediaRecorder
  const startRecording = useCallback(async () => {
    try {
      stopTtsSpeech();
      isAudioPlayingRef.current = false;
      isSpeakingRef.current = false;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4'
      ];
      const chosenMime = mimeTypes.find(m => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) || '';

      const recorder = chosenMime ? new MediaRecorder(stream, { mimeType: chosenMime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        // Stop all mic tracks immediately to release hardware
        stream.getTracks().forEach(track => track.stop());

        const chunks = audioChunksRef.current;
        if (chunks.length === 0) {
          setRecorderState('IDLE');
          return;
        }

        const audioBlob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        if (audioBlob.size < 800) {
          setRecorderState('IDLE');
          return;
        }

        setRecorderState('TRANSCRIBING');
        try {
          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const base64Data = reader.result as string;
              const res = await api.transcribeAudio(base64Data, audioBlob.type);
              const transcript = (res.data?.transcript || '').trim();

              if (!transcript) {
                setRecorderState('IDLE');
                propsRef.current.onSpeechBubble?.('Em chưa nghe rõ, đại ca bấm nói lại giúp em nha!');
                return;
              }

              if (isPetSelfEcho(transcript)) {
                console.log('🔇 [MediaRecorder STT] Dropped pet self-echo transcript:', transcript);
                setRecorderState('IDLE');
                return;
              }

              console.log('🎤 [MediaRecorder STT] Transcript:', transcript);
              setLiveTranscript(transcript);

              // Check if user spoke a wake word ("HEY ANY", "ANY", etc.)
              const wakeMatch = findWakeWordInPhrase(transcript);
              const cmdToExecute = (wakeMatch ? wakeMatch.commandAfterWake : transcript).trim();

              if (isPetSelfEcho(cmdToExecute)) {
                console.log('🔇 [MediaRecorder STT] Dropped pet self-echo command:', cmdToExecute);
                setRecorderState('IDLE');
                return;
              }

              if (cmdToExecute.length >= 2) {
                const matched = handlersRef.current.executeKnownCommand(cmdToExecute, Boolean(wakeMatch));
                if (!matched) {
                  void handlersRef.current.executeAIFallback(cmdToExecute);
                }
              } else if (wakeMatch) {
                handlersRef.current.triggerWakeState(false);
              } else {
                void handlersRef.current.executeAIFallback(transcript);
              }
            } catch (err: any) {
              console.warn('STT transcription error:', err);
              propsRef.current.onSpeechBubble?.('Em chưa nhận diện được, đại ca bấm thử lại nha!');
            } finally {
              setRecorderState('IDLE');
            }
          };
          reader.readAsDataURL(audioBlob);
        } catch {
          setRecorderState('IDLE');
        }
      };

      recorder.start(250);
      setRecorderState('RECORDING');
      setRecordingSeconds(0);
      setIsPanelOpen(true);
      playRetroTone('wake');

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);

      // Auto-stop after 5 seconds to prevent overly long recordings
      if (maxRecordingTimerRef.current) clearTimeout(maxRecordingTimerRef.current);
      maxRecordingTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          try {
            mediaRecorderRef.current.stop();
          } catch {
            // Ignore
          }
        }
      }, 5000);
    } catch (err: any) {
      console.warn('Microphone permission error:', err);
      setRecorderState('IDLE');
      const isElectronApp = typeof window !== 'undefined' && Boolean((window as any).officePet);
      const guideMsg = isElectronApp
        ? 'Đại ca ơi, hãy kiểm tra quyền Micro trong Windows Settings cho ứng dụng nhé!'
        : 'Đại ca hãy bấm "Cho phép" (Allow) quyền Micro trên thanh địa chỉ trình duyệt để nói chuyện với em nhé!';
      propsRef.current.onSpeechBubble?.(guideMsg);
    }
  }, []);

  const safeStartRecognition = useCallback(() => {
    if (!isContinuousModeRef.current) return;
    if (isTtsSpeaking() || isAudioPlayingRef.current) return;

    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Trình duyệt của bạn chưa hỗ trợ nhận diện giọng nói liên tục. Đại ca hãy mở bằng Google Chrome hoặc Microsoft Edge nhé!');
      setIsContinuousMode(false);
      isContinuousModeRef.current = false;
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'vi-VN';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 2;

      recognition.onresult = (event: any) => {
        if (isTtsSpeaking() || isAudioPlayingRef.current) {
          console.log('🔇 [Continuous Voice] Blocked: Pet is currently speaking');
          return;
        }

        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript + ' ';
          }
        }

        const clean = transcript.trim().toLowerCase();
        if (!clean) return;

        if (isPetSelfEcho(clean)) {
          console.log('🔇 [Continuous Voice] Filtered pet self-echo transcript:', clean);
          return;
        }

        console.log('🎤 [Continuous Voice] Heard:', clean);
        setLiveTranscript(clean);

        // Strip wake word if spoken (e.g. "hey any cho ăn" -> "cho ăn")
        const wakeMatch = findWakeWordInPhrase(clean);
        const cmd = (wakeMatch ? wakeMatch.commandAfterWake : clean).trim();

        if (isPetSelfEcho(cmd)) {
          console.log('🔇 [Continuous Voice] Filtered pet self-echo command:', cmd);
          return;
        }

        if (cmd.length >= 2) {
          const matched = handlersRef.current.executeKnownCommand(cmd, Boolean(wakeMatch));
          if (!matched) {
            void handlersRef.current.executeAIFallback(cmd);
          }
        } else if (wakeMatch) {
          handlersRef.current.triggerWakeState(false);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Recognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setIsContinuousMode(false);
          isContinuousModeRef.current = false;
          setIsListeningActive(false);
          propsRef.current.onSpeechBubble?.(
            'Đại ca hãy bấm "Cho phép" (Allow) quyền Micro trên trình duyệt để bật chế độ tự động nghe nhé!'
          );
        }
      };

      recognition.onend = () => {
        setIsListeningActive(false);
        if (isContinuousModeRef.current && !isTtsSpeaking() && !isAudioPlayingRef.current) {
          if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
          restartTimerRef.current = setTimeout(() => {
            safeStartRecognitionRef.current();
          }, 350);
        }
      };

      recognitionRef.current = recognition;
    }

    try {
      recognitionRef.current.start();
      setIsListeningActive(true);
    } catch (err: any) {
      if (err?.name !== 'InvalidStateError') {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          if (isContinuousModeRef.current && !isTtsSpeaking() && !isAudioPlayingRef.current) {
            safeStartRecognitionRef.current();
          }
        }, 500);
      }
    }
  }, []);

  safeStartRecognitionRef.current = safeStartRecognition;

  const toggleContinuousMode = useCallback(() => {
    stopTtsSpeech();
    if (isContinuousMode) {
      setIsContinuousMode(false);
      isContinuousModeRef.current = false;
      setIsListeningActive(false);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      playRetroTone('sleep');
      propsRef.current.onSpeechBubble?.('Đã tắt chế độ luôn lắng nghe!');
    } else {
      setIsContinuousMode(true);
      isContinuousModeRef.current = true;
      setIsPanelOpen(true);
      playRetroTone('wake');
      safeStartRecognition();
      propsRef.current.onSpeechBubble?.('🟢 Chế độ luôn lắng nghe đã BẬT! Đại ca cứ nói là em nghe và làm ngay nhé!');
    }
  }, [isContinuousMode, safeStartRecognition]);

  const toggleRecording = useCallback(() => {
    if (recorderState === 'RECORDING') {
      stopRecording();
    } else if (recorderState === 'IDLE') {
      void startRecording();
    }
  }, [recorderState, startRecording, stopRecording]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (maxRecordingTimerRef.current) clearTimeout(maxRecordingTimerRef.current);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore
        }
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  return (
    <>
      {/* TOP BAR VOICE ASSISTANT TRIGGER BUTTON */}
      {!embedded && (
      <div className="flex items-center gap-1.5">
        {/* Continuous Hands-Free Mode Toggle Button */}
        <button
          type="button"
          onClick={toggleContinuousMode}
          title={
            isContinuousMode
              ? 'Chế độ luôn lắng nghe đang BẬT. Bấm để tắt.'
              : 'Bật chế độ Luôn Lắng Nghe (Rảnh tay 100% — Cứ nói là pet nghe và làm ngay, không cần bấm mic)'
          }
          className={`h-8 px-2.5 rounded-md text-xs font-black border-2 border-slate-950 shadow-[0_2px_0_#000] active:translate-y-[2px] active:shadow-none transition flex items-center gap-1.5 ${
            isContinuousMode
              ? 'bg-emerald-400 text-slate-950 animate-pulse'
              : 'bg-[#231e36] hover:bg-[#332b4f] text-emerald-400'
          }`}
        >
          <Radio size={14} className={isContinuousMode ? 'animate-spin' : ''} />
          <span>{isContinuousMode ? 'Đang luôn nghe...' : 'Luôn nghe: BẬT'}</span>
        </button>

        {/* Push-to-Talk 1-touch Button */}
        {!isContinuousMode && (
          <button
            type="button"
            onClick={toggleRecording}
            disabled={recorderState === 'TRANSCRIBING'}
            title={
              recorderState === 'RECORDING'
                ? 'Bấm để hoàn tất và gửi lệnh ngay'
                : recorderState === 'TRANSCRIBING'
                ? 'Đang nhận diện giọng nói...'
                : 'Bấm để nói 1 lệnh nhanh ("Cho ăn", "Uống nước", "Mở shop"...)'
            }
            className={`h-8 px-2.5 rounded-md text-xs font-black border-2 border-slate-950 shadow-[0_2px_0_#000] active:translate-y-[2px] active:shadow-none transition flex items-center gap-1.5 ${
              recorderState === 'RECORDING'
                ? 'bg-rose-600 text-white animate-pulse'
                : recorderState === 'TRANSCRIBING'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-[#231e36] hover:bg-[#332b4f] text-amber-300'
            }`}
          >
            {recorderState === 'RECORDING' ? (
              <>
                <Square size={13} className="fill-current" />
                <span>Nói đi... ({5 - recordingSeconds}s)</span>
              </>
            ) : recorderState === 'TRANSCRIBING' ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Nhận diện...</span>
              </>
            ) : (
              <>
                <Mic size={14} className="text-amber-300" />
                <span>Nói 1 lệnh</span>
              </>
            )}
          </button>
        )}
      </div>
      )}

      {/* FLOATING VOICE ASSISTANT HUD PANEL (Visible when Voice Mode is Active) */}
      {isPanelOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-80 sm:w-96 bg-[#181528] text-white border-3 border-slate-950 rounded-2xl shadow-[5px_5px_0px_#000] overflow-hidden select-none">
          {/* Header Bar */}
          <div className="bg-[#231e36] px-3.5 py-2.5 border-b-2 border-slate-950 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full border border-slate-950 ${
                  isContinuousMode
                    ? 'bg-emerald-400 animate-ping'
                    : recorderState === 'RECORDING'
                    ? 'bg-rose-500 animate-ping'
                    : recorderState === 'TRANSCRIBING'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-emerald-400'
                }`}
              />
              <span className="font-black text-xs uppercase tracking-wider text-amber-300">
                Trợ lý giọng nói {isContinuousMode ? '(Luôn nghe)' : ''}
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
              <button
                type="button"
                onClick={() => setIsPanelMinimized(prev => !prev)}
                title={isPanelMinimized ? 'Mở rộng bảng' : 'Thu gọn bảng'}
                className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
              >
                {isPanelMinimized ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              <button
                type="button"
                onClick={() => {
                  stopRecording();
                  if (isContinuousMode) toggleContinuousMode();
                  setIsPanelOpen(false);
                }}
                title="Đóng bảng trợ lý"
                className="px-2 py-0.5 ml-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-[10px] font-black border border-slate-950"
              >
                Đóng
              </button>
            </div>
          </div>

          {!isPanelMinimized && (
            <div className="p-3.5 space-y-3">
              {/* Continuous Hands-Free Switch Card */}
              <div className="flex items-center justify-between p-3 bg-[#120f1d] border-2 border-slate-800 rounded-xl">
                <div className="flex flex-col pr-2">
                  <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                    <Radio size={14} className={isContinuousMode ? 'text-emerald-400 animate-spin' : 'text-slate-400'} />
                    Chế độ Luôn Lắng Nghe (Rảnh tay)
                  </span>
                  <span className="text-[11px] text-slate-400 leading-snug">
                    {isContinuousMode
                      ? '🟢 Đang mở mic chờ lệnh. Đại ca cứ nói là bé cưng tự làm ngay!'
                      : 'Bật để pet luôn lắng nghe đại ca nói mọi lúc, không cần bấm nút mỗi lần.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggleContinuousMode}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black border-2 border-slate-950 shadow-[0_2px_0_#000] active:translate-y-[1px] transition shrink-0 ${
                    isContinuousMode
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                  }`}
                >
                  {isContinuousMode ? 'TẮT ĐI' : 'BẬT NGAY'}
                </button>
              </div>

              {/* Push-to-Talk Fallback Button (visible when not in continuous mode) */}
              {!isContinuousMode && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={toggleRecording}
                    disabled={recorderState === 'TRANSCRIBING'}
                    className={`w-full py-2.5 px-4 rounded-xl font-black text-xs border-2 border-slate-950 shadow-[0_3px_0_#000] active:translate-y-[2px] active:shadow-none transition flex items-center justify-center gap-2 ${
                      recorderState === 'RECORDING'
                        ? 'bg-rose-600 text-white animate-pulse'
                        : recorderState === 'TRANSCRIBING'
                        ? 'bg-amber-500 text-slate-950 cursor-wait'
                        : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                    }`}
                  >
                    {recorderState === 'RECORDING' ? (
                      <>
                        <Square size={14} className="fill-current" />
                        <span>Đang thu âm... ({5 - recordingSeconds}s) — Bấm để hoàn tất</span>
                      </>
                    ) : recorderState === 'TRANSCRIBING' ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Đang giải mã giọng nói qua AI...</span>
                      </>
                    ) : (
                      <>
                        <Mic size={15} />
                        <span>Bấm để nói 1 lệnh ("Cho ăn", "Uống nước", "Mở shop"...)</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Status Display Box */}
              <div
                className={`p-3 rounded-xl border-2 border-slate-950 transition-all ${
                  isContinuousMode
                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                    : recorderState === 'RECORDING'
                    ? 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                    : recorderState === 'TRANSCRIBING'
                    ? 'bg-amber-950/60 border-amber-500/50 text-amber-200'
                    : 'bg-[#25203d] text-slate-200'
                }`}
              >
                <div className="text-[11px] font-black uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  {isContinuousMode ? (
                    <>
                      <Radio size={12} className="text-emerald-400 animate-spin" />
                      <span className="text-emerald-400">Đang lắng nghe đại ca (Rảnh tay)...</span>
                    </>
                  ) : recorderState === 'RECORDING' ? (
                    <>
                      <Radio size={12} className="text-rose-400 animate-spin" />
                      <span className="text-rose-400">Đang lắng nghe đại ca...</span>
                    </>
                  ) : recorderState === 'TRANSCRIBING' ? (
                    <>
                      <Loader2 size={12} className="text-amber-400 animate-spin" />
                      <span className="text-amber-400">Đang nhận diện giọng nói...</span>
                    </>
                  ) : (
                    <span className="text-slate-300">Sẵn sàng nhận lệnh</span>
                  )}
                </div>

                <p className="text-xs font-bold leading-snug">
                  {liveTranscript ? (
                    <span>Đã nghe: "{liveTranscript}"</span>
                  ) : isContinuousMode ? (
                    'Mic đang mở! Đại ca cứ nói lệnh (VD: "Cho ăn", "Uống nước", "Mở shop") là bé cưng tự làm ngay!'
                  ) : recorderState === 'RECORDING' ? (
                    'Đại ca hãy nói (VD: "Cho ăn", "Uống nước", "Mở cửa hàng", "Hẹn giờ 15 phút")...'
                  ) : recorderState === 'TRANSCRIBING' ? (
                    'Đang chuyển giọng nói thành văn bản và kích hoạt lệnh...'
                  ) : (
                    'Bật nút "Luôn nghe" phía trên để rảnh tay nói lệnh bất cứ lúc nào!'
                  )}
                </p>
              </div>

              {/* Last Executed Command Badge */}
              {lastExecuted && (
                <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-950/70 border border-emerald-500/40 rounded-lg text-[11px]">
                  <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                    <Sparkles size={12} />
                    Đã thực hiện:
                  </span>
                  <span className="font-black text-white truncate max-w-[200px]">{lastExecuted}</span>
                </div>
              )}

              {/* Quick Command Guide Cheat-Sheet */}
              {showCommandGuide && (
                <div className="bg-[#120f1d] border-2 border-slate-800 rounded-xl p-2.5 text-[11px] space-y-1.5 max-h-48 overflow-y-auto">
                  <div className="font-black text-amber-300 uppercase tracking-wider text-[10px]">
                    Gợi ý câu lệnh mẫu:
                  </div>
                  <div className="text-slate-300">
                    <strong className="text-white">• Điều hướng Web:</strong> "Mở cửa hàng", "Mở nhiệm vụ", "Xem bảng xếp hạng", "Mở phòng chung", "Về phòng thú cưng".
                  </div>
                  <div className="text-slate-300">
                    <strong className="text-white">• Hẹn giờ / Báo thức:</strong> "Cài 3h chiều báo tôi", "Hẹn giờ 15 phút", "Tắt chuông", "Tạm dừng hẹn giờ".
                  </div>
                  <div className="text-slate-300">
                    <strong className="text-white">• Âm nhạc & Playlist:</strong> "Phát playlist yêu thích", "Thêm vào yêu thích", "Đổi bài khác", "Mở cho tôi bài [tên bài]", "Tắt nhạc".
                  </div>
                  <div className="text-slate-300">
                    <strong className="text-white">• Chăm sóc Pet & Phòng:</strong> "Cho ăn", "Uống nước", "Vuốt ve", "Thăng cấp", "Vào quán cafe", "Ra vườn xuân".
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};
