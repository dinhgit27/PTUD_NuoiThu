import React, { useState, useEffect } from 'react';
import { PixelPetCanvas } from './PixelPetCanvas';
import { AnimationState, LofiTrack, MusicRequest, UserPet } from '../types';
import { AICompanionChat } from './AICompanionChat';
import { MusicPlayer } from './MusicPlayer';
import { PomodoroTimer } from './PomodoroTimer';
import {
  Utensils,
  Heart,
  MessageSquare,
  Timer,
  Music,
  Coffee,
  Sparkles,
  X,
  Minimize2,
  Move,
  ExternalLink,
  HelpCircle,
  Monitor,
  Compass,
  Pin
} from 'lucide-react';

interface DesktopOverlayProps {
  pet: UserPet;
  onFeed: () => void;
  onStroke: () => void;
  onCloseOverlay: () => void;
  onPetStateChange?: (state: AnimationState) => void;
  onModeChange?: (mode: 'STRICT' | 'RELAXED') => void;
  onSessionFinish?: (expAward: number) => void;
  onTrackSelect?: (track: LofiTrack) => void;
  onPetInteraction?: (state: AnimationState, message: string) => void;
  onPanelVisibilityChange?: (panel: 'menu' | 'chat' | 'pomodoro' | 'music' | null) => void;
  speechBubble?: string | null;
  isDesktopWindow?: boolean;
  petSide?: 'left' | 'right';
}

export const DesktopOverlay: React.FC<DesktopOverlayProps> = ({
  pet,
  onFeed,
  onStroke,
  onCloseOverlay,
  onPetStateChange,
  onModeChange,
  onSessionFinish,
  onTrackSelect,
  onPetInteraction,
  onPanelVisibilityChange,
  speechBubble,
  isDesktopWindow = false,
  petSide = 'right'
}) => {
  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [activePanel, setActivePanel] = useState<'chat' | 'pomodoro' | 'music' | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [isRoaming, setIsRoaming] = useState(true);
  const [isWalking, setIsWalking] = useState(false);
  const [facingDirection, setFacingDirection] = useState<'left' | 'right'>('right');
  const [isHovered, setIsHovered] = useState(false);
  const [musicRequest, setMusicRequest] = useState<MusicRequest>();

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

  const setPanel = (panel: 'chat' | 'pomodoro' | 'music' | null) => {
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

  const quickMenu = (
    <div className="electron-overlay-no-drag grid grid-cols-2 gap-2 rounded-xl border-2 border-charcoal bg-cream-100 p-3 shadow-pixel">
      <div className="col-span-2 flex items-center justify-between border-b border-charcoal/20 pb-2">
        <span className="font-pixel text-[10px] font-bold text-charcoal">BẠN MUỐN LÀM GÌ?</span>
        <button type="button" onClick={() => setShowQuickMenu(false)} className="rounded p-1 hover:bg-charcoal/10" aria-label="Đóng menu">
          <X size={14} />
        </button>
      </div>
      <button type="button" onClick={() => setPanel('chat')} className="flex min-h-11 items-center gap-2 rounded-lg border border-charcoal bg-sage-400 px-3 py-2 text-left text-xs font-bold text-white hover:bg-sage-500">
        <MessageSquare size={16} /> Trò chuyện với bé
      </button>
      <button type="button" onClick={() => setPanel('pomodoro')} className="flex min-h-11 items-center gap-2 rounded-lg border border-charcoal bg-indigo-500 px-3 py-2 text-left text-xs font-bold text-white hover:bg-indigo-600">
        <Timer size={16} /> Mở Pomodoro
      </button>
      <button type="button" onClick={() => setPanel('music')} className="flex min-h-11 items-center gap-2 rounded-lg border border-charcoal bg-violet-500 px-3 py-2 text-left text-xs font-bold text-white hover:bg-violet-600">
        <Music size={16} /> Mở nhạc
      </button>
      <button type="button" disabled={pet.dailyInteractionsLeft <= 0} onClick={() => { onFeed(); setShowQuickMenu(false); }} className="flex min-h-11 items-center gap-2 rounded-lg border border-charcoal bg-terracotta-400 px-3 py-2 text-left text-xs font-bold text-white hover:bg-terracotta-500 disabled:opacity-50">
        <Utensils size={16} /> Cho ăn (+50 EXP)
      </button>
      <button type="button" disabled={pet.dailyInteractionsLeft <= 0} onClick={() => { onStroke(); setShowQuickMenu(false); }} className="flex min-h-11 items-center gap-2 rounded-lg border border-charcoal bg-pink-400 px-3 py-2 text-left text-xs font-bold text-white hover:bg-pink-500 disabled:opacity-50">
        <Heart size={16} /> Vuốt ve (+30 EXP)
      </button>
      <button type="button" onClick={() => interaction('DRINKING', 'Cùng nghỉ uống nước một chút nhé! 💧')} className="flex min-h-11 items-center gap-2 rounded-lg border border-charcoal bg-cyan-600 px-3 py-2 text-left text-xs font-bold text-white hover:bg-cyan-700">
        <Coffee size={16} /> Uống nước cùng bé
      </button>
      <button type="button" onClick={() => interaction('DANCING', 'Chơi với bạn vui quá, mình nhảy một điệu nhé! 🎵')} className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-lg border border-charcoal bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-600">
        <Sparkles size={16} /> Chơi / nhảy cùng bé
      </button>
    </div>
  );

  const handleOpenPiP = async () => {
    if ('documentPictureInPicture' in window) {
      try {
        const pipWindow = await (window as any).documentPictureInPicture.requestWindow({
          width: 240,
          height: 240
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
        pipDiv.style.cssText = 'width: 100vw; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; background: #faf8f5; overflow: hidden;';
        pipWindow.document.body.appendChild(pipDiv);
        pipWindow.document.body.style.margin = '0';
        pipWindow.document.body.style.overflow = 'hidden';

        const { createRoot } = await import('react-dom/client');
        const root = createRoot(pipDiv);
        root.render(
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', userSelect: 'none' }}>
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
    <div className="electron-overlay-no-drag absolute inset-1 bg-cream-100 border-2 border-charcoal rounded-xl p-3 shadow-pixel z-[80] flex flex-col justify-between text-charcoal animate-in fade-in zoom-in-95">
      <div>
        <div className="flex items-center justify-between pb-1.5 mb-2 border-b-2 border-charcoal/15">
          <span className="font-pixel text-[10px] text-terracotta-500 font-bold flex items-center gap-1">
            📖 HƯỚNG DẪN THAO TÁC
          </span>
          <button
            type="button"
            onClick={() => setShowGuide(false)}
            className="p-0.5 hover:text-red-500 rounded"
            title="Đóng"
          >
            <X size={14} />
          </button>
        </div>
        <div className="space-y-1.5 text-[10px] leading-tight">
          <div className="flex items-start gap-1.5">
            <span className="bg-sage-500 text-white px-1.5 py-0.5 rounded text-[8.5px] font-pixel whitespace-nowrap">Ctrl+Shift+P</span>
            <span>Ẩn / Hiện thú cưng tức thì mọi lúc.</span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="bg-emerald-600 text-white px-1.5 py-0.5 rounded text-[8.5px] font-pixel whitespace-nowrap">🧭 Đi dạo</span>
            <span>Bé cưng tự động đi dạo quanh màn hình (bấm 📌 để ghim đứng yên).</span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="bg-charcoal text-white px-1.5 py-0.5 rounded text-[8.5px] font-pixel whitespace-nowrap">Kéo chuột ✥</span>
            <span>Giữ thanh trên để kéo pet đến bất kỳ vị trí nào.</span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="bg-pink-400 text-white px-1.5 py-0.5 rounded text-[8.5px] font-pixel whitespace-nowrap">Nhấp Bé Cưng</span>
            <span>Vuốt ve (+30 EXP & Hạnh phúc ❤️).</span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="bg-terracotta-400 text-white px-1.5 py-0.5 rounded text-[8.5px] font-pixel whitespace-nowrap">Menu ✨</span>
            <span>Cho ăn 🍱 (+50 EXP), Chat AI 💬, Pomodoro ⏱️.</span>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setShowGuide(false)}
        className="w-full mt-2 py-1 bg-sage-500 hover:bg-sage-600 text-white font-pixel text-[10px] rounded-lg border border-charcoal shadow-pixel-sm transition-transform active:scale-95"
      >
        Đã hiểu ✓
      </button>
    </div>
  );

  const activeAnimationState = isWalking ? 'WALKING' : pet.currentState;

  // -------------------------------------------------------------
  // ELECTRON DESKTOP WINDOW LAYOUT (Compact 280x260 floating widget)
  // -------------------------------------------------------------
  if (isDesktopWindow) {
    const hasExpandedLayout = Boolean(activePanel || showQuickMenu || showGuide);
    const isMusicPanel = activePanel === 'music';
    const renderPet = (
      <PixelPetCanvas
        petType={pet.petType}
        currentState={activeAnimationState}
        scaleSize={pet.scaleSize || 'MEDIUM'}
        speechBubble={speechBubble}
        onPetClick={onStroke}
        petName={pet.name}
        petLevel={pet.level}
        hunger={pet.hunger}
        happiness={pet.happiness}
        equippedItems={pet.userItems}
        showTooltip={true}
        facingDirection={facingDirection}
      />
    );

    return (
      <div className="relative flex h-full w-full min-w-0 flex-col select-none p-1.5">
        <div className="flex shrink-0 justify-center">
        <div className="electron-overlay-drag inline-flex items-center gap-1.5 bg-charcoal/90 backdrop-blur-sm text-white px-2.5 py-1 rounded-full border border-white/20 shadow-pixel-sm mb-1 max-w-[240px] whitespace-nowrap">
          <div className="flex items-center gap-1 cursor-move select-none">
            <Move size={11} className="text-sage-300" />
            <span className="font-pixel text-[9px] text-white tracking-wide truncate max-w-[80px]">🐾 {pet.name}</span>
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
                isRoaming ? 'text-emerald-400 hover:bg-white/20' : 'text-yellow-400 hover:bg-white/20'
              }`}
              title={isRoaming ? 'Bé cưng đang đi dạo (Nhấp để Ghim đứng yên)' : 'Đang ghim vị trí (Nhấp để Cho bé đi dạo)'}
            >
              {isRoaming ? <Compass size={13} /> : <Pin size={13} />}
            </button>
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="p-1 rounded hover:bg-white/20 hover:text-yellow-300 text-white/80 transition-colors"
              title="Hướng dẫn & Phím tắt (Ctrl+Shift+P)"
            >
              <HelpCircle size={13} />
            </button>
            <button
              type="button"
              onClick={() => setShowQuickMenu(!showQuickMenu)}
              className="p-1 rounded hover:bg-white/20 hover:text-terracotta-400 text-white/80 transition-colors"
              title="Menu tương tác nhanh"
            >
              <Sparkles size={13} />
            </button>
            <button
              type="button"
              onClick={() => window.officePet?.showDashboard()}
              className="p-1 rounded hover:bg-white/20 hover:text-sage-300 text-white/80 transition-colors"
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
          </div>
        </div>
        </div>

        <div className={`relative flex min-h-0 ${hasExpandedLayout ? 'flex-1 items-end gap-2' : 'flex-1 items-center justify-center'}`}>
          {hasExpandedLayout && petSide === 'left' && (
            <aside className="relative z-20 flex w-[160px] shrink-0 items-end justify-center pb-1">
              {renderPet}
            </aside>
          )}

          <section className={`electron-overlay-no-drag z-[60] flex min-w-0 flex-col rounded-xl border-2 border-charcoal bg-cream-100 p-3 shadow-pixel ${
            hasExpandedLayout
              ? `relative my-1 min-h-0 shrink-0 ${isMusicPanel ? 'h-[480px] w-[400px]' : 'h-[400px] w-[380px]'}`
              : hasExpandedLayout ? 'relative my-1 min-h-0 w-[360px] shrink-0'
              : 'pointer-events-none absolute left-[-10000px] top-0 h-[480px] w-[400px] opacity-0'
          }`}>
            {activePanel && (
              activePanel !== 'chat' && (
                <header className="mb-2 flex shrink-0 items-center justify-between border-b border-charcoal/20 pb-2">
                  <span className="font-pixel text-[10px] font-bold text-charcoal">
                    {activePanel === 'pomodoro' ? 'POMODORO' : 'NGHE NHẠC'}
                  </span>
                  <button type="button" onClick={() => setPanel(null)} className="rounded bg-charcoal p-1 text-white hover:bg-red-600" aria-label="Đóng bảng điều khiển" title="Đóng bảng điều khiển">
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
                  ? 'left-[-9px] border-y-[9px] border-y-transparent border-r-[9px] border-r-charcoal after:absolute after:left-[2px] after:top-[-6px] after:h-0 after:w-0 after:border-y-[6px] after:border-y-transparent after:border-r-[6px] after:border-r-cream-100 after:content-[""]'
                  : 'right-[-9px] border-y-[9px] border-y-transparent border-l-[9px] border-l-charcoal after:absolute after:right-[2px] after:top-[-6px] after:h-0 after:w-0 after:border-y-[6px] after:border-y-transparent after:border-l-[6px] after:border-l-cream-100 after:content-[""]'
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
              className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-center"
              onMouseEnter={() => {
                setIsHovered(true);
                window.officePet?.stopWalking();
              }}
              onMouseLeave={() => setIsHovered(false)}
            >
              <div className="cursor-pointer transition-transform hover:scale-105 active:scale-95" title="Nhấp chuột để vuốt ve bé cưng (+30 EXP)">
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
        className={`electron-overlay-no-drag fixed bottom-[180px] z-[60] flex max-h-[calc(100vh-200px)] w-[380px] max-w-[calc(100vw-24px)] flex-col overflow-y-auto rounded-xl border-2 border-charcoal bg-cream-100 p-3 shadow-pixel ${activePanel ? '' : 'pointer-events-none opacity-0'}`}
        style={{
          left: `max(min(210px, 50vw), min(calc(100vw - min(210px, 50vw)), ${position}%))`,
          transform: 'translateX(-50%)',
          ...(activePanel ? { height: activePanel === 'chat' ? 'min(440px, calc(100vh - 200px))' : 'min(520px, calc(100vh - 200px))' } : {})
        }}
      >
          {activePanel && (
          <header className="mb-2 flex items-center justify-between border-b border-charcoal/20 pb-2">
            <span className="font-pixel text-[10px] font-bold text-charcoal">
              {activePanel === 'chat' ? 'TRÒ CHUYỆN' : activePanel === 'pomodoro' ? 'POMODORO' : 'NGHE NHẠC'}
            </span>
            <button type="button" onClick={() => setPanel(null)} className="rounded bg-charcoal p-1 text-white hover:bg-red-600" aria-label="Đóng bảng điều khiển" title="Đóng bảng điều khiển">
              <X size={14} />
            </button>
          </header>
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
          <div className="absolute -top-7 flex items-center gap-1 bg-charcoal/80 backdrop-blur-sm text-white px-2 py-0.5 rounded-t-md opacity-0 group-hover:opacity-100 transition-opacity electron-overlay-no-drag">
            <button
              type="button"
              className="cursor-ew-resize p-0.5 hover:text-sage-300"
              onMouseDown={handleMouseDown}
              title="Kéo thả vị trí"
            >
              <Move size={12} />
            </button>
            <button
              type="button"
              onClick={() => setIsRoaming(!isRoaming)}
              className={`p-0.5 ${isRoaming ? 'text-emerald-400' : 'text-yellow-400'}`}
              title={isRoaming ? 'Bé cưng đang đi dạo (Nhấp để Ghim đứng yên)' : 'Đang ghim vị trí (Nhấp để Bật đi dạo)'}
            >
              {isRoaming ? <Compass size={12} /> : <Pin size={12} />}
            </button>
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="p-0.5 hover:text-yellow-300"
              title="Hướng dẫn phím tắt & thao tác"
            >
              <HelpCircle size={12} />
            </button>
            <button
              type="button"
              onClick={() => setShowQuickMenu(!showQuickMenu)}
              className="p-0.5 hover:text-terracotta-400"
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
          </div>

          {/* The 2D Pixel Pet Canvas */}
          <div>
            <PixelPetCanvas
              petType={pet.petType}
              currentState={activeAnimationState}
              scaleSize={pet.scaleSize}
              speechBubble={speechBubble}
              onPetClick={onStroke}
              petName={pet.name}
              petLevel={pet.level}
              hunger={pet.hunger}
              happiness={pet.happiness}
              equippedItems={pet.userItems}
              showTooltip={true}
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
