import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  Coffee,
  Droplets,
  CheckCircle,
  Flame,
  Timer,
  Sparkles,
  BookOpen,
  PawPrint,
  Bell,
  BellRing,
  Volume2,
  Eye,
  Wind,
  Activity,
  Target,
  History,
  Award,
  Clock,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { api } from '../services/api';
import { AnimationState } from '../types';

export interface TimerRequest {
  minutes: number;
  autoStart: boolean;
  action?: 'START' | 'PAUSE' | 'RESET' | 'STOP_ALARM' | 'SET_CLOCK_ALARM';
  alarmTime?: string; // "HH:MM" in 24-hour format, e.g. "15:00"
  alarmLabel?: string;
  requestId: number;
}

interface ScheduledClockAlarm {
  id: string;
  time: string; // "HH:MM" (24h format, e.g. "15:00")
  label: string;
  enabled: boolean;
  lastTriggeredDate?: string; // "YYYY-MM-DD"
}

interface PomodoroTimerProps {
  currentMode: 'STRICT' | 'RELAXED';
  onModeChange: (mode: 'STRICT' | 'RELAXED') => void;
  onSessionFinish: (expAward: number) => void;
  onPetStateChange?: (state: AnimationState) => void;
  onPauseBgmForAlarm?: () => void;
  compact?: boolean;
  timerRequest?: TimerRequest;
}

type RingtoneId = 'CHIPTUNE' | 'MORNING_CHIME' | 'CLASSIC_ALARM' | 'LOFI_BELL';

interface PresetOption {
  minutes: number;
  label: string;
  tag: string;
  recommendedBreak: number;
  desc: string;
  category: 'WORK' | 'SHORT_BREAK' | 'LONG_BREAK' | 'QUICK_TIMER';
}

// Presets cho Chế độ Nghiêm túc (Module 3 - Chuẩn khoa học Pomodoro 25/5, DeskTime 52/17, Ultradian 90/20)
const STRICT_PRESETS: PresetOption[] = [
  {
    minutes: 15,
    label: '15 phút',
    tag: 'Khởi động nhanh',
    recommendedBreak: 3,
    desc: 'Phá vỡ sự trì hoãn, xử lý nhanh email hoặc việc nhỏ. Nghỉ khuyến nghị: 3 phút.',
    category: 'WORK'
  },
  {
    minutes: 25,
    label: '25 phút',
    tag: 'Pomodoro Cổ Điển (25/5)',
    recommendedBreak: 5,
    desc: 'Chuẩn Francesco Cirillo: Tập trung cao độ 25p, nghỉ ngắn 5p. Sau 4 phiên nghỉ dài 15–30p.',
    category: 'WORK'
  },
  {
    minutes: 45,
    label: '45 phút',
    tag: 'Học tập & Phân tích (45/10)',
    recommendedBreak: 10,
    desc: 'Tương đương 1 tiết học tiêu chuẩn, phù hợp đọc tài liệu & giải quyết bài toán. Nghỉ: 10 phút.',
    category: 'WORK'
  },
  {
    minutes: 52,
    label: '52 phút',
    tag: 'Tỷ lệ vàng DeskTime (52/17)',
    recommendedBreak: 17,
    desc: 'Nghiên cứu DeskTime: Làm việc sâu 52p kết hợp nghỉ hoàn toàn 17p giúp đạt hiệu suất cao nhất.',
    category: 'WORK'
  },
  {
    minutes: 60,
    label: '60 phút',
    tag: 'Deep Work (60/15)',
    recommendedBreak: 15,
    desc: 'Lập trình, thiết kế hoặc viết báo cáo chuyên sâu không ngắt quãng. Nghỉ khuyến nghị: 15 phút.',
    category: 'WORK'
  },
  {
    minutes: 90,
    label: '90 phút',
    tag: 'Nhịp sinh học Ultradian (90/20)',
    recommendedBreak: 20,
    desc: 'Chu kỳ năng lượng tự nhiên của não bộ (GS. Kleitman). Sau 90p cần nghỉ sâu 20p để tránh tăng cortisol.',
    category: 'WORK'
  }
];

// Presets cho Chế độ Thư giãn & Nghỉ giải lao (Module 4 - Bảo vệ sức khỏe & chống Burnout)
const RELAXED_PRESETS: PresetOption[] = [
  {
    minutes: 5,
    label: '5 phút',
    tag: 'Nghỉ ngắn Pomodoro',
    recommendedBreak: 5,
    desc: 'Thời gian vàng sau 25p làm việc: Đứng dậy vươn vai, uống 1 ngụm nước và rời mắt khỏi màn hình.',
    category: 'SHORT_BREAK'
  },
  {
    minutes: 10,
    label: '10 phút',
    tag: 'Thư giãn Mắt & Hơi thở',
    recommendedBreak: 10,
    desc: 'Nghỉ giải lao sau phiên 45p: Kết hợp quy tắc mắt 20-20-20 và hít thở điều hòa 4-7-8 hạ căng thẳng.',
    category: 'SHORT_BREAK'
  },
  {
    minutes: 15,
    label: '15 phút',
    tag: 'Nghỉ dài (Sau 4 Pomodoro)',
    recommendedBreak: 15,
    desc: 'Sau 4 chu kỳ làm việc liên tục, não cần 15–30 phút đi lại nhẹ nhàng để tái tạo sự chú ý.',
    category: 'LONG_BREAK'
  },
  {
    minutes: 17,
    label: '17 phút',
    tag: 'Nghỉ chuẩn DeskTime (52/17)',
    recommendedBreak: 17,
    desc: 'Tách biệt hoàn toàn khỏi màn hình máy tính & điện thoại trong 17 phút để não bộ hồi phục 100%.',
    category: 'LONG_BREAK'
  },
  {
    minutes: 20,
    label: '20 phút',
    tag: 'Power Nap / Nghỉ sâu Ultradian',
    recommendedBreak: 20,
    desc: 'Chợp mắt ngắn 20 phút (trước khi vào giấc ngủ sâu gây uể oải) hoặc nghỉ sau phiên 90p Ultradian.',
    category: 'LONG_BREAK'
  },
  {
    minutes: 30,
    label: '30 phút',
    tag: 'Nghỉ trưa / Nạp năng lượng',
    recommendedBreak: 30,
    desc: 'Thư giãn buổi trưa, ăn nhẹ, nghe nhạc Lofi chữa lành cùng thú cưng.',
    category: 'LONG_BREAK'
  },
  {
    minutes: 45,
    label: '45 phút',
    tag: 'Làm việc nhịp nhàng',
    recommendedBreak: 10,
    desc: 'Làm việc thoải mái không phạt chuyển tab, thú cưng tự động nhắc uống nước (45p) & vận động nhẹ.',
    category: 'WORK'
  }
];

const RINGTONE_OPTIONS: Array<{ id: RingtoneId; name: string; desc: string }> = [
  {
    id: 'CHIPTUNE',
    name: 'Chuông Pixel 8-Bit',
    desc: 'Giai điệu game cổ điển vui nhộn đánh thức đại ca'
  },
  {
    id: 'MORNING_CHIME',
    name: 'Chuông Gió Ban Mai',
    desc: 'Âm thanh trong trẻo, dịu dàng không gây giật mình'
  },
  {
    id: 'CLASSIC_ALARM',
    name: 'Đồng Hồ Báo Thức Reng',
    desc: 'Tiếng chuông reng dứt khoát, rõ ràng khi cần dậy ngay'
  },
  {
    id: 'LOFI_BELL',
    name: 'Đàn Kalimba Chữa Lành',
    desc: 'Giai điệu ấm áp báo hiệu hoàn thành phiên tập trung'
  }
];

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
  currentMode,
  onModeChange,
  onSessionFinish,
  onPetStateChange,
  onPauseBgmForAlarm,
  compact = false,
  timerRequest
}) => {
  // Timer Core States
  const [targetMinutes, setTargetMinutes] = useState(25);
  const [customMinutes, setCustomMinutes] = useState('25');
  const [customSeconds, setCustomSeconds] = useState('0');
  const [alarmNote, setAlarmNote] = useState('');
  const [durationError, setDurationError] = useState('');
  const [totalInitialSeconds, setTotalInitialSeconds] = useState(25 * 60);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);

  // Cycle & Mode Context
  const [pomodoroCycle, setPomodoroCycle] = useState(1); // 1 -> 4
  const [selectedRingtone, setSelectedRingtone] = useState<RingtoneId>('CHIPTUNE');
  const [isAlarmRinging, setIsAlarmRinging] = useState(false);
  const [lastCompletedMinutes, setLastCompletedMinutes] = useState(25);
  const [lastEarnedExp, setLastEarnedExp] = useState(0);
  const [ringingClockAlarmTime, setRingingClockAlarmTime] = useState<string | null>(null);

  // Scheduled Clock-Time Alarms (e.g. "15:00" when user says "HEY ANY cài 3h chiều báo tôi")
  const [clockAlarmInput, setClockAlarmInput] = useState('15:00');
  const [clockAlarmLabel, setClockAlarmLabel] = useState('');
  const [currentTimeStr, setCurrentTimeStr] = useState(() =>
    new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
  const [clockAlarms, setClockAlarms] = useState<ScheduledClockAlarm[]>(() => {
    try {
      const saved = localStorage.getItem('officepet_clock_alarms');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('officepet_clock_alarms', JSON.stringify(clockAlarms));
    } catch {
      // Ignore
    }
  }, [clockAlarms]);

  // Module 3: Strict Mode Distraction Monitor
  const [violationsCount, setViolationsCount] = useState(0);
  const [showDistractionWarning, setShowDistractionWarning] = useState(false);
  const [autoDetectTabSwitch, setAutoDetectTabSwitch] = useState(true);

  // Module 4: Relaxed Mode Wellness & Micro-Breaks
  const [workMinutesElapsed, setWorkMinutesElapsed] = useState(0);
  const [showRestPrompt, setShowRestPrompt] = useState(false);
  const [restPostponeCount, setRestPostponeCount] = useState(0);
  const [activeExercise, setActiveExercise] = useState<'EYE_20' | 'BREATH_478' | 'NECK_STRETCH' | null>(null);
  const [exerciseSecondsLeft, setExerciseSecondsLeft] = useState(0);
  const [waterCupsToday, setWaterCupsToday] = useState<number>(() => {
    const saved = localStorage.getItem('officepet_water_cups');
    return saved ? Math.min(12, Math.max(0, parseInt(saved, 10) || 0)) : 2;
  });

  // Module 3: Productivity Stats & Daily Goal from Backend
  const [todayTotalMinutes, setTodayTotalMinutes] = useState(0);
  const [todaySessionCount, setTodaySessionCount] = useState(0);
  const [avgFocusScore, setAvgFocusScore] = useState(100);
  const [targetHours, setTargetHours] = useState(4);
  const [streakDays, setStreakDays] = useState(1);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);

  // Audio refs for Pet Wake-Up Alarm Ringtone
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alarmAutoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  const activePresets = currentMode === 'STRICT' ? STRICT_PRESETS : RELAXED_PRESETS;
  const currentPresetInfo =
    activePresets.find(p => p.minutes === targetMinutes) ||
    STRICT_PRESETS.find(p => p.minutes === targetMinutes) ||
    RELAXED_PRESETS.find(p => p.minutes === targetMinutes);

  const recommendedBreakMins = currentPresetInfo?.recommendedBreak || (targetMinutes >= 50 ? 15 : 5);

  // Fetch real session stats from Backend
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.getSessionStats();
      if (res.data) {
        setTodayTotalMinutes(res.data.todayTotalMinutes ?? 0);
        setTodaySessionCount(res.data.todaySessionCount ?? 0);
        setAvgFocusScore(res.data.avgFocusScore ?? 100);
        setTargetHours(res.data.targetHours ?? 4);
        setStreakDays(res.data.streakDays ?? 1);
        setRecentSessions(res.data.recentSessions ?? []);
        const nextCycle = ((res.data.todaySessionCount ?? 0) % 4) + 1;
        setPomodoroCycle(nextCycle);
      }
    } catch {
      // Fallback if guest/offline
    }
  }, []);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  // Synthesize a single bar of the selected ringtone using Web Audio API
  const ringtoneCtxRef = useRef<AudioContext | null>(null);

  const playRingtonePatternOnce = useCallback((ringtone: RingtoneId) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!ringtoneCtxRef.current || ringtoneCtxRef.current.state === 'closed') {
        try {
          ringtoneCtxRef.current = new AudioCtx();
        } catch {
          return;
        }
      }
      const ctx = ringtoneCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;

      const playNote = (
        freq: number,
        startOffset: number,
        duration: number,
        type: OscillatorType = 'triangle',
        peakGain = 0.22
      ) => {
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = type;
          osc.frequency.setValueAtTime(freq, now + startOffset);
          gain.gain.setValueAtTime(0.001, now + startOffset);
          gain.gain.exponentialRampToValueAtTime(peakGain, now + startOffset + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + startOffset);
          osc.stop(now + startOffset + duration + 0.02);
        } catch {
          // Ignore note error
        }
      };

      if (ringtone === 'CHIPTUNE') {
        // Cheerful 8-bit victory / wake-up fanfare
        const notes = [
          { f: 523.25, t: 0.0, d: 0.14 }, // C5
          { f: 659.25, t: 0.16, d: 0.14 }, // E5
          { f: 783.99, t: 0.32, d: 0.14 }, // G5
          { f: 1046.5, t: 0.48, d: 0.28 }, // C6
          { f: 783.99, t: 0.82, d: 0.14 }, // G5
          { f: 1046.5, t: 0.98, d: 0.45 } // C6
        ];
        notes.forEach(n => playNote(n.f, n.t, n.d, 'square', 0.16));
      } else if (ringtone === 'MORNING_CHIME') {
        // Gentle harmonic wind chimes
        const notes = [
          { f: 587.33, t: 0.0, d: 0.45 }, // D5
          { f: 880.0, t: 0.25, d: 0.45 }, // A5
          { f: 1174.66, t: 0.5, d: 0.55 }, // D6
          { f: 1479.98, t: 0.75, d: 0.7 } // F#6
        ];
        notes.forEach(n => playNote(n.f, n.t, n.d, 'sine', 0.25));
      } else if (ringtone === 'CLASSIC_ALARM') {
        // Rapid twin-bell alarm clock ring
        for (let i = 0; i < 8; i++) {
          playNote(i % 2 === 0 ? 880 : 1174.66, i * 0.12, 0.1, 'sawtooth', 0.18);
        }
      } else {
        // LOFI_BELL - Cozy Kalimba arpeggio
        const notes = [
          { f: 440.0, t: 0.0, d: 0.3 }, // A4
          { f: 523.25, t: 0.22, d: 0.3 }, // C5
          { f: 659.25, t: 0.44, d: 0.3 }, // E5
          { f: 783.99, t: 0.66, d: 0.45 }, // G5
          { f: 659.25, t: 1.0, d: 0.4 } // E5
        ];
        notes.forEach(n => playNote(n.f, n.t, n.d, 'triangle', 0.24));
      }
    } catch {
      // Ignore audio context restriction errors
    }
  }, []);

  // Speak Vietnamese wake-up message from Pet
  const speakPetWakeUp = useCallback((text: string) => {
    try {
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current = null;
      }
      const audio = new Audio(`/api/pet/tts?text=${encodeURIComponent(text)}`);
      audio.volume = 1.0;
      ttsAudioRef.current = audio;
      audio.play().catch(() => {});
    } catch {
      // Ignore
    }
  }, []);

  // Stop the looping wake-up alarm ringtone
  const stopAlarmRingtone = useCallback(() => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    if (alarmAutoStopRef.current) {
      clearTimeout(alarmAutoStopRef.current);
      alarmAutoStopRef.current = null;
    }
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }
    setIsAlarmRinging(false);
    setRingingClockAlarmTime(null);
    onPetStateChange?.('IDLE');
  }, [onPetStateChange]);

  // Start the looping wake-up alarm ringtone + Pet TTS voice
  const startAlarmRingtone = useCallback(
    (completedMins: number, noteText: string, clockTimeTriggered?: string) => {
      stopAlarmRingtone();
      onPauseBgmForAlarm?.();
      setIsAlarmRinging(true);
      if (clockTimeTriggered) {
        setRingingClockAlarmTime(clockTimeTriggered);
      }

      // Play ringtone immediately and repeat every 2.2 seconds
      playRingtonePatternOnce(selectedRingtone);
      alarmIntervalRef.current = setInterval(() => {
        playRingtonePatternOnce(selectedRingtone);
      }, 2200);

      // Have Pet announce wake-up in Vietnamese after 800ms
      setTimeout(() => {
        let spokenMsg = '';
        if (clockTimeTriggered) {
          const [hh, mm] = clockTimeTriggered.split(':');
          spokenMsg = noteText.trim()
            ? `Đại ca ơi! Đã đến ${parseInt(hh, 10)} giờ ${parseInt(mm, 10) > 0 ? `${parseInt(mm, 10)} phút ` : ''}rồi! Nhớ ${noteText.trim()} nha đại ca!`
            : `Đại ca ơi! Đã đến giờ hẹn báo thức ${parseInt(hh, 10)} giờ ${parseInt(mm, 10) > 0 ? `${parseInt(mm, 10)} phút ` : ''}rồi, đại ca ơi!`;
        } else {
          spokenMsg = noteText.trim()
            ? `Đại ca ơi! Đã hết thời gian ${completedMins} phút hẹn giờ rồi! Nhớ ${noteText.trim()} nha đại ca!`
            : `Đại ca ơi! Đã hết thời gian ${completedMins} phút hẹn giờ rồi, dậy thư giãn cùng em thôi nào!`;
        }
        speakPetWakeUp(spokenMsg);
      }, 800);

      // Send Desktop Browser Notification if granted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(
          clockTimeTriggered ? `⏰ Báo Thức Thú Cưng — Đã đến ${clockTimeTriggered}!` : '⏰ Bé Cưng Báo Thức — Đã hết giờ!',
          {
            body: clockTimeTriggered
              ? noteText.trim() || `Đã đến mốc giờ hẹn báo thức ${clockTimeTriggered}!`
              : noteText.trim()
              ? `Hoàn thành ${completedMins} phút: "${noteText.trim()}"`
              : `Đã hoàn thành ${completedMins} phút đếm ngược! Hãy nghỉ giải lao ${recommendedBreakMins} phút nhé.`
          }
        );
      }

      // Auto-stop after 45 seconds if user is away from desk
      alarmAutoStopRef.current = setTimeout(() => {
        stopAlarmRingtone();
      }, 45000);
    },
    [onPauseBgmForAlarm, playRingtonePatternOnce, recommendedBreakMins, selectedRingtone, speakPetWakeUp, stopAlarmRingtone]
  );

  // Add or enable a Clock Alarm (e.g. "15:00")
  const addOrEnableClockAlarm = useCallback((time24: string, labelText?: string) => {
    const cleanTime = time24.trim();
    if (!/^\d{2}:\d{2}$/.test(cleanTime)) return;
    const defaultLabel = labelText?.trim() || `Báo thức lúc ${cleanTime}`;
    setClockAlarmInput(cleanTime);
    setClockAlarms(prev => {
      const existing = prev.find(a => a.time === cleanTime);
      if (existing) {
        return prev.map(a =>
          a.time === cleanTime ? { ...a, enabled: true, label: labelText?.trim() || a.label, lastTriggeredDate: undefined } : a
        );
      }
      return [
        {
          id: `${cleanTime}-${Date.now()}`,
          time: cleanTime,
          label: defaultLabel,
          enabled: true
        },
        ...prev
      ];
    });
  }, []);

  // Real-time 1-second Clock Checker for Scheduled Clock Alarms (e.g. 15:00 / 3h chiều)
  useEffect(() => {
    const clockInterval = setInterval(() => {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const currentHHMM = `${hh}:${mm}`;
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${currentHHMM}`;

      setClockAlarms(prev => {
        let triggeredAlarm: ScheduledClockAlarm | null = null;
        const nextList = prev.map(alarm => {
          if (alarm.enabled && alarm.time === currentHHMM && alarm.lastTriggeredDate !== todayKey) {
            triggeredAlarm = alarm;
            return { ...alarm, lastTriggeredDate: todayKey };
          }
          return alarm;
        });

        if (triggeredAlarm) {
          const found = triggeredAlarm as ScheduledClockAlarm;
          setTimeout(() => {
            setAlarmNote(found.label);
            startAlarmRingtone(0, found.label, found.time);
          }, 50);
        }

        return triggeredAlarm ? nextList : prev;
      });
    }, 1000);

    return () => clearInterval(clockInterval);
  }, [startAlarmRingtone]);

  useEffect(() => {
    return () => {
      if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
      if (alarmAutoStopRef.current) clearTimeout(alarmAutoStopRef.current);
    };
  }, []);

  // Handle voice or AI timer requests (e.g., "HEY ANY cài 3h chiều báo tôi", "hẹn giờ 5 phút", "tắt chuông")
  useEffect(() => {
    if (!timerRequest) return;
    if (timerRequest.action === 'STOP_ALARM') {
      stopAlarmRingtone();
      return;
    }
    if (timerRequest.action === 'SET_CLOCK_ALARM' && timerRequest.alarmTime) {
      addOrEnableClockAlarm(timerRequest.alarmTime, timerRequest.alarmLabel);
      return;
    }
    if (timerRequest.action === 'PAUSE') {
      setIsRunning(false);
      return;
    }
    if (timerRequest.action === 'RESET') {
      stopAlarmRingtone();
      setIsRunning(false);
      setSecondsLeft(targetMinutes * 60);
      setTotalInitialSeconds(targetMinutes * 60);
      setViolationsCount(0);
      setShowDistractionWarning(false);
      return;
    }
    stopAlarmRingtone();
    const mins = Math.max(1, Math.min(180, Math.round(timerRequest.minutes || 25)));
    setDurationError('');
    setTargetMinutes(mins);
    setCustomMinutes(String(mins));
    setCustomSeconds('0');
    setTotalInitialSeconds(mins * 60);
    setSecondsLeft(mins * 60);
    setViolationsCount(0);
    setShowDistractionWarning(false);
    setIsRunning(timerRequest.autoStart);
    if (timerRequest.autoStart) {
      api.setPetState(currentMode === 'STRICT' ? 'TYPING' : 'IDLE').catch(() => {});
    }
  }, [timerRequest?.requestId]);

  useEffect(() => {
    if (isAlarmRinging) {
      onPetStateChange?.('CELEBRATING');
      return;
    }
    const state: AnimationState = isRunning && currentMode === 'STRICT' ? 'TYPING' : 'IDLE';
    onPetStateChange?.(state);
  }, [isRunning, currentMode, isAlarmRinging]);

  // Real-time Tab Switch / Window Blur Monitor in STRICT mode (Module 3)
  useEffect(() => {
    if (!isRunning || currentMode !== 'STRICT' || !autoDetectTabSwitch) return;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setViolationsCount(prev => prev + 1);
        setShowDistractionWarning(true);
        api.setPetState('SAD').catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRunning, currentMode, autoDetectTabSwitch]);

  // Main Countdown Effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isRunning && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft(prev => {
          const next = prev - 1;
          if (currentMode === 'RELAXED' && next > 0 && next % 60 === 0) {
            setWorkMinutesElapsed(w => w + 1);
          }
          return next;
        });
      }, 1000);
    } else if (secondsLeft === 0 && isRunning) {
      void handleCompleteSession();
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, secondsLeft, currentMode]);

  // Micro-exercise countdown effect (20-20-20 Eye Rule / 4-7-8 Breathing)
  useEffect(() => {
    if (!activeExercise || exerciseSecondsLeft <= 0) return;
    const timer = setInterval(() => {
      setExerciseSecondsLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [activeExercise, exerciseSecondsLeft]);

  // Check 90 min Ultradian fatigue threshold in Relaxed Mode (Module 4)
  useEffect(() => {
    if (currentMode === 'RELAXED' && workMinutesElapsed >= 90 && !showRestPrompt) {
      setShowRestPrompt(true);
    }
  }, [workMinutesElapsed, currentMode, showRestPrompt]);

  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  };

  const handleStartPause = () => {
    if (isAlarmRinging) {
      stopAlarmRingtone();
      return;
    }
    requestNotificationPermission();
    const nextRun = !isRunning;
    setIsRunning(nextRun);
    if (nextRun) {
      api.setPetState(currentMode === 'STRICT' ? 'TYPING' : 'IDLE').catch(() => {});
    }
  };

  const handleReset = () => {
    stopAlarmRingtone();
    setIsRunning(false);
    setSecondsLeft(totalInitialSeconds);
    setViolationsCount(0);
    setShowDistractionWarning(false);
  };

  const selectPresetMinutes = (mins: number) => {
    stopAlarmRingtone();
    setDurationError('');
    setTargetMinutes(mins);
    setCustomMinutes(String(mins));
    setCustomSeconds('0');
    setTotalInitialSeconds(mins * 60);
    setSecondsLeft(mins * 60);
    setIsRunning(false);
  };

  const applyCustomDuration = () => {
    stopAlarmRingtone();
    const mins = Number(customMinutes || 0);
    const secs = Number(customSeconds || 0);
    if (!Number.isInteger(mins) || !Number.isInteger(secs) || mins < 0 || mins > 180 || secs < 0 || secs > 59) {
      setDurationError('Thời gian cài đặt phải từ 0–180 phút và 0–59 giây.');
      return;
    }
    const totalSec = mins * 60 + secs;
    if (totalSec < 5) {
      setDurationError('Vui lòng cài thời gian tối thiểu là 5 giây.');
      return;
    }
    setDurationError('');
    const effectiveMins = Math.max(1, Math.round(totalSec / 60));
    setTargetMinutes(effectiveMins);
    setTotalInitialSeconds(totalSec);
    setSecondsLeft(totalSec);
    setIsRunning(false);
  };

  // Quick 5-second test button so user can immediately experience Pet's wake-up alarm
  const startFiveSecondDemo = () => {
    stopAlarmRingtone();
    requestNotificationPermission();
    setDurationError('');
    setTargetMinutes(1);
    setCustomMinutes('0');
    setCustomSeconds('5');
    setTotalInitialSeconds(5);
    setSecondsLeft(5);
    setIsRunning(true);
  };

  const handleCompleteSession = async () => {
    setIsRunning(false);
    const effectiveMins = Math.max(1, Math.round(totalInitialSeconds / 60));
    setLastCompletedMinutes(effectiveMins);

    // 1. Trigger Pet Wake-Up Alarm Ringtone + Voice Notification immediately!
    startAlarmRingtone(effectiveMins, alarmNote);

    // 2. Record session on backend and award EXP
    try {
      const res = await api.finishSession({
        durationMinutes: effectiveMins,
        mode: currentMode,
        violationsCount
      });
      const awarded = res.data?.expAward || effectiveMins * 2;
      setLastEarnedExp(awarded);
      onSessionFinish(awarded);
      api.setPetState('CELEBRATING').catch(() => {});
      void fetchStats();
    } catch {
      const fallbackExp = effectiveMins * 2;
      setLastEarnedExp(fallbackExp);
      onSessionFinish(fallbackExp);
    }
  };

  // Start recommended scientific break immediately after finishing a work session
  const handleStartRecommendedBreak = (breakMins: number) => {
    stopAlarmRingtone();
    onModeChange('RELAXED');
    setTargetMinutes(breakMins);
    setCustomMinutes(String(breakMins));
    setCustomSeconds('0');
    setTotalInitialSeconds(breakMins * 60);
    setSecondsLeft(breakMins * 60);
    setAlarmNote(`Nghỉ giải lao khoa học ${breakMins} phút`);
    setIsRunning(true);
  };

  // Snooze +5 minutes when alarm rings
  const handleSnoozeFiveMinutes = () => {
    stopAlarmRingtone();
    setTargetMinutes(5);
    setCustomMinutes('5');
    setCustomSeconds('0');
    setTotalInitialSeconds(5 * 60);
    setSecondsLeft(5 * 60);
    setAlarmNote('Báo thức lặp lại sau 5 phút');
    setIsRunning(true);
  };

  // Simulate Distraction (Strict Mode US-U04)
  const triggerSimulatedDistraction = () => {
    if (currentMode !== 'STRICT' || !isRunning) return;
    setViolationsCount(prev => prev + 1);
    setShowDistractionWarning(true);
    api.setPetState('SAD').catch(() => {});
  };

  const handleAddWaterCup = () => {
    const next = Math.min(12, waterCupsToday + 1);
    setWaterCupsToday(next);
    localStorage.setItem('officepet_water_cups', String(next));
    api.setPetState('DRINKING').catch(() => {});
    onPetStateChange?.('DRINKING');
  };

  const handleUpdateDailyGoal = async (hours: number) => {
    setTargetHours(hours);
    try {
      await api.setDailyGoal(hours);
    } catch {
      // Ignore
    }
  };

  const formatMinutes = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    return mins.toString().padStart(2, '0');
  };

  const formatSeconds = (totalSec: number) => {
    const secs = totalSec % 60;
    return secs.toString().padStart(2, '0');
  };

  const formatTotalHoursMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m} phút`;
  };

  const getRemainingTimeUntilClockAlarm = (time24: string) => {
    const [hh, mm] = time24.split(':').map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return '';
    const now = new Date();
    const target = new Date();
    target.setHours(hh, mm, 0, 0);
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    const diffMins = Math.max(1, Math.ceil((target.getTime() - now.getTime()) / 60000));
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    return h > 0 ? `Còn ${h}h ${m}p` : `Còn ${m} phút`;
  };

  const setQuickPlusOneMinuteAlarm = () => {
    requestNotificationPermission();
    const nextMin = new Date(Date.now() + 60000);
    const hh = String(nextMin.getHours()).padStart(2, '0');
    const mm = String(nextMin.getMinutes()).padStart(2, '0');
    const timeStr = `${hh}:${mm}`;
    addOrEnableClockAlarm(timeStr, `Báo thức test nhanh lúc ${timeStr}`);
  };

  const progressPercent =
    totalInitialSeconds > 0
      ? Math.max(0, Math.min(100, ((totalInitialSeconds - secondsLeft) / totalInitialSeconds) * 100))
      : 0;

  const currentFocusScore = Math.max(0, 100 - violationsCount * 10);
  const goalProgressPercent = Math.min(100, Math.round((todayTotalMinutes / (targetHours * 60)) * 100));

  return (
    <div className={`mx-auto space-y-6 text-slate-800 ${compact ? 'max-w-md' : 'max-w-6xl'}`}>
      {/* ========================================================================= */}
      {/* WAKE-UP ALARM MODAL (Appears on any screen when countdown hits 00:00)     */}
      {/* ========================================================================= */}
      {isAlarmRinging && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#fffdfa] border-4 border-slate-900 rounded-2xl shadow-[6px_6px_0px_#0f172a] overflow-hidden animate-bounce-short">
            <div className="bg-amber-400 border-b-3 border-slate-900 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-slate-950 text-amber-300 flex items-center justify-center animate-pulse">
                  <BellRing size={22} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-900 bg-white/80 px-2 py-0.5 rounded-full border border-slate-900">
                    BÁO THỨC THÚ CƯNG
                  </span>
                  <h3 className="text-base font-black text-slate-950 mt-0.5">
                    {ringingClockAlarmTime
                      ? `Đã đến giờ hẹn ${ringingClockAlarmTime}!`
                      : `Đã hết thời gian ${lastCompletedMinutes} phút!`}
                  </h3>
                </div>
              </div>
              <span className="text-xs font-black text-slate-950 bg-emerald-300 px-2.5 py-1 rounded-lg border-2 border-slate-900">
                +{lastEarnedExp || lastCompletedMinutes * 2} EXP
              </span>
            </div>

            <div className="p-5 space-y-4 text-center">
              <div className="p-3.5 rounded-xl bg-[#f7f2e7] border-2 border-slate-900">
                <p className="text-sm font-black text-slate-900">
                  {alarmNote.trim()
                    ? `📌 Lời nhắc: "${alarmNote.trim()}"`
                    : currentMode === 'STRICT'
                    ? `🎉 Hoàn thành xuất sắc phiên tập trung ${lastCompletedMinutes} phút!`
                    : `🌿 Đã kết thúc ${lastCompletedMinutes} phút hẹn giờ thư giãn!`}
                </p>
                <p className="text-xs text-slate-600 mt-1 font-medium">
                  Bé cưng đang mở nhạc chuông <strong>{RINGTONE_OPTIONS.find(r => r.id === selectedRingtone)?.name}</strong> để đánh thức đại ca!
                </p>
              </div>

              {/* Scientific Recommendation Next Step */}
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-left text-xs text-emerald-950">
                <div className="font-black flex items-center gap-1.5 text-emerald-800 mb-0.5">
                  <Sparkles size={14} /> Khuyến nghị khoa học tiếp theo:
                </div>
                {currentMode === 'STRICT' ? (
                  <p>
                    Sau <strong>{lastCompletedMinutes} phút</strong> tập trung, não bộ cần nghỉ giải lao{' '}
                    <strong>{pomodoroCycle === 4 ? '15–20 phút (Nghỉ dài sau 4 phiên)' : `${recommendedBreakMins} phút`}</strong>{' '}
                    để hồi phục sự chú ý và bảo vệ mắt.
                  </p>
                ) : (
                  <p>
                    Năng lượng đã được nạp đầy! Bạn có thể bắt đầu chu kỳ tập trung <strong>25 phút (Pomodoro)</strong> hoặc{' '}
                    <strong>52 phút (DeskTime)</strong> tiếp theo.
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={stopAlarmRingtone}
                  className="flex-1 py-3 px-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-xs border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none transition"
                >
                  🔕 Tắt chuông báo thức
                </button>
                {currentMode === 'STRICT' ? (
                  <button
                    type="button"
                    onClick={() => handleStartRecommendedBreak(pomodoroCycle === 4 ? 15 : recommendedBreakMins)}
                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none transition"
                  >
                    ☕ Nghỉ giải lao {pomodoroCycle === 4 ? 15 : recommendedBreakMins} phút
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      stopAlarmRingtone();
                      onModeChange('STRICT');
                      selectPresetMinutes(25);
                    }}
                    className="flex-1 py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none transition"
                  >
                    🔥 Vào phiên Tập trung 25p
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleSnoozeFiveMinutes}
                className="w-full py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 transition"
              >
                ⏰ Báo lại sau 5 phút (+5p Snooze)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TOP HEADER BANNER: POMODORO CYCLE & EXP REWARD                            */}
      {/* ========================================================================= */}
      {!compact && (
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-slate-900 bg-[#fffdfa] shadow-[3px_3px_0px_#0f172a] p-5">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-400 border-2 border-slate-900 flex items-center justify-center text-slate-950 shadow-[2px_2px_0px_#0f172a] shrink-0">
              <Timer size={24} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Trung Tâm Nhịp Độ Pomodoro & Chăm Sóc Sức Khỏe
                </h2>
                <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  CHU KỲ #{pomodoroCycle}/4 • HÔM NAY: {todaySessionCount} PHIÊN
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed font-medium">
                Kết hợp kỷ luật tập trung khoa học (25/5 • 52/17 • 90/20) cùng nhạc chuông báo thức thú cưng & bảo vệ sức khỏe công sở
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* 4-Step Pomodoro Cycle Indicator */}
            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-300">
              <span className="text-[11px] font-bold text-slate-600 mr-1">Chu kỳ:</span>
              {[1, 2, 3, 4].map(step => (
                <span
                  key={step}
                  title={`Phiên Pomodoro ${step}/4`}
                  className={`w-6 h-6 rounded-lg text-[11px] font-black flex items-center justify-center border border-slate-900 transition ${
                    step < pomodoroCycle
                      ? 'bg-emerald-400 text-slate-950'
                      : step === pomodoroCycle
                      ? 'bg-amber-400 text-slate-950 shadow-[1px_1px_0_#000]'
                      : 'bg-white text-slate-400'
                  }`}
                >
                  {step}
                </span>
              ))}
            </div>

            <div className="rounded-xl border-2 border-slate-900 bg-amber-50 px-3.5 py-2 text-xs font-bold text-slate-800 flex items-center gap-1.5 shadow-[2px_2px_0_#0f172a]">
              <Sparkles size={14} className="text-amber-600" />
              <span>
                Thưởng hoàn thành: <strong className="text-amber-700 font-black">+{targetMinutes * 2} EXP</strong>
              </span>
            </div>
          </div>
        </header>
      )}

      {/* ========================================================================= */}
      {/* MAIN 2-COLUMN WORKSPACE: LEFT (TIMER & ALARM) + RIGHT (SCIENCE & WELLNESS) */}
      {/* ========================================================================= */}
      <div className={`grid grid-cols-1 ${compact ? '' : 'lg:grid-cols-12'} gap-6 items-start`}>
        {/* ================= LEFT COLUMN (7 COLS): MAIN TIMER & ALARM SETTER ================= */}
        <div className={`${compact ? '' : 'lg:col-span-7'} space-y-6`}>
          <div className="bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] p-5 sm:p-7">
            {/* Mode Switch Tabs (Nghiêm túc vs Thư giãn & Giải lao) */}
            <div className="flex bg-slate-100 p-1.5 rounded-xl gap-1.5 mb-5 border border-slate-200">
              <button
                type="button"
                disabled={isRunning}
                onClick={() => {
                  onModeChange('STRICT');
                  selectPresetMinutes(25);
                }}
                className={`flex-1 py-2.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition ${
                  currentMode === 'STRICT'
                    ? 'bg-amber-400 text-slate-950 font-black border-2 border-slate-900 shadow-[0_2px_0_#0f172a]'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Flame size={15} className={currentMode === 'STRICT' ? 'text-slate-950' : 'text-slate-400'} />
                <span>Chế độ Nghiêm túc (Tập trung)</span>
              </button>
              <button
                type="button"
                disabled={isRunning}
                onClick={() => {
                  onModeChange('RELAXED');
                  selectPresetMinutes(5);
                }}
                className={`flex-1 py-2.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition ${
                  currentMode === 'RELAXED'
                    ? 'bg-emerald-400 text-slate-950 font-black border-2 border-slate-900 shadow-[0_2px_0_#0f172a]'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Coffee size={15} className={currentMode === 'RELAXED' ? 'text-slate-950' : 'text-slate-400'} />
                <span>Chế độ Thư giãn & Giải lao</span>
              </button>
            </div>

            {/* Center Timer Stage */}
            <div
              className={`rounded-2xl border-2 border-slate-900 p-6 sm:p-7 text-center shadow-inner relative transition-colors ${
                currentMode === 'STRICT' ? 'bg-[#f7f2e7]' : 'bg-[#eef8f3]'
              }`}
            >
              {/* Mode & Method Pill */}
              <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-black shadow-xs ${
                    currentMode === 'STRICT'
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isRunning ? 'bg-red-500 animate-ping' : currentMode === 'STRICT' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                  />
                  <span>
                    {currentPresetInfo ? currentPresetInfo.tag.toUpperCase() : `HẸN GIỜ TÙY CHỈNH (${targetMinutes} PHÚT)`}
                  </span>
                </div>

                {currentMode === 'STRICT' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-slate-300 text-[11px] font-bold text-slate-700">
                    <ShieldCheck size={12} className="text-emerald-600" />
                    Điểm tập trung: <strong className="text-slate-950">{currentFocusScore}%</strong>
                  </span>
                )}
              </div>

              {/* Giant Countdown Clock */}
              <div className="text-6xl sm:text-7xl font-black text-[#231e36] tracking-widest my-2 font-mono flex items-center justify-center gap-3 select-none">
                <span>{formatMinutes(secondsLeft)}</span>
                <span className={`${currentMode === 'STRICT' ? 'text-amber-500' : 'text-emerald-500'} animate-pulse`}>:</span>
                <span>{formatSeconds(secondsLeft)}</span>
              </div>

              {/* Scientific Subtitle & Recommended Break Info */}
              <p className="text-xs text-slate-600 font-semibold max-w-lg mx-auto leading-relaxed mt-1">
                {currentPresetInfo
                  ? currentPresetInfo.desc
                  : `Đếm ngược ${targetMinutes} phút — Hết giờ thú cưng sẽ mở nhạc chuông "${
                      RINGTONE_OPTIONS.find(r => r.id === selectedRingtone)?.name
                    }" đánh thức bạn!`}
              </p>

              {/* Progress Line */}
              <div className="w-full max-w-md mx-auto bg-slate-200/80 h-2.5 rounded-full overflow-hidden my-4 border border-slate-300">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    currentMode === 'STRICT'
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                      : 'bg-gradient-to-r from-emerald-400 to-teal-500'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Mode-Specific Scientific Preset Duration Buttons */}
              <div className="mb-4">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
                  {currentMode === 'STRICT'
                    ? 'Chọn khung thời gian Tập trung Nghiêm túc (Chuẩn khoa học):'
                    : 'Chọn khung thời gian Nghỉ giải lao & Thư giãn (Chuẩn khoa học):'}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-lg mx-auto">
                  {activePresets.map(preset => {
                    const isSelected = targetMinutes === preset.minutes && totalInitialSeconds === preset.minutes * 60;
                    return (
                      <button
                        key={preset.minutes}
                        type="button"
                        disabled={isRunning}
                        onClick={() => selectPresetMinutes(preset.minutes)}
                        className={`px-3 py-2 rounded-xl text-left transition border-2 border-slate-900 ${
                          isSelected
                            ? currentMode === 'STRICT'
                              ? 'bg-amber-400 text-slate-950 font-black shadow-[0_2px_0_#0f172a]'
                              : 'bg-emerald-400 text-slate-950 font-black shadow-[0_2px_0_#0f172a]'
                            : 'bg-white hover:bg-amber-50/70 text-slate-800 font-bold shadow-[0_2px_0_#0f172a] disabled:opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black">{preset.label}</span>
                          {currentMode === 'STRICT' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900/10 font-bold">
                              Nghỉ {preset.recommendedBreak}p
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] truncate opacity-85 mt-0.5">{preset.tag}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ===================================================================== */}
              {/* CUSTOM TIMER / ALARM SETTER & RINGTONE SELECTOR                       */}
              {/* ===================================================================== */}
              <div className="bg-white/90 border-2 border-slate-900 rounded-xl p-3.5 max-w-lg mx-auto text-left space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Bell size={14} className="text-amber-500" />
                    Cài giờ Hẹn báo thức & Nhạc chuông đánh thức
                  </span>
                  <button
                    type="button"
                    onClick={startFiveSecondDemo}
                    title="Chạy thử đếm ngược 5 giây để kiểm tra nhạc chuông và giọng Pet đánh thức"
                    className="px-2 py-0.5 rounded bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 text-[10px] font-black transition flex items-center gap-1"
                  >
                    <Zap size={11} /> Test nhanh 5 giây
                  </button>
                </div>

                {/* Quick Minute Chips (1p, 3p, 5p, 10p, 15p, 20p, 30p) */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 mr-1">Cài nhanh:</span>
                  {[1, 3, 5, 10, 15, 20, 30].map(m => (
                    <button
                      key={m}
                      type="button"
                      disabled={isRunning}
                      onClick={() => selectPresetMinutes(m)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-black border transition ${
                        targetMinutes === m && totalInitialSeconds === m * 60
                          ? 'bg-slate-900 text-amber-300 border-slate-900'
                          : 'bg-slate-100 hover:bg-amber-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      {m}p
                    </button>
                  ))}
                </div>

                {/* Custom Minutes + Seconds + Apply */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-slate-700">Tùy chỉnh:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={180}
                      value={customMinutes}
                      disabled={isRunning}
                      onChange={e => setCustomMinutes(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') applyCustomDuration();
                      }}
                      className="w-14 px-2 py-1 text-xs text-center font-black border-2 border-slate-900 rounded-lg bg-white"
                    />
                    <span className="font-bold text-slate-600">phút</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={customSeconds}
                      disabled={isRunning}
                      onChange={e => setCustomSeconds(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') applyCustomDuration();
                      }}
                      className="w-14 px-2 py-1 text-xs text-center font-black border-2 border-slate-900 rounded-lg bg-white"
                    />
                    <span className="font-bold text-slate-600">giây</span>
                  </div>
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={applyCustomDuration}
                    className="px-3 py-1 text-xs font-black bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[1px] active:shadow-none transition"
                  >
                    Đặt giờ
                  </button>
                </div>

                {/* Optional Reminder Note */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={alarmNote}
                    onChange={e => setAlarmNote(e.target.value)}
                    placeholder="Nhập lời nhắc khi hết giờ (VD: Nghỉ giải lao 5p, Họp nhóm, Nộp bài...)"
                    className="w-full px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-hidden focus:border-slate-900"
                  />
                </div>

                {/* Ringtone Selector + Preview Button */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200">
                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <span className="text-[11px] font-bold text-slate-600 shrink-0">Nhạc chuông Pet:</span>
                    <select
                      value={selectedRingtone}
                      onChange={e => setSelectedRingtone(e.target.value as RingtoneId)}
                      className="flex-1 px-2 py-1 text-xs font-bold border border-slate-300 rounded-lg bg-white text-slate-800"
                    >
                      {RINGTONE_OPTIONS.map(r => (
                        <option key={r.id} value={r.id}>
                          🔔 {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => playRingtonePatternOnce(selectedRingtone)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold text-[11px] flex items-center gap-1 transition"
                  >
                    <Volume2 size={12} /> Nghe thử chuông
                  </button>
                </div>

                {/* ===================================================================== */}
                {/* CLOCK-TIME ALARM SECTION (e.g., "15:00" / "3h chiều báo tôi")         */}
                {/* ===================================================================== */}
                <div className="pt-3 border-t-2 border-dashed border-slate-300 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Clock size={14} className="text-indigo-600" />
                      Nhắc hẹn & Báo thức theo Mốc Giờ (VD: 15:00 / 3h chiều)
                    </span>
                    <span className="text-[11px] font-mono font-black px-2 py-0.5 rounded bg-slate-900 text-emerald-300">
                      Bây giờ: {currentTimeStr}
                    </span>
                  </div>

                  {/* Quick Clock-Time Presets */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-500 mr-0.5">Chọn nhanh:</span>
                    {[
                      { time: '08:00', label: '8h Sáng' },
                      { time: '11:30', label: '11h30 Trưa' },
                      { time: '13:30', label: '1h30 Chiều' },
                      { time: '15:00', label: '15:00 (3h Chiều)' },
                      { time: '17:00', label: '17:00 (5h Chiều)' }
                    ].map(preset => (
                      <button
                        key={preset.time}
                        type="button"
                        onClick={() => {
                          requestNotificationPermission();
                          addOrEnableClockAlarm(preset.time, `Báo thức ${preset.label}`);
                        }}
                        className={`px-2 py-1 rounded-lg text-[11px] font-black border transition ${
                          clockAlarms.some(a => a.time === preset.time && a.enabled)
                            ? 'bg-indigo-600 text-white border-slate-900'
                            : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={setQuickPlusOneMinuteAlarm}
                      title="Đặt báo thức vào phút kế tiếp để kiểm tra ngay"
                      className="px-2 py-1 rounded-lg text-[10px] font-black bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 transition"
                    >
                      +1 phút nữa
                    </button>
                  </div>

                  {/* Custom 24h Time Picker + Label + Add Button */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <input
                      type="time"
                      value={clockAlarmInput}
                      onChange={e => setClockAlarmInput(e.target.value)}
                      className="px-2.5 py-1 text-xs font-black border-2 border-slate-900 rounded-lg bg-white text-slate-900"
                    />
                    <input
                      type="text"
                      value={clockAlarmLabel}
                      onChange={e => setClockAlarmLabel(e.target.value)}
                      placeholder="Lời nhắc (VD: 3h chiều báo tôi họp...)"
                      className="flex-1 min-w-[140px] px-2.5 py-1 text-xs font-medium border border-slate-300 rounded-lg bg-slate-50 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        requestNotificationPermission();
                        addOrEnableClockAlarm(clockAlarmInput, clockAlarmLabel || `Báo thức lúc ${clockAlarmInput}`);
                        setClockAlarmLabel('');
                      }}
                      className="px-3 py-1 text-xs font-black bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[1px] active:shadow-none transition"
                    >
                      + Đặt báo thức {clockAlarmInput}
                    </button>
                  </div>

                  {/* Active Clock Alarms List */}
                  {clockAlarms.length > 0 ? (
                    <div className="space-y-1.5 pt-1">
                      {clockAlarms.map(alarm => (
                        <div
                          key={alarm.id}
                          className={`px-3 py-2 rounded-lg border flex items-center justify-between text-xs transition ${
                            alarm.enabled
                              ? 'bg-indigo-50/90 border-indigo-300 text-slate-900'
                              : 'bg-slate-100 border-slate-200 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                alarm.enabled ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'
                              }`}
                            />
                            <span className="font-mono font-black text-sm text-indigo-950">{alarm.time}</span>
                            <span className="font-bold truncate max-w-[160px]">{alarm.label}</span>
                            {alarm.enabled && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-indigo-200 text-indigo-700">
                                {getRemainingTimeUntilClockAlarm(alarm.time)}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setClockAlarms(prev =>
                                  prev.map(a => (a.id === alarm.id ? { ...a, enabled: !a.enabled } : a))
                                )
                              }
                              className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                                alarm.enabled
                                  ? 'bg-emerald-400 text-slate-950 border-slate-900'
                                  : 'bg-slate-200 text-slate-600 border-slate-300'
                              }`}
                            >
                              {alarm.enabled ? 'Đang bật' : 'Đã tắt'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setClockAlarms(prev => prev.filter(a => a.id !== alarm.id))}
                              title="Xóa báo thức này"
                              className="px-1.5 py-0.5 rounded text-slate-400 hover:text-rose-600 font-black"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic">
                      💡 Mẹo: Bạn có thể chọn giờ ở trên hoặc gọi <strong>"HEY ANY, cài 3h chiều báo tôi"</strong> để tự động đặt báo thức <strong>15:00</strong>!
                    </p>
                  )}
                </div>

                {durationError && (
                  <p role="alert" className="text-[11px] text-red-600 font-bold">
                    {durationError}
                  </p>
                )}
              </div>

              {/* Action Control Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
                <button
                  type="button"
                  onClick={handleStartPause}
                  className={`px-8 py-3 rounded-xl border-2 border-slate-900 shadow-[0_3px_0_#0f172a] active:translate-y-[2px] active:shadow-none font-black text-sm transition flex items-center gap-2 ${
                    isRunning
                      ? 'bg-rose-400 hover:bg-rose-300 text-slate-950'
                      : currentMode === 'STRICT'
                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                      : 'bg-emerald-400 hover:bg-emerald-300 text-slate-950'
                  }`}
                >
                  {isRunning ? (
                    <>
                      <Pause size={16} /> Tạm dừng
                    </>
                  ) : (
                    <>
                      <Play size={16} /> Bắt đầu đếm ngược
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-6 py-3 rounded-xl bg-white hover:bg-amber-50 text-slate-800 font-black text-sm border-2 border-slate-900 shadow-[0_3px_0_#0f172a] active:translate-y-[2px] active:shadow-none transition flex items-center gap-1.5"
                >
                  <RotateCcw size={15} /> Đặt lại
                </button>
              </div>

              {/* Strict Mode Distraction Monitor Controls (Module 3) */}
              {currentMode === 'STRICT' && (
                <div className="mt-4 pt-3 border-t border-slate-300/70 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoDetectTabSwitch}
                      onChange={e => setAutoDetectTabSwitch(e.target.checked)}
                      className="rounded border-slate-400 text-amber-500 focus:ring-amber-400"
                    />
                    <span>Tự động phát hiện rời tab làm việc (Giám sát cửa sổ)</span>
                  </label>

                  {isRunning && (
                    <button
                      type="button"
                      onClick={triggerSimulatedDistraction}
                      className="text-amber-700 hover:underline flex items-center gap-1 font-bold"
                    >
                      <AlertTriangle size={12} /> Mô phỏng mở tab giải trí ({violationsCount} lỗi)
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Distraction Alert Bubble */}
            {showDistractionWarning && (
              <div className="mt-4 p-4 bg-red-50 border-2 border-red-400 rounded-xl text-xs text-red-800 shadow-xs">
                <div className="font-black flex items-center gap-1.5 mb-1 text-red-900">
                  <AlertTriangle size={15} /> Bé cưng nhắc nhở: Phát hiện rời màn hình làm việc!
                </div>
                <p>
                  Bạn vừa chuyển sang cửa sổ/tab khác trong Chế độ Nghiêm túc! Thú cưng đang buồn bã và Điểm Tập Trung hiện tại còn{' '}
                  <strong>{currentFocusScore}%</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowDistractionWarning(false);
                    api.setPetState('TYPING').catch(() => {});
                  }}
                  className="mt-2.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs transition"
                >
                  Tôi hiểu – Quay lại tập trung
                </button>
              </div>
            )}

            {/* Relaxed Mode 90m Ultradian Rest Prompt */}
            {showRestPrompt && (
              <div className="mt-4 p-4 bg-emerald-50 border-2 border-emerald-400 rounded-xl text-xs text-emerald-900 shadow-xs">
                <div className="font-black flex items-center gap-1.5 mb-1 text-emerald-800">
                  <Coffee size={15} /> Cảnh báo Nhịp sinh học Ultradian: Đã làm việc liên tục 90 phút!
                </div>
                <p className="mb-2 text-emerald-700">
                  Theo khoa học thần kinh, sau 90 phút não bộ cần 15–20 phút nghỉ ngơi để hạ hormone căng thẳng cortisol.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRestPrompt(false);
                      setWorkMinutesElapsed(0);
                      handleStartRecommendedBreak(20);
                    }}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition"
                  >
                    Nghỉ sâu ngay (20 phút)
                  </button>
                  {restPostponeCount < 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowRestPrompt(false);
                        setRestPostponeCount(prev => prev + 1);
                      }}
                      className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg font-bold text-xs border border-slate-300 transition"
                    >
                      Hoãn 15 phút ({2 - restPostponeCount} lần còn lại)
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* SCIENTIFIC FOCUS & BREAK GUIDE (Tra cứu thời gian nghỉ giải lao khoa học) */}
          {/* ========================================================================= */}
          {!compact && (
            <div className="bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <BookOpen size={16} className="text-amber-600" />
                  Cẩm Nang Khoa Học: Làm Bao Lâu Thì Nên Nghỉ Giải Lao?
                </h3>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  Nhấn để áp dụng ngay
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-amber-50/70 border-2 border-slate-900 flex flex-col justify-between">
                  <div>
                    <div className="font-black text-slate-900 flex items-center justify-between">
                      <span>🍅 Pomodoro 25 / 5</span>
                      <span className="text-[10px] bg-amber-300 px-1.5 py-0.5 rounded font-black">Phổ biến nhất</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">
                      <strong>25 phút làm • 5 phút nghỉ ngắn.</strong> Sau 4 chu kỳ thì nghỉ dài <strong>15–30 phút</strong>. Chống trì hoãn và giữ não luôn tỉnh táo.
                    </p>
                  </div>
                  <div className="flex gap-1.5 mt-3">
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => {
                        onModeChange('STRICT');
                        selectPresetMinutes(25);
                      }}
                      className="flex-1 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] rounded-lg border border-slate-900"
                    >
                      Làm 25p
                    </button>
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => {
                        onModeChange('RELAXED');
                        selectPresetMinutes(5);
                      }}
                      className="flex-1 py-1.5 bg-emerald-300 hover:bg-emerald-200 text-slate-950 font-black text-[11px] rounded-lg border border-slate-900"
                    >
                      Nghỉ 5p
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-blue-50/70 border-2 border-slate-900 flex flex-col justify-between">
                  <div>
                    <div className="font-black text-slate-900 flex items-center justify-between">
                      <span>⚡ DeskTime 52 / 17</span>
                      <span className="text-[10px] bg-blue-200 px-1.5 py-0.5 rounded font-black">Tỷ lệ vàng</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">
                      <strong>52 phút làm • 17 phút nghỉ hoàn toàn.</strong> Top 10% nhân sự năng suất nhất dùng nhịp này để lập trình, thiết kế, viết báo cáo.
                    </p>
                  </div>
                  <div className="flex gap-1.5 mt-3">
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => {
                        onModeChange('STRICT');
                        selectPresetMinutes(52);
                      }}
                      className="flex-1 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] rounded-lg border border-slate-900"
                    >
                      Làm 52p
                    </button>
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => {
                        onModeChange('RELAXED');
                        selectPresetMinutes(17);
                      }}
                      className="flex-1 py-1.5 bg-emerald-300 hover:bg-emerald-200 text-slate-950 font-black text-[11px] rounded-lg border border-slate-900"
                    >
                      Nghỉ 17p
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-purple-50/70 border-2 border-slate-900 flex flex-col justify-between">
                  <div>
                    <div className="font-black text-slate-900 flex items-center justify-between">
                      <span>🧠 Ultradian 90 / 20</span>
                      <span className="text-[10px] bg-purple-200 px-1.5 py-0.5 rounded font-black">Deep Work</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">
                      <strong>90 phút chuyên sâu • 20 phút nghỉ sâu.</strong> Chu kỳ sinh học tự nhiên tối đa của con người trước khi cần nạp lại năng lượng.
                    </p>
                  </div>
                  <div className="flex gap-1.5 mt-3">
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => {
                        onModeChange('STRICT');
                        selectPresetMinutes(90);
                      }}
                      className="flex-1 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] rounded-lg border border-slate-900"
                    >
                      Làm 90p
                    </button>
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => {
                        onModeChange('RELAXED');
                        selectPresetMinutes(20);
                      }}
                      className="flex-1 py-1.5 bg-emerald-300 hover:bg-emerald-200 text-slate-950 font-black text-[11px] rounded-lg border border-slate-900"
                    >
                      Nghỉ 20p
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================= RIGHT COLUMN (5 COLS): MODULE 3 & 4 DASHBOARD ================= */}
        {!compact && (
          <div className="lg:col-span-5 space-y-6">
            {/* 1. DAILY FOCUS GOAL & PERSONAL PRODUCTIVITY STATS (Module 3) */}
            <div className="bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Target size={16} className="text-amber-600" />
                  Mục Tiêu & Thống Kê Năng Suất Hôm Nay
                </h3>
                <span className="text-[11px] font-black text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                  🔥 Streak: {streakDays} ngày
                </span>
              </div>

              {/* 3 Stat Mini-Cards */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200 text-center">
                  <div className="text-[10px] font-bold text-slate-500">Tổng giờ hôm nay</div>
                  <div className="text-sm font-black text-slate-900 mt-0.5">
                    {formatTotalHoursMins(todayTotalMinutes)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-center">
                  <div className="text-[10px] font-bold text-slate-500">Điểm tập trung TB</div>
                  <div className="text-sm font-black text-slate-900 mt-0.5">{avgFocusScore}%</div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-center">
                  <div className="text-[10px] font-bold text-slate-500">Nghỉ khuyến nghị</div>
                  <div className="text-sm font-black text-emerald-800 mt-0.5">{recommendedBreakMins} phút</div>
                </div>
              </div>

              {/* Daily Focus Goal Progress Bar & Selector */}
              <div className="p-3.5 rounded-xl bg-[#f7f2e7] border-2 border-slate-900 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black text-slate-800">
                    Tiến độ mục tiêu ngày ({formatTotalHoursMins(todayTotalMinutes)} / {targetHours}h)
                  </span>
                  <span className="font-black text-amber-700">{goalProgressPercent}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden border border-slate-300">
                  <div
                    className="h-full bg-amber-400 transition-all duration-300"
                    style={{ width: `${goalProgressPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <span className="font-bold text-slate-600">Đặt mục tiêu ngày:</span>
                  <div className="flex gap-1">
                    {[2, 4, 6, 8].map(h => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => void handleUpdateDailyGoal(h)}
                        className={`px-2 py-0.5 rounded font-black border transition ${
                          targetHours === h
                            ? 'bg-slate-900 text-amber-300 border-slate-900'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-amber-50'
                        }`}
                      >
                        {h}h
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. WELLNESS & MICRO-BREAK EXERCISES (Module 4) */}
            <div className="bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Activity size={16} className="text-emerald-600" />
                  Trạm Chăm Sóc Sức Khỏe & Giải Lao Ngắn
                </h3>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Chống Burnout
                </span>
              </div>

              {/* Hydration Tracker (Module 4: Chu kỳ nhắc uống nước 2 lít/ngày) */}
              <div className="p-3.5 rounded-xl bg-sky-50 border-2 border-slate-900 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-sky-400 border-2 border-slate-900 flex items-center justify-center text-slate-950 shrink-0">
                    <Droplets size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900">
                      Uống nước hôm nay: {waterCupsToday}/8 cốc ({waterCupsToday * 250}ml)
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Chu kỳ khuyến nghị: Uống 1 cốc nước mỗi 45–60 phút làm việc
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddWaterCup}
                  className="px-3 py-1.5 rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 font-black text-xs border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[1px] active:shadow-none shrink-0"
                >
                  +1 Cốc
                </button>
              </div>

              {/* 3 Guided Micro-break Exercise Buttons */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveExercise('EYE_20');
                    setExerciseSecondsLeft(20);
                  }}
                  className={`p-2.5 rounded-xl border-2 border-slate-900 text-left transition ${
                    activeExercise === 'EYE_20' ? 'bg-amber-300 font-black' : 'bg-white hover:bg-amber-50'
                  }`}
                >
                  <Eye size={15} className="text-amber-700 mb-1" />
                  <div className="text-xs font-black text-slate-900">Mắt 20-20-20</div>
                  <div className="text-[10px] text-slate-600">Nhìn xa 6m (20s)</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveExercise('BREATH_478');
                    setExerciseSecondsLeft(19);
                  }}
                  className={`p-2.5 rounded-xl border-2 border-slate-900 text-left transition ${
                    activeExercise === 'BREATH_478' ? 'bg-emerald-300 font-black' : 'bg-white hover:bg-emerald-50'
                  }`}
                >
                  <Wind size={15} className="text-emerald-700 mb-1" />
                  <div className="text-xs font-black text-slate-900">Thở 4-7-8</div>
                  <div className="text-[10px] text-slate-600">Hạ căng thẳng</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveExercise('NECK_STRETCH');
                    setExerciseSecondsLeft(30);
                  }}
                  className={`p-2.5 rounded-xl border-2 border-slate-900 text-left transition ${
                    activeExercise === 'NECK_STRETCH' ? 'bg-purple-300 font-black' : 'bg-white hover:bg-purple-50'
                  }`}
                >
                  <Activity size={15} className="text-purple-700 mb-1" />
                  <div className="text-xs font-black text-slate-900">Giãn Cổ Vai</div>
                  <div className="text-[10px] text-slate-600">Chống mỏi gáy</div>
                </button>
              </div>

              {/* Active Micro-Exercise Interactive Box */}
              {activeExercise && (
                <div className="p-4 rounded-xl bg-[#f7f2e7] border-2 border-slate-900 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900">
                      {activeExercise === 'EYE_20' && '👁️ Quy tắc Bảo vệ Mắt 20-20-20'}
                      {activeExercise === 'BREATH_478' && '🌬️ Bài Thở Điều Hòa Thần Kinh 4-7-8'}
                      {activeExercise === 'NECK_STRETCH' && '🧘 Giãn Cơ Cổ - Vai - Gáy Tại Bàn'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-amber-300 font-mono text-xs font-black">
                      {exerciseSecondsLeft}s
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed">
                    {activeExercise === 'EYE_20' &&
                      'Hãy rời mắt khỏi màn hình và nhìn vào một vật thể cách xa khoảng 6 mét (20 feet) trong 20 giây để cơ điều tiết mắt được thả lỏng hoàn toàn.'}
                    {activeExercise === 'BREATH_478' &&
                      'Hít sâu bằng mũi trong 4 giây → Giữ hơi thở trong 7 giây → Thở ra chậm rãi bằng miệng trong 8 giây.'}
                    {activeExercise === 'NECK_STRETCH' &&
                      'Nghiêng đầu chậm rãi sang phải giữ 10s → Nghiêng sang trái giữ 10s → Xoay tròn hai bả vai về phía sau 10s.'}
                  </p>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveExercise(null)}
                      className="px-3 py-1 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-600"
                    >
                      Đóng
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveExercise(null);
                        api.strokePet().catch(() => {});
                        onSessionFinish(30);
                      }}
                      className="px-3.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs border-2 border-slate-900 shadow-[0_2px_0_#0f172a]"
                    >
                      Hoàn thành bài tập (+30 EXP)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 3. RECENT COMPLETED SESSIONS LOG (Module 3) */}
            <div className="bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <History size={16} className="text-indigo-600" />
                  Nhật Ký Phiên Tập Trung Gần Đây
                </h3>
                <span className="text-[11px] font-bold text-slate-500">{recentSessions.length} phiên gần nhất</span>
              </div>

              {recentSessions.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                  Chưa có phiên hoàn thành nào hôm nay. Hãy bấm <strong>Bắt đầu đếm ngược</strong> hoặc gọi{' '}
                  <strong>"HEY ANY, hẹn giờ 5 phút"</strong> nhé!
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {recentSessions.slice(0, 6).map((s: any, idx: number) => (
                    <div
                      key={s.id || idx}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-black border border-slate-900 ${
                            s.mode === 'STRICT' ? 'bg-amber-300 text-slate-950' : 'bg-emerald-300 text-slate-950'
                          }`}
                        >
                          {s.mode === 'STRICT' ? <Flame size={13} /> : <Coffee size={13} />}
                        </span>
                        <div>
                          <div className="font-black text-slate-900">
                            {s.mode === 'STRICT' ? 'Phiên Nghiêm túc' : 'Phiên Thư giãn'} • {s.durationMinutes} phút
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-2">
                            <span>Độ tập trung: {s.focusScore ?? 100}%</span>
                            {s.endTime && (
                              <span>
                                • {new Date(s.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200 text-[11px]">
                        +{Math.round((s.durationMinutes || 25) * 2)} EXP
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
