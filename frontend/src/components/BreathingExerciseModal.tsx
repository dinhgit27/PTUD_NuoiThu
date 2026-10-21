import React, { useState, useEffect } from 'react';
import { Wind, X, CheckCircle2, Heart } from 'lucide-react';

interface BreathingExerciseModalProps {
  isOpen: boolean;
  onClose: () => void;
  durationMinutes?: number;
}

type BreathPhase = 'INHALE' | 'HOLD' | 'EXHALE';

export const BreathingExerciseModal: React.FC<BreathingExerciseModalProps> = ({
  isOpen,
  onClose,
  durationMinutes = 2
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(durationMinutes * 60);
  const [phase, setPhase] = useState<BreathPhase>('INHALE');
  const [phaseSeconds, setPhaseSeconds] = useState(4);
  const [isCompleted, setIsCompleted] = useState(false);

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setSecondsRemaining(durationMinutes * 60);
      setPhase('INHALE');
      setPhaseSeconds(4);
      setIsCompleted(false);
    }
  }, [isOpen, durationMinutes]);

  // Main countdown timer
  useEffect(() => {
    if (!isOpen || isCompleted) return;
    if (secondsRemaining <= 0) {
      setIsCompleted(true);
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, secondsRemaining, isCompleted]);

  // 4-7-8 Breathing Cycle
  useEffect(() => {
    if (!isOpen || isCompleted) return;

    const phaseTimer = setInterval(() => {
      setPhaseSeconds(prev => {
        if (prev > 1) return prev - 1;

        // Transition between phases
        if (phase === 'INHALE') {
          setPhase('HOLD');
          return 7;
        } else if (phase === 'HOLD') {
          setPhase('EXHALE');
          return 8;
        } else {
          setPhase('INHALE');
          return 4;
        }
      });
    }, 1000);

    return () => clearInterval(phaseTimer);
  }, [isOpen, phase, isCompleted]);

  if (!isOpen) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const phaseInstruction = {
    INHALE: {
      title: 'HÍT VÀO',
      desc: 'Hít sâu và chậm qua mũi...',
      scale: 'scale-125 bg-sage-300 border-sage-500 shadow-lg text-sage-900',
      duration: 4
    },
    HOLD: {
      title: 'GIỮ HƠI',
      desc: 'Giữ lồng ngực thả lỏng...',
      scale: 'scale-125 bg-yellow-200 border-yellow-500 shadow-md text-yellow-900',
      duration: 7
    },
    EXHALE: {
      title: 'THỞ RA',
      desc: 'Thở ra chậm rãi qua miệng...',
      scale: 'scale-90 bg-terracotta-200 border-terracotta-400 shadow-inner text-terracotta-900',
      duration: 8
    }
  }[phase];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white border-4 border-charcoal rounded-2xl shadow-pixel-lg max-w-sm w-full p-6 text-center animate-in zoom-in-95 font-sans">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-charcoal hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Đóng bài tập"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center justify-center gap-2 mb-2 text-sage-600">
          <Wind size={22} className="animate-pulse" />
          <h3 className="font-pixel text-sm text-charcoal">Tập Hít Thở Sâu Thư Giãn</h3>
        </div>
        <p className="text-[11px] text-gray-500 mb-6">
          Kỹ thuật thở 4-7-8 giúp hạ nhịp tim, xoa dịu não bộ và xua tan căng thẳng tức thì.
        </p>

        {isCompleted ? (
          <div className="py-6 space-y-4 animate-in fade-in">
            <CheckCircle2 size={48} className="mx-auto text-sage-500 animate-bounce" />
            <div className="font-pixel text-xs text-charcoal">Tuyệt vời lắm bạn ơi! 🌸🐾</div>
            <p className="text-xs text-gray-600">
              Bạn đã hoàn thành phiên hít thở sâu {durationMinutes} phút. Cơ thể và tâm trí bạn đã được tiếp thêm năng lượng tươi mới!
            </p>
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-sage-500 hover:bg-sage-600 text-white font-pixel text-xs rounded-xl border-2 border-charcoal shadow-pixel transition-transform active:scale-95"
            >
              Hoàn thành ✓
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Countdown Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-cream-200 border-2 border-charcoal rounded-full text-xs font-mono font-bold text-charcoal">
              <span>Thời gian còn lại:</span>
              <span className="text-terracotta-600">{timeFormatted}</span>
            </div>

            {/* Breathing Visual Circle */}
            <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
              <div
                className={`w-36 h-36 rounded-full border-4 flex flex-col items-center justify-center transition-all duration-1000 ease-in-out ${phaseInstruction.scale}`}
              >
                <span className="font-pixel text-sm font-bold tracking-wider">{phaseInstruction.title}</span>
                <span className="font-mono text-2xl font-bold mt-1">{phaseSeconds}s</span>
              </div>
            </div>

            {/* Instruction description */}
            <p className="text-xs font-bold text-charcoal animate-pulse">
              {phaseInstruction.desc}
            </p>

            {/* Stop button */}
            <button
              onClick={onClose}
              className="w-full py-2 bg-cream-200 hover:bg-cream-300 text-gray-700 font-pixel text-xs rounded-lg border-2 border-charcoal shadow-pixel transition-transform active:scale-95"
            >
              Dừng bài tập
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
