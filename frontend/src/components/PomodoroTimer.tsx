import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, AlertTriangle, Coffee, Droplets, CheckCircle, Flame, Timer, Coins, Sparkles, BookOpen, PawPrint } from 'lucide-react';
import { api } from '../services/api';
import { AnimationState } from '../types';

export interface TimerRequest {
  minutes: number;
  autoStart: boolean;
  action?: 'START' | 'PAUSE' | 'RESET';
  requestId: number;
}

interface PomodoroTimerProps {
  currentMode: 'STRICT' | 'RELAXED';
  onModeChange: (mode: 'STRICT' | 'RELAXED') => void;
  onSessionFinish: (expAward: number) => void;
  onPetStateChange?: (state: AnimationState) => void;
  compact?: boolean;
  timerRequest?: TimerRequest;
}

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
  currentMode,
  onModeChange,
  onSessionFinish,
  onPetStateChange,
  compact = false,
  timerRequest
}) => {
  // Timer States
  const [targetMinutes, setTargetMinutes] = useState(25);
  const [customMinutes, setCustomMinutes] = useState('25');
  const [durationError, setDurationError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [violationsCount, setViolationsCount] = useState(0);
  const [showDistractionWarning, setShowDistractionWarning] = useState(false);

  // Relaxed Mode Wellness Prompts
  const [workMinutesElapsed, setWorkMinutesElapsed] = useState(0);
  const [showRestPrompt, setShowRestPrompt] = useState(false);
  const [restPostponeCount, setRestPostponeCount] = useState(0);
  const [activeExercise, setActiveExercise] = useState<string | null>(null);

  // Handle voice or AI timer requests (e.g., "Ê Ní hẹn giờ 15 phút")
  useEffect(() => {
    if (!timerRequest) return;
    if (timerRequest.action === 'PAUSE') {
      setIsRunning(false);
      return;
    }
    if (timerRequest.action === 'RESET') {
      setIsRunning(false);
      setSecondsLeft(targetMinutes * 60);
      setViolationsCount(0);
      setShowDistractionWarning(false);
      return;
    }
    const mins = Math.max(1, Math.min(180, Math.round(timerRequest.minutes || 25)));
    setDurationError('');
    setTargetMinutes(mins);
    setCustomMinutes(String(mins));
    setSecondsLeft(mins * 60);
    setViolationsCount(0);
    setShowDistractionWarning(false);
    setIsRunning(timerRequest.autoStart);
    if (timerRequest.autoStart) {
      api.setPetState(currentMode === 'STRICT' ? 'TYPING' : 'IDLE').catch(() => {});
    }
  }, [timerRequest?.requestId]);

  useEffect(() => {
    const state: AnimationState = isRunning && currentMode === 'STRICT' ? 'TYPING' : 'IDLE';
    onPetStateChange?.(state);
  }, [isRunning, currentMode]);

  // Countdown effect
  useEffect(() => {
    let interval: any = null;
    if (isRunning && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft(prev => prev - 1);
        if (currentMode === 'RELAXED' && secondsLeft % 60 === 0) {
          setWorkMinutesElapsed(prev => prev + 1);
        }
      }, 1000);
    } else if (secondsLeft === 0 && isRunning) {
      handleCompleteSession();
    }
    return () => clearInterval(interval);
  }, [isRunning, secondsLeft]);

  // Check 90 min fatigue threshold in Relaxed Mode (US-U05)
  useEffect(() => {
    if (currentMode === 'RELAXED' && workMinutesElapsed >= 90 && !showRestPrompt) {
      setShowRestPrompt(true);
    }
  }, [workMinutesElapsed, currentMode]);

  const handleStartPause = () => {
    setIsRunning(!isRunning);
    if (!isRunning) {
      api.setPetState(currentMode === 'STRICT' ? 'TYPING' : 'IDLE');
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setSecondsLeft(targetMinutes * 60);
    setViolationsCount(0);
    setShowDistractionWarning(false);
  };

  const applyCustomDuration = () => {
    const minutes = Number(customMinutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) {
      setDurationError('Thời lượng phải từ 1 đến 180 phút.');
      return;
    }
    setDurationError('');
    setTargetMinutes(minutes);
    setSecondsLeft(minutes * 60);
    setIsRunning(false);
  };

  const handleCompleteSession = async () => {
    setIsRunning(false);
    try {
      const res = await api.finishSession({
        durationMinutes: targetMinutes,
        mode: currentMode,
        violationsCount
      });
      onSessionFinish(res.data.expAward || targetMinutes * 2);
      api.setPetState('HAPPY');
      alert(`🎉 Hoàn thành phiên làm việc ${targetMinutes} phút! Bạn nhận được +${res.data.expAward} EXP!`);
    } catch (err) {
      console.error(err);
    }
  };

  // Simulate Distraction (Strict Mode US-U04)
  const triggerSimulatedDistraction = () => {
    if (currentMode !== 'STRICT' || !isRunning) return;
    setViolationsCount(prev => prev + 1);
    setShowDistractionWarning(true);
    api.setPetState('SAD');
  };

  const formatMinutes = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    return mins.toString().padStart(2, '0');
  };

  const formatSeconds = (totalSec: number) => {
    const secs = totalSec % 60;
    return secs.toString().padStart(2, '0');
  };

  const totalDurationSeconds = targetMinutes * 60;
  const progressPercent = Math.max(0, Math.min(100, ((totalDurationSeconds - secondsLeft) / totalDurationSeconds) * 100));

  return (
    <div className={`mx-auto space-y-6 text-slate-800 ${compact ? 'max-w-md' : 'max-w-4xl'}`}>
      {/* Top Banner (Matches Image 3) */}
      {!compact && (
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-slate-900 bg-[#fffdfa] shadow-[3px_3px_0px_#0f172a] p-5 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-400 border-2 border-slate-900 flex items-center justify-center text-slate-950 shadow-[2px_2px_0px_#0f172a] shrink-0">
              <Timer size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Bộ Đếm Nhịp Pomodoro
                </h2>
                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  PHIÊN SỐ #04
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                Đồng hành cùng thú cưng tích luỹ điểm tập trung & năng lượng làm việc
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-xs">
            <Sparkles size={14} className="text-amber-500" />
            <span>Thưởng phiên hoàn thành: <strong className="text-amber-600 font-bold">+50 EXP Thú Cưng</strong></span>
          </div>
        </header>
      )}

      {/* Main Timer Card */}
      <div className="bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] p-6 sm:p-8 max-w-2xl mx-auto">
        {/* Mode Switch Tabs (Nghiêm túc vs Thư giãn) */}
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1 mb-6">
          <button
            type="button"
            disabled={isRunning}
            onClick={() => {
              onModeChange('STRICT');
              setTargetMinutes(25);
              setCustomMinutes('25');
              setSecondsLeft(25 * 60);
            }}
            className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition ${
              currentMode === 'STRICT'
                ? 'bg-amber-400 text-slate-950 font-black border-2 border-slate-900 shadow-[0_2px_0_#0f172a]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Flame size={14} className={currentMode === 'STRICT' ? 'text-amber-400' : 'text-slate-400'} />
            <span>Nghiêm túc</span>
          </button>
          <button
            type="button"
            disabled={isRunning}
            onClick={() => {
              onModeChange('RELAXED');
              setTargetMinutes(45);
              setCustomMinutes('45');
              setSecondsLeft(45 * 60);
            }}
            className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition ${
              currentMode === 'RELAXED'
                ? 'bg-amber-400 text-slate-950 font-black border-2 border-slate-900 shadow-[0_2px_0_#0f172a]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Coffee size={14} className={currentMode === 'RELAXED' ? 'text-amber-400' : 'text-slate-400'} />
            <span>Thư giãn</span>
          </button>
        </div>

        {/* Center Timer Stage */}
        <div className="rounded-2xl bg-[#f7f2e7] border-2 border-slate-900 p-8 text-center shadow-inner relative">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/60 text-[11px] font-bold mb-3 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            <span>{currentMode === 'STRICT' ? 'PHIÊN TẬP TRUNG CHUYÊN SÂU' : 'PHIÊN LÀM VIỆC NHỊP NHÀNG'}</span>
          </div>

          {/* Giant Countdown Clock */}
          <div className="text-6xl sm:text-7xl font-black text-[#231e36] tracking-widest my-2 font-mono flex items-center justify-center gap-3">
            <span>{formatMinutes(secondsLeft)}</span>
            <span className="text-amber-400 animate-pulse">:</span>
            <span>{formatSeconds(secondsLeft)}</span>
          </div>

          <div className="text-xs text-slate-500 font-medium flex items-center justify-center gap-1.5 mt-2">
            <span className="text-amber-500">🌿</span>
            <span>{currentMode === 'STRICT' ? 'Bảo vệ độ tập trung tuyệt đối' : 'Làm việc nhịp nhàng & bảo vệ sức khỏe'}</span>
          </div>

          {/* Yellow Progress Line */}
          <div className="w-full max-w-md mx-auto bg-slate-200/70 h-2 rounded-full overflow-hidden my-4 border border-slate-300/40">
            <div
              className="bg-gradient-to-r from-amber-400 to-amber-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Preset Duration Pills */}
          <div className="flex flex-wrap justify-center gap-2 my-4">
            {[15, 25, 45, 60].map(mins => (
              <button
                key={mins}
                type="button"
                disabled={isRunning}
                onClick={() => {
                  setTargetMinutes(mins);
                  setCustomMinutes(String(mins));
                  setSecondsLeft(mins * 60);
                  setDurationError('');
                }}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
                  targetMinutes === mins
                    ? 'bg-amber-400 text-slate-950 font-black border-2 border-slate-900 shadow-[0_2px_0_#0f172a]'
                    : 'bg-white hover:bg-amber-50 text-slate-800 font-bold border-2 border-slate-900 shadow-[0_2px_0_#0f172a]'
                }`}
              >
                {mins}m
              </button>
            ))}
          </div>

          {/* Custom Duration Input */}
          <div className="flex items-center justify-center gap-2 text-xs text-slate-600 mb-2">
            <span>Tùy chỉnh:</span>
            <input
              type="number"
              min={1}
              max={180}
              step={1}
              value={customMinutes}
              disabled={isRunning}
              onChange={event => setCustomMinutes(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') applyCustomDuration();
              }}
              className="w-16 px-2.5 py-1.5 text-xs text-center font-bold border border-slate-200 rounded-lg bg-white shadow-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
            <span>phút</span>
            <button
              type="button"
              disabled={isRunning}
              onClick={applyCustomDuration}
              className="px-3 py-1.5 text-xs font-black bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[1px] active:shadow-none transition"
            >
              Áp dụng
            </button>
          </div>
          {durationError && (
            <p role="alert" className="text-center text-[11px] text-red-600 font-semibold">{durationError}</p>
          )}

          {/* Action Control Buttons */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              type="button"
              onClick={handleStartPause}
              className="px-8 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none font-extrabold text-sm shadow-xs transition active:scale-95 flex items-center gap-2"
            >
              {isRunning ? <><Pause size={16} /> Tạm dừng</> : <><Play size={16} /> Bắt đầu</>}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-6 py-3 rounded-xl bg-white hover:bg-amber-50 text-slate-800 font-black text-sm border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none transition active:scale-95 flex items-center gap-1.5"
            >
              <RotateCcw size={15} /> Đặt lại
            </button>
          </div>

          {/* Distraction Test Button */}
          {currentMode === 'STRICT' && isRunning && (
            <div className="mt-4 pt-3 border-t border-slate-200/60">
              <button
                type="button"
                onClick={triggerSimulatedDistraction}
                className="text-[11px] text-amber-600 hover:underline flex items-center justify-center gap-1 mx-auto font-medium"
              >
                <AlertTriangle size={12} /> Thử nghiệm: Phát hiện mở tab giải trí
              </button>
            </div>
          )}
        </div>

        {/* Distraction Alert Bubble */}
        {showDistractionWarning && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 shadow-xs">
            <div className="font-bold flex items-center gap-1.5 mb-1 text-red-800">
              <AlertTriangle size={15} /> Bé cưng nhắc nhở: Tập trung nào!
            </div>
            <p>Bạn đã rời khỏi công việc rồi đó! Thú cưng đang buồn bã và điểm hạnh phúc bị trừ 10 điểm.</p>
            <button
              type="button"
              onClick={() => {
                setShowDistractionWarning(false);
                api.setPetState('TYPING');
              }}
              className="mt-2.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs shadow-xs transition"
            >
              Tôi hiểu – Quay lại làm việc
            </button>
          </div>
        )}

        {/* Relaxed Mode 90m Rest Prompt */}
        {showRestPrompt && (
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 shadow-xs">
            <div className="font-bold flex items-center gap-1.5 mb-1 text-emerald-800">
              <Coffee size={15} /> Đã làm việc liên tục 90 phút!
            </div>
            <p className="mb-2 text-emerald-700">Hãy đứng dậy thả lỏng, uống một ngụm nước và cho mắt nghỉ ngơi một chút nhé!</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowRestPrompt(false);
                  setWorkMinutesElapsed(0);
                  setActiveExercise('478');
                }}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs transition"
              >
                Nghỉ ngay (10 phút)
              </button>
              {restPostponeCount < 2 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowRestPrompt(false);
                    setRestPostponeCount(prev => prev + 1);
                  }}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-xs border border-slate-200 transition"
                >
                  Thêm 15 phút ({2 - restPostponeCount} lần)
                </button>
              )}
            </div>
          </div>
        )}

        {/* Micro-exercise Card */}
        {activeExercise && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-slate-800 shadow-xs">
            <div className="font-bold text-sm mb-1 flex items-center gap-1 text-[#231e36]">
              <Droplets size={14} className="text-blue-600" /> Bài Thở Điều Hòa 4-7-8
            </div>
            <p className="text-slate-600 mb-2.5">Hít vào 4 giây &rarr; Giữ hơi 7 giây &rarr; Thở chậm ra 8 giây.</p>
            <button
              type="button"
              onClick={() => {
                setActiveExercise(null);
                api.strokePet();
              }}
              className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none rounded-lg font-bold text-xs shadow-xs transition"
            >
              Hoàn thành (+30 EXP)
            </button>
          </div>
        )}
      </div>

      {/* 3 Summary Cards (Matches Image 3) */}
      {!compact && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-100">
              <CheckCircle size={18} />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Tổng thời gian hôm nay</div>
              <div className="text-sm font-extrabold text-slate-900 mt-0.5">1h 40m</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
              <PawPrint size={18} />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Trạng thái Thú Cưng</div>
              <div className="text-sm font-extrabold text-slate-900 mt-0.5">Chăm chú (+8/h)</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
              <BookOpen size={18} />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Chu kỳ kế tiếp</div>
              <div className="text-sm font-extrabold text-slate-900 mt-0.5">Nghỉ ngắn 5 phút</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
