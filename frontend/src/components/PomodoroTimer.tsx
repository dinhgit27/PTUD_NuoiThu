import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, AlertTriangle, Coffee, Droplets, CheckCircle, Flame } from 'lucide-react';
import { api } from '../services/api';
import { AnimationState } from '../types';

interface PomodoroTimerProps {
  currentMode: 'STRICT' | 'RELAXED';
  onModeChange: (mode: 'STRICT' | 'RELAXED') => void;
  onSessionFinish: (expAward: number) => void;
  onPetStateChange?: (state: AnimationState) => void;
  compact?: boolean;
}

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
  currentMode,
  onModeChange,
  onSessionFinish,
  onPetStateChange,
  compact = false
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

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`bg-white border-2 border-charcoal rounded-xl shadow-pixel ${compact ? 'p-3 w-[400px] max-w-[calc(100vw-20px)] max-h-[calc(100vh-20px)] overflow-y-auto' : 'p-6 max-w-md mx-auto'}`}>
      {/* Mode Switch Tabs (US-U03) */}
      <div className="flex border-2 border-charcoal rounded-lg overflow-hidden mb-6 font-pixel text-xs">
        <button
          disabled={isRunning}
          onClick={() => {
            onModeChange('STRICT');
            setTargetMinutes(25);
            setCustomMinutes('25');
            setSecondsLeft(25 * 60);
          }}
          className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-2 transition-colors ${
            currentMode === 'STRICT'
              ? 'bg-terracotta-400 text-white font-bold'
              : 'bg-cream-100 text-charcoal hover:bg-cream-200'
          }`}
        >
          <Flame size={14} /> Nghiêm túc
        </button>
        <button
          disabled={isRunning}
          onClick={() => {
            onModeChange('RELAXED');
            setTargetMinutes(45);
            setCustomMinutes('45');
            setSecondsLeft(45 * 60);
          }}
          className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-2 transition-colors ${
            currentMode === 'RELAXED'
              ? 'bg-sage-400 text-white font-bold'
              : 'bg-cream-100 text-charcoal hover:bg-cream-200'
          }`}
        >
          <Coffee size={14} /> Thư giãn
        </button>
      </div>

      {/* Timer Display */}
      <div className="text-center py-6 bg-cream-100 border-2 border-charcoal rounded-xl mb-6 shadow-inner">
        <div className="font-pixel text-4xl text-charcoal tracking-wider">
          {formatTime(secondsLeft)}
        </div>
        <div className="text-xs text-gray-500 font-sans mt-2">
          {currentMode === 'STRICT'
            ? '🎯 Chế độ Pomodoro chống xao nhãng'
            : '🌿 Làm việc nhịp nhàng & bảo vệ sức khỏe'}
        </div>
      </div>

      {/* Preset Duration Buttons */}
      <div className="flex flex-wrap justify-center gap-2 mb-3">
        {[15, 25, 45, 60].map(mins => (
          <button
            key={mins}
            disabled={isRunning}
            onClick={() => {
              setTargetMinutes(mins);
              setCustomMinutes(String(mins));
              setSecondsLeft(mins * 60);
              setDurationError('');
            }}
            className={`px-3 py-1.5 text-xs font-pixel rounded-md border-2 border-charcoal transition-transform active:scale-95 disabled:opacity-50 ${
              targetMinutes === mins ? 'bg-sage-400 text-white shadow-pixel-sm' : 'bg-white hover:bg-gray-100'
            }`}
          >
            {mins}m
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 mb-6">
        <label htmlFor="custom-focus-minutes" className="text-[11px] text-gray-600">Tùy chỉnh:</label>
        <input
          id="custom-focus-minutes"
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
          aria-invalid={Boolean(durationError)}
          aria-describedby={durationError ? 'custom-focus-error' : undefined}
          className="w-20 px-2 py-1 text-xs border-2 border-charcoal rounded-md disabled:opacity-50"
        />
        <span className="text-[11px] text-gray-600">phút</span>
        <button
          type="button"
          disabled={isRunning}
          onClick={applyCustomDuration}
          className="px-3 py-1.5 text-xs font-pixel bg-sage-400 text-white rounded-md border-2 border-charcoal disabled:opacity-50"
        >
          Áp dụng
        </button>
      </div>
      {durationError && <p id="custom-focus-error" role="alert" className="-mt-4 mb-4 text-center text-[11px] text-red-600">{durationError}</p>}

      {/* Control Buttons */}
      <div className="flex justify-center gap-4 mb-4">
        <button
          onClick={handleStartPause}
          className={`px-6 py-2.5 font-pixel text-xs text-white rounded-lg border-2 border-charcoal shadow-pixel flex items-center gap-2 transition-transform active:translate-x-0.5 active:translate-y-0.5 ${
            isRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-sage-400 hover:bg-sage-500'
          }`}
        >
          {isRunning ? <><Pause size={14} /> Tạm dừng</> : <><Play size={14} /> Bắt đầu</>}
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-2.5 font-pixel text-xs bg-gray-200 hover:bg-gray-300 text-charcoal rounded-lg border-2 border-charcoal shadow-pixel flex items-center gap-2 transition-transform active:translate-x-0.5 active:translate-y-0.5"
        >
          <RotateCcw size={14} /> Đặt lại
        </button>
      </div>

      {/* Strict Mode: Distraction Testing Trigger (US-U04) */}
      {currentMode === 'STRICT' && isRunning && (
        <div className="mt-4 pt-4 border-t border-gray-200 text-center">
          <button
            onClick={triggerSimulatedDistraction}
            className="text-[11px] text-terracotta-500 hover:underline flex items-center justify-center gap-1 mx-auto"
          >
            <AlertTriangle size={12} /> Thử nghiệm: Phát hiện mở tab giải trí
          </button>
        </div>
      )}

      {/* Distraction Alert Bubble (US-U04: AC1, AC2) */}
      {showDistractionWarning && (
        <div className="mt-4 p-3 bg-red-50 border-2 border-red-400 rounded-lg text-xs text-red-700 animate-bounce">
          <div className="font-bold flex items-center gap-1.5 mb-1">
            <AlertTriangle size={14} /> Bé cưng nhắc nhở: Tập trung nào!
          </div>
          <div>Bạn đã rời khỏi công việc rồi đó! Thú cưng đang buồn bã và điểm hạnh phúc bị trừ 10 điểm.</div>
          <button
            onClick={() => {
              setShowDistractionWarning(false);
              api.setPetState('TYPING');
            }}
            className="mt-2 px-3 py-1 bg-red-600 text-white font-bold rounded text-[11px] border border-charcoal"
          >
            Tôi hiểu – Quay lại làm việc
          </button>
        </div>
      )}

      {/* Relaxed Mode: 90 Min Rest Notification (US-U05) */}
      {showRestPrompt && (
        <div className="mt-4 p-4 bg-sage-50 border-2 border-sage-400 rounded-lg text-xs text-sage-900 shadow-pixel-sm">
          <div className="font-pixel text-[11px] text-sage-700 flex items-center gap-1.5 mb-2">
            <Coffee size={14} /> Đã làm việc liên tục 90 phút!
          </div>
          <p className="mb-3">Hãy đứng dậy thả lỏng, uống một ngụm nước và cho mắt nghỉ ngơi một chút nhé!</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowRestPrompt(false);
                setWorkMinutesElapsed(0);
                setActiveExercise('478');
              }}
              className="px-3 py-1.5 bg-sage-500 text-white rounded font-bold border border-charcoal"
            >
              Nghỉ ngay (10 phút)
            </button>
            {restPostponeCount < 2 && (
              <button
                onClick={() => {
                  setShowRestPrompt(false);
                  setRestPostponeCount(prev => prev + 1);
                }}
                className="px-3 py-1.5 bg-gray-200 text-charcoal rounded border border-charcoal"
              >
                Thêm 15 phút ({2 - restPostponeCount} lần)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Micro-exercise modal / clock */}
      {activeExercise && (
        <div className="mt-4 p-4 bg-cream-200 border-2 border-charcoal rounded-lg text-xs">
          <div className="font-bold text-sm mb-1 flex items-center gap-1 text-terracotta-500">
            <Droplets size={14} /> Bài Thở Điều Hòa 4-7-8
          </div>
          <p className="text-gray-600 mb-2">Hít vào 4 giây &rarr; Giữ hơi 7 giây &rarr; Thở chậm ra 8 giây.</p>
          <button
            onClick={() => {
              setActiveExercise(null);
              api.strokePet();
            }}
            className="px-3 py-1 bg-terracotta-400 text-white rounded font-bold border border-charcoal"
          >
            Hoàn thành (+30 EXP)
          </button>
        </div>
      )}
    </div>
  );
};
