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
    action?: 'START' | 'PAUSE' | 'RESUME' | 'RESET' | 'STOP_ALARM' | 'SET_CLOCK_ALARM',
    alarmTime?: string,
    alarmLabel?: string
  ) => void;
  compact?: boolean;
  embedded?: boolean;
  autoStart?: boolean;
  autoListen?: boolean;
  onClosePanel?: () => void;
  onWalk?: () => void;
  onStopWalk?: () => void;
  onShowDashboard?: () => void;
  onHideDesktopPet?: () => void;
  onOpenMenu?: () => void;
  onJoinHotRoom?: (topic: string, query?: string) => Promise<void> | void;
  onMembershipChange?: () => Promise<void> | void;
  hunger?: number;
  happiness?: number;
  petLevel?: number;
}

interface PendingClarification {
  type: 'ALARM_AM_PM' | 'ALARM_MISSING_TIME' | 'TIMER_MISSING_MINUTES' | 'MUSIC_MISSING_SONG' | 'HOT_ROOM_MISSING_TOPIC';
  hour?: number;
  minute?: number;
  createdAt: number;
}

// Phonetic variations of "HEY ANY" / "ANY" in Vietnamese & English Speech-to-Text
// Ordered longest-first so full wake phrases (e.g. "hey any ơi", "hey any") are matched before shorter ones ("any")
const PET_JOKES = [
  'Đại ca có biết vì sao con cá không bao giờ nói chuyện không ạ? Vì mở mồm ra là sặc nước đó đại ca ơi! Haha! 😄',
  'Có một con mèo đi thi đại học, giám thị hỏi: "Em làm bài được không?". Mèo đáp: "Dạ méo làm được câu nào hết đại ca ạ!" 🐱',
  'Bác sĩ hỏi bệnh nhân: "Dạo này anh thấy thế nào?". Bệnh nhân bảo: "Tôi thấy mình như con pet của đại ca vậy, suốt ngày được cưng chiều!" 😆',
  'Đại ca biết con vịt đi hai chân thì gọi là gì không? Là con vịt bình thường đó đại ca, chứ vịt nào đi bốn chân đâu! Hehe! 🦆',
  'Hôm nay em học cách nấu ăn cho đại ca, mà đọc công thức thấy ghi "nêm nếm vừa miệng", em nếm hết luôn cái chảo rồi đại ca ơi! 🍳'
];

const PET_SONGS = [
  'Là la la ~ Thú cưng ngoan ngoãn chăm chỉ, chúc đại ca một ngày thật nhiều năng lượng, code đâu thắng đó, vạn sự như ý nha! 🎵✨',
  'Một con vịt xòe ra hai cái cánh, nó kêu rằng: Đại ca ơi đại ca à ~ Chúc đại ca làm việc thật vui, mệt mỏi tan biến hết nha! 🎶',
  'Tình tính tang tang tính tình, em đứng đây em ngắm đại ca, thấy đại ca vừa đẹp trai vừa tài giỏi, em tự hào ghê luôn á! 🌟🎤'
];

let activeMicInstanceId: string | null = null;
let lastGlobalCommandAt = 0;

const voiceSyncChannel: BroadcastChannel | null =
  typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('officepet_voice_sync')
    : null;

const WAKE_WORDS = [
  'hello any ơi',
  'hê lô any ơi',
  'hey any ơi',
  'hey ani ơi',
  'hây any ơi',
  'hê any ơi',
  'hay any ơi',
  'hây a ni ơi',
  'hê a ni ơi',
  'hay a ni ơi',
  'ê any ơi',
  'ê a ni ơi',
  'chào any ơi',
  'alo any ơi',
  'hello any',
  'hello ani',
  'hê lô any',
  'he lo any',
  'hê lô a ni',
  'hello em',
  'hê lô em',
  'hello pet',
  'hey any',
  'hey ani',
  'hey annie',
  'hey enny',
  'hey eni',
  'hey sunny',
  'hey honey',
  'hey a ni',
  'hey a ny',
  'hey an ni',
  'hi any',
  'hi ani',
  'hi annie',
  'hi a ni',
  'hây any',
  'hê any',
  'hay any',
  'hai any',
  'hây ani',
  'hê ani',
  'hay ani',
  'hai ani',
  'hây a ni',
  'hê a ni',
  'hay a ni',
  'hai a ni',
  'hây a ny',
  'hê a ny',
  'hay a ny',
  'hây a nhi',
  'hê a nhi',
  'hay a nhi',
  'hây an nhi',
  'hay an nhi',
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
  'hây em ni',
  'hay em ni',
  'hây em đi',
  'ây a ni',
  'ây any',
  'ây ani',
  'ê a ni',
  'ê a ny',
  'ê a nhi',
  'ê any',
  'ê ani',
  'ê e ni',
  'alo any',
  'alo ani',
  'alo a ni',
  'chào any',
  'chào ani',
  'chào a ni',
  'này any',
  'này a ni',
  'gọi any',
  'any ơi',
  'ani ơi',
  'a ni ơi',
  'a ny ơi',
  'a nhi ơi',
  'an ni ơi',
  'annie ơi',
  'enny ơi',
  'eni ơi',
  'bé any ơi',
  'em any ơi',
  'bé cưng ơi',
  'thú cưng ơi',
  'bé ơi',
  'pet ơi',
  'em ơi',
  'a ni',
  'a ny',
  'a nhi',
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
      const commandAfterWake = rawAfter
        .replace(/^(?:(?:ơi|à|ạ|nha|nhé|nào|hãy|đây|đó|nè|ha|hả)\s*)+(?=\s|[.,!?]|$)/i, '')
        .replace(/^[.,!?\s]+/, '')
        .trim();
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
    'cảm ơn đại ca đã khen',
    'em cũng yêu thương đại ca',
    'em cảm ơn đại ca',
    'đại ca cần em làm gì',
    'em đây đại ca',
    'hello đại ca',
    'em chào đại ca ạ',
    'em xin chào đại ca',
    'chào buổi sáng đại ca',
    'chào buổi tối đại ca',
    'chúc đại ca ngủ ngon',
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
    'mình về phòng trong nhà',
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
    'em mở bài',
    'nhìn xa sáu mét trong hai mươi giây',
    'duỗi vai vươn mình một chút',
    'hiện tại em đang ở cấp'
  ];

  for (const sig of petSignatures) {
    if (text.includes(sig)) {
      return true;
    }
  }

  // 2. Starts with pet submissive polite greetings: "dạ em...", "dạ để em...", "dạ mình...", "dạ đại ca..."
  if (/^dạ\s+(em|để\s+em|mình|đại\s+ca|đây\s+là|bây\s+giờ|báo\s+cáo|hiện\s+tại)/i.test(text)) {
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
    'vào phòng',
    'hãy vào phòng',
    'vào phòng chủ đề',
    'hãy vào phòng chủ đề',
    'tìm phòng',
    'tìm phòng chủ đề',
    'xem',
    'cho tôi xem'
  ];
  return incompletePrefixes.includes(cleaned);
}

// Detect commands asking Any to find/join a hot room by topic (e.g. "any hãy vào phòng chủ đề làm việc", "vào phòng làm việc đang hot")
function detectHotRoomCommand(
  cmd: string
): { topic: 'WORK' | 'STUDY' | 'CHILL' | 'CREATIVE' | 'SOCIAL'; label: string } | null {
  const lower = cmd.toLowerCase().trim();

  // Do not intercept personal pet room background switches unless "chủ đề" or "hot" or "like" is explicitly mentioned
  const isPersonalBgOnly =
    !lower.includes('chủ đề') &&
    !lower.includes('hot') &&
    !lower.includes('nhiều like') &&
    (lower.includes('quán cafe') ||
      lower.includes('quán cà phê') ||
      lower.includes('vườn xuân') ||
      lower.includes('góc zen') ||
      lower.includes('bãi biển') ||
      lower.includes('trong nhà') ||
      lower.includes('sàn gỗ') ||
      lower.includes('phòng thú cưng') ||
      lower.includes('về phòng') ||
      lower.includes('về nhà'));

  if (isPersonalBgOnly) return null;

  const hasRoomIntent =
    lower.includes('phòng chủ đề') ||
    lower.includes('chủ đề làm việc') ||
    lower.includes('chủ đề học') ||
    lower.includes('chủ đề thư giãn') ||
    lower.includes('chủ đề sáng tạo') ||
    lower.includes('chủ đề giao lưu') ||
    lower.includes('vào phòng') ||
    lower.includes('tìm phòng') ||
    lower.includes('kiếm phòng') ||
    lower.includes('qua phòng') ||
    lower.includes('chuyển phòng') ||
    lower.includes('tham gia phòng') ||
    lower.includes('mở phòng') ||
    lower.includes('phòng làm việc') ||
    lower.includes('phòng học tập') ||
    lower.includes('phòng học bài') ||
    lower.includes('phòng thư giãn') ||
    lower.includes('phòng sáng tạo') ||
    lower.includes('phòng giao lưu') ||
    lower.includes('phòng đang hot') ||
    lower.includes('phòng hot') ||
    lower.includes('phòng nhiều like');

  if (!hasRoomIntent) return null;

  if (
    lower.includes('học tập') ||
    lower.includes('học bài') ||
    lower.includes('ôn thi') ||
    lower.includes('đọc sách') ||
    lower.includes('nghiên cứu') ||
    lower.includes('study')
  ) {
    return { topic: 'STUDY', label: 'Học tập & Nghiên cứu' };
  }

  if (
    lower.includes('thư giãn') ||
    lower.includes('chill') ||
    lower.includes('nghỉ ngơi') ||
    lower.includes('giải lao')
  ) {
    return { topic: 'CHILL', label: 'Thư giãn & Lofi Chill' };
  }

  if (
    lower.includes('sáng tạo') ||
    lower.includes('thiết kế') ||
    lower.includes('ý tưởng') ||
    lower.includes('art') ||
    lower.includes('design')
  ) {
    return { topic: 'CREATIVE', label: 'Sáng tạo & Ý tưởng' };
  }

  if (
    lower.includes('giao lưu') ||
    lower.includes('kết bạn') ||
    lower.includes('tán gẫu') ||
    lower.includes('trò chuyện') ||
    lower.includes('chém gió') ||
    lower.includes('cộng đồng')
  ) {
    return { topic: 'SOCIAL', label: 'Giao lưu & Kết bạn' };
  }

  if (
    lower.includes('làm việc') ||
    lower.includes('công việc') ||
    lower.includes('code') ||
    lower.includes('lập trình') ||
    lower.includes('văn phòng') ||
    lower.includes('tập trung') ||
    lower.includes('deadline') ||
    lower.includes('dự án') ||
    lower.includes('work') ||
    lower.includes('chủ đề') ||
    lower.includes('đang hot') ||
    lower.includes('phòng hot') ||
    lower.includes('nhiều like') ||
    lower.includes('top')
  ) {
    return { topic: 'WORK', label: 'Làm việc & Tập trung' };
  }

  return null;
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
    'phòng chủ đề',
    'phòng làm việc',
    'phòng học tập',
    'phòng thư giãn',
    'phòng sáng tạo',
    'phòng giao lưu',
    'vào phòng',
    'tìm phòng',
    'quán cafe',
    'quán cà phê',
    'vườn xuân',
    'góc zen',
    'bãi biển',
    'trong nhà',
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
  autoListen,
  onClosePanel,
  onWalk,
  onStopWalk,
  onShowDashboard,
  onHideDesktopPet,
  onOpenMenu,
  onJoinHotRoom,
  onMembershipChange,
  hunger,
  happiness,
  petLevel
}) => {
  const isElectron = typeof window !== 'undefined' && Boolean((window as any).officePet);
  const shouldAutoListenOnMount = autoListen !== undefined
    ? autoListen
    : (!embedded ? true : false);

  const [recorderState, setRecorderState] = useState<'IDLE' | 'RECORDING' | 'TRANSCRIBING'>('IDLE');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isPanelOpen, setIsPanelOpen] = useState(autoStart);
  const [isAwake, setIsAwake] = useState(false);
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(true);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [lastExecuted, setLastExecuted] = useState<string | null>(null);
  const [showCommandGuide, setShowCommandGuide] = useState(false);
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);
  const [isContinuousMode, setIsContinuousMode] = useState<boolean>(shouldAutoListenOnMount);
  const [isListeningActive, setIsListeningActive] = useState<boolean>(false);
  const [micLevel, setMicLevel] = useState<number>(0);

  const instanceIdRef = useRef<string>(`va_${Math.random().toString(36).slice(2, 9)}`);
  const useVadFallbackRef = useRef<boolean>(false);
  const isContinuousModeRef = useRef<boolean>(shouldAutoListenOnMount);
  const isAudioPlayingRef = useRef<boolean>(false);
  const recognitionRef = useRef<any>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safeStartRecognitionRef = useRef<() => void>(() => {});
  const startContinuousListeningRef = useRef<() => void>(() => {});
  const stopVadListeningRef = useRef<() => void>(() => {});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxRecordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPrefixRef = useRef<string>('');
  const lastCommandTimeRef = useRef<number>(0);
  const isSpeakingRef = useRef<boolean>(false);
  const isAwakeRef = useRef<boolean>(false);

  // VAD Engine refs for Electron Desktop & non-Chrome environments
  const vadStreamRef = useRef<MediaStream | null>(null);
  const vadAudioCtxRef = useRef<AudioContext | null>(null);
  const vadAnalyserRef = useRef<AnalyserNode | null>(null);
  const vadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vadRecorderRef = useRef<MediaRecorder | null>(null);
  const vadAudioChunksRef = useRef<Blob[]>([]);
  const isVadSpeakingRef = useRef<boolean>(false);
  const vadSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vadProcessingRef = useRef<boolean>(false);

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
    onClosePanel,
    onWalk,
    onStopWalk,
    onShowDashboard,
    onHideDesktopPet,
    onOpenMenu,
    onJoinHotRoom,
    onMembershipChange,
    hunger,
    happiness,
    petLevel
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
      onClosePanel,
      onWalk,
      onStopWalk,
      onShowDashboard,
      onHideDesktopPet,
      onOpenMenu,
      onJoinHotRoom,
      onMembershipChange,
      hunger,
      happiness,
      petLevel
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
        if (vadRecorderRef.current && vadRecorderRef.current.state === 'recording') {
          try { vadRecorderRef.current.stop(); } catch {}
        }
        isVadSpeakingRef.current = false;
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch {}
        }
      } else {
        // If pet just finished speaking "Em đây đại ca", give user a full 16s window to speak the 1 task
        if (isAwakeRef.current) {
          if (awakeTimeoutRef.current) clearTimeout(awakeTimeoutRef.current);
          awakeTimeoutRef.current = setTimeout(() => {
            setIsAwake(false);
            isAwakeRef.current = false;
            pendingPrefixRef.current = '';
            setLiveTranscript('');
          }, 16000);
        }
        // TTS ended + 300ms room echo cooldown completed: restart continuous recognition immediately
        if (isContinuousModeRef.current && (!activeMicInstanceId || activeMicInstanceId === instanceIdRef.current)) {
          if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
          restartTimerRef.current = setTimeout(() => {
            startContinuousListeningRef.current();
          }, 80);
        }
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Cross-instance & cross-window synchronization so two VoiceAssistant components never double-listen or double-reply
  useEffect(() => {
    if (!voiceSyncChannel) return;
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data) return;
      if (data.type === 'CLAIM_MIC' && data.instanceId && data.instanceId !== instanceIdRef.current) {
        activeMicInstanceId = data.instanceId;
        if (isContinuousModeRef.current) {
          setIsContinuousMode(false);
          isContinuousModeRef.current = false;
          setIsListeningActive(false);
          stopVadListeningRef.current();
          if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
          if (recognitionRef.current) {
            try { recognitionRef.current.abort(); } catch {}
          }
        }
      } else if (data.type === 'COMMAND_EXECUTED' && typeof data.timestamp === 'number') {
        lastGlobalCommandAt = data.timestamp;
        lastCommandTimeRef.current = data.timestamp;
      }
    };
    voiceSyncChannel.addEventListener('message', handleMessage);
    return () => {
      voiceSyncChannel.removeEventListener('message', handleMessage);
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

  // Trigger wake state ("HEY ANY" / "ANY" detected) -> Step 1 of 2-step workflow
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
      }, 18000);
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
      if (now - lastCommandTimeRef.current < 750 || now - lastGlobalCommandAt < 750) return true;

      const confirmSuccess = (label: string, speechText?: string, keepAwakeAfter = false) => {
        const ts = Date.now();
        lastCommandTimeRef.current = ts;
        lastGlobalCommandAt = ts;
        try {
          voiceSyncChannel?.postMessage({ type: 'COMMAND_EXECUTED', timestamp: ts });
        } catch {}
        pendingPrefixRef.current = '';
        if (aiFallbackTimerRef.current) clearTimeout(aiFallbackTimerRef.current);
        if (wakeGreetingTimerRef.current) clearTimeout(wakeGreetingTimerRef.current);
        playRetroTone('success');
        setLastExecuted(label);
        if (keepAwakeAfter) {
          setIsAwake(true);
          isAwakeRef.current = true;
          if (awakeTimeoutRef.current) clearTimeout(awakeTimeoutRef.current);
          awakeTimeoutRef.current = setTimeout(() => {
            setIsAwake(false);
            isAwakeRef.current = false;
          }, 18000);
        } else {
          setIsAwake(false);
          isAwakeRef.current = false;
          if (awakeTimeoutRef.current) clearTimeout(awakeTimeoutRef.current);
        }
        if (speechText) {
          const fullSpeech = includeWakeGreeting ? `Em đây đại ca. ${speechText}` : speechText;
          speakVietnamese(fullSpeech);
        }
      };

      // =========================================================================
      // 0. INSTANT "HELLO" / GREETING RESPONSE (0ms latency + wakes pet up!)
      // =========================================================================
      const cleanedGreeting = cmd.replace(/[.,!?~]/g, '').trim();
      const isDirectHello =
        [
          'hello',
          'hê lô',
          'he lo',
          'hê lo',
          'ha lô',
          'hơ lô',
          'helô',
          'hế lô',
          'hê lơ',
          'hi',
          'hai',
          'hey',
          'alo',
          'a lô',
          'xin chào',
          'chào',
          'chào đi',
          'chào em',
          'chào any',
          'chào ani',
          'chào a ni',
          'chào pet',
          'chào bé',
          'chào bạn',
          'chào đại ca',
          'hello any',
          'hello em',
          'hello pet',
          'hello bạn',
          'hello đại ca',
          'hê lô em',
          'hê lô bạn',
          'hi em',
          'hi any',
          'vẫy tay'
        ].includes(cleanedGreeting) ||
        /^(?:hello|hê\s*lô|he\s*lo|hế\s*lô|ha\s*lô|hơ\s*lô|xin\s*chào|chào\s+em|chào\s+any|chào\s+pet|chào\s+bé|chào\s+bạn|hi\s+em|hi\s+any|alo|a\s*lô)(?:\s+(?:ơi|nha|nhé|ạ|nào))?$/i.test(
          cleanedGreeting
        );

      if (isDirectHello) {
        const helloMsg = `👋 Hello đại ca! Em là ${petName || 'Any'} đây ạ! Đại ca cần em giúp gì cứ nói em nghe nhé!`;
        onAction('WAVING', helloMsg);
        onSpeechBubble(helloMsg);
        confirmSuccess(
          'Chào đại ca (Hello)',
          'Hello đại ca! Em chào đại ca ạ! Đại ca cần em giúp gì cứ nói em nghe nhé!',
          true
        );
        return true;
      }

      // =========================================================================
      // 1. STOP MUSIC / RESUME BACKGROUND MUSIC ("tắt nhạc", "kêu tắt nhạc", "dừng phát", "bật nhạc nền")
      // =========================================================================
      const isStopMusicCmd =
        matchesAny(cmd, [
          'tắt nhạc',
          'tắc nhạc',
          'dừng nhạc',
          'ngừng nhạc',
          'ngưng nhạc',
          'tắt bài',
          'tắc bài',
          'dừng bài',
          'ngừng bài',
          'tắt bài hát',
          'dừng bài hát',
          'dừng phát',
          'ngừng phát',
          'ngưng phát',
          'tắt youtube',
          'dừng youtube',
          'tắt loa',
          'tắt tiếng',
          'tắt âm thanh',
          'đừng hát',
          'đừng phát',
          'thôi hát',
          'nghỉ hát',
          'dẹp nhạc',
          'im lặng',
          'yên lặng',
          'im đi',
          'kêu tắt nhạc',
          'bảo tắt nhạc',
          'tắt nhạc đi'
        ]) ||
        /\b(kêu|bảo|cho|yêu cầu)?\s*(tắt|dừng|ngừng|ngưng|dẹp|nghỉ|hủy|thôi)\s+(phát\s+)?(nhạc|bài|bài hát|loa|youtube|audio|âm thanh)\b/i.test(cmd);

      if (isStopMusicCmd) {
        onStopMusic();
        onSpeechBubble('Em đã tắt nhạc cho đại ca rồi ạ!');
        confirmSuccess('Đã tắt nhạc', 'Dạ, em đã tắt nhạc cho đại ca rồi ạ!');
        return true;
      }

      const isResumeMusicCmd =
        matchesAny(cmd, [
          'bật nhạc nền',
          'mở nhạc nền',
          'tiếp tục nhạc',
          'phát nhạc nền',
          'bật lại nhạc',
          'mở lại nhạc',
          'tiếp tục phát',
          'phát tiếp',
          'nghe tiếp',
          'kêu bật nhạc',
          'bảo bật nhạc'
        ]) ||
        /\b(bật|mở|tiếp tục|phát)\s+(lại\s+)?(nhạc nền|nhạc|bài hát)\b/i.test(cmd);

      if (isResumeMusicCmd) {
        onResumeBgm();
        onSpeechBubble('Em đã bật lại nhạc nền thư giãn cho đại ca!');
        confirmSuccess('Bật nhạc nền Web', 'Dạ, em đã bật lại nhạc nền cho đại ca rồi ạ!');
        return true;
      }

      // =========================================================================
      // 1.1 DESKTOP PET CONTROLS & WIDGET MANAGEMENT
      // =========================================================================
      if (
        matchesAny(cmd, [
          'mở web',
          'mở trang web',
          'mở dashboard',
          'mở bảng điều khiển',
          'mở ứng dụng',
          'hiện web',
          'hiện dashboard',
          'vào web',
          'vào app',
          'hiện bảng điều khiển'
        ])
      ) {
        onShowDashboard?.();
        onSpeechBubble('Em đã mở bảng điều khiển Web cho đại ca rồi ạ!');
        confirmSuccess('Mở Dashboard Web', 'Dạ, em đã mở bảng điều khiển Web cho đại ca rồi ạ!');
        return true;
      }

      if (
        matchesAny(cmd, [
          'ẩn đi',
          'giấu mình',
          'ẩn pet',
          'tạm ẩn',
          'thu pet lại',
          'thu thú cưng',
          'ẩn khỏi màn hình',
          'trốn đi',
          'tạm biệt pet',
          'tắt desktop pet'
        ])
      ) {
        onHideDesktopPet?.();
        onSpeechBubble('Em tạm ẩn đây ạ! Cần em đại ca nhấn Ctrl+Shift+P nhé!');
        confirmSuccess('Ẩn thú cưng Desktop', 'Dạ, em tạm ẩn để đại ca tập trung làm việc ạ!');
        return true;
      }

      if (
        matchesAny(cmd, [
          'đi dạo đi',
          'đi dạo',
          'chạy loanh quanh',
          'đi loanh quanh',
          'đi chơi đi',
          'chạy đi',
          'bước đi',
          'đi vòng vòng',
          'tự do đi dạo'
        ])
      ) {
        onWalk?.();
        onSpeechBubble('Em đi dạo quanh màn hình cùng đại ca đây ạ! 🧭');
        confirmSuccess('Đi dạo', 'Dạ, em đi dạo quanh màn hình cùng đại ca đây ạ!');
        return true;
      }

      if (
        matchesAny(cmd, [
          'đứng yên',
          'đứng lại',
          'dừng lại',
          'đứng im',
          'đừng đi nữa',
          'ghim lại',
          'ở yên đó',
          'đừng chạy nữa',
          'đứng đây'
        ])
      ) {
        onStopWalk?.();
        onAction('IDLE', 'Em đứng ngoan ở đây đợi đại ca sai bảo ạ.');
        onSpeechBubble('Em đứng ngoan ở đây đợi đại ca sai bảo ạ! 📌');
        confirmSuccess('Đứng yên', 'Dạ, em đứng ngoan ở đây đợi đại ca ạ!');
        return true;
      }

      if (
        matchesAny(cmd, [
          'mở menu',
          'bật menu',
          'thanh công cụ',
          'menu nhanh',
          'thanh điều khiển',
          'bảng chức năng'
        ])
      ) {
        onOpenMenu?.();
        onSpeechBubble('Em đã mở thanh Menu nhanh cho đại ca rồi ạ! ✨');
        confirmSuccess('Mở Menu nhanh');
        return true;
      }

      if (
        matchesAny(cmd, [
          'đóng bảng',
          'đóng menu',
          'đóng cửa sổ',
          'thu nhỏ',
          'đóng lại',
          'tắt bảng',
          'tắt menu',
          'thu gọn'
        ])
      ) {
        onClosePanel?.();
        onSpeechBubble('Em đã thu gọn các bảng điều khiển cho đại ca rồi ạ!');
        confirmSuccess('Thu gọn bảng');
        return true;
      }

      // =========================================================================
      // 1.2 TIME, JOKES, SONGS & COMPANION Q&A
      // =========================================================================
      if (
        matchesAny(cmd, [
          'mấy giờ rồi',
          'bây giờ là mấy giờ',
          'mấy giờ',
          'xem giờ',
          'mấy giờ thế',
          'mấy giờ vậy',
          'đồng hồ mấy giờ',
          'hôm nay thứ mấy',
          'hôm nay ngày mấy',
          'hôm nay là ngày mấy',
          'ngày bao nhiêu',
          'ngày mấy rồi',
          'xem ngày'
        ])
      ) {
        const now = new Date();
        const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        const dayName = days[now.getDay()];
        const h = now.getHours().toString().padStart(2, '0');
        const m = now.getMinutes().toString().padStart(2, '0');
        const dateStr = `${dayName}, ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;
        const timeSpeech = `Dạ bây giờ là ${h} giờ ${m} phút, ${dayName}, ngày ${now.getDate()} tháng ${now.getMonth() + 1} thưa đại ca!`;
        onSpeechBubble(`🕒 Bây giờ là ${h}:${m} • ${dateStr}`);
        confirmSuccess(`Thời gian: ${h}:${m} (${dayName})`, timeSpeech);
        return true;
      }

      if (
        matchesAny(cmd, [
          'kể chuyện cười',
          'kể chuyện vui',
          'nói câu gì vui',
          'chuyện hài',
          'hài hước xíu đi',
          'chọc cười',
          'kể chuyện tiếu lâm',
          'kể chuyện vui đi',
          'kể chuyện hài'
        ])
      ) {
        const joke = PET_JOKES[Math.floor(Math.random() * PET_JOKES.length)];
        onAction('HAPPY', joke);
        onSpeechBubble(joke);
        confirmSuccess('Kể chuyện cười cho đại ca', joke);
        return true;
      }

      if (
        matchesAny(cmd, [
          'hát đi',
          'hát một bài',
          'hát cho nghe',
          'hát tặng',
          'hát một câu',
          'hát hò',
          'hát ca',
          'hát nào',
          'hát nhé'
        ])
      ) {
        const song = PET_SONGS[Math.floor(Math.random() * PET_SONGS.length)];
        onAction('DANCING', song);
        onSpeechBubble(song);
        confirmSuccess('Hát tặng đại ca', song);
        return true;
      }

      if (
        matchesAny(cmd, [
          'mệt quá',
          'mệt mỏi',
          'áp lực quá',
          'stress quá',
          'buồn quá',
          'chán quá',
          'nản quá',
          'đuối quá',
          'áp lực ghê'
        ])
      ) {
        const cheerMsg = 'Thương đại ca nhiều lắm! Hôm nay đại ca đã cố gắng rất nhiều rồi. Đại ca vươn vai hít thở sâu một cái, hoặc để em mở nhạc lofi thư giãn cho đại ca nhé! Em luôn ở bên đại ca nè! ❤️';
        onAction('HAPPY', cheerMsg);
        onSpeechBubble(cheerMsg);
        confirmSuccess('Động viên đại ca', 'Thương đại ca nhiều lắm! Cố lên đại ca nhé, em luôn đồng hành bên cạnh đại ca!');
        return true;
      }

      if (
        matchesAny(cmd, [
          'em tên gì',
          'bạn tên gì',
          'mày tên gì',
          'giới thiệu bản thân',
          'bạn là ai',
          'em là ai',
          'tên là gì'
        ])
      ) {
        const introMsg = `Dạ, em là ${petName || 'Any'}! Em là thú cưng kiêm trợ lý ảo đồng hành độc quyền của đại ca, luôn sẵn sàng phục vụ đại ca 24/7 ạ!`;
        onAction('WAVING', introMsg);
        onSpeechBubble(introMsg);
        confirmSuccess('Giới thiệu bản thân', introMsg);
        return true;
      }

      if (
        matchesAny(cmd, [
          'em đói chưa',
          'đói không',
          'khỏe không',
          'hôm nay thế nào',
          'tình hình thế nào',
          'báo cáo tình hình',
          'tình trạng pet',
          'cấp mấy rồi',
          'level mấy',
          'bao nhiêu exp',
          'kiểm tra cấp độ'
        ])
      ) {
        const hVal = typeof hunger === 'number' ? hunger : 85;
        const hpVal = typeof happiness === 'number' ? happiness : 95;
        const lvVal = typeof petLevel === 'number' ? petLevel : 1;
        const statMsg = `Dạ báo cáo đại ca: Hiện tại em đang ở cấp ${lvVal}, độ no của em là ${hVal}%, hạnh phúc là ${hpVal}%! Em vẫn tràn trề năng lượng và rất vui vẻ bên đại ca ạ!`;
        onAction(hVal < 50 ? 'YAWNING' : 'HAPPY', statMsg);
        onSpeechBubble(statMsg);
        confirmSuccess('Tình trạng thú cưng', statMsg);
        return true;
      }

      // Smart Greetings by Time of Day & Affectionate Camaraderie
      if (matchesAny(cmd, ['chào buổi sáng', 'buổi sáng vui vẻ', 'good morning'])) {
        const msg = 'Dạ em chào buổi sáng đại ca! Chúc đại ca ngày mới tràn đầy năng lượng, làm việc đâu thắng đó ạ! ☀️';
        onAction('WAVING', msg);
        onSpeechBubble(msg);
        confirmSuccess('Chào buổi sáng đại ca', 'Dạ em chào buổi sáng đại ca! Chúc đại ca ngày mới tràn đầy năng lượng ạ!');
        return true;
      }

      if (matchesAny(cmd, ['chào buổi trưa', 'nghỉ trưa thôi', 'ăn trưa chưa'])) {
        const msg = 'Dạ buổi trưa rồi, đại ca nhớ ăn trưa đầy đủ và chợp mắt nghỉ ngơi một chút lấy sức nhé ạ! 🍱';
        onAction('HAPPY', msg);
        onSpeechBubble(msg);
        confirmSuccess('Chào buổi trưa đại ca', 'Dạ buổi trưa rồi, đại ca nhớ ăn trưa và nghỉ ngơi một chút lấy sức nhé ạ!');
        return true;
      }

      if (matchesAny(cmd, ['chào buổi tối', 'buổi tối vui vẻ', 'good evening'])) {
        const msg = 'Dạ em chào buổi tối đại ca! Chúc đại ca một buổi tối thật thư giãn và bình yên bên em nhé! 🌙';
        onAction('HAPPY', msg);
        onSpeechBubble(msg);
        confirmSuccess('Chào buổi tối đại ca', 'Dạ em chào buổi tối đại ca! Chúc đại ca buổi tối thật thư giãn bên em nhé ạ!');
        return true;
      }

      if (matchesAny(cmd, ['chúc ngủ ngon', 'good night', 'đại ca đi ngủ đây', 'anh đi ngủ đây'])) {
        const msg = 'Dạ chúc đại ca ngủ thật ngon và mơ đẹp nhé! Em cũng chợp mắt cạnh đại ca đây ạ! 💤';
        onAction('SLEEPING', msg);
        onSpeechBubble(msg);
        confirmSuccess('Chúc đại ca ngủ ngon', 'Dạ chúc đại ca ngủ thật ngon và mơ đẹp nhé ạ!');
        return true;
      }

      if (
        matchesAny(cmd, [
          'đáng yêu quá',
          'dễ thương quá',
          'cute quá',
          'cưng quá',
          'thông minh quá',
          'khéo miệng',
          'ngoan lắm',
          'thương em',
          'yêu em',
          'quý em',
          'cưng em'
        ])
      ) {
        const msg = 'Hihi dạ em cảm ơn đại ca đã khen! Em cũng yêu thương đại ca nhất trên đời luôn ạ! 💖';
        onAction('THANKING', msg);
        onSpeechBubble(msg);
        confirmSuccess('Đáp lại lời khen của đại ca', 'Hihi dạ em cảm ơn đại ca đã khen! Em cũng yêu thương đại ca nhất trên đời luôn ạ!');
        return true;
      }

      // Smart Ergonomics, Health & Wellness Care
      if (matchesAny(cmd, ['đau lưng', 'mỏi lưng', 'mỏi cổ', 'đau cổ', 'mỏi vai', 'đau vai', 'căng cơ'])) {
        const msg = 'Đại ca ngồi lâu mỏi người rồi đó ạ! Đại ca hãy ngồi thẳng lưng, xoay nhẹ khớp vai và duỗi vai vươn mình một chút cùng em nhé! 💪';
        onAction('EXERCISING', msg);
        onSpeechBubble(msg);
        confirmSuccess('Nhắc đại ca giãn cơ', 'Đại ca ngồi lâu mỏi rồi, đại ca hãy duỗi vai vươn mình một chút cùng em cho đỡ mỏi nhé ạ!');
        return true;
      }

      if (matchesAny(cmd, ['mỏi mắt', 'nhức mắt', 'khô mắt', 'cay mắt', 'mờ mắt'])) {
        const msg = 'Thương mắt của đại ca quá! Đại ca áp dụng quy tắc 20-20-20 nhé: rời mắt khỏi màn hình, nhìn xa sáu mét trong hai mươi giây và chớp mắt chậm rãi ạ! 👀';
        onAction('IDLE', msg);
        onSpeechBubble(msg);
        confirmSuccess('Chăm sóc mắt cho đại ca', 'Đại ca hãy rời mắt khỏi màn hình và nhìn xa sáu mét trong hai mươi giây để mắt nghỉ ngơi nhé ạ!');
        return true;
      }

      if (matchesAny(cmd, ['đau đầu', 'nhức đầu', 'chóng mặt', 'hoa mắt'])) {
        const msg = 'Đại ca làm việc căng thẳng quá rồi! Đại ca uống một ngụm nước ấm và hít thở sâu thư giãn vài phút cùng em nhé! 🍵';
        onOpenModal('BREATHING');
        onSpeechBubble(msg);
        confirmSuccess('Mở thư giãn giảm đau đầu', 'Đại ca làm việc căng thẳng quá rồi, đại ca uống chút nước ấm và hít thở sâu cùng em nhé ạ!');
        return true;
      }

      // Smart Work Motivation & Daily Life Advice
      if (
        matchesAny(cmd, [
          'khuyên đại ca',
          'cho lời khuyên',
          'làm sao để tập trung',
          'lười quá',
          'chưa muốn làm',
          'trì hoãn',
          'cổ vũ',
          'tiếp sức',
          'truyền động lực',
          'cố lên'
        ])
      ) {
        const msg = 'Đại ca của em siêu giỏi luôn! Bí quyết là mình chỉ cần bắt đầu bằng 1 phiên Pomodoro 25 phút thôi, việc khó mấy cũng xong gọn! Em cổ vũ đại ca hết mình! 🔥';
        onAction('CELEBRATING', msg);
        onSpeechBubble(msg);
        confirmSuccess('Truyền động lực cho đại ca', 'Đại ca của em siêu giỏi luôn! Mình cứ làm từng bước nhỏ một là việc gì cũng thành công rực rỡ ạ!');
        return true;
      }

      if (matchesAny(cmd, ['hôm nay ăn gì', 'trưa nay ăn gì', 'tối nay ăn gì', 'ăn món gì ngon', 'gợi ý món ăn'])) {
        const meals = [
          'Dạ hôm nay đại ca thử ăn cơm tấm sườn bì chả nóng hổi hoặc một tô phở bò tái lăn thơm phức xem sao ạ! Ngon bá cháy luôn!',
          'Dạ em gợi ý đại ca làm một phần bún chả Hà Nội hoặc mì quảng gà trứng vừa ngon miệng vừa đủ chất cho đại ca làm việc ạ!',
          'Dạ tối nay đại ca thưởng cho mình một bữa lẩu ấm cúng hoặc gà nướng mật ong kèm salad tươi mát nhé ạ!'
        ];
        const mealMsg = meals[Math.floor(Math.random() * meals.length)];
        onAction('HAPPY', mealMsg);
        onSpeechBubble(mealMsg);
        confirmSuccess('Gợi ý món ngon cho đại ca', mealMsg);
        return true;
      }

      if (matchesAny(cmd, ['thời tiết thế nào', 'trời mưa', 'trời nắng', 'nóng quá', 'lạnh quá', 'trời lạnh', 'trời nóng'])) {
        const weatherMsg = 'Dạ thời tiết thất thường dễ mệt lắm, đại ca nhớ uống đủ nước và giữ gìn sức khỏe thật tốt để luôn phong độ bên em nhé ạ! 🌤️';
        onAction('HAPPY', weatherMsg);
        onSpeechBubble(weatherMsg);
        confirmSuccess('Quan tâm sức khỏe thời tiết', weatherMsg);
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

      // Check topic-based hot room command BEFORE generic "phòng chung" and BEFORE "làm việc" pet action
      const hotRoomCmd = detectHotRoomCommand(cmd);
      if (hotRoomCmd) {
        onSpeechBubble(`🔥 Đang tìm phòng chủ đề "${hotRoomCmd.label}" nhiều Like nhất cho đại ca...`);
        confirmSuccess(
          `Vào phòng HOT: ${hotRoomCmd.label}`,
          `Dạ đại ca! Để em tìm phòng chủ đề ${hotRoomCmd.label} đang hot nhất và đưa đại ca vào ngay ạ!`
        );
        if (onJoinHotRoom) {
          void onJoinHotRoom(hotRoomCmd.topic, cmd);
        } else {
          void (async () => {
            try {
              const res = await api.joinHotDepartment(hotRoomCmd.topic, cmd);
              await onMembershipChange?.();
              onNavigate('GARDEN');
              if (res.data?.message) {
                onSpeechBubble(`🔥 ${res.data.message}`);
              }
            } catch {
              onNavigate('GARDEN');
            }
          })();
        }
        return true;
      }

      if (matchesAny(cmd, ['phòng chung', 'không gian chung', 'phòng ban', 'vườn chung', 'khu vườn chung', 'khu vườn', 'mở khu vườn', 'vào khu vườn'])) {
        onNavigate('GARDEN');
        onSpeechBubble('Em đưa đại ca vào Khu Vườn & Phòng Chung ạ!');
        confirmSuccess('Mở Khu Vườn', 'Dạ, em đưa đại ca vào khu vườn chung ạ!');
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
      if (matchesAny(cmd, ['trong nhà', 'phòng trong nhà', 'sàn gỗ', 'phòng gỗ'])) {
        onNavigate('PET');
        onChangeRoom('room');
        onSpeechBubble('Em đã chuyển về Phòng Trong Nhà ấm cúng!');
        confirmSuccess('Đổi phòng: Trong Nhà', 'Dạ, mình về phòng trong nhà ấm áp rồi ạ!');
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
        confirmSuccess('Mở & Phát Nhạc Lofi');
        return true;
      }

      return false;
    },
    [
      petName,
      hunger,
      happiness,
      petLevel,
      onFeed,
      onDrink,
      onStroke,
      onLevelUp,
      onAction,
      onChangeRoom,
      onChangeScale,
      onNavigate,
      onOpenModal,
      onClosePanel,
      onWalk,
      onStopWalk,
      onShowDashboard,
      onHideDesktopPet,
      onOpenMenu,
      onSpeechBubble,
      onPlayMusic,
      onStopMusic,
      onResumeBgm,
      onStartTimer,
      onJoinHotRoom,
      onMembershipChange,
      speakVietnamese
    ]
  );

  // Send unrecognized natural language sentence to trained Backend AI (Completes 1 Task)
  const executeAIFallback = useCallback(
    async (rawCommand: string, includeWakeGreeting = false) => {
      const cmd = rawCommand.toLowerCase().trim();
      if (cmd.length < 3 || isIncompleteCommandPrefix(cmd)) return;

      if (isPetSelfEcho(cmd)) {
        console.log('🔇 [executeAIFallback] Dropped pet self-echo:', cmd);
        return;
      }

      const now = Date.now();
      if (now - lastCommandTimeRef.current < 750 || now - lastGlobalCommandAt < 750) return;

      lastCommandTimeRef.current = now;
      lastGlobalCommandAt = now;
      voiceSyncChannel?.postMessage({
        type: 'COMMAND_EXECUTED',
        instanceId: instanceIdRef.current,
        timestamp: now
      });

      pendingPrefixRef.current = '';
      playRetroTone('success');
      setLastExecuted(`AI xử lý: "${rawCommand}"`);
      setIsAwake(false);
      isAwakeRef.current = false;
      if (awakeTimeoutRef.current) clearTimeout(awakeTimeoutRef.current);

      onSpeechBubble('Em đang xử lý nhanh cho đại ca...');
      try {
        const res = await api.chatWithAI(rawCommand, true);
        const data = res.data;
        let isAlreadySpokenByAction = false;

        if (data?.action) {
          if (data.action.type === 'JOIN_HOT_ROOM') {
            await onMembershipChange?.();
            onNavigate('GARDEN');
          } else if (data.action.type === 'NAVIGATE_TAB' && data.action.tab) {
            onNavigate(data.action.tab);
          } else if (data.action.type === 'CHANGE_ROOM' && data.action.room) {
            onNavigate('PET');
            onChangeRoom(data.action.room);
          } else if (data.action.type === 'OPEN_MODAL' && data.action.modal) {
            onOpenModal(data.action.modal);
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
            const spokenReply = includeWakeGreeting
              ? `Em đây đại ca! ${data.reply.replace(/^(dạ\s*,?\s*|em đây đại ca[!,.]?\s*)/i, '')}`
              : data.reply;
            speakVietnamese(spokenReply);
          }
        }
      } catch {
        const fallbackMsg = 'Em đây đại ca, em luôn ở bên cổ vũ đại ca làm việc thật tốt nhé!';
        onSpeechBubble(fallbackMsg);
        speakVietnamese(fallbackMsg);
      }
    },
    [onNavigate, onChangeRoom, onStopMusic, onStartTimer, onOpenModal, onPlayMusic, onFeed, onDrink, onStroke, onLevelUp, onAction, onMembershipChange, onSpeechBubble, speakVietnamese]
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
                  void handlersRef.current.executeAIFallback(cmdToExecute, Boolean(wakeMatch));
                }
              } else if (wakeMatch) {
                handlersRef.current.triggerWakeState(false);
              } else {
                void handlersRef.current.executeAIFallback(transcript, false);
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

      recorder.start(150);
      setRecorderState('RECORDING');
      setRecordingSeconds(0);
      setIsPanelOpen(true);
      playRetroTone('wake');

      // Fast silence auto-stop for Push-to-Talk: once user speaks and pauses for 480ms, stop immediately!
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const pttCtx = new AudioCtx();
          const src = pttCtx.createMediaStreamSource(stream);
          const analyser = pttCtx.createAnalyser();
          analyser.fftSize = 256;
          src.connect(analyser);
          const buf = new Uint8Array(analyser.frequencyBinCount);
          let spoke = false;
          let silenceSince = 0;
          const pttCheck = setInterval(() => {
            if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
              clearInterval(pttCheck);
              try { pttCtx.close(); } catch {}
              return;
            }
            analyser.getByteFrequencyData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) sum += buf[i];
            const avg = sum / buf.length;
            if (avg >= 14) {
              spoke = true;
              silenceSince = 0;
            } else if (spoke) {
              if (!silenceSince) silenceSince = Date.now();
              else if (Date.now() - silenceSince >= 240) {
                clearInterval(pttCheck);
                try { pttCtx.close(); } catch {}
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                  try { mediaRecorderRef.current.stop(); } catch {}
                }
              }
            }
          }, 60);
        }
      } catch {}

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);

      // Auto-stop after 3 seconds max (reduced from 5s for much faster response)
      if (maxRecordingTimerRef.current) clearTimeout(maxRecordingTimerRef.current);
      maxRecordingTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          try {
            mediaRecorderRef.current.stop();
          } catch {
            // Ignore
          }
        }
      }, 3000);
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

    // Prevent Web Speech API from running simultaneously if VAD engine is active
    if (useVadFallbackRef.current || isElectron) {
      void startVadListening();
      return;
    }

    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      useVadFallbackRef.current = true;
      void startVadListening();
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'vi-VN';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 2;

      let interimFastTimer: ReturnType<typeof setTimeout> | null = null;
      let lastFastHandledPhrase = '';
      let lastFastHandledAt = 0;

      const processRecognizedText = (clean: string, isInterimCommit: boolean) => {
        if (!clean) return;
        if (isPetSelfEcho(clean)) {
          console.log('🔇 [Continuous Voice] Filtered pet self-echo transcript:', clean);
          return;
        }

        const now = Date.now();
        if (clean === lastFastHandledPhrase && now - lastFastHandledAt < 2200) {
          return;
        }

        const wakeMatch = findWakeWordInPhrase(clean);
        const cmd = (wakeMatch ? wakeMatch.commandAfterWake : clean).trim();

        if (cmd && isPetSelfEcho(cmd)) {
          return;
        }

        if (wakeMatch) {
          if (cmd.length >= 2) {
            if (isInterimCommit && isIncompleteCommandPrefix(cmd)) return;
            const matched = handlersRef.current.executeKnownCommand(cmd, true);
            if (matched) {
              lastFastHandledPhrase = clean;
              lastFastHandledAt = now;
            } else if (!isInterimCommit) {
              lastFastHandledPhrase = clean;
              lastFastHandledAt = now;
              void handlersRef.current.executeAIFallback(cmd, true);
            }
          } else {
            lastFastHandledPhrase = clean;
            lastFastHandledAt = now;
            handlersRef.current.triggerWakeState(false);
          }
        } else if (isAwakeRef.current) {
          if (cmd.length >= 2) {
            if (isInterimCommit && isIncompleteCommandPrefix(cmd)) return;
            const matched = handlersRef.current.executeKnownCommand(cmd, false);
            if (matched) {
              lastFastHandledPhrase = clean;
              lastFastHandledAt = now;
            } else if (!isInterimCommit) {
              lastFastHandledPhrase = clean;
              lastFastHandledAt = now;
              void handlersRef.current.executeAIFallback(cmd, false);
            }
          }
        } else if (cmd.length >= 2) {
          if (isInterimCommit && isIncompleteCommandPrefix(cmd)) return;
          const matched = handlersRef.current.executeKnownCommand(cmd, false);
          if (matched) {
            lastFastHandledPhrase = clean;
            lastFastHandledAt = now;
          }
        }
      };

      recognition.onresult = (event: any) => {
        if (isTtsSpeaking() || isAudioPlayingRef.current) {
          console.log('🔇 [Continuous Voice] Blocked: Pet is currently speaking');
          return;
        }

        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const piece = event.results[i][0].transcript + ' ';
          if (event.results[i].isFinal) {
            finalTranscript += piece;
          } else {
            interimTranscript += piece;
          }
        }

        const cleanFinal = finalTranscript.trim().toLowerCase();
        const cleanInterim = interimTranscript.trim().toLowerCase();

        // Show live interim transcript immediately so user sees 0.1s feedback
        if (cleanInterim && !isPetSelfEcho(cleanInterim)) {
          setLiveTranscript(cleanInterim);
          if (interimFastTimer) clearTimeout(interimFastTimer);
          // Fast-commit known commands / "hello" / wake words after just 280ms pause without waiting 2s for Chrome isFinal!
          interimFastTimer = setTimeout(() => {
            processRecognizedText(cleanInterim, true);
          }, 280);
        }

        if (!cleanFinal) return;
        if (interimFastTimer) {
          clearTimeout(interimFastTimer);
          interimFastTimer = null;
        }

        console.log('🎤 [Continuous Voice] Heard final:', cleanFinal);
        setLiveTranscript(cleanFinal);
        processRecognizedText(cleanFinal, false);
      };

      recognition.onerror = (event: any) => {
        console.warn('Recognition error:', event.error);
        if (event.error === 'network') {
          console.log('🔄 Web Speech API network error -> switching permanently to VAD engine');
          useVadFallbackRef.current = true;
          if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
          if (recognitionRef.current) {
            try { recognitionRef.current.abort(); } catch {}
            recognitionRef.current = null;
          }
          void startVadListening();
          return;
        }
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
        if (useVadFallbackRef.current) return;
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
          if (isContinuousModeRef.current && !useVadFallbackRef.current && !isTtsSpeaking() && !isAudioPlayingRef.current) {
            safeStartRecognitionRef.current();
          }
        }, 500);
      }
    }
  }, [isElectron]);

  safeStartRecognitionRef.current = safeStartRecognition;

  const stopVadListening = useCallback(() => {
    setIsListeningActive(false);
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (vadSilenceTimerRef.current) {
      clearTimeout(vadSilenceTimerRef.current);
      vadSilenceTimerRef.current = null;
    }
    if (vadRecorderRef.current && vadRecorderRef.current.state === 'recording') {
      try { vadRecorderRef.current.stop(); } catch {}
    }
    vadRecorderRef.current = null;
    isVadSpeakingRef.current = false;
    vadProcessingRef.current = false;

    if (vadStreamRef.current) {
      vadStreamRef.current.getTracks().forEach(t => t.stop());
      vadStreamRef.current = null;
    }
    if (vadAudioCtxRef.current && vadAudioCtxRef.current.state !== 'closed') {
      try { vadAudioCtxRef.current.close(); } catch {}
      vadAudioCtxRef.current = null;
    }
    setMicLevel(0);
  }, []);

  const startVadListening = useCallback(async () => {
    if (!isContinuousModeRef.current) return;
    if (isTtsSpeaking() || isAudioPlayingRef.current) return;

    try {
      if (vadStreamRef.current && vadStreamRef.current.active) {
        setIsListeningActive(true);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      vadStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      if (audioCtx.state === 'suspended') {
        try { await audioCtx.resume(); } catch {}
      }
      vadAudioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.2;
      source.connect(analyser);
      vadAnalyserRef.current = analyser;

      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4'
      ];
      const chosenMime = mimeTypes.find(m => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) || '';

      const createNewVadRecorder = () => {
        const recorder = chosenMime ? new MediaRecorder(stream, { mimeType: chosenMime }) : new MediaRecorder(stream);
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            vadAudioChunksRef.current.push(event.data);
          }
        };
        recorder.onstop = async () => {
          const chunks = vadAudioChunksRef.current;
          vadAudioChunksRef.current = [];
          if (chunks.length === 0 || !isContinuousModeRef.current) {
            setRecorderState('IDLE');
            vadProcessingRef.current = false;
            return;
          }

          const audioBlob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          if (audioBlob.size < 600) {
            setRecorderState('IDLE');
            vadProcessingRef.current = false;
            return;
          }

          setRecorderState('TRANSCRIBING');
          vadProcessingRef.current = true;
          try {
            const reader = new FileReader();
            reader.onloadend = async () => {
              try {
                const base64Data = reader.result as string;
                const res = await api.transcribeAudio(base64Data, audioBlob.type);
                const transcript = (res.data?.transcript || '').trim();

                if (!transcript || isPetSelfEcho(transcript)) {
                  setRecorderState('IDLE');
                  vadProcessingRef.current = false;
                  return;
                }

                console.log('🎤 [Continuous VAD STT] Transcript:', transcript);
                setLiveTranscript(transcript);

                const wakeMatch = findWakeWordInPhrase(transcript);
                const cmdToExecute = (wakeMatch ? wakeMatch.commandAfterWake : transcript).trim();

                if (cmdToExecute && isPetSelfEcho(cmdToExecute)) {
                  setRecorderState('IDLE');
                  vadProcessingRef.current = false;
                  return;
                }

                if (wakeMatch) {
                  if (cmdToExecute.length >= 2) {
                    const matched = handlersRef.current.executeKnownCommand(cmdToExecute, true);
                    if (!matched) {
                      void handlersRef.current.executeAIFallback(cmdToExecute, true);
                    }
                  } else {
                    handlersRef.current.triggerWakeState(false);
                  }
                } else if (isAwakeRef.current) {
                  if (cmdToExecute.length >= 2) {
                    const matched = handlersRef.current.executeKnownCommand(cmdToExecute, false);
                    if (!matched) {
                      void handlersRef.current.executeAIFallback(cmdToExecute, false);
                    }
                  }
                } else if (cmdToExecute.length >= 2) {
                  // When not awake and no wake word was spoken, only run deterministic commands
                  handlersRef.current.executeKnownCommand(cmdToExecute, false);
                }
              } catch (err) {
                console.warn('VAD STT error:', err);
              } finally {
                setRecorderState('IDLE');
                vadProcessingRef.current = false;
              }
            };
            reader.readAsDataURL(audioBlob);
          } catch {
            setRecorderState('IDLE');
            vadProcessingRef.current = false;
          }
        };
        return recorder;
      };

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      setIsListeningActive(true);

      const finishVadRecording = () => {
        if (!isVadSpeakingRef.current) return;
        isVadSpeakingRef.current = false;
        if (vadSilenceTimerRef.current) {
          clearTimeout(vadSilenceTimerRef.current);
          vadSilenceTimerRef.current = null;
        }
        if (vadRecorderRef.current && vadRecorderRef.current.state === 'recording') {
          try { vadRecorderRef.current.stop(); } catch {}
        }
      };

      if (vadIntervalRef.current) clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = setInterval(() => {
        if (!audioCtx || audioCtx.state === 'closed') return;
        if (audioCtx.state === 'suspended') {
          audioCtx.resume().catch(() => {});
        }

        if (isTtsSpeaking() || isAudioPlayingRef.current || vadProcessingRef.current) {
          if (isVadSpeakingRef.current) {
            finishVadRecording();
          }
          setMicLevel(0);
          return;
        }

        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const avg = sum / buffer.length;
        setMicLevel(Math.min(100, Math.round(avg * 2.2)));

        const SPEECH_THRESHOLD = 14;

        if (avg >= SPEECH_THRESHOLD) {
          if (!isVadSpeakingRef.current) {
            isVadSpeakingRef.current = true;
            vadAudioChunksRef.current = [];
            vadRecorderRef.current = createNewVadRecorder();
            try {
              vadRecorderRef.current.start(150);
              setRecorderState('RECORDING');
            } catch {}
          } else {
            if (vadSilenceTimerRef.current) {
              clearTimeout(vadSilenceTimerRef.current);
              vadSilenceTimerRef.current = null;
            }
          }
        } else {
          if (isVadSpeakingRef.current && !vadSilenceTimerRef.current) {
            vadSilenceTimerRef.current = setTimeout(() => {
              finishVadRecording();
            }, 220);
          }
        }
      }, 80);
    } catch (err) {
      console.warn('VAD listening start error:', err);
      setIsListeningActive(false);
      propsRef.current.onSpeechBubble?.('Chưa thể mở Micro, đại ca hãy kiểm tra quyền Micro trên máy nhé!');
    }
  }, []);

  const startContinuousListening = useCallback(() => {
    if (!isContinuousModeRef.current) return;
    if (isTtsSpeaking() || isAudioPlayingRef.current) return;

    activeMicInstanceId = instanceIdRef.current;
    voiceSyncChannel?.postMessage({
      type: 'CLAIM_MIC',
      instanceId: instanceIdRef.current
    });

    if (isElectron || useVadFallbackRef.current) {
      void startVadListening();
    } else {
      safeStartRecognition();
    }
  }, [isElectron, startVadListening, safeStartRecognition]);

  startContinuousListeningRef.current = startContinuousListening;
  stopVadListeningRef.current = stopVadListening;

  useEffect(() => {
    if (autoStart) {
      setIsPanelOpen(true);
      setIsPanelMinimized(false);
    }
  }, [autoStart]);

  useEffect(() => {
    if (shouldAutoListenOnMount) {
      const timer = setTimeout(() => {
        if (isContinuousModeRef.current) {
          startContinuousListeningRef.current();
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [shouldAutoListenOnMount]);

  // Auto-start hands-free listening on mount when shouldAutoListenOnMount is true
  useEffect(() => {
    if (!isContinuousModeRef.current) return;
    const timer = setTimeout(() => {
      if (isContinuousModeRef.current) {
        startContinuousListeningRef.current();
      }
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // React to prop changes of autoListen (e.g. switching between Dashboard & Desktop Pet)
  useEffect(() => {
    if (autoListen !== undefined) {
      if (autoListen && !isContinuousModeRef.current) {
        setIsContinuousMode(true);
        isContinuousModeRef.current = true;
        startContinuousListeningRef.current();
      } else if (!autoListen && isContinuousModeRef.current) {
        setIsContinuousMode(false);
        isContinuousModeRef.current = false;
        setIsListeningActive(false);
        stopVadListeningRef.current();
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        if (recognitionRef.current) {
          try { recognitionRef.current.abort(); } catch {}
        }
      }
    }
  }, [autoListen]);

  const toggleContinuousMode = useCallback(() => {
    stopTtsSpeech();
    if (isContinuousMode) {
      setIsContinuousMode(false);
      isContinuousModeRef.current = false;
      setIsListeningActive(false);
      setIsAwake(false);
      isAwakeRef.current = false;
      stopVadListening();
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      playRetroTone('sleep');
      propsRef.current.onSpeechBubble?.('Đã tắt chế độ luôn lắng nghe!');
    } else {
      activeMicInstanceId = instanceIdRef.current;
      try {
        voiceSyncChannel?.postMessage({ type: 'CLAIM_MIC', instanceId: instanceIdRef.current });
      } catch {}
      setIsContinuousMode(true);
      isContinuousModeRef.current = true;
      setIsPanelOpen(true);
      playRetroTone('wake');
      startContinuousListening();
      propsRef.current.onSpeechBubble?.('🟢 Chế độ luôn lắng nghe đã BẬT! Đại ca gọi "Hey Any" để em thưa "Em đây đại ca" nhé!');
    }
  }, [isContinuousMode, startContinuousListening, stopVadListening]);

  const toggleRecording = useCallback(() => {
    if (recorderState === 'RECORDING') {
      stopRecording();
    } else if (recorderState === 'IDLE') {
      void startRecording();
    }
  }, [recorderState, startRecording, stopRecording]);

  useEffect(() => {
    return () => {
      stopVadListening();
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
  }, [stopVadListening]);

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
              ? 'Chế độ luôn lắng nghe đang BẬT. Gọi "Hey Any" để bé thưa "Em đây đại ca" rồi nói lệnh!'
              : 'Bật chế độ Luôn Lắng Nghe (Rảnh tay 100% — Gọi "Hey Any" là pet thưa "Em đây đại ca")'
          }
          className={`h-8 px-2.5 rounded-md text-xs font-black border-2 border-slate-950 shadow-[0_2px_0_#000] active:translate-y-[2px] active:shadow-none transition flex items-center gap-1.5 ${
            isAwake
              ? 'bg-amber-400 text-slate-950 animate-bounce'
              : isContinuousMode
              ? 'bg-emerald-400 text-slate-950 animate-pulse'
              : 'bg-[#231e36] hover:bg-[#332b4f] text-emerald-400'
          }`}
        >
          <Radio size={14} className={isContinuousMode ? 'animate-spin' : ''} />
          <span>
            {isAwake
              ? 'Em đây đại ca! (Nói lệnh...)'
              : isContinuousMode
              ? 'Đang nghe ("Hey Any")...'
              : 'Luôn nghe: BẬT'}
          </span>
        </button>


      </div>
      )}

      {/* FLOATING VOICE ASSISTANT HUD PANEL (Visible when Voice Mode is Active or Embedded) */}
      {(embedded || isPanelOpen) && (
        <div
          className={
            embedded
              ? 'w-full h-full flex flex-col bg-[#181528] text-white overflow-hidden select-none'
              : 'fixed bottom-4 right-4 z-50 w-80 sm:w-96 bg-[#181528] text-white border-3 border-slate-950 rounded-2xl shadow-[5px_5px_0px_#000] overflow-hidden select-none'
          }
        >
          {/* Header Bar */}
          <div className="bg-[#231e36] px-3.5 py-2.5 border-b-2 border-slate-950 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full border border-slate-950 ${
                  isAwake
                    ? 'bg-amber-400 animate-ping'
                    : isContinuousMode
                    ? 'bg-emerald-400 animate-ping'
                    : recorderState === 'RECORDING'
                    ? 'bg-rose-500 animate-ping'
                    : recorderState === 'TRANSCRIBING'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-emerald-400'
                }`}
              />
              <span className="font-black text-xs uppercase tracking-wider text-amber-300">
                Trợ lý giọng nói {isAwake ? '(Đang chờ lệnh đại ca)' : isContinuousMode ? '(Luôn nghe)' : ''}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setVoiceReplyEnabled(prev => !prev)}
                title={voiceReplyEnabled ? 'Tắt giọng đọc tiếng Việt' : 'Bật giọng đọc tiếng Việt'}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-black border flex items-center gap-1 transition ${
                  voiceReplyEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {voiceReplyEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
                <span>{voiceReplyEnabled ? 'Giọng đọc' : 'Tắt tiếng'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCommandGuide(prev => !prev)}
                title="Xem danh sách câu lệnh mẫu"
                className={`px-2 py-0.5 rounded-lg text-[10px] font-black border flex items-center gap-1 transition ${
                  showCommandGuide
                    ? 'bg-amber-400 text-slate-950 border-slate-950'
                    : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                }`}
              >
                <HelpCircle size={12} />
                <span>Câu lệnh mẫu</span>
              </button>
              {!embedded && (
                <>
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
                </>
              )}
            </div>
          </div>

          {(embedded || !isPanelMinimized) && (
            <div className={embedded ? 'flex-1 overflow-y-auto p-3 space-y-2.5' : 'p-3.5 space-y-3'}>
              {/* Continuous Hands-Free Switch Card */}
              <div className="flex items-center justify-between p-3 bg-[#120f1d] border-2 border-slate-800 rounded-xl">
                <div className="flex flex-col pr-2">
                  <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                    <Radio size={14} className={isContinuousMode ? 'text-emerald-400 animate-spin' : 'text-slate-400'} />
                    Chế độ Giao Tiếp Thông Minh ("Hey Any")
                  </span>
                  <span className="text-[11px] text-slate-400 leading-snug">
                    {isAwake
                      ? '🟡 Đã nghe "Hey Any" — Em đây đại ca! Đại ca nói yêu cầu để hoàn tất 1 task nhé!'
                      : isContinuousMode
                      ? '🟢 Đang mở mic. Gọi "Hey Any" -> Bé thưa "Em đây đại ca" -> Nói yêu cầu là xong 1 task!'
                      : 'Bật để gọi "Hey Any" rảnh tay mọi lúc, không cần bấm nút mỗi lần.'}
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



              {/* Status Display Box */}
              <div
                className={`p-3 rounded-xl border-2 border-slate-950 transition-all ${
                  isAwake
                    ? 'bg-amber-950/70 border-amber-400/80 text-amber-100'
                    : isContinuousMode
                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                    : recorderState === 'RECORDING'
                    ? 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                    : recorderState === 'TRANSCRIBING'
                    ? 'bg-amber-950/60 border-amber-500/50 text-amber-200'
                    : 'bg-[#25203d] text-slate-200'
                }`}
              >
                <div className="text-[11px] font-black uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  {isAwake ? (
                    <>
                      <Sparkles size={13} className="text-amber-300 animate-spin" />
                      <span className="text-amber-300">Em đây đại ca! Đang chờ đại ca nói 1 yêu cầu...</span>
                    </>
                  ) : isContinuousMode ? (
                    <>
                      <Radio size={12} className="text-emerald-400 animate-spin" />
                      <span className="text-emerald-400">Đang lắng nghe đại ca ("Hey Any")...</span>
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
                  ) : isAwake ? (
                    'Đại ca hãy nói yêu cầu ngay (VD: "Cho pet ăn", "Bật nhạc Lofi", "Hôm nay ăn gì", "Kể chuyện cười")...'
                  ) : isContinuousMode ? (
                    'Gọi "Hey Any" để em thưa "Em đây đại ca", sau đó nói yêu cầu là xong 1 task!'
                  ) : recorderState === 'RECORDING' ? (
                    'Đại ca hãy nói (VD: "Cho ăn", "Uống nước", "Mở cửa hàng", "Hẹn giờ 15 phút")...'
                  ) : recorderState === 'TRANSCRIBING' ? (
                    'Đang chuyển giọng nói thành văn bản và kích hoạt lệnh...'
                  ) : (
                    'Bật nút "Luôn nghe" phía trên để gọi "Hey Any" rảnh tay bất cứ lúc nào!'
                  )}
                </p>

                {/* Real-time Visual Audio Equalizer Meter */}
                {isContinuousMode && (
                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-bold shrink-0">Sóng âm Micro:</span>
                    <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-75 rounded-full"
                        style={{ width: `${Math.min(100, micLevel * 2.2)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-emerald-400 font-mono w-7 text-right">{micLevel}%</span>
                  </div>
                )}
              </div>

              {/* Last Executed Command Badge */}
              {lastExecuted && (
                <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-950/70 border border-emerald-500/40 rounded-lg text-[11px]">
                  <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                    <Sparkles size={12} />
                    Xong 1 task:
                  </span>
                  <span className="font-black text-white truncate max-w-[200px]">{lastExecuted}</span>
                </div>
              )}

              {/* Quick Command Guide Cheat-Sheet */}
              {showCommandGuide && (
                <div className="bg-[#120f1d] border-2 border-slate-800 rounded-xl p-2.5 text-[11px] space-y-1.5 max-h-48 overflow-y-auto">
                  <div className="font-black text-amber-300 uppercase tracking-wider text-[10px]">
                    Quy trình 1 Task ("Hey Any" &rarr; "Em đây đại ca" &rarr; Yêu cầu):
                  </div>
                  <div className="text-slate-300">
                    <strong className="text-amber-300">• Bước 1 (Gọi tên):</strong> Nói <em>"Hey Any"</em> (hoặc <em>"Any ơi"</em>) &rarr; Bé đáp <strong>"Em đây đại ca"</strong>.
                  </div>
                  <div className="text-slate-300">
                    <strong className="text-amber-300">• Bước 2 (Nói yêu cầu):</strong> Nói 1 câu lệnh hoặc trò chuyện bất kỳ &rarr; Bé thực hiện ngay và hoàn tất 1 task!
                  </div>
                  <div className="text-slate-300">
                    <strong className="text-white">• Giao tiếp thông minh:</strong> "Chào buổi sáng", "Đáng yêu quá", "Đau lưng quá", "Hôm nay ăn gì", "Thời tiết thế nào", "Cấp mấy rồi", "Kể chuyện cười", "Hát một bài".
                  </div>
                  <div className="text-slate-300">
                    <strong className="text-white">• Chăm sóc Pet & Phòng:</strong> "Cho pet ăn", "Cho uống nước", "Vuốt ve", "Thăng cấp", "Nhảy múa đi", "Đi ngủ thôi", "Vào quán cafe", "Ra biển".
                  </div>
                  <div className="text-slate-300">
                    <strong className="text-white">• Âm nhạc & Hẹn giờ:</strong> "Bật nhạc Lofi", "Phát playlist yêu thích", "Đổi bài khác", "Tắt nhạc", "Hẹn giờ 15 phút", "Tắt chuông".
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
