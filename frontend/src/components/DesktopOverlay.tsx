import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../services/api';
import { PixelPetCanvas } from './PixelPetCanvas';
import { AnimationState, LofiTrack, MusicRequest, UserPet } from '../types';
import { AICompanionChat } from './AICompanionChat';
import { MusicPlayer } from './MusicPlayer';
import { PomodoroTimer, TimerRequest } from './PomodoroTimer';
import { VoiceAssistant } from './VoiceAssistant';
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
  Moon,
  Smile,
  Trophy,
  RotateCcw
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
  onOpenPiP?: () => void;
  onStopMusic?: () => void;
  onResumeBgm?: () => void;
  externalMusicRequest?: MusicRequest;
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
  petSide = 'right',
  onOpenPiP,
  onStopMusic,
  onResumeBgm,
  externalMusicRequest
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
  const [isControlHovered, setIsControlHovered] = useState(false);
  const [musicRequest, setMusicRequest] = useState<MusicRequest>();
  const [timerRequest, setTimerRequest] = useState<TimerRequest>();

  const controlBarRef = useRef<HTMLDivElement>(null);
  const quickMenuRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const petWrapperRef = useRef<HTMLDivElement>(null);
  const browserControlBarRef = useRef<HTMLDivElement>(null);

  // Direct drag refs for smooth Electron desktop window & browser dragging
  const isPointerDownRef = useRef(false);
  const hasDraggedRef = useRef(false);
  const dragStartScreenRef = useRef({ x: 0, y: 0 });
  const lastDragScreenRef = useRef({ x: 0, y: 0 });
  const ignoreMouseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  useEffect(() => {
    if (externalMusicRequest) {
      setMusicRequest(externalMusicRequest);
    }
  }, [externalMusicRequest]);

  // Smoothly show hover menu immediately when mouse enters Pet or Menu, and hide with a 220ms grace period on leave
  useEffect(() => {
    if (hoverHideTimerRef.current) {
      clearTimeout(hoverHideTimerRef.current);
      hoverHideTimerRef.current = null;
    }
    if (isHovered || isControlHovered || isDragging) {
      setIsMenuVisible(true);
    } else {
      hoverHideTimerRef.current = setTimeout(() => {
        setIsMenuVisible(false);
      }, 220);
    }
    return () => {
      if (hoverHideTimerRef.current) {
        clearTimeout(hoverHideTimerRef.current);
      }
    };
  }, [isHovered, isControlHovered, isDragging]);

  // Listen to external panel open requests from Electron main process (e.g. popOutToDesktop('music'))
  useEffect(() => {
    if (!isDesktopWindow) return;
    const bridge = window.officePet;
    if (!bridge?.onOpenPanel) return;
    return bridge.onOpenPanel(panel => {
      if (panel === 'menu') {
        setActivePanel(null);
        setShowGuide(false);
        setShowQuickMenu(true);
      } else if (panel === 'chat' || panel === 'pomodoro' || panel === 'music' || panel === 'voice') {
        setShowQuickMenu(false);
        setShowGuide(false);
        setActivePanel(panel);
      } else if (panel === null) {
        setActivePanel(null);
        setShowQuickMenu(false);
        setShowGuide(false);
      }
    });
  }, [isDesktopWindow]);

  const hasExpandedLayout = Boolean(activePanel || showQuickMenu || showGuide);

  // Manage transparent click-through on Electron Desktop Pet window so clicks on empty space pass through to VSCode
  useEffect(() => {
    if (!isDesktopWindow) return;
    const bridge = window.officePet;
    if (!bridge?.setIgnoreMouseEvents) return;

    if (ignoreMouseTimerRef.current) {
      clearTimeout(ignoreMouseTimerRef.current);
      ignoreMouseTimerRef.current = null;
    }

    if (hasExpandedLayout || isMenuVisible || isHovered || isControlHovered || isDragging) {
      bridge.setIgnoreMouseEvents(false);
    } else {
      ignoreMouseTimerRef.current = setTimeout(() => {
        bridge.setIgnoreMouseEvents(true);
      }, 100);
    }

    return () => {
      if (ignoreMouseTimerRef.current) {
        clearTimeout(ignoreMouseTimerRef.current);
      }
    };
  }, [isDesktopWindow, hasExpandedLayout, isMenuVisible, isHovered, isControlHovered, isDragging]);

  // Ensure mouse events are restored when unmounting
  useEffect(() => {
    return () => {
      if (isDesktopWindow) {
        window.officePet?.setIgnoreMouseEvents?.(false);
      }
    };
  }, [isDesktopWindow]);

  const setPanel = (panel: 'chat' | 'pomodoro' | 'music' | 'voice' | null) => {
    setActivePanel(panel);
    setShowQuickMenu(false);
    setShowGuide(false);
  };

  const openQuickActionsPage = () => {
    setActivePanel(null);
    setShowGuide(false);
    setShowQuickMenu(true);
  };

  const handleStopMusic = () => {
    setMusicRequest({ query: '__STOP_MUSIC__', autoPlay: false, requestId: Date.now() });
    window.officePet?.performPetAction('stopMusic');
    onStopMusic?.();
    setPanel(null);
  };

  const handleResumeBgm = () => {
    window.officePet?.performPetAction('resumeBgm');
    onResumeBgm?.();
  };

  const handleStartRoaming = () => {
    setIsRoaming(true);
    if (isDesktopWindow) {
      window.officePet?.performPetAction('startRoaming');
    }
  };

  const handleStopRoaming = () => {
    setIsRoaming(false);
    if (isDesktopWindow) {
      window.officePet?.stopWalking();
      window.officePet?.performPetAction('stopRoaming');
    }
  };

  const handleShowDashboard = () => {
    window.officePet?.showDashboard();
  };

  const handleHideDesktopPet = () => {
    window.officePet?.performPetAction('hideOverlay');
    onCloseOverlay?.();
  };

  const handleOpenMenu = () => {
    setActivePanel(null);
    setShowGuide(false);
    setShowQuickMenu(true);
  };

  const handleClosePanel = () => {
    setPanel(null);
    setShowQuickMenu(false);
    setShowGuide(false);
  };

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
    if (!isDesktopWindow || !isRoaming || hasExpandedLayout || isMenuVisible || isHovered || isControlHovered || isDragging) return;

    let roamTimer: ReturnType<typeof setTimeout>;
    let disposed = false;

    const scheduleRoam = () => {
      roamTimer = setTimeout(() => {
        if (disposed || !isRoaming || hasExpandedLayout || isMenuVisible || isHovered || isControlHovered || isDragging) return;
        const screenW = window.screen?.availWidth || 1920;
        const targetX = Math.round(60 + Math.random() * Math.max(200, screenW - 380));
        window.officePet?.walkTo(targetX);
        scheduleRoam();
      }, 35000 + Math.random() * 35000);
    };

    scheduleRoam();

    return () => {
      disposed = true;
      clearTimeout(roamTimer);
    };
  }, [isDesktopWindow, isRoaming, hasExpandedLayout, isMenuVisible, isHovered, isControlHovered, isDragging]);

  // 3. Autonomous Movement for Browser Web Dashboard mode
  useEffect(() => {
    if (isDesktopWindow || !isRoaming) return;
    let timeout: ReturnType<typeof setTimeout>;
    let stopWalkingTimer: ReturnType<typeof setTimeout>;

    const movePet = () => {
      timeout = setTimeout(() => {
        if (!isDragging && !hasExpandedLayout) {
          const newPos = 8 + Math.round(Math.random() * 84);
          setFacingDirection(newPos > position ? 'right' : 'left');
          setIsWalking(true);
          setPosition(newPos);
          stopWalkingTimer = setTimeout(() => {
            setIsWalking(false);
          }, 2600);
        }
        movePet();
      }, 30000 + Math.random() * 30000);
    };
    movePet();

    return () => {
      clearTimeout(timeout);
      clearTimeout(stopWalkingTimer);
    };
  }, [isDragging, hasExpandedLayout, isDesktopWindow, isRoaming, position]);

  useEffect(() => {
    onPanelVisibilityChange?.(activePanel || (showQuickMenu || showGuide ? 'menu' : null));
  }, [activePanel, showQuickMenu, showGuide, onPanelVisibilityChange]);

  // Global mouse move / up listener for smooth dragging in both Desktop and Browser modes
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isPointerDownRef.current) return;
      const totalDx = e.screenX - dragStartScreenRef.current.x;
      const totalDy = e.screenY - dragStartScreenRef.current.y;

      if (!hasDraggedRef.current && Math.hypot(totalDx, totalDy) > 4) {
        hasDraggedRef.current = true;
        setIsDragging(true);
        if (isDesktopWindow) {
          window.officePet?.stopWalking();
        }
      }

      if (!hasDraggedRef.current) return;

      if (isDesktopWindow) {
        const stepDx = e.screenX - lastDragScreenRef.current.x;
        const stepDy = e.screenY - lastDragScreenRef.current.y;
        lastDragScreenRef.current = { x: e.screenX, y: e.screenY };
        if (stepDx !== 0 || stepDy !== 0) {
          window.officePet?.dragMove?.(stepDx, stepDy);
        }
      } else {
        setPosition(Math.max(8, Math.min(92, (e.clientX / window.innerWidth) * 100)));
      }
    };

    const handleGlobalMouseUp = () => {
      if (!isPointerDownRef.current) return;
      isPointerDownRef.current = false;
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDesktopWindow]);

  const startMouseDrag = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isPointerDownRef.current = true;
    hasDraggedRef.current = false;
    dragStartScreenRef.current = { x: e.screenX, y: e.screenY };
    lastDragScreenRef.current = { x: e.screenX, y: e.screenY };
  };

  const handlePetClick = () => {
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }
    if (pet.currentState === 'SLEEPING') {
      interaction('WAKING_UP', 'Bé cưng đã vươn vai tỉnh giấc rồi nè! Sẵn sàng đồng hành cùng đại ca! ✨');
      return;
    }
    if (pet.hunger < 25) {
      interaction('HUNGRY', 'Bụng em đói cồn cào rồi, đại ca cho em ăn một chút với nhé! 🍖');
      return;
    }
    if (pet.happiness < 25) {
      interaction('SAD', 'Em hơi mệt một xíu, được đại ca quan tâm xoa đầu thích thật đó... 🥰');
      onStroke();
      return;
    }

    // Dynamic responsive joyful reactions when user clicks on pet
    const rand = Math.random();
    if (rand < 0.55) {
      onStroke(); // PETTING +30 EXP
    } else if (rand < 0.75) {
      interaction('HAPPY', 'Bé cưng nhảy cẫng lên vui sướng khi được đại ca cưng chiều! ✨');
      onStroke();
    } else if (rand < 0.90) {
      interaction('WAVING', 'Bé cưng vẫy tay chào đại ca thân yêu! Chúc đại ca làm việc thật suôn sẻ! 👋');
    } else {
      interaction('DANCING', 'Bé cưng nhún nhảy một điệu vui tươi phục vụ đại ca! 🎵');
    }
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
    onFeed();
    setShowQuickMenu(false);
  };

  const handleDrinkAction = async () => {
    interaction('DRINKING', 'Cùng nghỉ uống nước một chút nhé! 💧 (+20 EXP)');
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

  const quickMenuContent = (
    <div
      ref={quickMenuRef}
      className="electron-overlay-no-drag space-y-2.5 font-sans text-slate-800 p-3"
    >
      {/* Pet Status Summary Card */}
      <div className="p-2.5 rounded-xl bg-[#181528] text-white border-2 border-slate-900 flex items-center justify-between">
        <div>
          <div className="text-xs font-black text-amber-300 flex items-center gap-1.5">
            <span>🐾 {pet.name}</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-mono">
              Cấp {pet.level}
            </span>
          </div>
          <div className="text-[10px] text-slate-300 mt-0.5 font-bold">
            Kinh nghiệm: {pet.exp}/{pet.nextLevelExp || pet.level * 200} EXP
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-black">
          <span className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-400/30">
            🍖 {Math.round(pet.hunger)}%
          </span>
          <span className="px-2 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-400/30">
            ❤️ {Math.round(pet.happiness)}%
          </span>
        </div>
      </div>

      {/* Care & Level Up Section */}
      <div>
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
          Chăm sóc & Phát triển thú cưng
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={handleFeedAction}
            className="flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 px-3 py-2 text-left text-xs font-black text-white border border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[1px] transition"
          >
            <Utensils size={14} className="shrink-0" />
            <div>
              <div>Cho ăn</div>
              <div className="text-[9px] font-semibold opacity-90">+50 EXP • Tăng no bụng</div>
            </div>
          </button>

          <button
            type="button"
            onClick={handleDrinkAction}
            className="flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 px-3 py-2 text-left text-xs font-black text-white border border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[1px] transition"
          >
            <Coffee size={14} className="shrink-0" />
            <div>
              <div>Uống nước</div>
              <div className="text-[9px] font-semibold opacity-90">+20 EXP • Giải khát</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onStroke();
              setShowQuickMenu(false);
            }}
            className="flex items-center gap-2 rounded-xl bg-rose-500 hover:bg-rose-600 px-3 py-2 text-left text-xs font-black text-white border border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[1px] transition"
          >
            <Heart size={14} className="shrink-0" />
            <div>
              <div>Vuốt ve</div>
              <div className="text-[9px] font-semibold opacity-90">+30 EXP • Tăng vui vẻ</div>
            </div>
          </button>

          <button
            type="button"
            onClick={handleLevelUpAction}
            className="flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-3 py-2 text-left text-xs font-black text-white border border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[1px] transition"
          >
            <Sparkles size={14} className="shrink-0" />
            <div>
              <div>Thăng cấp</div>
              <div className="text-[9px] font-semibold opacity-90">Tiến hóa cấp mới</div>
            </div>
          </button>
        </div>
      </div>

      {/* Animations Grid */}
      <div>
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
          <span>Biểu cảm & Hoạt ảnh tương tác</span>
          <span className="font-mono text-[9px] text-amber-600 font-bold">10 động thái</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => interaction('TYPING', 'Cùng tập trung gõ phím làm việc chăm chỉ với đại ca nhé! 💻')}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-3 py-2 text-left text-xs font-bold text-white border border-slate-900 transition"
          >
            <Monitor size={14} /> Gõ phím làm việc
          </button>
          <button
            type="button"
            onClick={() => interaction('DANCING', 'Chơi với bạn vui quá, mình nhảy múa vận động nhé! 🎵')}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-left text-xs font-bold text-white border border-slate-900 transition"
          >
            <Sparkles size={14} /> Nhảy múa vui vẻ
          </button>
          <button
            type="button"
            onClick={() => interaction('EXERCISING', 'Một hai một hai, cùng rèn luyện thể lực dẻo dai nào! 🏋️')}
            className="flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 px-3 py-2 text-left text-xs font-bold text-white border border-slate-900 transition"
          >
            <Compass size={14} /> Tập thể dục
          </button>
          <button
            type="button"
            onClick={() => interaction('WAVING', 'Bé cưng vẫy tay chào bạn nè! Chúc ngày mới tốt lành! 👋')}
            className="flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 px-3 py-2 text-left text-xs font-bold text-white border border-slate-900 transition"
          >
            <Smile size={14} /> Vẫy tay chào
          </button>
          <button
            type="button"
            onClick={() => interaction('HAPPY', 'Tâm trạng hôm nay thật tuyệt vời, ở bên đại ca thích quá! ✨')}
            className="flex items-center gap-2 rounded-xl bg-pink-600 hover:bg-pink-700 px-3 py-2 text-left text-xs font-bold text-white border border-slate-900 transition"
          >
            <Heart size={14} /> Vui vẻ hạnh phúc
          </button>
          <button
            type="button"
            onClick={() => interaction('CELEBRATING', 'Hoan hô! Chúc mừng thành quả xuất sắc của đại ca! 🎉')}
            className="flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-3 py-2 text-left text-xs font-bold text-white border border-slate-900 transition"
          >
            <Trophy size={14} /> Hoan hô ăn mừng
          </button>
          <button
            type="button"
            onClick={() => interaction('THANKING', 'Em cúi đầu cảm ơn đại ca vì luôn quan tâm yêu thương em! 🙇')}
            className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-3 py-2 text-left text-xs font-bold text-white border border-slate-900 transition"
          >
            <Award size={14} /> Cúi đầu cảm ơn
          </button>
          <button
            type="button"
            onClick={() => interaction('SAD', 'Em đang làm nũng một chút, muốn được đại ca dỗ dành cơ... 🥺')}
            className="flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 px-3 py-2 text-left text-xs font-bold text-white border border-slate-900 transition"
          >
            <Heart size={14} /> Làm nũng
          </button>
          <button
            type="button"
            onClick={() => interaction('SLEEPING', 'Khò khò... Cho bé cưng chợp mắt nghỉ ngơi tí nhé... Zzz 💤')}
            className="flex items-center gap-2 rounded-xl bg-slate-700 hover:bg-slate-800 px-3 py-2 text-left text-xs font-bold text-white border border-slate-900 transition"
          >
            <Moon size={14} /> Cho bé đi ngủ
          </button>
          <button
            type="button"
            onClick={() => interaction('WAKING_UP', 'Vươn vai tỉnh giấc, sẵn sàng tiếp tục ngày mới cùng đại ca! ☀️')}
            className="flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 px-3 py-2 text-left text-xs font-bold text-white border border-slate-900 transition"
          >
            <Sparkles size={14} /> Thức dậy vươn vai
          </button>
        </div>
      </div>

      {/* Shortcuts & Utilities */}
      <div className="pt-1 border-t border-slate-200 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => {
            onOpenQuests?.();
            setShowQuickMenu(false);
          }}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 px-2.5 py-2 text-xs font-black text-slate-950 border border-slate-900 transition"
        >
          <Award size={14} /> Nhiệm vụ & Thưởng
        </button>

        {isDesktopWindow ? (
          <button
            type="button"
            onClick={() => {
              window.officePet?.resetPosition?.();
              setShowQuickMenu(false);
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 px-2.5 py-2 text-xs font-bold text-slate-800 border border-slate-300 transition"
          >
            <RotateCcw size={13} /> Về góc màn hình
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setShowQuickMenu(false);
              setShowGuide(true);
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 px-2.5 py-2 text-xs font-bold text-slate-800 border border-slate-300 transition"
          >
            <HelpCircle size={13} /> Xem hướng dẫn
          </button>
        )}
      </div>

      {/* Built-in Quick Guide Tip */}
      <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px] text-slate-600 space-y-1">
        <div className="font-black text-slate-800 flex items-center gap-1">
          <HelpCircle size={12} className="text-amber-600" /> Mẹo sử dụng nhanh:
        </div>
        <div>• <strong>Giữ chuột trái vào thú cưng</strong> để kéo đến bất kỳ vị trí nào trên màn hình.</div>
        <div>• Nhấn <strong>Ctrl + Shift + P</strong> để Ẩn / Hiện thú cưng tức thì khi đang code.</div>
      </div>
    </div>
  );

  const guideContent = (
    <div
      ref={guideRef}
      className="electron-overlay-no-drag flex flex-col justify-between text-slate-800 font-sans h-full p-3"
    >
      <div>
        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-200">
          <span className="font-black text-xs text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
            📖 Hướng Dẫn Pet Nổi Desktop
          </span>
          <button
            type="button"
            onClick={() => setShowGuide(false)}
            className="p-1 hover:bg-slate-200 text-slate-500 hover:text-slate-900 rounded-lg"
            title="Đóng"
          >
            <X size={14} />
          </button>
        </div>
        <div className="space-y-2 text-[11px] leading-snug">
          <div className="flex items-start gap-2">
            <span className="bg-[#231e36] text-amber-300 px-2 py-0.5 rounded-md text-[10px] font-black whitespace-nowrap shrink-0">
              Kéo Thả Pet
            </span>
            <span>Giữ chuột trái trực tiếp vào thú cưng (hoặc thanh tiêu đề) để kéo tới bất kỳ góc nào trên màn hình VSCode.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="bg-rose-500 text-white px-2 py-0.5 rounded-md text-[10px] font-black whitespace-nowrap shrink-0">
              Di Chuột Vào Pet
            </span>
            <span>Chỉ cần di chuột vào thú cưng, bảng chức năng có tên rõ ràng sẽ hiện ngay phía trên.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-md text-[10px] font-black whitespace-nowrap shrink-0">
              🧭 Đi dạo / Ghim
            </span>
            <span>Bấm nút Đi dạo / Đứng yên để ghim pet đứng cố định một chỗ khi đang làm việc.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-md text-[10px] font-black whitespace-nowrap shrink-0">
              🎤 Giọng nói AI
            </span>
            <span>Bật "Luôn lắng nghe" trong mục Giọng nói — khi đóng khung lại pet vẫn nghe khẩu lệnh của bạn!</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="bg-slate-800 text-white px-2 py-0.5 rounded-md text-[10px] font-black whitespace-nowrap shrink-0">
              Ctrl + Shift + P
            </span>
            <span>Phím tắt toàn cục để Ẩn / Hiện thú cưng tức thì trên mọi cửa sổ.</span>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setShowGuide(false)}
        className="w-full mt-3 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[1px] active:shadow-none font-black text-xs rounded-xl transition"
      >
        Đã hiểu ✓
      </button>
    </div>
  );

  const handleOpenPiP = async () => {
    if (window.officePet) {
      window.officePet.popOutToDesktop?.();
      return;
    }
    if ('documentPictureInPicture' in window) {
      try {
        const pipWindow = await (window as any).documentPictureInPicture.requestWindow({
          width: 280,
          height: 320
        });

        Array.from(document.styleSheets).forEach(sheet => {
          try {
            if (sheet.href) {
              const link = document.createElement('link');
              link.rel = 'stylesheet';
              link.href = sheet.href;
              pipWindow.document.head.appendChild(link);
            } else if (sheet.cssRules) {
              const style = document.createElement('style');
              Array.from(sheet.cssRules).forEach(rule => {
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
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              height: '100%',
              justifyContent: 'space-between',
              userSelect: 'none'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '0 4px',
                fontSize: '11px',
                fontWeight: 'bold'
              }}
            >
              <span style={{ color: '#fbbf24' }}>🐾 {pet.name}</span>
              <span
                style={{
                  background: '#25203d',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  border: '1px solid #3e3860',
                  color: '#a5b4fc',
                  fontSize: '10px'
                }}
              >
                Lv.{pet.level}
              </span>
            </div>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PixelPetCanvas
                petType={pet.petType}
                currentState={pet.currentState}
                scaleSize="SMALL"
                disableWander={true}
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
                style={{
                  flex: 1,
                  padding: '5px 0',
                  background: '#d97706',
                  color: '#fff',
                  border: '2px solid #000',
                  borderRadius: '8px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                🍖 Cho ăn
              </button>
              <button
                type="button"
                onClick={handleDrinkAction}
                style={{
                  flex: 1,
                  padding: '5px 0',
                  background: '#0284c7',
                  color: '#fff',
                  border: '2px solid #000',
                  borderRadius: '8px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                💧 Uống nước
              </button>
              <button
                type="button"
                onClick={onStroke}
                style={{
                  flex: 1,
                  padding: '5px 0',
                  background: '#db2777',
                  color: '#fff',
                  border: '2px solid #000',
                  borderRadius: '8px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
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
      alert(
        '📌 Để thú cưng nổi lơ lửng ngoài màn hình Desktop (đè lên mọi ứng dụng & trang web khác), bạn hãy khởi chạy chế độ Desktop bằng lệnh: npm run desktop trong thư mục frontend!'
      );
    }
  };

  const activeAnimationState = isWalking ? 'WALKING' : pet.currentState;

  // ============================================================================
  // HOVER ACTION DOCK CARD (Appears ONLY on Hover with Clear Icons + Labels!)
  // ============================================================================
  const renderLabeledHoverMenu = (isBrowserMode = false) => (
    <div
      ref={isBrowserMode ? browserControlBarRef : controlBarRef}
      onMouseEnter={() => setIsControlHovered(true)}
      onMouseLeave={() => setIsControlHovered(false)}
      className={`z-30 flex justify-center pb-1.5 transition-all duration-200 ${
        isMenuVisible
          ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
          : 'opacity-0 translate-y-2 scale-95 pointer-events-none'
      }`}
    >
      <div className="electron-overlay-no-drag w-[316px] rounded-2xl bg-[#181528]/95 backdrop-blur-md text-white border-2 border-slate-950 shadow-[0_6px_0_#000] p-2.5 space-y-2 font-sans">
        {/* 1. Top Drag & Status Header */}
        <div className="flex items-center justify-between gap-1.5 pb-1.5 border-b border-slate-800">
          <div
            onMouseDown={startMouseDrag}
            className="electron-overlay-drag flex items-center gap-1.5 cursor-grab active:cursor-grabbing select-none min-w-0"
            title="Giữ chuột trái để kéo thú cưng đi bất kỳ đâu"
          >
            <span className="p-1 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/40 shrink-0">
              <Move size={11} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-black text-[11px] text-amber-300 truncate max-w-[90px]">{pet.name}</span>
                <span className="px-1 py-0.2 rounded bg-amber-400 text-slate-950 text-[9px] font-black">
                  Lv.{pet.level}
                </span>
              </div>
              <div className="text-[9px] text-slate-300 font-bold flex items-center gap-1.5">
                <span>🍖 {Math.round(pet.hunger)}%</span>
                <span>•</span>
                <span>❤️ {Math.round(pet.happiness)}%</span>
              </div>
            </div>
          </div>

          <div className="electron-overlay-no-drag flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (isRoaming) handleStopRoaming();
                else handleStartRoaming();
              }}
              className={`px-2 py-1 rounded-lg text-[10px] font-black border border-slate-950 flex items-center gap-1 transition ${
                isRoaming
                  ? 'bg-emerald-500/25 text-emerald-300 hover:bg-emerald-500/35 border-emerald-500/40'
                  : 'bg-amber-400 text-slate-950'
              }`}
              title={isRoaming ? 'Đang tự đi dạo — Bấm để Ghim đứng yên' : 'Đang ghim cố định — Bấm để Cho đi dạo'}
            >
              {isRoaming ? <Compass size={11} /> : <Pin size={11} />}
              <span>{isRoaming ? 'Đi dạo' : 'Đã ghim'}</span>
            </button>

            {isDesktopWindow ? (
              <button
                type="button"
                onClick={() => window.officePet?.showDashboard()}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[10px] font-black border border-slate-700 flex items-center gap-1 transition"
                title="Mở giao diện Bảng điều khiển lớn"
              >
                <Monitor size={11} />
                <span>Mở Web</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenPiP || handleOpenPiP}
                className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black border border-slate-950 flex items-center gap-1 transition"
                title="Nổi thú cưng trên màn hình Desktop"
              >
                <ExternalLink size={11} />
                <span>Nổi PiP</span>
              </button>
            )}

            <button
              type="button"
              onClick={onCloseOverlay}
              className="px-1.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white text-[10px] font-bold border border-slate-700 transition"
              title="Ẩn thú cưng (Ctrl+Shift+P)"
            >
              Ẩn
            </button>
          </div>
        </div>

        {/* 2. Primary Mini-Pages (2x2 Grid with Clear Icons + Labels) */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setPanel('voice')}
            className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:brightness-105 text-slate-950 font-black text-[11px] border border-slate-950 shadow-[0_2px_0_#000] active:translate-y-[1px] transition text-left"
          >
            <Mic size={14} className="shrink-0 animate-pulse" />
            <div className="min-w-0 leading-tight">
              <div className="truncate">Giọng nói AI</div>
              <div className="text-[9px] font-bold opacity-80 truncate">Rảnh tay / Khẩu lệnh</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setPanel('chat')}
            className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-[#272142] hover:bg-[#332b54] text-white font-black text-[11px] border border-slate-700 shadow-[0_2px_0_#000] active:translate-y-[1px] transition text-left"
          >
            <MessageSquare size={14} className="text-amber-400 shrink-0" />
            <div className="min-w-0 leading-tight">
              <div className="truncate">Chat cùng AI</div>
              <div className="text-[9px] font-medium text-slate-300 truncate">Hỏi đáp & Tâm sự</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setPanel('pomodoro')}
            className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[11px] border border-slate-950 shadow-[0_2px_0_#000] active:translate-y-[1px] transition text-left"
          >
            <Timer size={14} className="text-amber-300 shrink-0" />
            <div className="min-w-0 leading-tight">
              <div className="truncate">Hẹn giờ</div>
              <div className="text-[9px] font-medium text-indigo-100 truncate">Pomodoro & Báo thức</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setPanel('music')}
            className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black text-[11px] border border-slate-950 shadow-[0_2px_0_#000] active:translate-y-[1px] transition text-left"
          >
            <Music size={14} className="text-amber-300 shrink-0" />
            <div className="min-w-0 leading-tight">
              <div className="truncate">Nhạc & TV</div>
              <div className="text-[9px] font-medium text-violet-100 truncate">Lofi & YouTube</div>
            </div>
          </button>
        </div>

        {/* 3. Quick Pet Care Row (4 Labeled Buttons) */}
        <div className="grid grid-cols-4 gap-1 pt-0.5">
          <button
            type="button"
            onClick={handleFeedAction}
            className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl bg-amber-500/20 hover:bg-amber-500 hover:text-slate-950 text-amber-300 border border-amber-500/30 font-black text-[10px] transition"
          >
            <Utensils size={12} />
            <span>Cho ăn</span>
          </button>

          <button
            type="button"
            onClick={handleDrinkAction}
            className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl bg-sky-500/20 hover:bg-sky-400 hover:text-slate-950 text-sky-300 border border-sky-500/30 font-black text-[10px] transition"
          >
            <Coffee size={12} />
            <span>Uống nước</span>
          </button>

          <button
            type="button"
            onClick={onStroke}
            className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl bg-rose-500/20 hover:bg-rose-500 hover:text-white text-rose-300 border border-rose-500/30 font-black text-[10px] transition"
          >
            <Heart size={12} />
            <span>Vuốt ve</span>
          </button>

          <button
            type="button"
            onClick={openQuickActionsPage}
            className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl bg-purple-500/20 hover:bg-purple-500 hover:text-white text-purple-300 border border-purple-500/30 font-black text-[10px] transition"
          >
            <Sparkles size={12} />
            <span>Hoạt ảnh</span>
          </button>
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // UNIFIED TOP NAVIGATION BAR FOR OPEN INNER PAGES
  // ============================================================================
  const renderPanelNavigationHeader = () => {
    const currentTab = activePanel || (showQuickMenu || showGuide ? 'menu' : null);
    const navItems: Array<{ id: 'voice' | 'chat' | 'pomodoro' | 'music' | 'menu'; label: string; icon: React.ReactNode }> = [
      { id: 'voice', label: 'Giọng nói', icon: <Mic size={12} /> },
      { id: 'chat', label: 'Chat AI', icon: <MessageSquare size={12} /> },
      { id: 'pomodoro', label: 'Hẹn giờ', icon: <Timer size={12} /> },
      { id: 'music', label: 'Nhạc & TV', icon: <Music size={12} /> },
      { id: 'menu', label: 'Hoạt ảnh', icon: <Sparkles size={12} /> }
    ];

    return (
      <div className="bg-[#181528] text-white border-b-2 border-slate-950 px-2.5 py-2 shrink-0 select-none space-y-1.5">
        {/* Top Row: Drag Handle + Pet Info + Open Web + Close Panel */}
        <div className="flex items-center justify-between gap-2">
          <div
            onMouseDown={startMouseDrag}
            className="electron-overlay-drag flex items-center gap-1.5 cursor-grab active:cursor-grabbing min-w-0"
            title="Giữ chuột trái để kéo cửa sổ"
          >
            <Move size={12} className="text-amber-400 shrink-0" />
            <span className="font-black text-xs text-amber-300 truncate">
              🐾 {pet.name} • Lv.{pet.level}
            </span>
          </div>

          <div className="electron-overlay-no-drag flex items-center gap-1 shrink-0">
            {isDesktopWindow && (
              <button
                type="button"
                onClick={() => window.officePet?.showDashboard()}
                className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[10px] font-black border border-slate-700 flex items-center gap-1 transition"
                title="Mở giao diện Web lớn"
              >
                <Monitor size={11} />
                <span>Mở Web</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleClosePanel}
              className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black border border-slate-950 flex items-center gap-1 transition"
              title="Đóng trang nhỏ này"
            >
              <X size={11} />
              <span>Đóng</span>
            </button>
          </div>
        </div>

        {/* Bottom Row: Labeled Page Switcher Pills */}
        <div className="electron-overlay-no-drag grid grid-cols-5 gap-1">
          {navItems.map(item => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'menu') {
                    openQuickActionsPage();
                  } else {
                    setPanel(item.id);
                  }
                }}
                className={`py-1 px-1 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 border transition truncate ${
                  isActive
                    ? 'bg-amber-400 text-slate-950 border-slate-950 shadow-[0_1px_0_#000]'
                    : 'bg-[#231e36] hover:bg-[#312a4a] text-slate-300 border-slate-800'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // ELECTRON DESKTOP WINDOW LAYOUT (Frameless Transparent Window)
  // -------------------------------------------------------------
  if (isDesktopWindow) {
    const renderPet = (
      <div
        ref={petWrapperRef}
        onMouseDown={startMouseDrag}
        onMouseEnter={() => {
          setIsHovered(true);
          window.officePet?.stopWalking();
        }}
        onMouseLeave={() => setIsHovered(false)}
        onClick={e => {
          e.stopPropagation();
          handlePetClick();
        }}
        className={`relative flex flex-col items-center justify-end select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        } transition-transform hover:scale-[1.03] active:scale-95`}
        title="Di chuột vào để mở bảng chức năng • Giữ chuột trái để kéo vị trí • Nhấp để vuốt ve (+30 EXP)"
      >
        <PixelPetCanvas
          petType={pet.petType}
          currentState={activeAnimationState}
          scaleSize={hasExpandedLayout ? 'MEDIUM' : pet.scaleSize || 'MEDIUM'}
          disableWander={true}
          speechBubble={hasExpandedLayout ? null : speechBubble}
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
    );

    return (
      <div className="relative flex h-full w-full min-w-0 flex-col justify-end select-none p-1.5 overflow-hidden">
        <div
          className={`relative flex min-h-0 w-full ${
            hasExpandedLayout ? 'flex-1 items-end justify-center gap-2' : 'flex-col items-center justify-end'
          }`}
        >
          {hasExpandedLayout && petSide === 'left' && (
            <aside className="relative z-20 flex w-[145px] shrink-0 flex-col items-center justify-end gap-1 pb-1">
              {renderPet}
            </aside>
          )}

          {/* Persistent Inner Page Card (Keeps VoiceAssistant & MusicPlayer alive even when collapsed!) */}
          <section
            onMouseEnter={() => setIsControlHovered(true)}
            onMouseLeave={() => setIsControlHovered(false)}
            className={`electron-overlay-no-drag z-[60] flex min-w-0 flex-col rounded-2xl border-2 border-slate-950 shadow-[0_6px_0_#000] font-sans overflow-hidden ${
              activePanel === 'voice' ? 'bg-[#181528] text-white' : 'bg-[#fffdfa] text-slate-800'
            } ${
              hasExpandedLayout
                ? 'relative h-[495px] flex-1 max-w-[425px] min-w-[320px]'
                : 'pointer-events-none fixed -left-[9999px] top-0 h-[420px] w-[380px] opacity-0'
            }`}
          >
            {hasExpandedLayout && renderPanelNavigationHeader()}

            <div className="relative min-h-0 flex-1 flex flex-col overflow-hidden">
              {activePanel === 'chat' && (
                <div className="h-full w-full overflow-hidden">
                  <AICompanionChat
                    pet={pet}
                    onPetStateChange={onPetStateChange}
                    compact
                    onMusicRequest={openMusicFromChat}
                    onStartPomodoro={minutes => {
                      setPanel('pomodoro');
                      onPetInteraction?.('TYPING', `⏱️ Bắt đầu hẹn giờ tập trung ${minutes} phút!`);
                    }}
                  />
                </div>
              )}

              {/* Persistent VoiceAssistant: stays mounted so "Luôn nghe" works even when panel is closed */}
              <div
                className={
                  activePanel === 'voice'
                    ? 'h-full w-full overflow-hidden'
                    : 'hidden pointer-events-none'
                }
              >
                <VoiceAssistant
                  embedded={true}
                  autoListen={true}
                  autoStart={activePanel === 'voice'}
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
                      window.officePet?.performPetAction('navigateTab', tab);
                      window.officePet?.showDashboard();
                      if (tab === 'QUESTS') onOpenQuests?.();
                      setPanel(null);
                    }
                  }}
                  onOpenModal={modal => {
                    window.officePet?.performPetAction('openModal', modal);
                    window.officePet?.showDashboard();
                    setPanel(null);
                  }}
                  onPlayMusic={openMusicFromChat}
                  onStopMusic={handleStopMusic}
                  onResumeBgm={handleResumeBgm}
                  onStartTimer={(minutes, autoStart, action, alarmTime, alarmLabel) => {
                    setTimerRequest({ minutes, autoStart, action, alarmTime, alarmLabel, requestId: Date.now() });
                    if (action !== 'STOP_ALARM') {
                      setPanel('pomodoro');
                    }
                  }}
                  onClosePanel={handleClosePanel}
                  onWalk={handleStartRoaming}
                  onStopWalk={handleStopRoaming}
                  onShowDashboard={handleShowDashboard}
                  onHideDesktopPet={handleHideDesktopPet}
                  onOpenMenu={handleOpenMenu}
                  onChangeRoom={theme => window.officePet?.performPetAction('changeRoom', theme)}
                  onChangeScale={scale => window.officePet?.performPetAction('changeScale', scale)}
                  hunger={pet.hunger}
                  happiness={pet.happiness}
                  petLevel={pet.level}
                />
              </div>

              {/* Persistent PomodoroTimer: stays mounted so active countdown & alarms are never reset when closing panel */}
              <div
                className={
                  activePanel === 'pomodoro'
                    ? 'h-full w-full overflow-y-auto'
                    : 'hidden pointer-events-none'
                }
              >
                <PomodoroTimer
                  compact={true}
                  currentMode={pet.currentMode}
                  timerRequest={timerRequest}
                  onModeChange={mode => onModeChange?.(mode)}
                  onPetStateChange={onPetStateChange}
                  onSessionFinish={exp => onSessionFinish?.(exp)}
                />
              </div>

              {/* Persistent MusicPlayer: keeps YouTube/audio playing when switching panels */}
              <div
                className={
                  activePanel === 'music'
                    ? 'h-full w-full overflow-y-auto'
                    : 'pointer-events-none fixed -left-[9999px] top-0 h-[460px] w-[380px] opacity-0 overflow-hidden'
                }
              >
                <MusicPlayer
                  onTrackSelect={onTrackSelect}
                  fillPanel
                  compact
                  request={musicRequest}
                  historyScope={pet.id}
                  pet={pet}
                  petName={pet.name}
                />
              </div>

              {!activePanel && showQuickMenu && (
                <div className="h-full w-full overflow-y-auto">{quickMenuContent}</div>
              )}

              {!activePanel && showGuide && (
                <div className="h-full w-full overflow-y-auto">{guideContent}</div>
              )}
            </div>
          </section>

          {hasExpandedLayout && petSide === 'right' && (
            <aside className="relative z-20 flex w-[145px] shrink-0 flex-col items-center justify-end gap-1 pb-1">
              {renderPet}
            </aside>
          )}

          {!hasExpandedLayout && (
            <div className="relative flex w-full flex-col items-center justify-end pb-1">
              {renderLabeledHoverMenu(false)}
              {renderPet}
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
        className={`electron-overlay-no-drag fixed bottom-[180px] z-[60] flex max-h-[calc(100vh-200px)] w-[395px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border-2 border-slate-950 shadow-[0_6px_0_#0f172a] font-sans ${
          activePanel === 'voice' ? 'bg-[#181528] text-white' : 'bg-[#fffdfa] text-slate-800'
        } ${hasExpandedLayout ? '' : 'pointer-events-none opacity-0'}`}
        style={{
          left: `max(min(210px, 50vw), min(calc(100vw - min(210px, 50vw)), ${position}%))`,
          transform: 'translateX(-50%)',
          ...(hasExpandedLayout
            ? {
                height: 'min(490px, calc(100vh - 200px))'
              }
            : {})
        }}
      >
        {hasExpandedLayout && renderPanelNavigationHeader()}

        {activePanel === 'voice' && (
          <div className="min-h-0 flex-1 overflow-hidden">
            <VoiceAssistant
              embedded={true}
              autoListen={true}
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
              onStopMusic={handleStopMusic}
              onResumeBgm={handleResumeBgm}
              onStartTimer={(minutes, autoStart, action, alarmTime, alarmLabel) => {
                setTimerRequest({ minutes, autoStart, action, alarmTime, alarmLabel, requestId: Date.now() });
                if (action !== 'STOP_ALARM') {
                  setPanel('pomodoro');
                }
              }}
              onClosePanel={handleClosePanel}
              onWalk={handleStartRoaming}
              onStopWalk={handleStopRoaming}
              onShowDashboard={handleShowDashboard}
              onHideDesktopPet={handleHideDesktopPet}
              onOpenMenu={handleOpenMenu}
              hunger={pet.hunger}
              happiness={pet.happiness}
              petLevel={pet.level}
            />
          </div>
        )}
        {activePanel === 'chat' && (
          <div className="min-h-0 flex-1 overflow-hidden">
            <AICompanionChat
              pet={pet}
              onPetStateChange={onPetStateChange}
              compact
              onMusicRequest={openMusicFromChat}
            />
          </div>
        )}
        <div
          className={
            activePanel === 'pomodoro'
              ? 'min-h-0 flex-1 overflow-y-auto'
              : 'hidden pointer-events-none'
          }
        >
          <PomodoroTimer
            compact={true}
            currentMode={pet.currentMode}
            timerRequest={timerRequest}
            onModeChange={mode => onModeChange?.(mode)}
            onPetStateChange={onPetStateChange}
            onSessionFinish={exp => onSessionFinish?.(exp)}
          />
        </div>
        <div
          className={
            activePanel === 'music'
              ? 'min-h-0 flex-1 overflow-y-auto'
              : 'pointer-events-none fixed -left-[9999px] top-0 h-[500px] w-[380px] opacity-0 overflow-hidden'
          }
        >
          <MusicPlayer
            onTrackSelect={onTrackSelect}
            fillPanel
            compact
            request={musicRequest}
            historyScope={pet.id}
            pet={pet}
            petName={pet.name}
          />
        </div>
        {!activePanel && showQuickMenu && (
          <div className="min-h-0 flex-1 overflow-y-auto">{quickMenuContent}</div>
        )}
        {!activePanel && showGuide && (
          <div className="min-h-0 flex-1 overflow-y-auto">{guideContent}</div>
        )}
      </div>

      <div
        className="fixed bottom-3 z-50 select-none group"
        style={{
          left: `${position}%`,
          transform: 'translateX(-50%)',
          transition: isDragging ? 'none' : 'left 2.5s ease-in-out'
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="relative flex flex-col items-center">
          {!hasExpandedLayout && renderLabeledHoverMenu(true)}

          {/* The 2D Pixel Pet Canvas */}
          <div
            ref={petWrapperRef}
            onMouseDown={startMouseDrag}
            onClick={e => {
              e.stopPropagation();
              handlePetClick();
            }}
            className="cursor-grab active:cursor-grabbing"
          >
            <PixelPetCanvas
              petType={pet.petType}
              currentState={activeAnimationState}
              scaleSize={pet.scaleSize}
              disableWander={true}
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
        </div>
      </div>
    </>
  );
};
