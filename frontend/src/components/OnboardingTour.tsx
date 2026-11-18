import React, { useEffect, useState, useCallback } from 'react';
import { Sparkles, ChevronRight, ChevronLeft, X, CheckCircle2, Compass, MousePointerClick } from 'lucide-react';

export interface TourStep {
  id: string;
  targetSelector?: string; // If omitted, renders as centered welcome/outro dialog
  badge: string;
  title: string;
  greeting?: string;
  description: string;
  highlightTip?: string;
  petPoseLabel: string;
}

export const DEFAULT_ONBOARDING_STEPS: TourStep[] = [
  {
    id: 'welcome',
    badge: 'XIN CHÀO BẠN MỚI 👋',
    title: 'Chào mừng bạn đến với OfficePet 2D Pixel Art!',
    greeting: '“Xin chào! Mình là Mèo Shiro — người bạn đồng hành công sở của bạn đây! 🐾”',
    description:
      'OfficePet là không gian nuôi thú cưng ảo kết hợp công cụ tập trung Pomodoro, nhạc Lofi, trợ lý giọng nói AI và khu vườn phòng ban trực tuyến. Hãy cùng mình dạo một vòng ngắn qua các khu vực chính nhé!',
    highlightTip: 'Bạn có thể nhấn "Bắt đầu hướng dẫn" để xem từng khu vực hoặc nhấn "Bỏ qua (Skip)" bất cứ lúc nào.',
    petPoseLabel: 'Đang vẫy tay chào bạn'
  },
  {
    id: 'header-bar',
    targetSelector: '[data-tour="tour-header"]',
    badge: 'KHU VỰC 1 / 5 • THANH ĐIỀU HƯỚNG TRÊN CÙNG',
    title: 'Trung Tâm Điều Khiển Nhanh & Tài Khoản',
    greeting: '“Mọi công cụ tiện lợi nhất đều nằm ngay trên thanh trên cùng này nè!”',
    description:
      'Tại đây bạn có thể bật/tắt Nhạc nền Lofi, gọi Trợ lý giọng nói AI rảnh tay, bật chế độ Thú cưng nổi trên màn hình Desktop (PiP / Overlay), mở lại Hướng dẫn hoặc Đăng nhập / Đăng ký tài khoản.',
    highlightTip: 'Bạn có thể click thử trực tiếp vào vùng sáng hoặc bấm "Tiếp theo" để sang khu vực kế tiếp!',
    petPoseLabel: 'Giới thiệu thanh công cụ'
  },
  {
    id: 'hero-cta',
    targetSelector: '[data-tour="tour-hero-cta"]',
    badge: 'KHU VỰC 2 / 5 • CỔNG BẮT ĐẦU & TÀI KHOẢN',
    title: 'Khởi Đầu Hành Trình & Lưu Trữ Thú Cưng',
    greeting: '“Tạo tài khoản riêng để nhận nuôi bé cưng và lưu lại cấp độ, vật phẩm nhé!”',
    description:
      'Khu vực này giúp bạn Đăng nhập vào không gian làm việc hoặc Đăng ký tài khoản mới chỉ trong vài giây. Khi có tài khoản, mọi điểm kinh nghiệm (EXP), cấp độ tiến hóa và túi đồ của bé cưng đều được đồng bộ an toàn.',
    highlightTip: 'Sau khi kết thúc hướng dẫn, bạn có thể nhấn Đăng nhập hoặc Đăng ký ngay tại đây.',
    petPoseLabel: 'Sẵn sàng đồng hành'
  },
  {
    id: 'pet-sandbox',
    targetSelector: '[data-tour="tour-pet-sandbox"]',
    badge: 'KHU VỰC 3 / 5 • PHÒNG THÚ CƯNG TƯƠNG TÁC',
    title: 'Sân Khấu Thú Cưng 2D Pixel & Đổi Bối Cảnh Phòng',
    greeting: '“Đây là căn phòng của tụi mình! Bạn thử click vào mình hoặc đổi phòng xem sao nhé!”',
    description:
      'Trong căn phòng này, bạn có thể chuyển đổi qua lại giữa các loài thú cưng (Mèo Shiro, Corgi Bento, Thỏ Mochi, Chim Cánh Cụt Pingu, Husky Tuyết), đổi 5 chủ đề phòng (Quán Cafe, Vườn Xuân, Góc Zen, Bãi Biển, Trong Nhà) và nhấp trực tiếp vào thú cưng để vuốt ve!',
    highlightTip: '💡 Vùng sáng đang mở tương tác: Bạn hãy thử click đổi loài thú, đổi nền phòng hoặc nhấp vào thú cưng ngay bây giờ!',
    petPoseLabel: 'Đang vui vẻ trong phòng'
  },
  {
    id: 'exp-actions',
    targetSelector: '[data-tour="tour-exp-actions"]',
    badge: 'KHU VỰC 4 / 5 • BỂ CHỨA EXP & HÀNH ĐỘNG BIỂU CẢM',
    title: 'Tích Lũy Kinh Nghiệm (EXP) & 16 Động Thái',
    greeting: '“Mỗi khi bạn cho ăn, uống nước hay hoàn thành Pomodoro, bể EXP sẽ đầy dần lên đó!”',
    description:
      'Bên cạnh phòng thú cưng là Bể chứa EXP thủy tinh và bảng điều khiển hành động (Cho ăn, Uống nước, Vuốt ve, Làm việc, Nhảy múa, Đi ngủ, Thăng cấp...). Khi bể EXP đạt 100%, thú cưng sẽ tiến hóa lên cấp độ mới!',
    highlightTip: '💡 Hãy thử click vào nút "Cho ăn", "Uống nước" hoặc "Nhảy múa" ngay trong vùng sáng để xem hiệu ứng!',
    petPoseLabel: 'Háo hức nhận EXP'
  },
  {
    id: 'feature-ecosystem',
    targetSelector: '[data-tour="tour-features"]',
    badge: 'KHU VỰC 5 / 5 • HỆ SINH THÁI NĂNG SUẤT & KẾT NỐI',
    title: '6 Phân Hệ Chính: Pomodoro, AI, Lofi, Khu Vườn & Cửa Hàng',
    greeting: '“Và đây là toàn bộ các khu vực chức năng giúp bạn vừa làm việc hiệu quả vừa thư giãn!”',
    description:
      'Bao gồm: (1) Đồng hồ Pomodoro & Báo thức thú cưng, (2) Trợ lý giọng nói AI "Hello" & Chat tâm sự, (3) Đài phát nhạc Lofi & YouTube TV, (4) Khu vườn chung phòng ban & Bảng xếp hạng, (5) Cửa hàng trang phục & Nhiệm vụ ngày, (6) Chế độ Nổi trên màn hình Desktop.',
    highlightTip: 'Nhấn "Hoàn tất hướng dẫn" để tự do khám phá giao diện trang chủ hoặc đăng nhập ngay nhé!',
    petPoseLabel: 'Ăn mừng hoàn tất'
  }
];

interface OnboardingTourProps {
  isOpen: boolean;
  onCompleteOrSkip: () => void;
  steps?: TourStep[];
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  isOpen,
  onCompleteOrSkip,
  steps = DEFAULT_ONBOARDING_STEPS
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const [interactedInStep, setInteractedInStep] = useState(false);

  const currentStep = steps[currentStepIndex] || steps[0];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  // Reset step to 0 when tour opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(0);
      setInteractedInStep(false);
    }
  }, [isOpen]);

  const updateSpotlightRect = useCallback(() => {
    if (!isOpen || !currentStep?.targetSelector) {
      setSpotlightRect(null);
      return;
    }

    const targetEl = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
    if (!targetEl) {
      setSpotlightRect(null);
      return;
    }

    const rect = targetEl.getBoundingClientRect();
    const pad = 8;
    const top = Math.max(4, rect.top - pad);
    const left = Math.max(4, rect.left - pad);
    const width = Math.min(window.innerWidth - left - 4, rect.width + pad * 2);
    const height = Math.min(window.innerHeight - top - 4, rect.height + pad * 2);

    setSpotlightRect({ top, left, width, height });
  }, [isOpen, currentStep?.targetSelector]);

  // Scroll target into view when step changes
  useEffect(() => {
    setInteractedInStep(false);
    if (!isOpen) return;

    if (!currentStep?.targetSelector) {
      setSpotlightRect(null);
      return;
    }

    const targetEl = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }

    // Update rect immediately and after smooth scroll settles
    updateSpotlightRect();
    const t1 = setTimeout(updateSpotlightRect, 180);
    const t2 = setTimeout(updateSpotlightRect, 420);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isOpen, currentStepIndex, currentStep?.targetSelector, updateSpotlightRect]);

  // Keep spotlight rect synced on window resize or scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleLayoutUpdate = () => {
      updateSpotlightRect();
    };

    window.addEventListener('resize', handleLayoutUpdate);
    window.addEventListener('scroll', handleLayoutUpdate, true);

    return () => {
      window.removeEventListener('resize', handleLayoutUpdate);
      window.removeEventListener('scroll', handleLayoutUpdate, true);
    };
  }, [isOpen, updateSpotlightRect]);

  // Listen for clicks inside the highlighted target area so user gets feedback when clicking the lit zone
  useEffect(() => {
    if (!isOpen || !currentStep?.targetSelector) return;
    const targetEl = document.querySelector(currentStep.targetSelector);
    if (!targetEl) return;

    const handleTargetClick = () => {
      setInteractedInStep(true);
      setTimeout(updateSpotlightRect, 100);
    };

    targetEl.addEventListener('click', handleTargetClick, true);
    return () => {
      targetEl.removeEventListener('click', handleTargetClick, true);
    };
  }, [isOpen, currentStep?.targetSelector, updateSpotlightRect]);

  // Keyboard navigation support (Right/Left/Escape)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCompleteOrSkip();
      } else if (e.key === 'ArrowRight') {
        if (currentStepIndex < steps.length - 1) {
          setCurrentStepIndex(i => i + 1);
        } else {
          onCompleteOrSkip();
        }
      } else if (e.key === 'ArrowLeft' && currentStepIndex > 0) {
        setCurrentStepIndex(i => i - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStepIndex, steps.length, onCompleteOrSkip]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (isLastStep) {
      onCompleteOrSkip();
    } else {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  // Compute smart position for the floating tour card so it doesn't cover the lit spotlight area
  const getDialogPositionStyle = (): React.CSSProperties => {
    if (!spotlightRect) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
    }

    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const cardMaxWidth = Math.min(460, viewportW - 24);
    const spaceBelow = viewportH - (spotlightRect.top + spotlightRect.height);
    const spaceAbove = spotlightRect.top;

    // Center horizontally relative to spotlight, clamped to viewport
    const desiredLeft = spotlightRect.left + spotlightRect.width / 2 - cardMaxWidth / 2;
    const clampedLeft = Math.max(12, Math.min(viewportW - cardMaxWidth - 12, desiredLeft));
    const cardEstHeight = 335;

    if (spaceBelow >= cardEstHeight) {
      return {
        top: `${Math.max(12, Math.min(viewportH - cardEstHeight, spotlightRect.top + spotlightRect.height + 12))}px`,
        left: `${clampedLeft}px`,
        width: `${cardMaxWidth}px`
      };
    }
    if (spaceAbove >= cardEstHeight) {
      return {
        bottom: `${Math.max(12, viewportH - spotlightRect.top + 12)}px`,
        left: `${clampedLeft}px`,
        width: `${cardMaxWidth}px`
      };
    }

    // If spotlight is tall or near middle, dock card at bottom-right cleanly inside viewport
    return {
      bottom: '16px',
      right: '16px',
      width: `${cardMaxWidth}px`
    };
  };

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none select-none font-sans">
      {/* ===================================================================== */}
      {/* 1. 4-PANE SURROUND DIMMER & BLUR (Leaves Spotlight Target 100% Lit & Clickable!) */}
      {/* ===================================================================== */}
      {spotlightRect ? (
        <>
          {/* Top Dimmed Pane */}
          <div
            onClick={handleNext}
            title="Nhấn để sang bước tiếp theo"
            className="fixed left-0 right-0 top-0 bg-slate-950/75 backdrop-blur-[2px] pointer-events-auto transition-all duration-300 cursor-pointer"
            style={{ height: `${Math.max(0, spotlightRect.top)}px` }}
          />
          {/* Bottom Dimmed Pane */}
          <div
            onClick={handleNext}
            title="Nhấn để sang bước tiếp theo"
            className="fixed left-0 right-0 bottom-0 bg-slate-950/75 backdrop-blur-[2px] pointer-events-auto transition-all duration-300 cursor-pointer"
            style={{ top: `${spotlightRect.top + spotlightRect.height}px` }}
          />
          {/* Left Dimmed Pane */}
          <div
            onClick={handleNext}
            title="Nhấn để sang bước tiếp theo"
            className="fixed left-0 bg-slate-950/75 backdrop-blur-[2px] pointer-events-auto transition-all duration-300 cursor-pointer"
            style={{
              top: `${spotlightRect.top}px`,
              height: `${spotlightRect.height}px`,
              width: `${Math.max(0, spotlightRect.left)}px`
            }}
          />
          {/* Right Dimmed Pane */}
          <div
            onClick={handleNext}
            title="Nhấn để sang bước tiếp theo"
            className="fixed right-0 bg-slate-950/75 backdrop-blur-[2px] pointer-events-auto transition-all duration-300 cursor-pointer"
            style={{
              top: `${spotlightRect.top}px`,
              height: `${spotlightRect.height}px`,
              left: `${spotlightRect.left + spotlightRect.width}px`
            }}
          />

          {/* Glowing Pixel Frame Around the Lit Area (pointer-events-none so user can click inside freely!) */}
          <div
            className="fixed rounded-2xl border-3 border-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.28),0_0_30px_rgba(251,191,36,0.55)] pointer-events-none transition-all duration-300 z-[101]"
            style={{
              top: `${spotlightRect.top}px`,
              left: `${spotlightRect.left}px`,
              width: `${spotlightRect.width}px`,
              height: `${spotlightRect.height}px`
            }}
          >
            {/* Corner Pixel Badges */}
            <div className="absolute -top-3 left-3 bg-amber-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-md border-2 border-slate-950 shadow-[2px_2px_0_#000] flex items-center gap-1">
              <MousePointerClick size={11} />
              <span>VÙNG ĐANG GIỚI THIỆU (CÓ THỂ CLICK THỬ)</span>
            </div>
          </div>
        </>
      ) : (
        /* Full-Screen Dimmer for Centered Welcome Step */
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs pointer-events-auto transition-opacity duration-300" />
      )}

      {/* ===================================================================== */}
      {/* 2. MASCOT DIALOGUE & TOUR CONTROL CARD                                */}
      {/* ===================================================================== */}
      <div
        style={getDialogPositionStyle()}
        className={`fixed z-[105] pointer-events-auto transition-all duration-300 ${
          !spotlightRect ? 'w-[calc(100vw-24px)] max-w-lg' : ''
        }`}
      >
        <div className="bg-[#23293a] text-white border-4 border-slate-950 rounded-2xl p-4 sm:p-5 shadow-[6px_6px_0px_#000] ring-2 ring-amber-400/70">
          {/* Card Header: Step Badge + Skip Button */}
          <div className="flex items-center justify-between gap-2 pb-2.5 mb-3 border-b-2 border-slate-800">
            <div className="flex items-center gap-1.5">
              <Compass size={14} className="text-amber-400 shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                {currentStep.badge}
              </span>
            </div>

            <button
              type="button"
              onClick={onCompleteOrSkip}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white text-[11px] font-black border border-slate-700 transition flex items-center gap-1 cursor-pointer shrink-0"
              title="Bỏ qua hướng dẫn (Phím Esc)"
            >
              <span>Bỏ qua (Skip)</span>
              <X size={12} />
            </button>
          </div>

          {/* Mascot Avatar + Greeting & Explanation */}
          <div className="flex items-start gap-3.5">
            <div className="flex flex-col items-center shrink-0">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-[#fffcf7] border-2 border-[#b88256] flex items-center justify-center overflow-hidden shadow-[2px_2px_0_#000]">
                <img
                  src="/brand/officepet_cat_logo.png"
                  alt="Mèo Shiro Hướng Dẫn"
                  className="w-12 h-12 sm:w-14 sm:h-14 object-contain animate-bounce"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
              <span className="mt-1 px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[9px] whitespace-nowrap">
                Mèo Shiro
              </span>
            </div>

            <div className="min-w-0 flex-1 space-y-1.5">
              <h3 className="text-sm sm:text-base font-black text-white leading-snug">
                {currentStep.title}
              </h3>

              {currentStep.greeting && (
                <div className="text-xs font-bold text-amber-300 bg-[#313b52] border border-amber-400/30 rounded-lg px-2.5 py-1.5 italic">
                  {currentStep.greeting}
                </div>
              )}

              <p className="text-xs text-slate-200 leading-relaxed font-medium">
                {currentStep.description}
              </p>

              {currentStep.highlightTip && (
                <div
                  className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 ${
                    interactedInStep
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                      : 'bg-indigo-950/70 border-indigo-400/30 text-indigo-200'
                  }`}
                >
                  {interactedInStep ? (
                    <>
                      <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                      <span>Tuyệt vời! Bạn vừa tương tác trực tiếp với khu vực này! ✨</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} className="text-amber-300 shrink-0" />
                      <span>{currentStep.highlightTip}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Step Dots + Navigation Buttons */}
          <div className="mt-4 pt-3 border-t-2 border-slate-800 flex flex-wrap items-center justify-between gap-2">
            {/* Progress Dots */}
            <div className="flex items-center gap-1.5">
              {steps.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCurrentStepIndex(idx)}
                  title={`Chuyển tới bước ${idx + 1}`}
                  className={`h-2.5 rounded-full transition-all cursor-pointer ${
                    idx === currentStepIndex
                      ? 'w-6 bg-amber-400'
                      : idx < currentStepIndex
                      ? 'w-2.5 bg-emerald-400'
                      : 'w-2.5 bg-slate-700 hover:bg-slate-500'
                  }`}
                />
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {!isFirstStep && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="h-9 px-3 rounded-xl bg-[#343e56] hover:bg-[#455372] text-slate-200 text-xs font-black border-2 border-slate-950 shadow-[0_2px_0_#000] active:translate-y-[1px] transition flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft size={14} />
                  <span>Quay lại</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="h-9 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black border-2 border-slate-950 shadow-[0_2px_0_#000] active:translate-y-[1px] transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>
                  {isFirstStep
                    ? 'Bắt đầu khám phá'
                    : isLastStep
                    ? 'Hoàn tất hướng dẫn ✨'
                    : 'Tiếp theo'}
                </span>
                {!isLastStep && <ChevronRight size={14} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
