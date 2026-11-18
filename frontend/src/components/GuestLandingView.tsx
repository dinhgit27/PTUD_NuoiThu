import React, { useState, useEffect, useRef } from 'react';
import { AnimationState, PetType } from '../types';
import { PixelPetCanvas } from './PixelPetCanvas';
import {
  Sparkles,
  LogIn,
  UserPlus,
  Compass,
  Heart,
  Zap,
  Timer,
  Mic,
  Music,
  TreePine,
  ShoppingBag,
  Monitor,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

interface GuestLandingViewProps {
  petTypes: PetType[];
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onStartTour: () => void;
}

const FALLBACK_GUEST_PETS: PetType[] = [
  {
    id: 'guest-cat-01',
    name: 'Mèo Pixel Shiro',
    description: 'Bé mèo mướp màu cam lanh lợi, thích ngủ gật và gõ phím cùng chủ nhân.',
    unlockLevel: 1,
    isActive: true,
    isShopEnabled: false,
    isPurchaseRequired: false,
    expPrice: 0,
    spriteSheetUrl: '/sprites/cat_default_spritesheet.png',
    previewUrl: '/sprites/cat_default_preview.png',
    naturalAspectRatio: 1,
    frameConfig: {
      frameWidth: 64,
      frameHeight: 64,
      totalColumns: 4,
      totalRows: 17,
      totalFrames: 68,
      framesPerState: 4,
      naturalAspectRatio: 1,
      renderScale: { minWidth: 100, maxWidth: 150, minHeight: 100, maxHeight: 150, defaultWidth: 120, defaultHeight: 120 }
    },
    animations: {
      IDLE: { row: 0, frames: [0, 1, 2, 3], fps: 6, loop: true },
      TYPING: { row: 1, frames: [4, 5, 6, 7], fps: 8, loop: true },
      SLEEPING: { row: 2, frames: [8, 9, 10, 11], fps: 3, loop: true },
      WAKING_UP: { row: 3, frames: [12, 13, 14, 15], fps: 6, loop: false },
      HAPPY: { row: 4, frames: [16, 17, 18, 19], fps: 8, loop: true },
      SAD: { row: 5, frames: [20, 21, 22, 23], fps: 4, loop: true },
      YAWNING: { row: 6, frames: [24, 25, 26, 27], fps: 4, loop: true },
      HUNGRY: { row: 7, frames: [28, 29, 30, 31], fps: 5, loop: true },
      EATING: { row: 8, frames: [32, 33, 34, 35], fps: 7, loop: true },
      PETTING: { row: 9, frames: [36, 37, 38, 39], fps: 8, loop: true },
      DANCING: { row: 10, frames: [40, 41, 42, 43], fps: 10, loop: true },
      DRINKING: { row: 11, frames: [44, 45, 46, 47], fps: 6, loop: true },
      EXERCISING: { row: 12, frames: [48, 49, 50, 51], fps: 9, loop: true },
      WAVING: { row: 13, frames: [52, 53, 54, 55], fps: 7, loop: true },
      THANKING: { row: 14, frames: [56, 57, 58, 59], fps: 6, loop: false },
      CELEBRATING: { row: 15, frames: [60, 61, 62, 63], fps: 10, loop: false },
      EVOLVING: { row: 16, frames: [64, 65, 66, 67], fps: 10, loop: false }
    }
  },
  {
    id: 'guest-corgi-01',
    name: 'Corgi Pixel Bento',
    description: 'Chú cún Corgi chân ngắn vui nhộn, luôn lắc lư theo điệu nhạc Lofi.',
    unlockLevel: 1,
    isActive: true,
    isShopEnabled: false,
    isPurchaseRequired: false,
    expPrice: 0,
    spriteSheetUrl: '/sprites/corgi_default_spritesheet.png',
    previewUrl: '/sprites/corgi_default_preview.png',
    naturalAspectRatio: 1,
    frameConfig: {
      frameWidth: 64,
      frameHeight: 64,
      totalColumns: 4,
      totalRows: 17,
      totalFrames: 68,
      framesPerState: 4,
      naturalAspectRatio: 1,
      renderScale: { minWidth: 100, maxWidth: 150, minHeight: 100, maxHeight: 150, defaultWidth: 120, defaultHeight: 120 }
    },
    animations: {
      IDLE: { row: 0, frames: [0, 1, 2, 3], fps: 6, loop: true },
      TYPING: { row: 1, frames: [4, 5, 6, 7], fps: 8, loop: true },
      SLEEPING: { row: 2, frames: [8, 9, 10, 11], fps: 3, loop: true },
      WAKING_UP: { row: 3, frames: [12, 13, 14, 15], fps: 6, loop: false },
      HAPPY: { row: 4, frames: [16, 17, 18, 19], fps: 8, loop: true },
      SAD: { row: 5, frames: [20, 21, 22, 23], fps: 4, loop: true },
      YAWNING: { row: 6, frames: [24, 25, 26, 27], fps: 4, loop: true },
      HUNGRY: { row: 7, frames: [28, 29, 30, 31], fps: 5, loop: true },
      EATING: { row: 8, frames: [32, 33, 34, 35], fps: 7, loop: true },
      PETTING: { row: 9, frames: [36, 37, 38, 39], fps: 8, loop: true },
      DANCING: { row: 10, frames: [40, 41, 42, 43], fps: 10, loop: true },
      DRINKING: { row: 11, frames: [44, 45, 46, 47], fps: 6, loop: true },
      EXERCISING: { row: 12, frames: [48, 49, 50, 51], fps: 9, loop: true },
      WAVING: { row: 13, frames: [52, 53, 54, 55], fps: 7, loop: true },
      THANKING: { row: 14, frames: [56, 57, 58, 59], fps: 6, loop: false },
      CELEBRATING: { row: 15, frames: [60, 61, 62, 63], fps: 10, loop: false },
      EVOLVING: { row: 16, frames: [64, 65, 66, 67], fps: 10, loop: false }
    }
  },
  {
    id: 'guest-rabbit-01',
    name: 'Thỏ Pixel Mochi',
    description: 'Bé thỏ trắng tai dài dịu dàng, luôn chăm chú nhắc bạn uống nước đúng giờ.',
    unlockLevel: 1,
    isActive: true,
    isShopEnabled: false,
    isPurchaseRequired: false,
    expPrice: 0,
    spriteSheetUrl: '/sprites/rabbit_default_spritesheet.png',
    previewUrl: '/sprites/rabbit_default_preview.png',
    naturalAspectRatio: 1,
    frameConfig: {
      frameWidth: 64,
      frameHeight: 64,
      totalColumns: 4,
      totalRows: 17,
      totalFrames: 68,
      framesPerState: 4,
      naturalAspectRatio: 1,
      renderScale: { minWidth: 100, maxWidth: 150, minHeight: 100, maxHeight: 150, defaultWidth: 120, defaultHeight: 120 }
    },
    animations: {
      IDLE: { row: 0, frames: [0, 1, 2, 3], fps: 6, loop: true },
      TYPING: { row: 1, frames: [4, 5, 6, 7], fps: 8, loop: true },
      SLEEPING: { row: 2, frames: [8, 9, 10, 11], fps: 3, loop: true },
      WAKING_UP: { row: 3, frames: [12, 13, 14, 15], fps: 6, loop: false },
      HAPPY: { row: 4, frames: [16, 17, 18, 19], fps: 8, loop: true },
      SAD: { row: 5, frames: [20, 21, 22, 23], fps: 4, loop: true },
      YAWNING: { row: 6, frames: [24, 25, 26, 27], fps: 4, loop: true },
      HUNGRY: { row: 7, frames: [28, 29, 30, 31], fps: 5, loop: true },
      EATING: { row: 8, frames: [32, 33, 34, 35], fps: 7, loop: true },
      PETTING: { row: 9, frames: [36, 37, 38, 39], fps: 8, loop: true },
      DANCING: { row: 10, frames: [40, 41, 42, 43], fps: 10, loop: true },
      DRINKING: { row: 11, frames: [44, 45, 46, 47], fps: 6, loop: true },
      EXERCISING: { row: 12, frames: [48, 49, 50, 51], fps: 9, loop: true },
      WAVING: { row: 13, frames: [52, 53, 54, 55], fps: 7, loop: true },
      THANKING: { row: 14, frames: [56, 57, 58, 59], fps: 6, loop: false },
      CELEBRATING: { row: 15, frames: [60, 61, 62, 63], fps: 10, loop: false },
      EVOLVING: { row: 16, frames: [64, 65, 66, 67], fps: 10, loop: false }
    }
  }
];

const SANDBOX_ACTIONS: Array<{
  state: Exclude<AnimationState, 'WALKING'>;
  label: string;
  expGain: number;
  bubble: string;
}> = [
  { state: 'EATING', label: 'Cho ăn (+50 EXP)', expGain: 50, bubble: 'Nhai nhóp nhép ngon quá! Cảm ơn bạn nhé! 🍖' },
  { state: 'DRINKING', label: 'Uống nước (+20 EXP)', expGain: 20, bubble: 'Ực ực... Mát lành sảng khoái quá đi! 💧' },
  { state: 'PETTING', label: 'Vuốt ve (+30 EXP)', expGain: 30, bubble: 'Được xoa đầu thích thật đó, yêu bạn nhất! ❤️' },
  { state: 'TYPING', label: 'Làm việc', expGain: 15, bubble: 'Lạch cạch... Tập trung làm việc năng suất nào! 💻' },
  { state: 'DANCING', label: 'Nhảy múa', expGain: 15, bubble: 'Nhún nhảy theo điệu nhạc Lofi cực chill! 🎵' },
  { state: 'WAVING', label: 'Vẫy tay', expGain: 10, bubble: 'Xin chào! Chúc bạn một ngày tràn đầy năng lượng! 👋' },
  { state: 'EXERCISING', label: 'Tập thể dục', expGain: 20, bubble: 'Một hai một hai! Vươn vai giãn cơ chống mỏi lưng! 🏋️' },
  { state: 'SLEEPING', label: 'Đi ngủ', expGain: 0, bubble: 'Khò khò... Mình chợp mắt nghỉ ngơi một lát nhé... 💤' },
  { state: 'WAKING_UP', label: 'Thức dậy', expGain: 10, bubble: 'Vươn vai tỉnh giấc, sẵn sàng đồng hành tiếp! ☀️' },
  { state: 'HAPPY', label: 'Vui vẻ', expGain: 15, bubble: 'Hôm nay được gặp bạn mình vui lắm luôn! ✨' },
  { state: 'CELEBRATING', label: 'Ăn mừng', expGain: 25, bubble: 'Hoan hô! Chúc mừng thành quả tuyệt vời! 🎉' },
  { state: 'IDLE', label: 'Đứng yên', expGain: 0, bubble: 'Đứng ngoan ngoãn canh bạn làm việc nè! 🐾' }
];

export const GuestLandingView: React.FC<GuestLandingViewProps> = ({
  petTypes,
  onOpenLogin,
  onOpenRegister,
  onStartTour
}) => {
  const availablePets = petTypes.length > 0 ? petTypes.slice(0, 6) : FALLBACK_GUEST_PETS;
  const [selectedPetIdx, setSelectedPetIdx] = useState(0);
  const [roomTheme, setRoomTheme] = useState<'cafe' | 'garden' | 'office' | 'beach' | 'room'>('cafe');
  const [scaleSize, setScaleSize] = useState<'SMALL' | 'MEDIUM' | 'LARGE'>('LARGE');
  const [demoState, setDemoState] = useState<AnimationState>('WAVING');
  const [demoLevel, setDemoLevel] = useState(1);
  const [demoExp, setDemoExp] = useState(80);
  const [demoHunger, setDemoHunger] = useState(85);
  const [demoHappiness, setDemoHappiness] = useState(95);
  const [speechBubble, setSpeechBubble] = useState<string | null>(
    'Xin chào! Hãy bấm thử vào mình hoặc các nút bên phải để trải nghiệm nhé! 🐾'
  );

  const stateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const initTimer = setTimeout(() => {
      setDemoState('IDLE');
    }, 5000);
    return () => {
      clearTimeout(initTimer);
      if (stateTimerRef.current) clearTimeout(stateTimerRef.current);
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    };
  }, []);

  const activePet = availablePets[selectedPetIdx] || FALLBACK_GUEST_PETS[0];
  const nextLevelExp = demoLevel * 200;
  const expPercent = Math.min(100, Math.round((demoExp / nextLevelExp) * 100));
  const isReadyToLevelUp = demoExp >= nextLevelExp;

  const triggerDemoAction = (state: AnimationState, bubbleText: string, expGain = 0) => {
    if (stateTimerRef.current) clearTimeout(stateTimerRef.current);
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);

    setDemoState(state);
    setSpeechBubble(bubbleText);

    if (expGain > 0) {
      setDemoExp(prev => prev + expGain);
    }
    if (state === 'EATING') {
      setDemoHunger(prev => Math.min(100, prev + 15));
    }
    if (state === 'PETTING' || state === 'HAPPY' || state === 'DANCING') {
      setDemoHappiness(prev => Math.min(100, prev + 10));
    }

    bubbleTimerRef.current = setTimeout(() => {
      setSpeechBubble(null);
    }, 4500);

    if (state !== 'IDLE' && state !== 'TYPING' && state !== 'SLEEPING' && state !== 'DANCING') {
      stateTimerRef.current = setTimeout(() => {
        setDemoState('IDLE');
      }, 6000);
    }
  };

  const handleDemoLevelUp = () => {
    if (demoExp < nextLevelExp) {
      triggerDemoAction(
        'HAPPY',
        `Bể chứa đang có ${demoExp}/${nextLevelExp} EXP. Hãy bấm Cho ăn hoặc Vuốt ve thêm để đầy bể nhé! ✨`,
        0
      );
      return;
    }
    setDemoExp(prev => Math.max(0, prev - nextLevelExp));
    setDemoLevel(lvl => lvl + 1);
    triggerDemoAction(
      'EVOLVING',
      `🎉 Tuyệt vời! ${activePet.name} đã tiến hóa lên Cấp ${demoLevel + 1}! Hãy đăng nhập để lưu thú cưng của riêng bạn nhé!`,
      0
    );
  };

  return (
    <div className="space-y-6 pb-8">
      {/* ===================================================================== */}
      {/* 1. HERO WELCOME BANNER & QUICK AUTH CTA (data-tour="tour-hero-cta")    */}
      {/* ===================================================================== */}
      <section
        data-tour="tour-hero-cta"
        className="bg-gradient-to-br from-[#23293a] via-[#2c3448] to-[#3b302a] text-white border-4 border-slate-950 border-b-[6px] border-b-[#b88256] rounded-2xl p-5 sm:p-7 shadow-[6px_6px_0px_#23293a] relative overflow-hidden"
      >
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start gap-5 max-w-2xl">
            {/* Mascot Cat Emblem */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#fffcf7] border-3 border-[#b88256] shadow-[4px_4px_0_#151924] flex items-center justify-center shrink-0 p-1.5">
              <img
                src="/brand/officepet_cat_logo.png"
                alt="OfficePet Mascot"
                className="w-full h-full object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>

            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#b88256]/25 border border-[#d49b6a]/50 text-[#f7d7b5] text-xs font-black tracking-wide">
                <Sparkles size={14} className="text-amber-400" />
                <span>KHÔNG GIAN THÚ CƯNG ẢO CÔNG SỞ & ĐỒNG HÀNH NĂNG SUẤT</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
                Nuôi Thú Cưng <span className="text-amber-400">2D Pixel Art</span> • Tập Trung <span className="text-[#8fc2eb]">Pomodoro</span> • Thư Giãn Cùng <span className="text-[#f498ad]">Lofi & AI</span>
              </h2>

              <p className="text-xs sm:text-sm text-[#e8dfd5] leading-relaxed font-medium">
                Biến mỗi giờ làm việc và học tập thành một hành trình thú vị: chăm sóc thú cưng, tích lũy EXP qua các phiên Pomodoro, điều khiển bằng giọng nói tiếng Việt và giao lưu tại Khu vườn chung cùng đồng nghiệp.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-bold">
                <span className="flex items-center gap-1 text-amber-300">
                  <CheckCircle2 size={14} className="text-amber-400" /> 20+ Loài thú 17 trạng thái
                </span>
                <span className="text-slate-500">•</span>
                <span className="flex items-center gap-1 text-[#8fc2eb]">
                  <CheckCircle2 size={14} className="text-[#5a9bd5]" /> Đồng hồ Pomodoro & Báo thức
                </span>
                <span className="text-slate-500">•</span>
                <span className="flex items-center gap-1 text-[#86d19e]">
                  <CheckCircle2 size={14} className="text-emerald-400" /> Nổi trên màn hình Desktop
                </span>
              </div>
            </div>
          </div>

          {/* Right Auth Action Box */}
          <div className="bg-[#fffcf7] text-slate-900 border-3 border-[#b88256] rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0_#151924] shrink-0 w-full lg:w-[330px] space-y-3">
            <div className="text-xs font-black text-[#7c5233] uppercase tracking-wider flex items-center justify-between">
              <span>🐾 Bắt đầu ngay hôm nay</span>
              <span className="px-2 py-0.5 rounded bg-[#f48fb1]/25 text-[#b83b5e] border border-[#f0788c]/40 text-[10px]">
                Miễn phí 100%
              </span>
            </div>

            <button
              type="button"
              onClick={onOpenLogin}
              className="w-full h-11 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm border-2 border-slate-950 shadow-[0_3px_0_#000] active:translate-y-[2px] active:shadow-none transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn size={16} />
              <span>Đăng nhập vào phòng</span>
            </button>

            <button
              type="button"
              onClick={onOpenRegister}
              className="w-full h-10 rounded-xl bg-[#2e6da4] hover:bg-[#387fc0] text-white font-black text-xs border-2 border-slate-950 shadow-[0_3px_0_#000] active:translate-y-[2px] active:shadow-none transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserPlus size={15} />
              <span>Đăng ký tài khoản mới</span>
            </button>

            <button
              type="button"
              onClick={onStartTour}
              className="w-full h-9 rounded-xl bg-[#f6eee3] hover:bg-[#ede0ce] text-[#5c3d24] font-bold text-xs border-2 border-[#c89b73] transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Compass size={14} className="text-[#a36436]" />
              <span>Xem lại hướng dẫn tân thủ (Tour)</span>
            </button>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 2. INTERACTIVE GUEST SANDBOX ROOM + EXP TANK & ACTIONS                 */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* LEFT COLUMN (7 COLS): LIVE SANDBOX PET ROOM (data-tour="tour-pet-sandbox") */}
        <div data-tour="tour-pet-sandbox" className="lg:col-span-7 flex flex-col gap-3">
          {/* Room & Species Selector Bar */}
          <div className="pixel-box rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-black text-slate-700 text-[11px] uppercase tracking-wider mr-1">
                Phòng thử:
              </span>
              {[
                { id: 'cafe', label: 'Quán Cafe' },
                { id: 'garden', label: 'Vườn Xuân' },
                { id: 'office', label: 'Góc Zen' },
                { id: 'beach', label: 'Bãi Biển' },
                { id: 'room', label: 'Trong Nhà' }
              ].map(theme => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setRoomTheme(theme.id as any)}
                  className={`h-8 px-2.5 rounded-md text-xs font-bold border-2 transition-all cursor-pointer ${
                    roomTheme === theme.id
                      ? 'border-slate-900 bg-amber-400 text-slate-950 font-black shadow-[0_2px_0_#0f172a]'
                      : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {theme.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-slate-100 px-1.5 py-1 rounded-md border-2 border-slate-900">
              {(['SMALL', 'MEDIUM', 'LARGE'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScaleSize(s)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                    scaleSize === s
                      ? 'bg-slate-900 text-amber-300 font-black'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  {s === 'SMALL' ? 'Nhỏ' : s === 'MEDIUM' ? 'Vừa' : 'To'}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Pet Stage */}
          <div className="pixel-box-lg rounded-2xl border-4 border-slate-900 shadow-[5px_5px_0px_#0f172a] relative overflow-hidden flex-1 min-h-[420px] sm:min-h-[480px] flex flex-col items-center justify-end pb-12 select-none">
            {/* Background */}
            <div
              className="absolute inset-0 z-0 bg-cover bg-center pixelated transition-all duration-300"
              style={{
                backgroundImage: `url(${
                  roomTheme === 'cafe'
                    ? '/backgrounds/cafe_cozy.png?v=2'
                    : roomTheme === 'garden'
                    ? '/backgrounds/garden_spring.png'
                    : roomTheme === 'office'
                    ? '/backgrounds/office_zen.png'
                    : roomTheme === 'beach'
                    ? '/backgrounds/beach_sunset.png'
                    : '/backgrounds/room_indoor.png'
                })`
              }}
            />

            {/* Top-Left Status Pill */}
            <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-3 bg-[#2d364c]/95 backdrop-blur-xs border-2 border-slate-950 px-3.5 py-2 rounded-xl text-xs shadow-[3px_3px_0px_#000]">
              <div className="flex items-center gap-1.5 font-black text-amber-300">
                <span className="text-sm tracking-tight">{activePet.name}</span>
                <span className="bg-amber-400 text-slate-950 text-[10px] px-1.5 py-0.5 rounded-xs border border-slate-950 font-mono font-black">
                  Lv.{demoLevel}
                </span>
                <span className="bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 text-[10px] px-1.5 py-0.5 rounded-xs font-bold">
                  Bản dùng thử
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-rose-400 text-[11px]" title={`Vui vẻ: ${demoHappiness}%`}>
                <Heart size={13} className="fill-rose-500 text-rose-500" />
                <div className="w-14 h-2 bg-slate-950 border border-slate-700 overflow-hidden p-[1px]">
                  <div className="bg-rose-500 h-full transition-all duration-300" style={{ width: `${demoHappiness}%` }} />
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-amber-300 text-[11px]" title={`No bụng: ${demoHunger}%`}>
                <Zap size={13} className="fill-amber-400 text-amber-400" />
                <div className="w-14 h-2 bg-slate-950 border border-slate-700 overflow-hidden p-[1px]">
                  <div className="bg-amber-400 h-full transition-all duration-300" style={{ width: `${demoHunger}%` }} />
                </div>
              </div>
            </div>

            {/* Pet Switcher Dock inside Top-Right of Stage */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 bg-[#23293a]/90 border-2 border-slate-950 p-1.5 rounded-xl shadow-[3px_3px_0_#000]">
              {availablePets.slice(0, 5).map((pt, idx) => (
                <button
                  key={pt.id}
                  type="button"
                  onClick={() => {
                    setSelectedPetIdx(idx);
                    triggerDemoAction('WAVING', `Xin chào! Mình là ${pt.name}, rất vui được làm quen với bạn! 🐾`, 10);
                  }}
                  title={`Đổi thử sang: ${pt.name}`}
                  className={`w-9 h-9 rounded-lg border-2 flex items-center justify-center transition cursor-pointer ${
                    idx === selectedPetIdx
                      ? 'bg-amber-400 border-slate-950 scale-105 shadow-[0_2px_0_#000]'
                      : 'bg-[#343e56] border-slate-800 hover:border-amber-400/60 opacity-80 hover:opacity-100'
                  }`}
                >
                  {pt.previewUrl ? (
                    <img
                      src={pt.previewUrl}
                      alt={pt.name}
                      className="w-7 h-7 object-contain"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  ) : (
                    <span className="text-xs">🐾</span>
                  )}
                </button>
              ))}
            </div>

            {/* Center Pet & Speech Bubble */}
            <div className="relative z-10 flex flex-col items-center justify-center">
              {speechBubble && (
                <div className="pixel-speech-bubble mb-4 max-w-sm bg-[#fffcf7] text-slate-950 text-xs sm:text-sm font-bold px-4 py-2.5 rounded-lg relative text-center shadow-[3px_3px_0px_#000]">
                  "{speechBubble}"
                  <div className="w-3 h-3 bg-[#fffcf7] border-r-2 border-b-2 border-slate-900 rotate-45 absolute -bottom-[7px] left-1/2 -translate-x-1/2" />
                </div>
              )}

              <div className="relative cursor-pointer" title="Nhấn vào thú cưng để vuốt ve (+30 EXP)">
                <PixelPetCanvas
                  petType={activePet}
                  currentState={demoState}
                  scaleSize={scaleSize}
                  speechBubble={null}
                  petName={activePet.name}
                  petLevel={demoLevel}
                  hunger={demoHunger}
                  happiness={demoHappiness}
                  showTooltip={false}
                  onPetClick={() =>
                    triggerDemoAction('PETTING', 'Được bạn vuốt ve thích quá đi! (+30 EXP dùng thử) 💕', 30)
                  }
                />
                <div className="w-40 h-4 bg-slate-950/35 rounded-full mx-auto -mt-2" />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (5 COLS): DEMO EXP TANK & INTERACTION GRID (data-tour="tour-exp-actions") */}
        <div data-tour="tour-exp-actions" className="lg:col-span-5 flex flex-col gap-4">
          {/* 1. Demo EXP Tank */}
          <div className="pixel-box rounded-2xl p-4 sm:p-5">
            <div className="flex items-stretch gap-4">
              <div className="flex flex-col items-center shrink-0">
                <div className="w-16 h-2.5 bg-slate-800 border-2 border-b-0 border-slate-950 rounded-t-sm" />
                <div className="relative w-24 h-36 bg-[#1d222e] border-3 border-slate-950 rounded-lg overflow-hidden shadow-inner flex items-end">
                  <div
                    className="w-full bg-gradient-to-t from-amber-600 via-amber-400 to-yellow-300 transition-all duration-500 ease-out relative"
                    style={{ height: `${Math.max(demoExp > 0 ? 8 : 0, expPercent)}%` }}
                  >
                    <div className="w-full h-1.5 bg-yellow-100/90 border-b border-amber-500" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="px-1.5 py-0.5 rounded bg-slate-950/75 text-amber-300 font-mono font-black text-xs border border-amber-400/40">
                      {expPercent}%
                    </span>
                  </div>
                </div>
                <div className="w-20 h-2.5 bg-slate-800 border-2 border-t-0 border-slate-950 rounded-b-sm" />
              </div>

              <div className="flex-1 flex flex-col justify-between py-0.5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                      Bể chứa EXP (Trải nghiệm)
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">
                      Cấp {demoLevel} → {demoLevel + 1}
                    </span>
                  </div>

                  <div className="text-xl font-black text-slate-950 font-mono tracking-tight">
                    {demoExp} <span className="text-sm font-bold text-slate-400">/ {nextLevelExp} EXP</span>
                  </div>

                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    {isReadyToLevelUp
                      ? 'Bể EXP đã đầy! Nhấn nút bên dưới để xem hiệu ứng Tiến hóa cấp mới!'
                      : 'Hãy bấm các nút tương tác bên dưới để nạp đầy bể EXP và thử nâng cấp cho thú cưng!'}
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleDemoLevelUp}
                    className={`w-full h-10 rounded-lg border-2 border-slate-900 font-black text-xs uppercase tracking-wider pixel-btn transition-all cursor-pointer ${
                      isReadyToLevelUp
                        ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-[0_3px_0_#0f172a] animate-pulse'
                        : 'bg-[#2d364c] hover:bg-[#424f6d] text-amber-300 shadow-[0_3px_0_#0f172a]'
                    }`}
                  >
                    {isReadyToLevelUp ? `Tiến hóa lên Cấp ${demoLevel + 1} ✨` : 'Thử Thăng Cấp'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Interactive Actions Grid */}
          <div className="pixel-box rounded-2xl p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between border-b-2 border-slate-200 pb-2 mb-3">
                <h3 className="font-black text-slate-950 text-xs uppercase tracking-wider">
                  Thử Tương Tác & Hoạt Ảnh
                </h3>
                <span className="text-[11px] font-bold text-slate-500">
                  Trạng thái: <strong className="text-amber-700">{demoState}</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SANDBOX_ACTIONS.map(act => {
                  const isActive = demoState === act.state;
                  return (
                    <button
                      key={act.state}
                      type="button"
                      onClick={() => triggerDemoAction(act.state, act.bubble, act.expGain)}
                      className={`h-10 px-2 rounded-lg border-2 border-slate-900 font-bold text-xs text-center truncate transition-all pixel-btn cursor-pointer ${
                        isActive
                          ? 'bg-amber-400 text-slate-950 font-black shadow-none translate-y-[2px]'
                          : 'bg-white hover:bg-amber-100/70 text-slate-800'
                      }`}
                    >
                      {act.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-600 font-semibold">
                Muốn lưu thú cưng và mở khóa toàn bộ 20+ loài thú?
              </span>
              <button
                type="button"
                onClick={onOpenLogin}
                className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs border-2 border-slate-900 shadow-[0_2px_0_#000] whitespace-nowrap cursor-pointer"
              >
                Đăng nhập ngay →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. 6 CORE FEATURE CARDS (data-tour="tour-features")                   */}
      {/* ===================================================================== */}
      <section data-tour="tour-features" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
              Khám Phá Các Khu Vực Chức Năng Chính Của OfficePet
            </h3>
            <p className="text-xs text-slate-600 font-medium">
              Đăng nhập tài khoản để mở khóa trọn vẹn 6 phân hệ năng suất & kết nối dưới đây
            </p>
          </div>

          <button
            type="button"
            onClick={onStartTour}
            className="px-3.5 py-2 rounded-xl bg-[#23293a] hover:bg-[#343e56] text-amber-300 text-xs font-black border-2 border-slate-950 shadow-[2px_2px_0_#000] flex items-center gap-1.5 cursor-pointer"
          >
            <Compass size={14} />
            <span>Chạy lại Hướng dẫn từng khu vực</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: <Timer size={20} className="text-indigo-600" />,
              badge: 'NĂNG SUẤT KHOA HỌC',
              title: 'Đồng Hồ Pomodoro & Báo Thức Thú Cưng',
              desc: 'Chu kỳ chuẩn 25/5, DeskTime 52/17 và Ultradian 90/20. Chế độ Nghiêm túc tự động phát hiện rời tab; chế độ Thư giãn nhắc uống nước, tập thở 4-7-8 và báo thức bằng giọng nói thú cưng.',
              actionLabel: 'Mở khóa Pomodoro'
            },
            {
              icon: <Mic size={20} className="text-amber-600" />,
              badge: 'TRÍ TUỆ NHÂN TẠO',
              title: 'Trợ Lý Giọng Nói "Hello" & Chat AI',
              desc: 'Ra lệnh rảnh tay bằng tiếng Việt ("Hello cho ăn", "mở nhạc Lofi", "hẹn giờ 25 phút") và trò chuyện tâm sự giảm căng thẳng cùng trợ lý AI Companion thông minh.',
              actionLabel: 'Trò chuyện cùng AI'
            },
            {
              icon: <Music size={20} className="text-violet-600" />,
              badge: 'ÂM NHẠC THƯ GIÃN',
              title: 'Đài Nhạc Lofi & YouTube Mini-TV',
              desc: 'Tìm kiếm và phát nhạc Lofi, Baroque, Piano hoặc video YouTube yêu thích. Thú cưng sẽ tự động đứng dậy nhún nhảy theo giai điệu bài hát đang phát.',
              actionLabel: 'Bật đài nhạc Lofi'
            },
            {
              icon: <TreePine size={20} className="text-emerald-600" />,
              badge: 'KẾT NỐI ĐỘI NHÓM',
              title: 'Khu Vườn Chung Phòng Ban & Xếp Hạng',
              desc: 'Tham gia phòng ban bằng mã mời, ngắm thú cưng của đồng nghiệp dạo chơi thời gian thực, thả tim phòng HOT, tặng quà, kết bạn và đua Top EXP hàng tuần.',
              actionLabel: 'Vào Khu vườn chung'
            },
            {
              icon: <ShoppingBag size={20} className="text-rose-600" />,
              badge: 'CỬA HÀNG & NHIỆM VỤ',
              title: 'Cửa Hàng Vật Phẩm & Nhiệm Vụ Ngày',
              desc: 'Hoàn thành nhiệm vụ hàng ngày để nhận thưởng EXP, mua thức ăn, mũ nón, kính mát, trang phục hiếm và mở khóa các bối cảnh khu vườn Pixel độc đáo.',
              actionLabel: 'Khám phá Cửa hàng'
            },
            {
              icon: <Monitor size={20} className="text-sky-600" />,
              badge: 'ĐA NỀN TẢNG WEB & DESKTOP',
              title: 'Chế Độ Nổi Màn Hình Desktop (Overlay)',
              desc: 'Đưa thú cưng nổi lơ lửng bên ngoài trình duyệt (Picture-in-Picture hoặc ứng dụng Electron trong suốt) đè lên VSCode, Word với phím tắt toàn cục Ctrl + Shift + P.',
              actionLabel: 'Trải nghiệm ngay'
            }
          ].map((feat, idx) => (
            <div
              key={idx}
              className="pixel-box rounded-2xl p-5 flex flex-col justify-between gap-4 hover:-translate-y-0.5 transition-transform"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 border-2 border-slate-900 flex items-center justify-center shadow-[2px_2px_0_#0f172a]">
                    {feat.icon}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-slate-900 text-amber-300">
                    {feat.badge}
                  </span>
                </div>

                <h4 className="text-sm font-black text-slate-950 leading-snug">{feat.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">{feat.desc}</p>
              </div>

              <button
                type="button"
                onClick={onOpenLogin}
                className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-amber-400 text-slate-900 font-black text-xs border-2 border-slate-900 transition flex items-center justify-between cursor-pointer"
              >
                <span>{feat.actionLabel}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
