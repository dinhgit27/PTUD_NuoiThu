import React, { useState } from 'react';
import { PixelPetCanvas } from './PixelPetCanvas';
import { AnimationState, UserPet } from '../types';
import { playTtsSpeech } from '../utils/tts';
import { Heart, Coffee, Utensils, Sparkles, Smile, Moon, Trophy, X, ChevronDown, ChevronUp } from 'lucide-react';

interface DesktopPetPiPViewProps {
  pet: UserPet;
  speechBubble: string | null;
  onFeed: () => void | Promise<void>;
  onDrink: () => void;
  onStroke: () => void | Promise<void>;
  onInteraction?: (state: AnimationState, message: string) => void;
  onClose?: () => void;
}

export const DesktopPetPiPView: React.FC<DesktopPetPiPViewProps> = ({
  pet,
  speechBubble,
  onFeed,
  onDrink,
  onStroke,
  onInteraction,
  onClose,
}) => {
  const [showMoreActions, setShowMoreActions] = useState(false);

  const handleAction = async (type: 'feed' | 'drink' | 'stroke') => {
    if (type === 'feed') {
      void onFeed();
      void playTtsSpeech('Măm măm ngon quá, cảm ơn đại ca!');
    } else if (type === 'drink') {
      onDrink();
      void playTtsSpeech('Nước mát quá, cảm ơn đại ca!');
    } else if (type === 'stroke') {
      void onStroke();
      void playTtsSpeech('Hihi thích quá, cảm ơn đại ca!');
    }
  };

  const handleCustomInteraction = (state: AnimationState, message: string, speechText: string) => {
    if (onInteraction) {
      onInteraction(state, message);
    }
    void playTtsSpeech(speechText);
  };

  return (
    <div className="w-full h-full min-h-[300px] flex flex-col justify-between items-center bg-[#181528] text-white select-none p-2.5 box-border font-sans overflow-hidden">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between px-2 py-1 bg-[#231e36] border-2 border-slate-950 rounded-xl shadow-[0_2px_0_#000]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-black text-amber-300 text-xs truncate">🐾 {pet.name}</span>
          <span className="bg-[#2d2545] border border-amber-400/40 text-amber-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
            Lv.{pet.level}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold">
            <span title={`Độ đói: ${pet.hunger}%`} className="text-amber-400 flex items-center">
              🍖 {pet.hunger}%
            </span>
            <span title={`Hạnh phúc: ${pet.happiness}%`} className="text-pink-400 flex items-center">
              💖 {pet.happiness}%
            </span>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Đóng cửa sổ nổi"
              className="p-1 hover:bg-rose-500/30 text-slate-400 hover:text-rose-300 rounded transition"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Middle Pet Area */}
      <div className="flex-1 w-full flex items-center justify-center relative py-1 cursor-pointer">
        <PixelPetCanvas
          petType={pet.petType}
          currentState={pet.currentState}
          scaleSize="MEDIUM"
          speechBubble={speechBubble}
          onPetClick={() => handleAction('stroke')}
          petName={pet.name}
          petLevel={pet.level}
          hunger={pet.hunger}
          happiness={pet.happiness}
          equippedItems={pet.userItems}
          showTooltip={false}
        />
      </div>

      {/* Action Buttons */}
      <div className="w-full flex flex-col gap-1.5 shrink-0">
        {/* Main 3 Action Buttons */}
        <div className="grid grid-cols-3 gap-1.5 w-full">
          <button
            type="button"
            onClick={() => handleAction('feed')}
            title="Cho ăn (+50 EXP)"
            className="flex items-center justify-center gap-1 py-1.5 px-1 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-lg border-2 border-slate-950 shadow-[0_2px_0_#000] active:translate-y-[2px] active:shadow-none transition cursor-pointer"
          >
            <Utensils size={12} />
            <span>Cho ăn</span>
          </button>

          <button
            type="button"
            onClick={() => handleAction('drink')}
            title="Uống nước"
            className="flex items-center justify-center gap-1 py-1.5 px-1 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-lg border-2 border-slate-950 shadow-[0_2px_0_#000] active:translate-y-[2px] active:shadow-none transition cursor-pointer"
          >
            <Coffee size={12} />
            <span>Uống nước</span>
          </button>

          <button
            type="button"
            onClick={() => handleAction('stroke')}
            title="Vuốt ve (+30 EXP)"
            className="flex items-center justify-center gap-1 py-1.5 px-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg border-2 border-slate-950 shadow-[0_2px_0_#000] active:translate-y-[2px] active:shadow-none transition cursor-pointer"
          >
            <Heart size={12} />
            <span>Vuốt ve</span>
          </button>
        </div>

        {/* Extra Action Pill Toggle */}
        <div className="w-full flex items-center justify-between px-1">
          <button
            type="button"
            onClick={() => setShowMoreActions(!showMoreActions)}
            className="text-[10px] text-slate-400 hover:text-amber-300 font-bold flex items-center gap-1 transition"
          >
            <span>Hành động khác</span>
            {showMoreActions ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          <span className="text-[9px] text-slate-500 font-mono">PiP Desktop</span>
        </div>

        {/* Extra Action Buttons */}
        {showMoreActions && (
          <div className="grid grid-cols-4 gap-1 w-full bg-[#231e36] p-1.5 rounded-lg border border-slate-800 animate-in fade-in zoom-in-95">
            <button
              type="button"
              onClick={() => handleCustomInteraction('DANCING', 'Nhảy múa cùng đại ca nào! 🎵', 'Nhảy múa cùng đại ca vui quá!')}
              title="Nhảy múa"
              className="flex flex-col items-center justify-center py-1 bg-emerald-700 hover:bg-emerald-600 rounded text-[10px] font-bold text-white transition"
            >
              <Sparkles size={11} />
              <span>Nhảy</span>
            </button>
            <button
              type="button"
              onClick={() => handleCustomInteraction('WAVING', 'Vẫy tay chào đại ca nè! 👋', 'Vẫy tay chào đại ca nè!')}
              title="Vẫy tay chào"
              className="flex flex-col items-center justify-center py-1 bg-amber-700 hover:bg-amber-600 rounded text-[10px] font-bold text-white transition"
            >
              <Smile size={11} />
              <span>Chào</span>
            </button>
            <button
              type="button"
              onClick={() => handleCustomInteraction('SLEEPING', 'Bé cưng chợp mắt tí nha... Zzz 💤', 'Bé cưng chợp mắt tí nha đại ca.')}
              title="Đi ngủ"
              className="flex flex-col items-center justify-center py-1 bg-indigo-700 hover:bg-indigo-600 rounded text-[10px] font-bold text-white transition"
            >
              <Moon size={11} />
              <span>Ngủ</span>
            </button>
            <button
              type="button"
              onClick={() => handleCustomInteraction('HAPPY', 'Hoan hô! Đại ca làm việc xuất sắc lắm! 🎉', 'Hoan hô! Đại ca làm việc xuất sắc lắm!')}
              title="Ăn mừng"
              className="flex flex-col items-center justify-center py-1 bg-purple-700 hover:bg-purple-600 rounded text-[10px] font-bold text-white transition"
            >
              <Trophy size={11} />
              <span>Ăn mừng</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
