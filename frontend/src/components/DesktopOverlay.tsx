import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../services/api';
import { PixelPetCanvas } from './PixelPetCanvas';
import { AnimationState, LofiTrack, MusicRequest, UserPet } from '../types';
import { AICompanionChat } from './AICompanionChat';
import { MusicPlayer } from './MusicPlayer';
import { PomodoroTimer } from './PomodoroTimer';
import { VoiceAssistant } from './VoiceAssistant';
import { playTtsSpeech } from '../utils/tts';
import {
  Utensils,
  Heart,
  MessageSquare,
  Timer,
  Music,
  Mic,
  Coffee,
  Sparkles,
  X,
  Minimize2,
  Move,
  ExternalLink,
  HelpCircle,
  Monitor,
  Compass,
  Pin,
  Award,
  Activity,
  Moon,
  Smile,
  Trophy
} from 'lucide-react';

interface DesktopOverlayProps {
  pet: UserPet;
  onFeed: () => void;
  onStroke: () => void;
  onCloseOverlay: () => void;
  onDrink?: () => void;
  onLevelUp?: () => void;
  onPetStateChange?: (state: AnimationState) => void;
  onModeChange?: (mode: 'STRICT' | 'RELAXED') => void;
  onSessionFinish?: (expAward: number) => void;
  onTrackSelect?: (track: LofiTrack) => void;
  onPetInteraction?: (state: AnimationState, message: string) => void;
  onPanelVisibilityChange?: (panel: 'menu' | 'chat' | 'pomodoro' | 'music' | 'voice' | null) => void;
  onOpenQuests?: () => void;
  speechBubble?: string | null;
  isDesktopWindow?: boolean;
  petSide?: 'left' | 'right';
}

export const DesktopOverlay: React.FC<DesktopOverlayProps> = ({
  pet,
  onFeed,
  onStroke,
  onCloseOverlay,
  onDrink,
  onLevelUp,
  onPetStateChange,
  onModeChange,
  onSessionFinish,
  onTrackSelect,
  onPetInteraction,
  onPanelVisibilityChange,
  onOpenQuests,
  speechBubble,
  isDesktopWindow = false,
  petSide = 'right'
}) => {
  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [activePanel, setActivePanel] = useState<'chat' | 'pomodoro' | 'music' | 'voice' | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [isRoaming, setIsRoaming] = useState(true);
  const [isWalking, setIsWalking] = useState(false);
  const [facingDirection, setFacingDirection] = useState<'left' | 'right'>('right');
  const [isHovered, setIsHovered] = useState(false);
  const [showControlBar, setShowControlBar] = useState(false);
  const [musicRequest, setMusicRequest] = useState<MusicRequest>();

  const controlBarRef = useRef<HTMLDivElement>(null);
  const quickMenuRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const petWrapperRef = useRef<HTMLDivElement>(null);
  const browserControlBarRef = useRef<HTMLDivElement>(null);

  // 1. Listen to Electron Walk State (Desktop window mode)
  useEffect(() => {
    if (!isDesktopWindow) return;
    const bridge = window.officePet;
    if (!bridge?.onWalkState) return;

    return bridge.onWalkState(({ isWalking: walking, direction }) => {
      setIsWalking(walking);
      if (typeof direction === 'number') {
        setFacingDirection(direction > 0 ? 'right' : 'left');
      }
    });
  }, [isDesktopWindow]);

  // 2. Autonomous Roaming loop for Electron Desktop Window
  useEffect(() => {
    if (!isDesktopWindow || !isRoaming || activePanel || showGuide || isHovered) return;

    let roamTimer: ReturnType<typeof setTimeout>;
    let disposed = false;

    const scheduleRoam = () => {
      roamTimer = setTimeout(() => {
        if (disposed || !isRoaming || activePanel || showGuide || isHovered) return;
        const screenW = window.screen?.availWidth || 1920;
        // Target a random spot across the bottom of the user's screen
        const targetX = Math.round(50 + Math.random() * (screenW - 350));
        window.officePet?.walkTo(targetX);
        scheduleRoam();
      }, 10000 + Math.random() * 12000); // Takes a stroll every 10-22 seconds
    };

    scheduleRoam();

    return () => {
      disposed = true;
      clearTimeout(roamTimer);
    };
  }, [isDesktopWindow, isRoaming, activePanel, showGuide, isHovered]);

  // 3. Autonomous Movement for Browser Web Dashboard mode
  useEffect(() => {
    if (isDesktopWindow || !isRoaming) return;
    let timeout: ReturnType<typeof setTimeout>;
    let stopWalkingTimer: ReturnType<typeof setTimeout>;

    const movePet = () => {
      timeout = setTimeout(() => {
        if (!isDragging && !activePanel) {
          const newPos = 8 + Math.round(Math.random() * 84);
          setFacingDirection(newPos > position ? 'right' : 'left');
          setIsWalking(true);
          setPosition(newPos);
          stopWalkingTimer = setTimeout(() => {
            setIsWalking(false);
          }, 2600);
        }
        movePet();
      }, 8000 + Math.random() * 9000);
    };
    movePet();

    return () => {
      clearTimeout(timeout);
      clearTimeout(stopWalkingTimer);
    };
  }, [isDragging, activePanel, isDesktopWindow, isRoaming, position]);

  useEffect(() => {
    onPanelVisibilityChange?.(activePanel || (showQuickMenu || showGuide ? 'menu' : null));
  }, [activePanel, showQuickMenu, showGuide, onPanelVisibilityChange]);

  useEffect(() => {
    if (!showControlBar || activePanel || showQuickMenu || showGuide) return;
    const timer = setTimeout(() => {
      setShowControlBar(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, [showControlBar, activePanel, showQuickMenu, showGuide]);

  // Click outside and window blur to auto-dismiss control bar, quick menu, and guide
  useEffect(() => {
    if (!showControlBar && !showQuickMenu && !showGuide) return;

    const handlePointerDown = (e: MouseEvent | PointerEvent) => {
      const target = e.target as Node;
      if (
        controlBarRef.current?.contains(target) ||
        quickMenuRef.current?.contains(target) ||
        guideRef.current?.contains(target) ||
        petWrapperRef.current?.contains(target) ||
        browserControlBarRef.current?.contains(target)
      ) {
        return;
      }
      setShowControlBar(false);
      setShowQuickMenu(false);
      setShowGuide(false);
    };

    const handleWindowBlur = () => {
      if (!activePanel) {
        setShowControlBar(false);
        setShowQuickMenu(false);
        setShowGuide(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [showControlBar, showQuickMenu, showGuide, activePanel]);

  const handlePetClick = () => {
    setShowControlBar(prev => !prev);
  };

  const setPanel = (panel: 'chat' | 'pomodoro' | 'music' | 'voice' | null) => {
    setActivePanel(panel);
    setShowQuickMenu(false);
  };

  const openMusicFromChat = (query: string, autoPlay: boolean) => {
    const request = { query, autoPlay, requestId: Date.now() };
    setMusicRequest(request);
    setPanel('music');
  };

  const interaction = (state: AnimationState, message: string) => {
    onPetInteraction?.(state, message);
    setShowQuickMenu(false);
  };

  const handleFeedAction = () => {
    if (pet.dailyInteractionsLeft > 0) {
      onFeed();
    } else {
      interaction('EATING', 'Bé cưng đang măm măm bữa ăn ngon lành nè! 🍱');
    }
    void playTtsSpeech('Măm măm ngon quá, cảm ơn đại ca!');
    setShowQuickMenu(false);
  };

  const handleDrinkAction = async () => {
    interaction('DRINKING', 'Cùng nghỉ uống nước một chút nhé! 💧 (+20 EXP)');
    void playTtsSpeech('Nước mát quá, cảm ơn đại ca!');
    try {
      if (onDrink) {
        onDrink();
      } else {
        await api.drinkPet();
      }
    } catch (err) {
      console.warn('Drink action API call failed:', err);
    }
    setShowQuickMenu(false);
  };

  const handleLevelUpAction = async () => {
    interaction('EVOLVING', 'Bé cưng đang thăng cấp nè! ✨');
    void playTtsSpeech('Bé cưng đã lên cấp rồi đại ca ơi!');
    try {
      if (onLevelUp) {
        onLevelUp();
      } else {
        await api.levelUpPet();
      }
    } catch (err) {
      console.warn('Level up API call failed:', err);
    }
    setShowQuickMenu(false);
  };

  const quickMenu = (
    <div
      ref={quickMenuRef}
      className="electron-overlay-no-drag grid grid-cols-2 gap-2 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xl font-sans"
    >
      <div className="col-span-2 flex items-center justify-between border-b border-slate-100 pb-2">
        <span className="font-bold text-[11px] text-slate-800 uppercase tracking-wide">BẠN MUỐN LÀM GÌ?</span>
        <button type="button" onClick={() => setShowQuickMenu(false)} className="rounded-lg p-1 hover:bg-slate-100 text-slate-500" aria-label="Đóng menu">
          <X size={14} />
        </button>
      </div>

      {/* Voice Assistant - Prominent top action */}
      <button
        type="button"
        onClick={() => setPanel('voice')}
        className="col-span-2 flex min-h-10 items-center justify-between rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 px-3 py-2 text-left text-xs font-black text-slate-950 shadow-md hover:brightness-105 transition"
      >
        <span className="flex items-center gap-2">
          <Mic size={16} className="text-slate-950 animate-pulse" />
          <span>Trợ lý giọng nói "HEY ANY"</span>
        </span>
        <span className="text-[10px] font-bold bg-slate-950/20 px-2 py-0.5 rounded-full">Nói & Nghe</span>
      </button>

      <button type="button" onClick={() => setPanel('chat')} className="flex min-h-10 items-center gap-2 rounded-xl bg-[#231e36] px-3 py-2 text-left text-xs font-semibold text-white hover:bg-[#332b4f] shadow-xs transition">
        <MessageSquare size={15} className="text-amber-400" /> Trò chuyện với bé
      </button>
      <button type="button" onClick={() => setPanel('pomodoro')} className="flex min-h-10 items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-left text-xs font-semibold text-white hover:bg-indigo-700 shadow-xs transition">
        <Timer size={15} /> Mở Pomodoro
      </button>
      <button type="button" onClick={() => setPanel('music')} className="flex min-h-10 items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-left text-xs font-semibold text-white hover:bg-violet-700 shadow-xs transition">
        <Music size={15} /> Mở nhạc Lofi
      </button>
      <button
        type="button"
        onClick={() => {
          onOpenQuests?.();
          setShowQuickMenu(false);
        }}
        className="flex min-h-10 items-center gap-2 rounded-xl bg-amber-400 px-3 py-2 text-left text-xs font-bold text-slate-950 hover:bg-amber-500 shadow-xs transition"
      >
        <Award size={15} /> Nhiệm vụ & Thưởng
      </button>

      {/* Quick Interactive Actions */}
      <div className="col-span-2 pt-1 border-t border-slate-100 text-[10px] font-bold text-slate-400 uppercase">
        Tương tác & Hoạt ảnh
      </div>
      <button type="button" onClick={handleFeedAction} className="flex min-h-9 items-center gap-1.5 rounded-xl bg-amber-500 px-2.5 py-1.5 text-left text-xs font-semibold text-white hover:bg-amber-600 shadow-xs transition">
        <Utensils size={14} /> Cho ăn
      </button>
      <button type="button" onClick={handleDrinkAction} className="flex min-h-9 items-center gap-1.5 rounded-xl bg-cyan-600 px-2.5 py-1.5 text-left text-xs font-semibold text-white hover:bg-cyan-700 shadow-xs transition">
        <Coffee size={14} /> Uống nước
      </button>
      <button type="button" disabled={pet.dailyInteractionsLeft <= 0} onClick={() => { onStroke(); void playTtsSpeech('Hihi thích quá, cảm ơn đại ca!'); setShowQuickMenu(false); }} className="flex min-h-9 items-center gap-1.5 rounded-xl bg-rose-500 px-2.5 py-1.5 text-left text-xs font-semibold text-white hover:bg-rose-600 shadow-xs transition disabled:opacity-50">
        <Heart size={14} /> Vuốt ve (+30 EXP)
      </button>
      <button type="button" onClick={() => interaction('DANCING', 'Chơi với bạn vui quá, mình nhảy múa vận động nhé! 🎵')} className="flex min-h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-left text-xs font-semibold text-white hover:bg-emerald-700 shadow-xs transition">
        <Sparkles size={14} /> Nhảy múa / Thể dục
      </button>
      <button type="button" onClick={() => interaction('WAVING', 'Bé cưng vẫy tay chào bạn nè! Chúc ngày mới tốt lành! 👋')} className="flex min-h-9 items-center gap-1.5 rounded-xl bg-amber-600 px-2.5 py-1.5 text-left text-xs font-semibold text-white hover:bg-amber-700 shadow-xs transition">
        <Smile size={14} /> Vẫy tay chào
      </button>
      <button type="button" onClick={() => interaction('SLEEPING', 'Khò khò... Cho bé cưng chợp mắt nghỉ ngơi tí nhé... Zzz 💤')} className="flex min-h-9 items-center gap-1.5 rounded-xl bg-slate-600 px-2.5 py-1.5 text-left text-xs font-semibold text-white hover:bg-slate-700 shadow-xs transition">
        <Moon size={14} /> Đi ngủ
      </button>
      <button type="button" onClick={() => interaction('HAPPY', 'Hoan hô! Bạn làm việc xuất sắc lắm, chúc mừng bạn! 🎉')} className="flex min-h-9 items-center gap-1.5 rounded-xl bg-purple-600 px-2.5 py-1.5 text-left text-xs font-semibold text-white hover:bg-purple-700 shadow-xs transition">
        <Trophy size={14} /> Ăn mừng vui vẻ
      </button>
    </div>
  );

  const handleOpenPiP = async () => {
    if ('documentPictureInPicture' in window) {
      try {
        const pipWindow = await (window as any).documentPictureInPicture.requestWindow({
          width: 280,
          height: 320
        });

        Array.from(document.styleSheets).forEach((sheet) => {
          try {
            if (sheet.href) {
              const link = document.createElement('link');
              link.rel = 'stylesheet';
              link.href = sheet.href;
              pipWindow.document.head.appendChild(link);
            } else if (sheet.cssRules) {
              const style = document.createElement('style');
              Array.from(sheet.cssRules).forEach((rule) => {
                style.appendChild(document.createTextNode(rule.cssText));
              });
              pipWindow.document.head.appendChild(style);
            }
          } catch {}
        });

        const pipDiv = pipWindow.document.createElement('div');
        pipDiv.style.cssText =
          'width: 100vw; height: 100vh; display: flex; flex-direction: column; justify-content: space-between; align-items: center; background: #181528; color: #fff; overflow: hidden; padding: 10px; box-sizing: border-box; font-family: monospace, sans-serif;';
        pipWindow.document.body.appendChild(pipDiv);
        pipWindow.document.body.style.margin = '0';
        pipWindow.document.body.style.overflow = 'hidden';
        pipWindow.document.body.style.background = '#181528';

        const root = createRoot(pipDiv);
        root.render(
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%', justifyContent: 'space-between', userSelect: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 4px', fontSize: '11px', fontWeight: 'bold' }}>
              <span style={{ color: '#fbbf24' }}>🐾 {pet.name}</span>
              <span style={{ background: '#25203d', padding: '2px 8px', borderRadius: '12px', border: '1px solid #3e3860', color: '#a5b4fc', fontSize: '10px' }}>
                Lv.{pet.level}
              </span>
            </div>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PixelPetCanvas
                petType={pet.petType}
                currentState={pet.currentState}
                scaleSize="SMALL"
                speechBubble={speechBubble}
                onPetClick={onStroke}
                petName={pet.name}
                petLevel={pet.level}
                hunger={pet.hunger}
                happiness={pet.happiness}
                equippedItems={pet.userItems}
                showTooltip={false}
              />
            </div>

            <div style={{ display: 'flex', gap: '6px', width: '100%', justifyContent: 'center', paddingBottom: '4px' }}>
              <button
                type="button"
                onClick={handleFeedAction}
                style={{ flex: 1, padding: '5px 0', background: '#d97706', color: '#fff', border: '2px solid #000', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                🍖 Cho ăn
              </button>
              <button
                type="button"
                onClick={handleDrinkAction}
                style={{ flex: 1, padding: '5px 0', background: '#0284c7', color: '#fff', border: '2px solid #000', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                💧 Uống nước
              </button>
              <button
                type="button"
                onClick={onStroke}
                style={{ flex: 1, padding: '5px 0', background: '#db2777', color: '#fff', border: '2px solid #000', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                💖 Vuốt ve
              </button>
            </div>
          </div>
        );

        pipWindow.addEventListener('pagehide', () => {
          root.unmount();
        });
      } catch (err: any) {
        console.warn('PiP error:', err);
      }
    } else {
      alert('📌 Để thú cưng nổi lơ lửng ngoài màn hình Desktop (đè lên mọi ứng dụng & trang web khác), bạn hãy khởi chạy chế độ Desktop bằng lệnh: npm run desktop trong thư mục frontend!');
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isDesktopWindow) return;
    setIsDragging(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || isDesktopWindow) return;
    setPosition(Math.max(8, Math.min(92, (e.clientX / window.innerWidth) * 100)));
  };

  const handleMouseUp = () => {
    if (!isDesktopWindow) setIsDragging(false);
  };

  const guideCard = (
    <div
      ref={guideRef}
      className="electron-overlay-no-drag absolute inset-1 bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xl z-[80] flex flex-col justify-between text-slate-800 animate-in fade-in zoom-in-95 font-sans"
    >
      <div>
        <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
          <span className="font-bold text-[10px] text-amber-500 uppercase tracking-wide flex items-center gap-1">
            📖 HƯỚNG DẪN THAO TÁC
          </span>
          <button
            type="button"
            onClick={() => setShowGuide(false)}
            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg"
            title="Đóng"
          >
            <X size={14} />
          </button>
        </div>
        <div className="space-y-1.5 text-[10px] leading-tight">
          <div className="flex items-start gap-1.5">
            <span className="bg-[#231e36] text-white px-2 py-0.5 rounded-md text-[8.5px] font-bold whitespace-nowrap">Ctrl+Shift+P</span>
            <span>Ẩn / Hiện thú cưng tức thì mọi lúc.</span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-md text-[8.5px] font-bold whitespace-nowrap">🧭 Đi dạo</span>
            <span>Bé cưng tự động đi dạo quanh màn hình (bấm 📌 để ghim đứng yên).</span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="bg-slate-800 text-white px-2 py-0.5 rounded-md text-[8.5px] font-bold whitespace-nowrap">Kéo chuột ✥</span>
            <span>Giữ thanh trên để kéo pet đến bất kỳ vị trí nào.</span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="bg-rose-500 text-white px-2 py-0.5 rounded-md text-[8.5px] font-bold whitespace-nowrap">Nhấp Bé Cưng</span>
            <span>Vuốt ve (+30 EXP & Hạnh phúc ❤️).</span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-md text-[8.5px] font-bold whitespace-nowrap">Menu ✨</span>
            <span>Cho ăn 🍱 (+50 EXP), Chat AI 💬, Pomodoro ⏱️.</span>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setShowGuide(false)}
        className="w-full mt-2 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none font-bold text-[10px] rounded-xl shadow-xs transition active:scale-95"
      >
        Đã hiểu ✓
      </button>
    </div>
  );

  const activeAnimationState = isWalking ? 'WALKING' : pet.currentState;
  const hasExpandedLayout = Boolean(activePanel || showQuickMenu || showGuide);

  // -------------------------------------------------------------
  // ELECTRON DESKTOP WINDOW LAYOUT (Compact 280x260 floating widget)
  // -------------------------------------------------------------
  if (isDesktopWindow) {
    const isMusicPanel = activePanel === 'music';
    const renderPet = (
      <PixelPetCanvas
        petType={pet.petType}
        currentState={activeAnimationState}
        scaleSize={pet.scaleSize || 'MEDIUM'}
        speechBubble={speechBubble}
        onPetClick={handlePetClick}
        petName={pet.name}
        petLevel={pet.level}
        hunger={pet.hunger}
        happiness={pet.happiness}
        equippedItems={pet.userItems}
        showTooltip={false}
        facingDirection={facingDirection}
      />
    );

    return (
      <div
        className="relative flex h-full w-full min-w-0 flex-col select-none p-1.5"
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) {
            setShowControlBar(false);
            setShowQuickMenu(false);
            setShowGuide(false);
          }
        }}
      >
        {(showControlBar || hasExpandedLayout) && (
          <div
            ref={controlBarRef}
            className="flex shrink-0 justify-center transition-all duration-200 animate-fade-in"
          >
            <div className="electron-overlay-drag inline-flex items-center gap-1.5 bg-slate-900/95 backdrop-blur-sm text-white px-3 py-1 rounded-full border border-slate-700/80 shadow-md mb-1 max-w-[260px] whitespace-nowrap">
              <div className="flex items-center gap-1 cursor-move select-none">
                <Move size={11} className="text-amber-400" />
                <span className="font-bold text-[10px] text-white tracking-wide truncate max-w-[110px]">🐾 {pet.name} (Lv.{pet.level})</span>
              </div>
              <div className="h-3 w-px bg-white/20 mx-0.5" />
              <div className="flex items-center gap-0.5 electron-overlay-no-drag">
                {/* Roam / Pin Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    const next = !isRoaming;
                    setIsRoaming(next);
                    if (!next) window.officePet?.stopWalking();
                  }}
                  className={`p-1 rounded transition-colors ${
                    isRoaming ? 'text-emerald-400 hover:bg-white/20' : 'text-amber-400 hover:bg-white/20'
                  }`}
                  title={isRoaming ? 'Bé cưng đang đi dạo (Nhấp để Ghim đứng yên)' : 'Đang ghim vị trí (Nhấp để Cho bé đi dạo)'}
                >
                  {isRoaming ? <Compass size={13} /> : <Pin size={13} />}
                </button>
                {/* Voice Assistant Toggle */}
                <button
                  type="button"
                  onClick={() => setPanel(activePanel === 'voice' ? null : 'voice')}
                  className={`p-1 rounded transition-colors ${
                    activePanel === 'voice'
                      ? 'bg-amber-400 text-slate-950 font-bold'
                      : 'text-white/80 hover:bg-white/20 hover:text-amber-400'
                  }`}
                  title="Trợ lý giọng nói 'HEY ANY'"
                >
                  <Mic size={13} className={activePanel === 'voice' ? 'animate-pulse' : ''} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowGuide(!showGuide)}
                  className="p-1 rounded hover:bg-white/20 hover:text-amber-300 text-white/80 transition-colors"
                  title="Hướng dẫn & Phím tắt (Ctrl+Shift+P)"
                >
                  <HelpCircle size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickMenu(!showQuickMenu)}
                  className="p-1 rounded hover:bg-white/20 hover:text-amber-400 text-white/80 transition-colors"
                  title="Menu tương tác nhanh"
                >
                  <Sparkles size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => window.officePet?.showDashboard()}
                  className="p-1 rounded hover:bg-white/20 hover:text-amber-400 text-white/80 transition-colors"
                  title="Mở Bảng điều khiển chính"
                >
                  <Monitor size={13} />
                </button>
                <button
                  type="button"
                  onClick={onCloseOverlay}
                  className="p-1 rounded hover:bg-red-500/80 text-white/80 hover:text-white transition-colors"
                  title="Ẩn thú cưng (Ctrl+Shift+P)"
                >
                  <Minimize2 size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowControlBar(false)}
                  className="p-1 rounded hover:bg-white/20 text-white/60 hover:text-white transition-colors"
                  title="Đóng thanh điều khiển"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={`relative flex min-h-0 ${hasExpandedLayout ? 'flex-1 items-end gap-2' : 'flex-1 items-center justify-center'}`}>
          {hasExpandedLayout && petSide === 'left' && (
            <aside className="relative z-20 flex w-[160px] shrink-0 items-end justify-center pb-1">
              {renderPet}
            </aside>
          )}

          <section className={`electron-overlay-no-drag z-[60] flex min-w-0 flex-col rounded-2xl shadow-xl font-sans ${
            activePanel === 'voice'
              ? 'border-2 border-slate-950 bg-[#181528] p-0 text-white shadow-[4px_4px_0_#000]'
              : 'border border-slate-200/90 bg-white p-3.5'
          } ${
            hasExpandedLayout
              ? `relative my-1 min-h-0 shrink-0 ${isMusicPanel ? 'h-[480px] w-[380px]' : activePanel === 'voice' ? 'h-[360px] w-[340px]' : 'h-[400px] w-[360px]'}`
              : 'pointer-events-none absolute left-[-10000px] top-0 h-[480px] w-[380px] opacity-0'
          }`}>
            {activePanel && (
              activePanel !== 'chat' && activePanel !== 'voice' && (
                <header className="mb-2 flex shrink-0 items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-xs text-slate-800 uppercase tracking-wide">
                    {activePanel === 'pomodoro' ? 'POMODORO' : 'NGHE NHẠC'}
                  </span>
                  <button type="button" onClick={() => setPanel(null)} className="rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 p-1" aria-label="Đóng bảng điều khiển" title="Đóng bảng điều khiển">
                    <X size={14} />
                  </button>
                </header>
              )
            )}
            <div className="relative min-h-0 flex-1">
              {activePanel === 'chat' && (
                <AICompanionChat
                  pet={pet}
                  onPetStateChange={onPetStateChange}
                  compact
                  onClose={() => setPanel(null)}
                  onMusicRequest={openMusicFromChat}
                />
              )}
              {activePanel === 'voice' && (
                <div className="h-full w-full overflow-hidden">
                  <VoiceAssistant
                    embedded={true}
                    autoStart={true}
                    petName={pet.name}
                    onFeed={handleFeedAction}
                    onDrink={handleDrinkAction}
                    onStroke={onStroke}
                    onLevelUp={handleLevelUpAction}
                    onAction={interaction}
                    onSpeechBubble={text => interaction(pet.currentState, text)}
                    onNavigate={tab => {
                      if (tab === 'FOCUS') setPanel('pomodoro');
                      else if (tab === 'MUSIC') setPanel('music');
                      else if (tab === 'AI_CHAT') setPanel('chat');
                      else {
                        window.officePet?.showDashboard();
                        if (tab === 'QUESTS') onOpenQuests?.();
                        setPanel(null);
                      }
                    }}
                    onPlayMusic={openMusicFromChat}
                    onStopMusic={() => setPanel(null)}
                    onStartTimer={() => setPanel('pomodoro')}
                    onClosePanel={() => setPanel(null)}
                  />
                </div>
              )}
              {activePanel === 'pomodoro' && (
                <div className="h-full overflow-y-auto">
                  <PomodoroTimer
                    currentMode={pet.currentMode}
                    onModeChange={mode => onModeChange?.(mode)}
                    onPetStateChange={onPetStateChange}
                    onSessionFinish={exp => onSessionFinish?.(exp)}
                  />
                </div>
              )}
              <div className={activePanel === 'music'
                ? 'absolute inset-0'
                : 'pointer-events-none absolute left-[-10000px] top-0 h-[480px] w-[400px] opacity-0'}>
                <MusicPlayer onTrackSelect={onTrackSelect} fillPanel compact request={musicRequest} historyScope={pet.id} />
              </div>
              {!activePanel && showQuickMenu && quickMenu}
              {!activePanel && showGuide && guideCard}
            </div>
            {activePanel === 'chat' && (
              <div aria-hidden="true" className={`absolute bottom-8 z-10 h-0 w-0 ${
                petSide === 'left'
                  ? 'left-[-9px] border-y-[9px] border-y-transparent border-r-[9px] border-r-slate-200 after:absolute after:left-[2px] after:top-[-6px] after:h-0 after:w-0 after:border-y-[6px] after:border-y-transparent after:border-r-[6px] after:border-r-white after:content-[""]'
                  : 'right-[-9px] border-y-[9px] border-y-transparent border-l-[9px] border-l-slate-200 after:absolute after:right-[2px] after:top-[-6px] after:h-0 after:w-0 after:border-y-[6px] after:border-y-transparent after:border-l-[6px] after:border-l-white after:content-[""]'
              }`} />
            )}
          </section>

          {hasExpandedLayout && petSide === 'right' && (
            <aside className="relative z-20 flex w-[160px] shrink-0 items-end justify-center pb-1">
              {renderPet}
            </aside>
          )}

          {!hasExpandedLayout && (
            <div
              ref={petWrapperRef}
              className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-center"
              onMouseEnter={() => {
                setIsHovered(true);
                window.officePet?.stopWalking();
              }}
              onMouseLeave={() => setIsHovered(false)}
            >
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handlePetClick();
                }}
                className="cursor-pointer transition-transform hover:scale-105 active:scale-95"
                title="Nhấp chuột để mở thanh điều khiển / vuốt ve bé cưng (+30 EXP)"
              >
                {renderPet}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // BROWSER / WEB DASHBOARD OVERLAY LAYOUT
  // -------------------------------------------------------------
  return (
    <>
      <div
        className={`electron-overlay-no-drag fixed bottom-[180px] z-[60] flex max-h-[calc(100vh-200px)] w-[380px] max-w-[calc(100vw-24px)] flex-col overflow-y-auto rounded-2xl shadow-xl font-sans ${
          activePanel === 'voice'
            ? 'border-2 border-slate-950 bg-[#181528] p-0 text-white shadow-[5px_5px_0_#000]'
            : 'border border-slate-200/90 bg-white p-3.5'
        } ${activePanel ? '' : 'pointer-events-none opacity-0'}`}
        style={{
          left: `max(min(210px, 50vw), min(calc(100vw - min(210px, 50vw)), ${position}%))`,
          transform: 'translateX(-50%)',
          ...(activePanel ? { height: activePanel === 'chat' ? 'min(440px, calc(100vh - 200px))' : activePanel === 'voice' ? 'min(380px, calc(100vh - 200px))' : 'min(520px, calc(100vh - 200px))' } : {})
        }}
      >
          {activePanel && activePanel !== 'voice' && (
          <header className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="font-bold text-xs text-slate-800 uppercase tracking-wide">
              {activePanel === 'chat' ? 'TRÒ CHUYỆN' : activePanel === 'pomodoro' ? 'POMODORO' : 'NGHE NHẠC'}
            </span>
            <button type="button" onClick={() => setPanel(null)} className="rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 p-1" aria-label="Đóng bảng điều khiển" title="Đóng bảng điều khiển">
              <X size={14} />
            </button>
          </header>
          )}
          {activePanel === 'voice' && (
            <div className="min-h-0 flex-1">
              <VoiceAssistant
                embedded={true}
                autoStart={true}
                petName={pet.name}
                onFeed={handleFeedAction}
                onDrink={handleDrinkAction}
                onStroke={onStroke}
                onLevelUp={handleLevelUpAction}
                onAction={interaction}
                onSpeechBubble={text => interaction(pet.currentState, text)}
                onNavigate={tab => {
                  if (tab === 'FOCUS') setPanel('pomodoro');
                  else if (tab === 'MUSIC') setPanel('music');
                  else if (tab === 'AI_CHAT') setPanel('chat');
                  else {
                    if (tab === 'QUESTS') onOpenQuests?.();
                    setPanel(null);
                  }
                }}
                onPlayMusic={openMusicFromChat}
                onStopMusic={() => setPanel(null)}
                onStartTimer={() => setPanel('pomodoro')}
                onClosePanel={() => setPanel(null)}
              />
            </div>
          )}
          {activePanel === 'chat' && (
            <div className="min-h-0 flex-1">
            <AICompanionChat
              pet={pet}
              onPetStateChange={onPetStateChange}
              compact
              onClose={() => setPanel(null)}
              onMusicRequest={openMusicFromChat}
            />
            </div>
          )}
          {activePanel === 'pomodoro' && (
            <PomodoroTimer
              currentMode={pet.currentMode}
              onModeChange={mode => onModeChange?.(mode)}
              onPetStateChange={onPetStateChange}
              onSessionFinish={exp => onSessionFinish?.(exp)}
            />
          )}
          <div className={activePanel === 'music' ? 'min-h-0 flex-1' : 'pointer-events-none absolute left-[-10000px] top-0 h-[520px] w-[380px] opacity-0'}>
            <MusicPlayer onTrackSelect={onTrackSelect} fillPanel compact request={musicRequest} historyScope={pet.id} />
          </div>
      </div>

      {showQuickMenu && (
        <div
          className="electron-overlay-no-drag fixed bottom-[180px] z-[60] w-[360px] max-w-[calc(100vw-24px)]"
          style={{ left: `max(min(180px, 50vw), min(calc(100vw - min(180px, 50vw)), ${position}%))`, transform: 'translateX(-50%)' }}
        >
          {quickMenu}
        </div>
      )}

      {showGuide && (
        <div
          className="fixed bottom-[180px] z-[70] w-72"
          style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        >
          {guideCard}
        </div>
      )}

      <div
        className="fixed bottom-3 z-50 select-none group"
        style={{
          left: `${position}%`,
          transform: 'translateX(-50%)',
          transition: isDragging ? 'none' : 'left 2.5s ease-in-out'
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="relative flex flex-col items-center">
          {/* Drag Handle & Quick Menu Trigger */}
          <div
            ref={browserControlBarRef}
            className={`absolute -top-7 flex items-center gap-1 bg-slate-900/95 backdrop-blur-sm text-white px-2 py-0.5 rounded-t-lg border border-slate-700/80 transition-all duration-200 electron-overlay-no-drag ${
              showControlBar || hasExpandedLayout ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          >
            <button
              type="button"
              className="cursor-ew-resize p-0.5 hover:text-amber-400"
              onMouseDown={handleMouseDown}
              title="Kéo thả vị trí"
            >
              <Move size={12} />
            </button>
            <button
              type="button"
              onClick={() => setIsRoaming(!isRoaming)}
              className={`p-0.5 ${isRoaming ? 'text-emerald-400' : 'text-amber-400'}`}
              title={isRoaming ? 'Bé cưng đang đi dạo (Nhấp để Ghim đứng yên)' : 'Đang ghim vị trí (Nhấp để Bật đi dạo)'}
            >
              {isRoaming ? <Compass size={12} /> : <Pin size={12} />}
            </button>
            <button
              type="button"
              onClick={() => setPanel(activePanel === 'voice' ? null : 'voice')}
              className={`p-0.5 transition-colors ${
                activePanel === 'voice' ? 'text-amber-400 font-bold' : 'hover:text-amber-400 text-white/80'
              }`}
              title="Trợ lý giọng nói 'HEY ANY'"
            >
              <Mic size={12} className={activePanel === 'voice' ? 'animate-pulse' : ''} />
            </button>
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="p-0.5 hover:text-amber-300"
              title="Hướng dẫn phím tắt & thao tác"
            >
              <HelpCircle size={12} />
            </button>
            <button
              type="button"
              onClick={() => setShowQuickMenu(!showQuickMenu)}
              className="p-0.5 hover:text-amber-400"
              title="Menu tương tác"
            >
              <Sparkles size={12} />
            </button>
            <button
              type="button"
              onClick={handleOpenPiP}
              className="p-0.5 hover:text-yellow-400"
              title="📌 Nổi Thú Cưng Trên Màn Hình Desktop (Picture-in-Picture)"
            >
              <ExternalLink size={12} />
            </button>
            <button
              type="button"
              onClick={onCloseOverlay}
              className="p-0.5 hover:text-red-400"
              title="Ẩn thú cưng (Ctrl+Shift+P)"
            >
              <Minimize2 size={12} />
            </button>
            <button
              type="button"
              onClick={() => setShowControlBar(false)}
              className="p-0.5 hover:text-white/80 text-white/50"
              title="Đóng thanh điều khiển"
            >
              <X size={12} />
            </button>
          </div>

          {/* The 2D Pixel Pet Canvas */}
          <div
            ref={petWrapperRef}
            onClick={(e) => {
              e.stopPropagation();
              handlePetClick();
            }}
          >
            <PixelPetCanvas
              petType={pet.petType}
              currentState={activeAnimationState}
              scaleSize={pet.scaleSize}
              speechBubble={speechBubble}
              onPetClick={handlePetClick}
              petName={pet.name}
              petLevel={pet.level}
              hunger={pet.hunger}
              happiness={pet.happiness}
              equippedItems={pet.userItems}
              showTooltip={false}
              facingDirection={facingDirection}
            />
          </div>

          {/* Quick Interaction Bubble Menu */}
          {showQuickMenu && <div className="absolute bottom-full z-[60] mb-2 w-[360px] max-w-[calc(100vw-24px)]">{quickMenu}</div>}
        </div>
      </div>
    </>
  );
};
