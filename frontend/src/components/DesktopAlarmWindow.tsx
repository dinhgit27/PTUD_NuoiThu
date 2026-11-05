import React, { useEffect, useState, useCallback, useRef } from 'react';
import { BellRing, Volume2, X, Coffee, Clock, Monitor, Sparkles } from 'lucide-react';
import { PixelPetCanvas } from './PixelPetCanvas';
import { UserPet } from '../types';
import { api } from '../services/api';

interface AlarmPopupData {
  completedMins?: number;
  noteText?: string;
  clockTimeTriggered?: string;
  pet?: UserPet | null;
}

export const DesktopAlarmWindow: React.FC = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const initialMins = parseInt(searchParams.get('completedMins') || '25', 10);
  const initialNote = searchParams.get('note') || '';
  const initialTime = searchParams.get('time') || '';

  const [alarmData, setAlarmData] = useState<AlarmPopupData>({
    completedMins: initialMins,
    noteText: initialNote,
    clockTimeTriggered: initialTime,
    pet: null
  });

  const [pet, setPet] = useState<UserPet | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Play chiptune chime locally if standalone browser window
  const playStandaloneBeep = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.12);
        osc.stop(ctx.currentTime + idx * 0.12 + 0.22);
      });
    } catch {}
  }, []);

  // Listen for IPC popup data from Electron
  useEffect(() => {
    document.title = '🚨 Báo Thức OfficePet — Đã Đến Giờ!';
    document.documentElement.classList.add('desktop-alarm-window');
    document.body.classList.add('desktop-alarm-window');

    const bridge = window.officePet;
    if (bridge?.onAlarmPopupData) {
      const unsub = bridge.onAlarmPopupData(data => {
        setAlarmData(prev => ({
          ...prev,
          ...data,
          completedMins: data.completedMins ?? prev.completedMins,
          noteText: data.noteText ?? prev.noteText,
          clockTimeTriggered: data.clockTimeTriggered ?? prev.clockTimeTriggered
        }));
        if (data.pet) {
          setPet(data.pet);
        }
      });

      return () => {
        unsub();
        document.documentElement.classList.remove('desktop-alarm-window');
        document.body.classList.remove('desktop-alarm-window');
      };
    }

    // Fallback: fetch pet from API or localStorage
    if (localStorage.getItem('officepet_token')) {
      api
        .getPet()
        .then(res => {
          if (res.data) setPet(res.data);
        })
        .catch(() => {});
    }

    return () => {
      document.documentElement.classList.remove('desktop-alarm-window');
      document.body.classList.remove('desktop-alarm-window');
    };
  }, []);

  // Play chime loop if standalone web popup
  useEffect(() => {
    if (!window.officePet) {
      playStandaloneBeep();
      audioIntervalRef.current = setInterval(playStandaloneBeep, 2400);
      return () => {
        if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
      };
    }
  }, [playStandaloneBeep]);

  // Actions
  const handleDismiss = useCallback(() => {
    if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    try {
      window.officePet?.stopAlarmNotification();
      window.officePet?.dismissAlarmWindow();
    } catch {}
    window.close();
  }, []);

  const handleAction = useCallback((action: 'BREAK_5' | 'SNOOZE_5' | 'SHOW_DASHBOARD') => {
    if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    try {
      window.officePet?.stopAlarmNotification();
      window.officePet?.performAlarmAction(action);
      window.officePet?.dismissAlarmWindow();
    } catch {}
    window.close();
  }, []);

  // Hotkey support: Space, Enter, or Escape dismisses alarm
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDismiss]);

  const timeLabel = alarmData.clockTimeTriggered
    ? `Đã đến mốc ${alarmData.clockTimeTriggered}!`
    : `Đã kết thúc ${alarmData.completedMins || 25} phút!`;

  return (
    <div className="w-screen h-screen flex items-center justify-center p-3 select-none bg-transparent overflow-hidden">
      <div className="w-[470px] bg-[#fffdfa] border-4 border-slate-900 rounded-2xl shadow-[0_0_50px_rgba(245,158,11,0.65),8px_8px_0px_#0f172a] ring-4 ring-amber-400 ring-offset-2 ring-offset-slate-950 flex flex-col overflow-hidden animate-bounce-short">
        {/* Draggable Title Bar */}
        <div
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
          className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-300 border-b-3 border-slate-900 px-4 py-2.5 flex items-center justify-between cursor-move"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-950 text-amber-300 flex items-center justify-center animate-pulse shadow-xs">
              <BellRing size={18} className="animate-bounce" />
            </div>
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-900 bg-white/95 px-2 py-0.5 rounded-full border border-slate-900 inline-block">
                🚨 BÁO THỨC MÀN HÌNH MÁY TÍNH
              </span>
            </div>
          </div>

          <button
            type="button"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            onClick={handleDismiss}
            className="w-7 h-7 rounded-lg bg-slate-950 hover:bg-rose-600 text-white flex items-center justify-center transition active:scale-95"
            title="Tắt chuông và đóng"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 flex gap-3.5 items-center">
          {/* Pet dancing preview */}
          <div className="w-28 h-28 shrink-0 bg-amber-50/80 border-2 border-slate-900 rounded-xl flex items-center justify-center shadow-xs overflow-hidden relative">
            <PixelPetCanvas
              petType={pet?.petType}
              currentState="DANCING"
              scaleSize="MEDIUM"
              showTooltip={false}
              disableWander={true}
            />
          </div>

          {/* Alarm Details */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center justify-between gap-1">
              <h2 className="text-base font-black text-slate-950 leading-tight truncate">
                {timeLabel}
              </h2>
              <span className="shrink-0 text-[10px] font-black text-slate-900 bg-emerald-300 px-2 py-0.5 rounded-md border border-slate-900">
                +{(alarmData.completedMins || 25) * 2} EXP
              </span>
            </div>

            <div className="p-2 rounded-lg bg-[#f7f2e7] border border-slate-300 text-xs">
              <p className="font-bold text-slate-900 line-clamp-2">
                {alarmData.noteText?.trim()
                  ? `📌 "${alarmData.noteText.trim()}"`
                  : '🌿 Đã hoàn thành phiên hẹn giờ! Hãy thả lỏng cơ thể nhé.'}
              </p>
            </div>

            <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
              <Volume2 size={13} className="text-amber-500 animate-pulse shrink-0" />
              <span>Bé cưng đang reo chuông trên toàn màn hình!</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className="px-4 pb-3.5 pt-0 space-y-2"
        >
          {/* Main Dismiss Button */}
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 active:from-rose-700 active:to-red-800 text-white font-black text-xs sm:text-sm border-2 border-slate-900 shadow-[0_3px_0_#0f172a] active:translate-y-[2px] active:shadow-none transition flex items-center justify-center gap-1.5"
          >
            🔕 TẮT CHUÔNG BÁO THỨC (Phím Space / Esc)
          </button>

          {/* Secondary Action Row */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => handleAction('BREAK_5')}
              className="py-1.5 px-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-[11px] border border-slate-900 shadow-xs active:translate-y-[1px] transition flex items-center justify-center gap-1 truncate"
            >
              <Coffee size={12} className="shrink-0" /> Nghỉ 5p
            </button>

            <button
              type="button"
              onClick={() => handleAction('SNOOZE_5')}
              className="py-1.5 px-2 rounded-lg bg-amber-300 hover:bg-amber-200 text-slate-950 font-black text-[11px] border border-slate-900 shadow-xs active:translate-y-[1px] transition flex items-center justify-center gap-1 truncate"
            >
              <Clock size={12} className="shrink-0" /> Snooze 5p
            </button>

            <button
              type="button"
              onClick={() => handleAction('SHOW_DASHBOARD')}
              className="py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] border border-slate-300 active:translate-y-[1px] transition flex items-center justify-center gap-1 truncate"
            >
              <Monitor size={12} className="shrink-0" /> Mở App
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
