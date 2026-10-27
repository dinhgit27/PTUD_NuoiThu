import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Volume2, VolumeX, Sparkles, HelpCircle, ChevronDown, ChevronUp, Radio } from 'lucide-react';
import { AnimationState } from '../types';
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
  onChangeRoom: (theme: RoomTheme) => void;
  onChangeScale: (scale: 'SMALL' | 'MEDIUM' | 'LARGE') => void;
  onNavigate: (tab: NavTab) => void;
  onOpenModal: (modal: ModalTarget) => void;
  onSpeechBubble: (text: string) => void;
  onPlayMusic: (query: string, autoPlay: boolean) => void;
  onStopMusic: () => void;
  onResumeBgm: () => void;
  onStartTimer: (minutes: number, autoStart: boolean, action?: 'START' | 'PAUSE' | 'RESET') => void;
}

// Phonetic variations of "HEY ANY" in Vietnamese & English Speech-to-Text
const WAKE_WORDS = [
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
  'ê any',
  'ê ani',
  'ê e ni',
  'any ơi',
  'ani ơi',
  'a ni ơi',
  'annie ơi'
];

// Check if a spoken chunk is just an incomplete prefix (e.g., "hãy mở", "mở cho tôi", "vào")
// waiting for the user to finish saying the target noun (e.g., "...cửa hàng")
function isIncompleteCommandPrefix(cmd: string): boolean {
  const cleaned = cmd.replace(/[.,!?]/g, '').trim();
  const incompletePrefixes = [
    'mở',
    'bật',
    'vào',
    'hãy',
    'hãy mở',
    'hãy bật',
    'hãy vào',
    'mở cho',
    'mở cho tôi',
    'mở cho mình',
    'mở giúp',
    'mở giúp tôi',
    'bật cho',
    'bật cho tôi',
    'bật cho mình',
    'cho tôi',
    'cho mình',
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
    'trợ lý'
  ];
  if (nonMusicFeatures.some(w => cmd.includes(w))) {
    return null;
  }

  const patterns = [
    /(?:mở|bật|phát|nghe|tìm|chơi|đổi)\s+(?:cho\s+(?:tôi|mình|anh|chị|em|bạn|chủ\s*nhân)\s+)?(?:nghe\s+)?(?:bài\s+hát|bài\s+nhạc|bản\s+nhạc|ca\s+khúc|bài|nhạc)\s+(.+)/i,
    /(?:cho\s+(?:tôi|mình|anh|chị|em|chủ\s*nhân)\s+nghe)\s+(?:bài\s+hát|bài\s+nhạc|bài|nhạc)\s+(.+)/i,
    /^(?:bài\s+hát|bài\s+nhạc|ca\s+khúc)\s+(.+)/i
  ];

  for (const regex of patterns) {
    const match = cmd.match(regex);
    if (match && match[1]) {
      const cleaned = match[1]
        .replace(/\b(nha|nhé|đi|với|ạ|nào|luôn)\b$/gi, '')
        .trim();
      if (cleaned.length >= 2) {
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
  onStartTimer
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isAwake, setIsAwake] = useState(false);
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(true);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [lastExecuted, setLastExecuted] = useState<string | null>(null);
  const [showCommandGuide, setShowCommandGuide] = useState(false);
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);
  const [browserSupported, setBrowserSupported] = useState(true);

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const isAwakeRef = useRef(false);
  const awakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPrefixRef = useRef<string>('');
  const lastCommandTimeRef = useRef<number>(0);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    isAwakeRef.current = isAwake;
  }, [isAwake]);

  // Speak authentic Vietnamese audio via backend Google TTS proxy (with Web Speech fallback)
  const speakVietnamese = useCallback(
    (text: string) => {
      if (!voiceReplyEnabled) return;
      const cleanText = text.replace(/[^\p{L}\p{N}\s,.!?-]/gu, '').trim();
      if (!cleanText) return;

      try {
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current = null;
        }
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }

        const audio = new Audio(`/api/pet/tts?text=${encodeURIComponent(cleanText)}`);
        currentAudioRef.current = audio;
        audio.play().catch(() => {
          if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.lang = 'vi-VN';
            const voices = window.speechSynthesis.getVoices();
            const viVoice = voices.find(
              v => v.lang.toLowerCase().includes('vi') || v.name.toLowerCase().includes('viet')
            );
            if (viVoice) {
              utterance.voice = viVoice;
            }
            utterance.rate = 1.05;
            window.speechSynthesis.speak(utterance);
          }
        });
      } catch {
        // Ignore playback errors
      }
    },
    [voiceReplyEnabled]
  );

  // Trigger wake state ("Ê Ní" detected)
  const triggerWakeState = useCallback(
    (silentVoice = false) => {
      setIsAwake(true);
      isAwakeRef.current = true;
      pendingPrefixRef.current = '';
      if (aiFallbackTimerRef.current) clearTimeout(aiFallbackTimerRef.current);
      playRetroTone('wake');

      const wakeMsg = 'Em đây chủ nhân! Chủ nhân cần em làm gì ạ?';
      onAction('WAVING', wakeMsg);
      if (!silentVoice) {
        speakVietnamese('Em đây chủ nhân');
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
      if (now - lastCommandTimeRef.current < 1400) return false;

      const confirmSuccess = (label: string, speechText?: string) => {
        lastCommandTimeRef.current = Date.now();
        pendingPrefixRef.current = '';
        if (aiFallbackTimerRef.current) clearTimeout(aiFallbackTimerRef.current);
        playRetroTone('success');
        setLastExecuted(label);
        setIsAwake(false);
        isAwakeRef.current = false;
        if (awakeTimeoutRef.current) clearTimeout(awakeTimeoutRef.current);
        if (speechText) {
          const fullSpeech = includeWakeGreeting ? `Em đây chủ nhân. ${speechText}` : speechText;
          speakVietnamese(fullSpeech);
        } else if (includeWakeGreeting) {
          speakVietnamese('Em đây chủ nhân');
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
        onSpeechBubble('Em đã tắt nhạc cho chủ nhân rồi ạ!');
        confirmSuccess('Đã tắt nhạc', 'Dạ, em đã tắt nhạc cho chủ nhân rồi ạ!');
        return true;
      }

      if (matchesAny(cmd, ['bật nhạc nền', 'mở nhạc nền', 'tiếp tục nhạc', 'phát nhạc nền'])) {
        onResumeBgm();
        onSpeechBubble('Em đã bật lại nhạc nền thư giãn cho chủ nhân!');
        confirmSuccess('Bật nhạc nền Web', 'Dạ, em đã bật lại nhạc nền cho chủ nhân rồi ạ!');
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
        onSpeechBubble('Em đã mở Cửa Hàng vật phẩm cho chủ nhân rồi ạ!');
        confirmSuccess('Mở Cửa Hàng', 'Dạ, em mở cửa hàng cho chủ nhân mua sắm ạ!');
        return true;
      }
      if (matchesAny(cmd, ['nhiệm vụ', 'mở nhiệm vụ', 'làm nhiệm vụ', 'xem nhiệm vụ', 'nhận thưởng'])) {
        onNavigate('QUESTS');
        onSpeechBubble('Em đã mở danh sách Nhiệm Vụ cho chủ nhân!');
        confirmSuccess('Mở Nhiệm Vụ', 'Dạ, em mở danh sách nhiệm vụ cho chủ nhân ạ!');
        return true;
      }
      if (matchesAny(cmd, ['xếp hạng', 'bảng xếp hạng', 'đua top', 'xem top', 'hạng mấy'])) {
        onNavigate('LEADERBOARD');
        onSpeechBubble('Em đã mở Bảng Xếp Hạng cho chủ nhân!');
        confirmSuccess('Mở Bảng Xếp Hạng', 'Dạ, em mở bảng xếp hạng cho chủ nhân xem ạ!');
        return true;
      }
      if (matchesAny(cmd, ['phòng chung', 'không gian chung', 'phòng ban', 'vườn chung', 'khu vườn chung'])) {
        onNavigate('GARDEN');
        onSpeechBubble('Em đưa chủ nhân vào Phòng Chung ạ!');
        confirmSuccess('Mở Phòng Chung', 'Dạ, em đưa chủ nhân vào phòng chung ạ!');
        return true;
      }
      if (matchesAny(cmd, ['trợ lý ai', 'trợ lý', 'ây ai', 'phòng chat', 'nhắn tin ai'])) {
        onNavigate('AI_CHAT');
        onSpeechBubble('Em đã mở phòng Trợ Lý AI cho chủ nhân!');
        confirmSuccess('Mở Trợ Lý AI', 'Dạ, em mở mục trò chuyện AI cho chủ nhân ạ!');
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
        confirmSuccess('Mở Bài Tập Hít Thở', 'Dạ, chủ nhân cùng hít thở sâu và thư giãn với em nhé!');
        return true;
      }
      if (matchesAny(cmd, ['đổi thú', 'chọn thú', 'đổi pet'])) {
        onOpenModal('PET_SELECTOR');
        confirmSuccess('Mở Chọn Thú Cưng', 'Dạ, chủ nhân muốn chọn bé thú cưng nào ạ?');
        return true;
      }

      // =========================================================================
      // 3. ROOM BACKGROUND THEMES
      // =========================================================================
      if (matchesAny(cmd, ['quán cafe', 'quán cà phê', 'cà phê', 'ca fe', 'ca phê', 'tiệm cafe'])) {
        onNavigate('PET');
        onChangeRoom('cafe');
        onSpeechBubble('Em đã chuyển sang không gian Quán Cafe ấm cúng cho chủ nhân!');
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
        confirmSuccess('Về Phòng Thú Cưng', 'Dạ, em đưa chủ nhân về phòng thú cưng ạ!');
        return true;
      }

      // =========================================================================
      // 4. TIMER / HẸN GIỜ / POMODORO COMMANDS
      // =========================================================================
      if (
        matchesAny(cmd, [
          'hẹn giờ',
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
        /\d+\s*phút/.test(cmd)
      ) {
        if (matchesAny(cmd, ['tạm dừng', 'dừng lại', 'ngừng'])) {
          onStartTimer(25, false, 'PAUSE');
          onSpeechBubble('Em đã tạm dừng đồng hồ hẹn giờ cho chủ nhân!');
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
        onSpeechBubble(`Đã bắt đầu hẹn giờ tập trung ${requestedMinutes} phút cho chủ nhân!`);
        confirmSuccess(
          `Hẹn giờ ${requestedMinutes} phút (Đang chạy)`,
          `Dạ, em đã bật hẹn giờ ${requestedMinutes} phút cho chủ nhân rồi ạ!`
        );
        return true;
      }

      // =========================================================================
      // 5. PET CARE, ACTIONS & SCALE
      // =========================================================================
      if (matchesAny(cmd, ['cho ăn', 'ăn đi', 'ăn cơm', 'ăn bánh', 'măm măm'])) {
        onNavigate('PET');
        onFeed();
        confirmSuccess('Cho thú cưng ăn', 'Măm măm, em cảm ơn chủ nhân đã cho em ăn ngon ạ!');
        return true;
      }
      if (matchesAny(cmd, ['uống nước', 'uống trà', 'khát nước', 'uống sữa'])) {
        onNavigate('PET');
        onDrink();
        confirmSuccess('Cho thú cưng uống nước', 'Nước mát quá, em cảm ơn chủ nhân ạ!');
        return true;
      }
      if (matchesAny(cmd, ['vuốt ve', 'xoa đầu', 'cưng nựng', 'thương thương', 'nựng'])) {
        onNavigate('PET');
        onStroke();
        confirmSuccess('Vuốt ve thú cưng', 'Hihi, được chủ nhân xoa đầu thích quá đi ạ!');
        return true;
      }
      if (matchesAny(cmd, ['thăng cấp', 'lên cấp', 'nâng cấp', 'tiến hóa'])) {
        onNavigate('PET');
        onLevelUp();
        confirmSuccess('Thăng cấp thú cưng', 'Dạ, để em kiểm tra bể chứa kinh nghiệm để thăng cấp ạ!');
        return true;
      }
      if (matchesAny(cmd, ['đi ngủ', 'ngủ đi', 'ngủ thôi', 'khò khò'])) {
        onNavigate('PET');
        onAction('SLEEPING', 'Em đi ngủ đây... Chúc chủ nhân một ngày tốt lành ạ!');
        confirmSuccess('Đi ngủ', 'Dạ, em đi ngủ đây ạ, khò khò');
        return true;
      }
      if (matchesAny(cmd, ['thức dậy', 'dậy đi', 'dậy thôi', 'tỉnh dậy'])) {
        onNavigate('PET');
        onAction('WAKING_UP', 'Em tỉnh dậy rồi, sẵn sàng đồng hành cùng chủ nhân!');
        confirmSuccess('Thức dậy', 'Dạ, em thức dậy rồi đây chủ nhân ơi!');
        return true;
      }
      if (matchesAny(cmd, ['ngáp', 'buồn ngủ'])) {
        onNavigate('PET');
        onAction('YAWNING', 'Ngáp một hơi dài, em hơi buồn ngủ một chút...');
        confirmSuccess('Ngáp ngủ', 'Dạ, em hơi buồn ngủ một xíu ạ');
        return true;
      }
      if (matchesAny(cmd, ['đói bụng', 'đói quá'])) {
        onNavigate('PET');
        onAction('HUNGRY', 'Bụng em đói cồn cào rồi, chủ nhân cho em ăn nhé!');
        confirmSuccess('Biểu cảm Đói bụng', 'Chủ nhân ơi, bụng em đói cồn cào rồi ạ');
        return true;
      }
      if (matchesAny(cmd, ['đứng yên', 'nghỉ ngơi', 'bình thường'])) {
        onNavigate('PET');
        onAction('IDLE', 'Em đứng ngoan nhìn chủ nhân làm việc ạ.');
        confirmSuccess('Đứng yên', 'Dạ, em đứng ngoan ở đây với chủ nhân ạ');
        return true;
      }
      if (matchesAny(cmd, ['làm việc', 'gõ phím', 'code đi', 'học bài'])) {
        onNavigate('PET');
        onAction('TYPING', 'Tập trung gõ phím làm việc chăm chỉ cùng chủ nhân!');
        confirmSuccess('Làm việc chăm chỉ', 'Dạ, em cùng làm việc chăm chỉ với chủ nhân nhé!');
        return true;
      }
      if (matchesAny(cmd, ['tập thể dục', 'vận động', 'thể thao', 'hít đất'])) {
        onNavigate('PET');
        onAction('EXERCISING', 'Vận động rèn luyện thể lực dẻo dai!');
        confirmSuccess('Tập thể dục', 'Một hai một hai, em tập thể dục cho khỏe mạnh ạ!');
        return true;
      }
      if (matchesAny(cmd, ['nhảy múa', 'nhảy đi', 'múa đi', 'quẩy lên'])) {
        onNavigate('PET');
        onAction('DANCING', 'Nhún nhảy theo giai điệu vui tươi phục vụ chủ nhân!');
        confirmSuccess('Nhảy múa', 'Dạ, để em nhảy múa cho chủ nhân xem nhé!');
        return true;
      }
      if (matchesAny(cmd, ['vui vẻ', 'cười lên', 'hạnh phúc'])) {
        onNavigate('PET');
        onAction('HAPPY', 'Ở bên chủ nhân lúc nào em cũng vui vẻ hết ạ!');
        confirmSuccess('Biểu cảm Vui vẻ', 'Ở bên chủ nhân lúc nào em cũng vui hết ạ!');
        return true;
      }
      if (matchesAny(cmd, ['vẫy tay', 'chào đi', 'xin chào', 'hello'])) {
        onNavigate('PET');
        onAction('WAVING', 'Em xin chào chủ nhân! Chúc chủ nhân một ngày làm việc thật hiệu quả!');
        confirmSuccess('Vẫy tay chào', 'Em xin chào chủ nhân ạ!');
        return true;
      }
      if (matchesAny(cmd, ['cảm ơn', 'ngoan quá', 'giỏi quá'])) {
        onNavigate('PET');
        onAction('THANKING', 'Em cúi đầu cảm ơn chủ nhân vì luôn yêu thương em!');
        confirmSuccess('Cảm ơn chủ nhân', 'Dạ, em cảm ơn chủ nhân nhiều lắm ạ!');
        return true;
      }
      if (matchesAny(cmd, ['ăn mừng', 'hoan hô', 'chiến thắng'])) {
        onNavigate('PET');
        onAction('CELEBRATING', 'Hoan hô! Cùng ăn mừng thành quả tuyệt vời của chủ nhân nào!');
        confirmSuccess('Ăn mừng', 'Hoan hô, chúc mừng chủ nhân nha!');
        return true;
      }
      if (matchesAny(cmd, ['làm nũng', 'buồn quá', 'khóc'])) {
        onNavigate('PET');
        onAction('SAD', 'Em đang buồn một chút, muốn được chủ nhân dỗ dành cơ...');
        confirmSuccess('Làm nũng', 'Chủ nhân dỗ dành em đi mà');
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
      // 6. SPECIFIC SONG REQUESTS ("mở cho tôi bài ...", "bật bài hát ...")
      // =========================================================================
      const extractedSong = extractSongQuery(cmd);
      if (extractedSong) {
        const isGenericLofi = ['lofi', 'lô phi', 'lo fi', 'lô fi', 'thư giãn', 'chill'].includes(
          extractedSong.toLowerCase()
        );
        const finalQuery = isGenericLofi ? 'nhạc lofi chill học bài' : extractedSong;
        onPlayMusic(finalQuery, true);
        onSpeechBubble(`Đang tìm và phát bài "${extractedSong}" cho chủ nhân!`);
        confirmSuccess(
          `Phát bài: ${extractedSong}`,
          `Dạ, em mở bài ${extractedSong} cho chủ nhân nghe ngay ạ!`
        );
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
        confirmSuccess('Mở & Phát Nhạc Lofi', 'Dạ, em bật nhạc Lofi thư giãn cho chủ nhân nghe nhé!');
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

      onSpeechBubble('Em đang xử lý yêu cầu của chủ nhân...');
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
          }
        }

        if (data?.reply) {
          onSpeechBubble(data.reply);
          speakVietnamese(data.reply);
        }
      } catch {
        const fallbackMsg = 'Em đây chủ nhân, em luôn ở bên cổ vũ chủ nhân làm việc thật tốt nhé!';
        onSpeechBubble(fallbackMsg);
        speakVietnamese(fallbackMsg);
      }
    },
    [onNavigate, onStopMusic, onStartTimer, onOpenModal, onPlayMusic, onSpeechBubble, speakVietnamese]
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
      let interimTranscript = '';
      let finalTranscript = '';
      const allAlternativePhrases: string[] = [];

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
        for (let altIdx = 0; altIdx < event.results[i].length; altIdx++) {
          const altText = event.results[i][altIdx]?.transcript?.toLowerCase()?.trim();
          if (altText) allAlternativePhrases.push(altText);
        }
      }

      const isFinalResult = event.results[event.results.length - 1].isFinal;
      const rawCombined = (finalTranscript || interimTranscript).toLowerCase().trim();
      if (!rawCombined) return;

      // Ignore self-echo if mic hears the pet's own TTS greeting
      if (rawCombined === 'em đây chủ nhân' || rawCombined.startsWith('em đây chủ nhân dạ')) {
        return;
      }

      // Combine with any buffered prefix (e.g. if user said "mở cho tôi" then paused before "cửa hàng")
      const fullPhrase = pendingPrefixRef.current
        ? `${pendingPrefixRef.current} ${rawCombined}`.trim()
        : rawCombined;

      setLiveTranscript(fullPhrase);

      // Check if transcript (or any STT alternative) contains a wake word ("HEY ANY", etc.)
      let matchedWakeWord: string | null = null;
      let phraseWithWake = fullPhrase;
      for (const wake of WAKE_WORDS) {
        if (fullPhrase.includes(wake)) {
          matchedWakeWord = wake;
          phraseWithWake = fullPhrase;
          break;
        }
        const matchedAlt = allAlternativePhrases.find(alt => alt.includes(wake));
        if (matchedAlt) {
          matchedWakeWord = wake;
          phraseWithWake = matchedAlt;
          break;
        }
      }

      if (matchedWakeWord) {
        const parts = phraseWithWake.split(matchedWakeWord);
        const commandAfterWake = parts[parts.length - 1]?.trim() || '';

        // If user spoke "HEY ANY" + a command in one single breath
        if (commandAfterWake.length >= 2) {
          if (isIncompleteCommandPrefix(commandAfterWake)) {
            if (!isAwakeRef.current) triggerWakeState(true);
            if (isFinalResult) pendingPrefixRef.current = commandAfterWake;
            return;
          }

          if (isFinalResult) {
            const matched = executeKnownCommand(commandAfterWake, true);
            if (!matched) {
              void executeAIFallback(commandAfterWake);
            }
          } else if (!isAwakeRef.current) {
            triggerWakeState(true);
          }
          return;
        }

        // User just said "HEY ANY" and paused -> Say "Em đây chủ nhân!" and listen for command
        if (!isAwakeRef.current) {
          triggerWakeState(false);
        }
        return;
      }

      // If already awake (user previously said "HEY ANY"), process the spoken phrase
      if (isAwakeRef.current) {
        if (aiFallbackTimerRef.current) clearTimeout(aiFallbackTimerRef.current);

        // If the user only said an incomplete prefix like "hãy mở" or "mở cho tôi", buffer it and wait!
        if (isIncompleteCommandPrefix(fullPhrase)) {
          if (isFinalResult) {
            pendingPrefixRef.current = fullPhrase;
          }
          return;
        }

        if (isFinalResult) {
          const matched = executeKnownCommand(fullPhrase, false);
          if (!matched) {
            // Wait 700ms in case the user is still speaking the rest of the sentence
            pendingPrefixRef.current = fullPhrase;
            aiFallbackTimerRef.current = setTimeout(() => {
              const finalToRun = pendingPrefixRef.current;
              pendingPrefixRef.current = '';
              if (!executeKnownCommand(finalToRun, false)) {
                void executeAIFallback(finalToRun);
              }
            }, 700);
          }
        } else if (
          // Fast-execute unambiguous non-parameterized commands
          !fullPhrase.includes('bài') &&
          !fullPhrase.includes('hẹn giờ') &&
          !fullPhrase.includes('đếm ngược') &&
          matchesAny(fullPhrase, [
            'cửa hàng',
            'mở shop',
            'nhiệm vụ',
            'xếp hạng',
            'phòng chung',
            'tắt nhạc',
            'tắc nhạc',
            'dừng nhạc',
            'cho ăn',
            'uống nước',
            'vuốt ve',
            'đi ngủ',
            'thức dậy',
            'nhảy múa',
            'thăng cấp',
            'quán cafe',
            'quán cà phê'
          ])
        ) {
          executeKnownCommand(fullPhrase, false);
        }
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
      try {
        recognition.stop();
      } catch {
        // Ignore
      }
    };
  }, [triggerWakeState, executeKnownCommand, executeAIFallback]);

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
      {/* TOP BAR VOICE ASSISTANT TRIGGER BUTTON */}
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
            <span>{isAwake ? 'Em nghe đây chủ nhân...' : 'Đang đợi "HEY ANY"'}</span>
          </>
        ) : (
          <>
            <Mic size={14} className="text-amber-300" />
            <span>Gọi "HEY ANY"</span>
          </>
        )}
      </button>

      {/* FLOATING VOICE ASSISTANT HUD PANEL (Visible when Voice Mode is Active) */}
      {isListening && (
        <div className="fixed bottom-4 right-4 z-50 w-80 sm:w-96 bg-[#181528] text-white border-3 border-slate-950 rounded-2xl shadow-[5px_5px_0px_#000] overflow-hidden select-none">
          {/* Header Bar */}
          <div className="bg-[#231e36] px-3.5 py-2.5 border-b-2 border-slate-950 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full border border-slate-950 ${
                  isAwake ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'
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
                onClick={toggleListening}
                title="Tắt nhận diện giọng nói"
                className="px-2 py-0.5 ml-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-black border border-slate-950"
              >
                Tắt
              </button>
            </div>
          </div>

          {!isPanelMinimized && (
            <div className="p-3.5 space-y-3">
              {/* Status Display Box */}
              <div
                className={`p-3 rounded-xl border-2 border-slate-950 transition-all ${
                  isAwake ? 'bg-amber-400 text-slate-950' : 'bg-[#25203d] text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-black uppercase tracking-wider">
                    {isAwake ? '"Em đây chủ nhân!" — Đang nghe lệnh' : 'Chế độ chờ gọi "HEY ANY"'}
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
                    'Chủ nhân hãy nói lệnh (VD: "Mở cửa hàng", "Hẹn giờ 15 phút", "Tắt nhạc"...)'
                  ) : (
                    'Hãy nói "HEY ANY" — Bé cưng sẽ thưa "Em đây chủ nhân" và thực hiện lệnh!'
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
                    Gợi ý câu lệnh sau khi gọi "HEY ANY":
                  </div>
                  <div className="text-slate-300">
                    <strong className="text-white">• Điều hướng Web:</strong> "Mở cửa hàng", "Mở nhiệm vụ", "Xem bảng xếp hạng", "Mở phòng chung", "Về phòng thú cưng".
                  </div>
                  <div className="text-slate-300">
                    <strong className="text-white">• Hẹn giờ / Đếm ngược:</strong> "Hẹn giờ 15 phút", "Đếm ngược 10 phút", "Tạm dừng hẹn giờ", "Đặt lại hẹn giờ".
                  </div>
                  <div className="text-slate-300">
                    <strong className="text-white">• Âm nhạc:</strong> "Mở cho tôi bài [tên bài hát]", "Tắt nhạc", "Bật nhạc nền".
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
