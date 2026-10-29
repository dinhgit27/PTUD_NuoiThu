import React, { useState } from 'react';
import { PixelPetCanvas } from './PixelPetCanvas';
import { AnimationState, UserPet } from '../types';
import { playTtsSpeech } from '../utils/tts';
import { Heart, Coffee, Utensils, X } from 'lucide-react';

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
  onClose,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleAction = (type: 'feed' | 'drink' | 'stroke') => {
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

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative w-screen h-screen flex flex-col items-center justify-center bg-[#13111c] text-white select-none overflow-hidden font-sans p-2 box-border"
    >
      {/* Top Floating Mini Info & Close (Chỉ hiện khi rê chuột) */}
      <div
        className={`absolute top-2 left-2 right-2 flex items-center justify-between px-2.5 py-1 bg-[#231e36]/90 backdrop-blur-md rounded-xl border border-slate-700/80 shadow-md z-40 transition-all duration-200 ${
          isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-black text-amber-300 text-xs truncate">🐾 {pet.name}</span>
          <span className="bg-amber-400/20 text-amber-200 text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
            Lv.{pet.level}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-amber-400 font-bold">🍖 {pet.hunger}%</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Đóng cửa sổ"
              className="p-0.5 hover:bg-rose-500/30 text-slate-400 hover:text-rose-300 rounded transition"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Center: HIỆN RIÊNG BÉ THÚ CƯNG TRỌN VẸN */}
      <div
        onClick={() => handleAction('stroke')}
        title="Nhấn vào bé cưng để vuốt ve (+30 EXP)"
        className="flex-1 w-full flex items-center justify-center cursor-pointer transition-transform active:scale-95"
      >
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

      {/* Bottom Floating Mini Controls (Chỉ hiện khi rê chuột) */}
      <div
        className={`absolute bottom-2 inset-x-3 flex items-center justify-center gap-1.5 p-1 bg-[#231e36]/90 backdrop-blur-md rounded-xl border border-slate-700/80 shadow-lg z-40 transition-all duration-200 ${
          isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={() => handleAction('feed')}
          title="Cho ăn (+50 EXP)"
          className="flex-1 flex items-center justify-center gap-1 py-1 px-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
        >
          <Utensils size={12} />
          <span>Ăn</span>
        </button>

        <button
          type="button"
          onClick={() => handleAction('drink')}
          title="Uống nước"
          className="flex-1 flex items-center justify-center gap-1 py-1 px-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px] rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
        >
          <Coffee size={12} />
          <span>Nước</span>
        </button>

        <button
          type="button"
          onClick={() => handleAction('stroke')}
          title="Vuốt ve (+30 EXP)"
          className="flex-1 flex items-center justify-center gap-1 py-1 px-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
        >
          <Heart size={12} />
          <span>Xoa</span>
        </button>
      </div>
    </div>
  );
};
