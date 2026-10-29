import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from './services/api';
import { User, UserPet, AnimationState, MusicRequest, PetType } from './types';
import { PixelPetCanvas } from './components/PixelPetCanvas';
import { DesktopOverlay } from './components/DesktopOverlay';
import { DesktopPetPiPView } from './components/DesktopPetPiPView';
import { PomodoroTimer, TimerRequest } from './components/PomodoroTimer';
import { AICompanionChat } from './components/AICompanionChat';
import { SharedGarden } from './components/SharedGarden';
import { MusicPlayer } from './components/MusicPlayer';
import { AdminConsole } from './components/AdminConsole';
import { AuthModal } from './components/AuthModal';
import { DepartmentWorkspace } from './components/DepartmentWorkspace';
import { PetShop } from './components/PetShop';
import { FriendsModal } from './components/FriendsModal';
import { BreathingExerciseModal } from './components/BreathingExerciseModal';
import { QuestModal } from './components/QuestModal';
import { ProfileModal } from './components/ProfileModal';
import { VoiceAssistant } from './components/VoiceAssistant';
import { getSocket } from './services/socket';
import { PET_RESPONSES } from './utils/petResponses';
import { playTtsSpeech } from './utils/tts';
import { formatCleanSongTitle } from './utils/songFormatter';

import {
  Heart, Utensils, MessageSquare, Timer, TreePine, Music, ShoppingBag,
  ShieldAlert, LogIn, LogOut, Sparkles, Trophy, Minimize2, Users,
  Maximize2, Activity, Coffee, Sun, Monitor, HelpCircle, X, Pencil, Award,
  Moon, Smile, ThumbsUp, Footprints, Flame, Zap, Camera, Volume2,
  GraduationCap, ShieldCheck, Coins, RefreshCw, Hand, Droplets, Menu,
  Crown, Share2, ChevronRight, ChevronLeft, Clock
} from 'lucide-react';

const PET_ANIMATION_ACTIONS: Array<{
  state: Exclude<AnimationState, 'WALKING'>;
  label: string;
}> = [
  { state: 'IDLE', label: 'Đứng yên' },
  { state: 'TYPING', label: 'Làm việc' },
  { state: 'SLEEPING', label: 'Ngủ' },
  { state: 'WAKING_UP', label: 'Thức dậy' },
  { state: 'HAPPY', label: 'Vui vẻ' },
  { state: 'SAD', label: 'Buồn' },
  { state: 'YAWNING', label: 'Ngáp ngủ' },
  { state: 'HUNGRY', label: 'Đói bụng' },
  { state: 'EATING', label: 'Ăn uống' },
  { state: 'PETTING', label: 'Vuốt ve' },
  { state: 'DANCING', label: 'Nhảy múa' },
  { state: 'DRINKING', label: 'Uống nước' },
  { state: 'EXERCISING', label: 'Tập thể dục' },
  { state: 'WAVING', label: 'Vẫy tay' },
  { state: 'THANKING', label: 'Cảm ơn' },
  { state: 'CELEBRATING', label: 'Ăn mừng' },
  { state: 'EVOLVING', label: 'Tiến hóa' },
];

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [pet, setPet] = useState<UserPet | null>(null);
  const [petTypes, setPetTypes] = useState<PetType[]>([]);
  const [ownedPetTypeIds, setOwnedPetTypeIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<
    'PET' | 'SHOP' | 'GARDEN' | 'FOCUS' | 'AI_CHAT' | 'MUSIC' | 'LEADERBOARD' | 'DEPARTMENT' | 'QUESTS' | 'ADMIN'
  >('PET');

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isOverlayVisible, setIsOverlayVisible] = useState(true);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [isPetSelectorOpen, setIsPetSelectorOpen] = useState(false);
  const [isPetActionsOpen, setIsPetActionsOpen] = useState(false);
  const [isPetRenameOpen, setIsPetRenameOpen] = useState(false);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [isBreathingModalOpen, setIsBreathingModalOpen] = useState(false);
  const [breathingDuration, setBreathingDuration] = useState(2);
  const [petNameDraft, setPetNameDraft] = useState('');
  const [isRenamingPet, setIsRenamingPet] = useState(false);
  const [speechBubble, setSpeechBubble] = useState<string | null>(null);
  const [musicRequest, setMusicRequest] = useState<MusicRequest>();
  const [timerRequest, setTimerRequest] = useState<TimerRequest>();
  const [isYoutubePlaying, setIsYoutubePlaying] = useState(false);
  const [isBgmPlaying, setIsBgmPlaying] = useState(true);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const bgmManualOffRef = useRef(false);
  const idleAnimationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pipContainer, setPipContainer] = useState<HTMLElement | null>(null);
  const pipWindowRef = useRef<any>(null);

  // Initialize default web background music (/audio/bgm_lofi.mp3)
  useEffect(() => {
    const audio = new Audio('/audio/bgm_lofi.mp3');
    audio.loop = true;
    audio.volume = 0.32;
    bgmRef.current = audio;

    const tryPlayBgm = () => {
      if (bgmManualOffRef.current || !bgmRef.current) return;
      bgmRef.current
        .play()
        .then(() => {
          setIsBgmPlaying(true);
        })
        .catch(() => {
          // Browser autoplay policy waiting for first user gesture
        });
    };

    tryPlayBgm();

    const unlockOnFirstInteraction = () => {
      if (!bgmManualOffRef.current && bgmRef.current && bgmRef.current.paused) {
        bgmRef.current
          .play()
          .then(() => setIsBgmPlaying(true))
          .catch(() => {});
      }
      window.removeEventListener('pointerdown', unlockOnFirstInteraction);
      window.removeEventListener('keydown', unlockOnFirstInteraction);
    };

    window.addEventListener('pointerdown', unlockOnFirstInteraction);
    window.addEventListener('keydown', unlockOnFirstInteraction);

    return () => {
      window.removeEventListener('pointerdown', unlockOnFirstInteraction);
      window.removeEventListener('keydown', unlockOnFirstInteraction);
      audio.pause();
      bgmRef.current = null;
    };
  }, []);

  const stopAllMusic = () => {
    bgmManualOffRef.current = true;
    if (bgmRef.current) {
      bgmRef.current.pause();
    }
    setIsBgmPlaying(false);
    setMusicRequest({ query: '__STOP_MUSIC__', autoPlay: false, requestId: Date.now() });
  };

  const resumeDefaultBgm = () => {
    bgmManualOffRef.current = false;
    setMusicRequest({ query: '__STOP_MUSIC__', autoPlay: false, requestId: Date.now() });
    if (bgmRef.current) {
      bgmRef.current.play().then(() => setIsBgmPlaying(true)).catch(() => {});
    }
  };

  const pauseBgmForCustomSong = () => {
    bgmManualOffRef.current = true;
    if (bgmRef.current) {
      bgmRef.current.pause();
    }
    setIsBgmPlaying(false);
  };

  // Auth modal
  // Profile modal
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [isAuthOpen, setIsAuthOpen] = useState(() =>
    Boolean(new URLSearchParams(window.location.search).get('resetToken'))
  );

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<any | null>(null);
  const [leaderboardFilter, setLeaderboardFilter] = useState<'WEEK' | 'MONTH' | 'SEMESTER' | 'ALL'>('WEEK');

  // Scale size selection (default to LARGE for prominent pet)
  const [currentScale, setCurrentScale] = useState<'SMALL' | 'MEDIUM' | 'LARGE'>('LARGE');
  // Pet Sanctuary Room Theme
  const [petRoomTheme, setPetRoomTheme] = useState<'cafe' | 'garden' | 'office' | 'beach' | 'room'>('cafe');

  useEffect(() => {
    if (!user || !pet || user.preference?.quietMode) return;
    const messages = [
      'Bạn nhớ uống chút nước nhé! 💧',
      'Cố lên, mình đang cổ vũ bạn đây! ✨',
      'Thả lỏng vai một chút rồi làm tiếp nha. 🌿',
      'Làm tốt lắm! Nghỉ mắt vài giây nhé. 👀',
      'Hôm nay bạn làm việc chăm chỉ ghê, mình tự hào lắm! 🥰',
      'Có mình ở đây cùng bạn nè, cứ từ từ thôi nhé. 🤗',
      'Bạn đang tập trung tuyệt vời đó! 💪',
      'Mình hơi buồn ngủ rồi... mình nghỉ cùng nhau một lát nhé? 😴',
      'Kể mình nghe hôm nay bạn thấy thế nào nhé? 💬',
      'Một việc nhỏ hoàn thành cũng đáng ăn mừng đó! 🎉',
      'Mình tin bạn sẽ làm được, cố lên nha! 🌟',
      'Đừng quên chớp mắt và nhìn xa một chút nhé. 👀',
      'Mình đang vui vì được ở bên bạn! 💖',
      'Nếu thấy mệt thì nghỉ ngắn một chút cũng không sao đâu. 🍵',
      'Bạn muốn nghe một bài nhạc thật chill không? 🎶',
      'Từng bước một thôi, bạn đang tiến bộ rồi! 🌱',
      'Mình đang tò mò không biết bạn làm gì đó! 🐾',
      'Cảm ơn bạn đã dành thời gian chơi với mình nha! 💕',
      'Nào, cùng hít thở sâu một hơi thật chậm nhé. 🌬️',
      'Bạn đã cố gắng nhiều rồi, nhớ dịu dàng với bản thân nữa nha. 🫶'
    ];
    let bubbleTimeout: ReturnType<typeof setTimeout>;
    let nextMessageTimeout: ReturnType<typeof setTimeout>;
    const scheduleMessage = () => {
      nextMessageTimeout = setTimeout(() => {
        setSpeechBubble(messages[Math.floor(Math.random() * messages.length)]);
        bubbleTimeout = setTimeout(() => setSpeechBubble(null), 5000);
        scheduleMessage();
      }, 45000 + Math.random() * 45000);
    };
    scheduleMessage();
    return () => {
      clearTimeout(nextMessageTimeout);
      clearTimeout(bubbleTimeout);
    };
  }, [user?.id, pet?.id, user?.preference?.quietMode]);

  useEffect(() => {
    if (!user?.id) return;
    const socket = getSocket();
    socket.emit('join_user', user.id);

    const handleQuestCompleted = (data: { questId: string; title: string; rewardExp: number }) => {
      setSpeechBubble(`Nhiệm vụ hoàn thành: "${data.title}"! Nhận thưởng ngay ✨`);
      setTimeout(() => setSpeechBubble(null), 5000);
    };

    socket.on('quest_completed', handleQuestCompleted);
    return () => {
      socket.off('quest_completed', handleQuestCompleted);
    };
  }, [user?.id]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    localStorage.removeItem('officepet_admin_token');
    let isUserAccount = false;

    try {
      const meRes = await api.getMe();
      isUserAccount = meRes.data.role === 'USER';
      setUser(meRes.data);
      setActiveTab(meRes.data.role === 'ADMIN' ? 'ADMIN' : 'PET');
      if (meRes.data.role === 'USER' && meRes.data.userPet) {
        setPet(meRes.data.userPet);
        setCurrentScale(meRes.data.userPet.scaleSize || 'MEDIUM');
      } else {
        setPet(null);
      }
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        localStorage.removeItem('officepet_token');
      } else {
        console.warn('Could not load the account session:', err);
      }
      setUser(null);
      setPet(null);
      setIsAuthOpen(true);
      return;
    }

    await refreshPetTypesAndOwned();
  };

  const refreshPetTypesAndOwned = async () => {
    try {
      const typesRes = await api.getPetTypes();
      setPetTypes(typesRes.data);
      if (user ? user.role !== 'ADMIN' : true) {
        const shopRes = await api.getShop();
        setOwnedPetTypeIds(shopRes.data.ownedPetTypeIds || []);
      } else {
        setOwnedPetTypeIds([]);
      }
    } catch (err) {
      console.warn('Could not load pet types or owned pet catalog:', err);
    }
  };

  const handleSelectPet = async (typeId: string) => {
    try {
      await api.selectPet({ typeId });
      await handleRefreshPet();
      setIsPetSelectorOpen(false);
    } catch (error: any) {
      alert(error?.response?.data?.error || 'Không thể đổi thú cưng lúc này.');
    }
  };

  const handleRefreshPet = async () => {
    try {
      const res = await api.getPet();
      setPet(res.data);
    } catch (err) {
      console.warn(err);
    }
  };

  const handleRenamePet = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = petNameDraft.trim();
    if (!name || name.length > 24 || isRenamingPet) return;
    setIsRenamingPet(true);
    try {
      const response = await api.renamePet(name);
      setPet(response.data.pet);
      setIsPetRenameOpen(false);
    } catch (error: any) {
      alert(error?.response?.data?.error || 'Không thể đổi tên thú cưng lúc này.');
    } finally {
      setIsRenamingPet(false);
    }
  };

  const speechBubbleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTemporarySpeechBubble = (text: string, durationMs = 4500) => {
    if (speechBubbleTimeout.current) clearTimeout(speechBubbleTimeout.current);
    setSpeechBubble(text);
    speechBubbleTimeout.current = setTimeout(() => {
      setSpeechBubble(null);
      speechBubbleTimeout.current = null;
    }, durationMs);
  };

  const schedulePetIdleAnimation = () => {
    if (idleAnimationTimeout.current) clearTimeout(idleAnimationTimeout.current);
    idleAnimationTimeout.current = setTimeout(async () => {
      try {
        await api.setPetState('IDLE');
        setPet(prev => (prev ? { ...prev, currentState: 'IDLE' } : prev));
      } catch (error) {
        console.warn('Could not restore the pet idle animation:', error);
      }
    }, 5000);
  };

  const handlePetStateChange = (state: AnimationState) => {
    setPet(prev => (prev ? { ...prev, currentState: state } : prev));
    if (idleAnimationTimeout.current) {
      clearTimeout(idleAnimationTimeout.current);
      idleAnimationTimeout.current = null;
    }
    void api.setPetState(state).catch(error => {
      console.warn('Could not update the pet animation:', error);
    });
    if (state !== 'IDLE' && state !== 'TYPING') schedulePetIdleAnimation();
  };

  const handleInteraction = (state: AnimationState, bubbleMsg: string) => {
    handlePetStateChange(state);
    showTemporarySpeechBubble(bubbleMsg, 4500);
    schedulePetIdleAnimation();
  };

  const handleFeed = async () => {
    handlePetStateChange('EATING');
    showTemporarySpeechBubble(PET_RESPONSES.feed.bubble, 5000);
    void playTtsSpeech(PET_RESPONSES.feed.speech);

    try {
      const res = await api.feedPet();
      const updatedPet = res.data.pet;
      setPet({ ...updatedPet, currentState: 'EATING' });
      schedulePetIdleAnimation();
      return;
    } catch (err: any) {
      console.warn('Feed API error:', err);
    }
    schedulePetIdleAnimation();
  };

  const handleLevelUp = async () => {
    if (!pet) return;
    const reqExp = pet.nextLevelExp || pet.level * 200;
    if (pet.exp < reqExp) {
      handlePetStateChange('EVOLVING');
      showTemporarySpeechBubble(`Bể chứa hiện có ${pet.exp}/${reqExp} EXP. Cần thêm ${reqExp - pet.exp} EXP nữa để thăng lên Cấp ${pet.level + 1}!`, 4500);
      schedulePetIdleAnimation();
      return;
    }
    try {
      const res = await api.levelUpPet();
      const updatedPet = res.data.pet;
      setPet(updatedPet);
      handlePetStateChange('EVOLVING');
      showTemporarySpeechBubble(PET_RESPONSES.levelUp.bubble, 5000);
      void playTtsSpeech(PET_RESPONSES.levelUp.speech);
      schedulePetIdleAnimation();
    } catch (err: any) {
      showTemporarySpeechBubble(err?.response?.data?.error || 'Chưa đủ EXP trong bể để thăng cấp.', 4000);
    }
  };

  const handleDrink = () => {
    handlePetStateChange('DRINKING');
    showTemporarySpeechBubble(PET_RESPONSES.drink.bubble, 4500);
    void playTtsSpeech(PET_RESPONSES.drink.speech);
    schedulePetIdleAnimation();
  };

  const handleStroke = async () => {
    handlePetStateChange('PETTING');
    showTemporarySpeechBubble(PET_RESPONSES.stroke.bubble, 4500);
    void playTtsSpeech(PET_RESPONSES.stroke.speech);

    try {
      const prevLevel = pet?.level || 1;
      const res = await api.strokePet();
      const updatedPet = res.data.pet;

      // Check for level up -> trigger EVOLVING animation!
      if (updatedPet.level > prevLevel) {
        setPet({ ...updatedPet, currentState: 'EVOLVING' });
        handlePetStateChange('EVOLVING');
        showTemporarySpeechBubble(`🎉 Bé cưng đã thăng cấp lên Cấp ${updatedPet.level}! Hào quang tiến hóa bùng nổ! ✨`, 5000);
        void playTtsSpeech(PET_RESPONSES.levelUp.speech);
        return;
      }

      setPet({ ...updatedPet, currentState: 'PETTING' });
      schedulePetIdleAnimation();
    } catch (err: any) {
      console.warn('Stroke API error:', err);
    }
  };

  const handleSetScale = async (scale: 'SMALL' | 'MEDIUM' | 'LARGE') => {
    setCurrentScale(scale);
    try {
      await api.updateTransform({ scaleSize: scale });
      setPet(prev => (prev ? { ...prev, scaleSize: scale } : prev));
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('officepet_token');
    localStorage.removeItem('officepet_admin_token');
    setUser(null);
    setPet(null);
    setActiveTab('PET');
    setIsAuthOpen(true);
  };

  const handleRefreshUser = async () => {
    const res = await api.getMe();
    setUser(res.data);
    setPet(res.data.role === 'USER' ? res.data.userPet || null : null);
  };

  useEffect(() => {
    const bridge = window.officePet;
    if (!bridge) return;
    bridge.updatePet(user ? pet : null, speechBubble);
    bridge.setOverlayVisible(Boolean(user && pet && isOverlayVisible));
  }, [user?.id, pet, speechBubble, isOverlayVisible]);

  useEffect(() => {
    const bridge = window.officePet;
    if (!bridge) return;
    const unsubscribeAction = bridge.onPetAction(action => {
      if (action === 'feed') void handleFeed();
      if (action === 'stroke') void handleStroke();
      if (action === 'drink') void handleDrink();
      if (action === 'levelUp') void handleLevelUp();
      if (action === 'openTimer' && pet) {
        setActiveTab('FOCUS');
        bridge.showDashboard();
      }
      if (action === 'hideOverlay') setIsOverlayVisible(false);
    });
    const unsubscribeVisibility = bridge.onOverlayVisibility(setIsOverlayVisible);
    return () => {
      unsubscribeAction();
      unsubscribeVisibility();
    };
  }, [pet?.id]);

  const handleOpenDesktopPetPiP = async () => {
    // 1. If running inside Electron desktop app:
    if ((window as any).officePet) {
      (window as any).officePet.setOverlayVisible(true);
      return;
    }

    // 2. If running in browser:
    if (!pet) {
      alert('Vui lòng tạo hoặc chọn một thú cưng trước khi bật cửa sổ nổi!');
      return;
    }

    const docPiP = (window as unknown as { documentPictureInPicture?: any }).documentPictureInPicture;
    if (docPiP) {
      // If PiP is already open, focus it
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        pipWindowRef.current.focus();
        return;
      }

      try {
        const pipWindow = await docPiP.requestWindow({
          width: 220,
          height: 260,
        });
        pipWindowRef.current = pipWindow;

        // Copy stylesheets and preconnect links
        document.querySelectorAll('link[rel="stylesheet"], link[rel="preconnect"]').forEach(link => {
          try {
            pipWindow.document.head.appendChild(link.cloneNode(true));
          } catch {}
        });

        // Copy inline style tags (Vite dev styles, Tailwind)
        document.querySelectorAll('style').forEach(style => {
          try {
            pipWindow.document.head.appendChild(style.cloneNode(true));
          } catch {}
        });

        // Copy CSSStyleSheet rules if any
        Array.from(document.styleSheets).forEach(sheet => {
          try {
            if (sheet.href) return;
            if (sheet.cssRules) {
              const style = pipWindow.document.createElement('style');
              Array.from(sheet.cssRules).forEach(rule => {
                style.appendChild(pipWindow.document.createTextNode(rule.cssText));
              });
              pipWindow.document.head.appendChild(style);
            }
          } catch {}
        });

        pipWindow.document.title = `🐾 ${pet.name} - Thú Cưng Nổi Desktop`;
        pipWindow.document.body.style.margin = '0';
        pipWindow.document.body.style.padding = '0';
        pipWindow.document.body.style.background = '#181528';
        pipWindow.document.body.style.overflow = 'hidden';

        const container = pipWindow.document.createElement('div');
        container.id = 'desktop-pet-pip-root';
        container.style.width = '100vw';
        container.style.height = '100vh';
        container.style.overflow = 'hidden';
        pipWindow.document.body.appendChild(container);

        setPipContainer(container);

        pipWindow.addEventListener('pagehide', () => {
          setPipContainer(null);
          pipWindowRef.current = null;
        });
      } catch (err) {
        console.warn('Document Picture-in-Picture request failed:', err);
        alert('Không thể mở cửa sổ Picture-in-Picture. Bạn hãy kiểm tra xem trình duyệt có đang chặn quyền pop-up không nhé!');
      }
    } else {
      // Browser doesn't support Document PiP (e.g. Firefox, Safari)
      setIsOverlayVisible(true);
      alert('📌 Để đưa thú cưng nổi lơ lửng ngoài màn hình Desktop (đè lên mọi ứng dụng & game khác):\n\n1. Bạn hãy mở web bằng Google Chrome hoặc Microsoft Edge (phiên bản mới nhất).\n2. Hoặc khởi chạy ứng dụng Desktop bằng lệnh: npm run desktop trong thư mục frontend!');
    }
  };

  const canManageSystem = user?.role === 'ADMIN';
  const roleLabel: Record<User['role'], string> = {
    USER: 'Người dùng',
    ADMIN: 'Quản trị viên'
  };

  const loadLeaderboard = async () => {
    try {
      const res = await api.getLeaderboard();
      setLeaderboard(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'LEADERBOARD') {
      loadLeaderboard();
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-[#f5efe6] flex flex-col font-sans select-none text-slate-900">
      {/* ================= 1. FULL-WIDTH HORIZONTAL TOP BAR ================= */}
      <header className="w-full bg-[#181528] text-white border-b-4 border-slate-950 px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-[0_4px_0_0_#0f172a] z-40 sticky top-0">
        {/* Left Side: Brand Anchor (OfficePet is front & center) */}
        <div className="flex items-center gap-3">
          {/* Logo & Brand Info */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-amber-400 border-2 border-slate-950 rounded-lg flex items-center justify-center text-slate-950 font-black text-sm shadow-[2px_2px_0px_#000] shrink-0">
              OP
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-black text-base tracking-tight text-white leading-tight">
                  OfficePet
                </h1>
                <span className="text-[9px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.5 border border-slate-950 rounded-xs uppercase tracking-wider">
                  PIXEL
                </span>
              </div>
              <p className="text-[11px] text-amber-200/80 font-medium truncate max-w-[200px] sm:max-w-xs leading-none mt-0.5">
                {canManageSystem
                  ? 'Bảng điều khiển quản trị hệ thống'
                  : user?.department?.name || 'Không gian thú cưng thư giãn & năng suất'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Quick Utilities & User Account */}
        <div className="flex items-center gap-2 sm:gap-3">
          {user?.role !== 'ADMIN' && (
            <>
              {user?.role === 'USER' && pet && (
                <>
                  <VoiceAssistant
                    petName={pet.name}
                    onFeed={() => void handleFeed()}
                    onDrink={() => handleDrink()}
                    onStroke={() => void handleStroke()}
                    onLevelUp={() => void handleLevelUp()}
                    onAction={(state, msg) => handleInteraction(state, msg)}
                    onChangeRoom={theme => setPetRoomTheme(theme)}
                    onChangeScale={scale => void handleSetScale(scale)}
                    onNavigate={tab => setActiveTab(tab)}
                    onOpenModal={modal => {
                      if (modal === 'FRIENDS') setIsFriendsOpen(true);
                      if (modal === 'GUIDE') setIsGuideModalOpen(true);
                      if (modal === 'BREATHING') setIsBreathingModalOpen(true);
                      if (modal === 'PET_SELECTOR') {
                        void refreshPetTypesAndOwned();
                        setIsPetSelectorOpen(true);
                      }
                    }}
                    onSpeechBubble={text => {
                      showTemporarySpeechBubble(text, 5000);
                    }}
                    onPlayMusic={(query, autoPlay) => {
                      pauseBgmForCustomSong();
                      setMusicRequest({ query, autoPlay, requestId: Date.now() });
                      if (
                        query !== '__NEXT_TRACK__' &&
                        query !== '__PREV_TRACK__' &&
                        query !== '__ADD_TO_FAVORITES__'
                      ) {
                        setActiveTab('MUSIC');
                      }
                    }}
                    onStopMusic={() => stopAllMusic()}
                    onResumeBgm={() => resumeDefaultBgm()}
                    onStartTimer={(minutes, autoStart, action, alarmTime, alarmLabel) => {
                      setTimerRequest({ minutes, autoStart, action, alarmTime, alarmLabel, requestId: Date.now() });
                      if (action !== 'STOP_ALARM') {
                        setActiveTab('FOCUS');
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (isBgmPlaying) {
                        stopAllMusic();
                      } else {
                        resumeDefaultBgm();
                      }
                    }}
                    title={isBgmPlaying ? 'Nhấn để tắt nhạc nền' : 'Nhấn để bật nhạc nền'}
                    className={`hidden sm:flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-bold border-2 border-slate-950 shadow-[0_2px_0_#000] active:translate-y-[2px] active:shadow-none transition ${
                      isBgmPlaying
                        ? 'bg-[#231e36] hover:bg-[#332b4f] text-amber-300'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                    }`}
                  >
                    <Music size={13} className={isBgmPlaying ? 'text-amber-300 animate-bounce' : 'text-slate-400'} />
                    <span>{isBgmPlaying ? 'Nhạc nền: Bật' : 'Nhạc nền: Tắt'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenDesktopPetPiP}
                    title="Nổi thú cưng trên màn hình Desktop (Picture-in-Picture hoặc Electron Desktop Overlay)"
                    className="hidden md:flex items-center gap-1.5 h-8 px-2.5 bg-[#231e36] hover:bg-[#332b4f] text-slate-200 rounded-md text-xs font-bold border-2 border-slate-950 shadow-[0_2px_0_#000] active:translate-y-[2px] active:shadow-none transition cursor-pointer"
                  >
                    <Monitor size={13} className="text-amber-300" />
                    <span>Nổi Desktop</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setIsGuideModalOpen(true)}
                className="hidden sm:flex items-center gap-1.5 h-8 px-2.5 bg-[#231e36] hover:bg-[#332b4f] text-slate-200 rounded-md text-xs font-bold border-2 border-slate-950 shadow-[0_2px_0_#000] active:translate-y-[2px] active:shadow-none transition"
              >
                <HelpCircle size={13} className="text-amber-300" />
                <span>Hướng dẫn</span>
              </button>
            </>
          )}

          {/* User Profile Pill */}
          {user ? (
            <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l-2 border-slate-800">
              <button
                type="button"
                onClick={() => setIsProfileOpen(true)}
                title="Hồ sơ tài khoản & Cài đặt"
                className="flex items-center gap-2 hover:opacity-90 transition group cursor-pointer text-left"
              >
                <div className="w-8 h-8 rounded-md bg-amber-400 border-2 border-slate-950 flex items-center justify-center text-xs font-black text-slate-950 shadow-[1px_1px_0px_#000] shrink-0 group-hover:scale-105 transition-transform">
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-black text-amber-300 leading-tight truncate max-w-[120px]">{user.fullName}</div>
                  <div className="text-[10px] text-slate-400 leading-tight">
                    {canManageSystem ? 'Quản trị viên' : user.department?.name || 'Thành viên'}
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="px-2.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-md border-2 border-slate-950 text-xs font-black shadow-[0_2px_0_#000] active:translate-y-[2px] active:shadow-none transition shrink-0"
                title="Đăng xuất"
              >
                Thoát
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAuthOpen(true)}
              className="h-9 px-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-md border-2 border-slate-950 shadow-[0_2px_0_#000] active:translate-y-[2px] active:shadow-none transition"
            >
              Đăng nhập
            </button>
          )}
        </div>
      </header>

      {/* ================= 2. BODY: COLLAPSIBLE SIDEBAR + MAIN VIEWPORT ================= */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Docked Toggle Tab when Sidebar is collapsed (positioned cleanly below the OfficePet bar) */}
        {!isSidebarOpen && user && (
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            title="Mở danh mục chính"
            aria-label="Mở danh mục chính"
            className="fixed left-0 top-16 z-30 bg-[#181528] hover:bg-[#272144] text-amber-300 hover:text-white px-3 py-2 rounded-r-xl border-2 border-l-0 border-slate-950 font-black text-xs flex items-center gap-2 shadow-[3px_3px_0_#000] hover:translate-x-1 transition-all pixel-btn"
          >
            <Menu size={16} className="text-amber-400" />
            <span className="hidden sm:inline">Danh mục</span>
            <ChevronRight size={14} className="text-amber-400" />
          </button>
        )}

        {/* Collapsible Left Sidebar (DANH MỤC CHÍNH - Directly below the OfficePet top bar) */}
        {user && (
          <aside
            className={`bg-[#181528] text-white border-r-4 border-slate-950 flex flex-col justify-between shrink-0 transition-all duration-300 z-30 shadow-[4px_0_0_#0f172a] ${
              isSidebarOpen ? 'w-60 sm:w-64' : 'w-0 border-r-0 overflow-hidden'
            }`}
          >
            <div className="p-3 w-60 sm:w-64">
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800 text-slate-400">
                <div className="flex items-center gap-2 px-1">
                  <Menu size={15} className="text-amber-400" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                    Danh mục chính
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  title="Thu gọn danh mục"
                  aria-label="Thu gọn danh mục"
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <ChevronLeft size={16} />
                </button>
              </div>

              <nav aria-label="Điều hướng chính" className="space-y-1.5">
                {user.role === 'USER' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('PET')}
                    className={`w-full h-10 px-3.5 rounded-lg font-black text-xs tracking-wide transition flex items-center justify-between group ${
                      activeTab === 'PET' ? 'pixel-tab-active' : 'pixel-tab-inactive'
                    }`}
                  >
                    <span className="group-hover:translate-x-1 transition-transform">Phòng Thú Cưng</span>
                    {activeTab === 'PET' ? (
                      <span className="w-2 h-2 rounded-full bg-slate-950" />
                    ) : (
                      <span className="text-[10px] opacity-0 group-hover:opacity-100 text-amber-300 font-mono transition-opacity">▶</span>
                    )}
                  </button>
                )}
                {user.role === 'USER' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('SHOP')}
                    className={`w-full h-10 px-3.5 rounded-lg font-black text-xs tracking-wide transition flex items-center justify-between group ${
                      activeTab === 'SHOP' ? 'pixel-tab-active' : 'pixel-tab-inactive'
                    }`}
                  >
                    <span className="group-hover:translate-x-1 transition-transform">Cửa Hàng</span>
                    {activeTab === 'SHOP' ? (
                      <span className="w-2 h-2 rounded-full bg-slate-950" />
                    ) : (
                      <span className="text-[10px] opacity-0 group-hover:opacity-100 text-amber-300 font-mono transition-opacity">▶</span>
                    )}
                  </button>
                )}
                {user.role === 'USER' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('GARDEN')}
                    className={`w-full h-10 px-3.5 rounded-lg font-black text-xs tracking-wide transition flex items-center justify-between group ${
                      activeTab === 'GARDEN' ? 'pixel-tab-active' : 'pixel-tab-inactive'
                    }`}
                  >
                    <span className="group-hover:translate-x-1 transition-transform">{user.department ? 'Phòng Chung' : 'Khu Vườn'}</span>
                    {activeTab === 'GARDEN' ? (
                      <span className="w-2 h-2 rounded-full bg-slate-950" />
                    ) : (
                      <span className="text-[10px] opacity-0 group-hover:opacity-100 text-amber-300 font-mono transition-opacity">▶</span>
                    )}
                  </button>
                )}
                {user.role === 'USER' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('FOCUS')}
                    className={`w-full h-10 px-3.5 rounded-lg font-black text-xs tracking-wide transition flex items-center justify-between group ${
                      activeTab === 'FOCUS' ? 'pixel-tab-active' : 'pixel-tab-inactive'
                    }`}
                  >
                    <span className="group-hover:translate-x-1 transition-transform">Pomodoro</span>
                    {activeTab === 'FOCUS' ? (
                      <span className="w-2 h-2 rounded-full bg-slate-950" />
                    ) : (
                      <span className="text-[10px] opacity-0 group-hover:opacity-100 text-amber-300 font-mono transition-opacity">▶</span>
                    )}
                  </button>
                )}
                {user.role === 'USER' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab(pet ? 'AI_CHAT' : 'PET')}
                    className={`w-full h-10 px-3.5 rounded-lg font-black text-xs tracking-wide transition flex items-center justify-between group ${
                      activeTab === 'AI_CHAT' ? 'pixel-tab-active' : 'pixel-tab-inactive'
                    }`}
                  >
                    <span className="group-hover:translate-x-1 transition-transform">Trợ Lý AI</span>
                    {activeTab === 'AI_CHAT' ? (
                      <span className="w-2 h-2 rounded-full bg-slate-950" />
                    ) : (
                      <span className="text-[10px] opacity-0 group-hover:opacity-100 text-amber-300 font-mono transition-opacity">▶</span>
                    )}
                  </button>
                )}
                {user.role === 'USER' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('MUSIC')}
                    className={`w-full h-10 px-3.5 rounded-lg font-black text-xs tracking-wide transition flex items-center justify-between group ${
                      activeTab === 'MUSIC' ? 'pixel-tab-active' : 'pixel-tab-inactive'
                    }`}
                  >
                    <span className="group-hover:translate-x-1 transition-transform">Nhạc Lofi</span>
                    {activeTab === 'MUSIC' ? (
                      <span className="w-2 h-2 rounded-full bg-slate-950" />
                    ) : (
                      <span className="text-[10px] opacity-0 group-hover:opacity-100 text-amber-300 font-mono transition-opacity">▶</span>
                    )}
                  </button>
                )}
                {user.role === 'USER' && user.department && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('LEADERBOARD')}
                    className={`w-full h-10 px-3.5 rounded-lg font-black text-xs tracking-wide transition flex items-center justify-between group ${
                      activeTab === 'LEADERBOARD' ? 'pixel-tab-active' : 'pixel-tab-inactive'
                    }`}
                  >
                    <span className="group-hover:translate-x-1 transition-transform">Xếp Hạng</span>
                    {activeTab === 'LEADERBOARD' ? (
                      <span className="w-2 h-2 rounded-full bg-slate-950" />
                    ) : (
                      <span className="text-[10px] opacity-0 group-hover:opacity-100 text-amber-300 font-mono transition-opacity">▶</span>
                    )}
                  </button>
                )}
                {user.role === 'USER' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('QUESTS')}
                    className={`w-full h-10 px-3.5 rounded-lg font-black text-xs tracking-wide transition flex items-center justify-between group ${
                      activeTab === 'QUESTS' ? 'pixel-tab-active' : 'pixel-tab-inactive'
                    }`}
                  >
                    <span className="group-hover:translate-x-1 transition-transform">Nhiệm Vụ</span>
                    {activeTab === 'QUESTS' ? (
                      <span className="w-2 h-2 rounded-full bg-slate-950" />
                    ) : (
                      <span className="text-[10px] opacity-0 group-hover:opacity-100 text-amber-300 font-mono transition-opacity">▶</span>
                    )}
                  </button>
                )}
                {user.role === 'USER' && (
                  <button
                    type="button"
                    onClick={() => setIsFriendsOpen(true)}
                    className="w-full h-10 px-3.5 rounded-lg font-black text-xs tracking-wide transition flex items-center justify-between pixel-tab-inactive group"
                  >
                    <span className="group-hover:translate-x-1 transition-transform">Bạn Bè & Tin Nhắn</span>
                    <span className="text-[10px] opacity-0 group-hover:opacity-100 text-amber-300 font-mono transition-opacity">▶</span>
                  </button>
                )}
                {user.role === 'USER' && (
                  <button
                    type="button"
                    onClick={() => setIsProfileOpen(true)}
                    className="w-full h-10 px-3.5 rounded-lg font-black text-xs tracking-wide transition flex items-center justify-between pixel-tab-inactive group"
                  >
                    <span className="group-hover:translate-x-1 transition-transform">Hồ Sơ Cá Nhân</span>
                    <span className="text-[10px] opacity-0 group-hover:opacity-100 text-amber-300 font-mono transition-opacity">▶</span>
                  </button>
                )}
                {canManageSystem && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveTab('ADMIN')}
                      className={`w-full h-10 px-3.5 rounded-lg font-black text-xs tracking-wide transition flex items-center justify-between group ${
                        activeTab === 'ADMIN' ? 'pixel-tab-active' : 'pixel-tab-inactive'
                      }`}
                    >
                      <span className="group-hover:translate-x-1 transition-transform">Quản Trị Hệ Thống</span>
                      {activeTab === 'ADMIN' ? (
                        <span className="w-2 h-2 rounded-full bg-slate-950" />
                      ) : (
                        <span className="text-[10px] opacity-0 group-hover:opacity-100 text-amber-300 font-mono transition-opacity">▶</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsProfileOpen(true)}
                      className="w-full h-10 px-3.5 rounded-lg font-black text-xs tracking-wide transition flex items-center justify-between pixel-tab-inactive group"
                    >
                      <span className="group-hover:translate-x-1 transition-transform">Hồ Sơ Quản Trị Viên</span>
                      <span className="text-[10px] opacity-0 group-hover:opacity-100 text-amber-300 font-mono transition-opacity">▶</span>
                    </button>
                  </>
                )}
              </nav>
            </div>
          </aside>
        )}

        {/* Main Content Viewport */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
            {/* TAB 1: PET MAIN VIEW — SIDE-BY-SIDE: CLEAN ROOM (LEFT) + EXP TANK & ACTIONS (RIGHT) */}
          {user?.role === 'USER' && activeTab === 'PET' && (
            <div className="space-y-5">
              {pet ? (
                <div className="space-y-5">
                  {(() => {
                    const nextLevelExp = pet.nextLevelExp || pet.level * 200;
                    const expPercent = Math.min(100, Math.round((pet.exp / nextLevelExp) * 100));
                    const isReadyToLevelUp = pet.exp >= nextLevelExp;

                    const actionButtons: Array<{ state: Exclude<AnimationState, 'WALKING'>; label: string; msg: string }> = [
                      { state: 'EATING', label: 'Cho ăn', msg: '' },
                      { state: 'DRINKING', label: 'Uống nước', msg: '' },
                      { state: 'PETTING', label: 'Vuốt ve', msg: '' },
                      { state: 'HUNGRY', label: 'Đói bụng', msg: 'Bụng đói cồn cào rồi, cho mình ăn nhé!' },
                      { state: 'SLEEPING', label: 'Đi ngủ', msg: 'Mình chìm vào giấc ngủ êm đềm đây...' },
                      { state: 'WAKING_UP', label: 'Thức dậy', msg: 'Vươn vai tỉnh giấc, sẵn sàng cho ngày mới!' },
                      { state: 'YAWNING', label: 'Ngáp ngủ', msg: 'Ngáp một hơi dài, hơi buồn ngủ một chút...' },
                      { state: 'IDLE', label: 'Đứng yên', msg: 'Đứng thư giãn nhìn bạn làm việc.' },
                      { state: 'TYPING', label: 'Làm việc', msg: 'Tập trung gõ phím làm việc chăm chỉ!' },
                      { state: 'EXERCISING', label: 'Tập thể dục', msg: 'Vận động rèn luyện thể lực dẻo dai!' },
                      { state: 'DANCING', label: 'Nhảy múa', msg: 'Nhún nhảy theo giai điệu vui tươi!' },
                      { state: 'HAPPY', label: 'Vui vẻ', msg: 'Tâm trạng hôm nay thật tuyệt vời!' },
                      { state: 'WAVING', label: 'Vẫy tay', msg: 'Xin chào! Chúc bạn một ngày hiệu quả!' },
                      { state: 'THANKING', label: 'Cảm ơn', msg: 'Cúi đầu cảm ơn bạn vì luôn quan tâm mình!' },
                      { state: 'CELEBRATING', label: 'Ăn mừng', msg: 'Hoan hô! Cùng ăn mừng thành quả nào!' },
                      { state: 'SAD', label: 'Làm nũng', msg: 'Đang buồn một chút, muốn được bạn dỗ dành...' },
                    ];

                    return (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                        {/* ================= LEFT COLUMN (7 COLS): PET ROOM ================= */}
                        <div className="lg:col-span-7 flex flex-col gap-3">
                          {/* Minimal Room Controls Bar */}
                          <div className="pixel-box rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-black text-slate-700 text-[11px] uppercase tracking-wider mr-1">
                                Phòng:
                              </span>
                              {[
                                { id: 'cafe', label: 'Quán Cafe' },
                                { id: 'garden', label: 'Vườn Xuân' },
                                { id: 'office', label: 'Góc Zen' },
                                { id: 'beach', label: 'Bãi Biển' },
                                { id: 'room', label: 'Sàn Gỗ' }
                              ].map(theme => (
                                <button
                                  key={theme.id}
                                  type="button"
                                  onClick={() => setPetRoomTheme(theme.id as any)}
                                  className={`h-8 px-3 rounded-md text-xs font-bold border-2 transition-all ${
                                    petRoomTheme === theme.id
                                      ? 'border-slate-900 bg-amber-400 text-slate-950 font-black shadow-[0_2px_0_#0f172a]'
                                      : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {theme.label}
                                </button>
                              ))}
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="h-8 flex items-center gap-1 bg-slate-100 px-1.5 rounded-md border-2 border-slate-900">
                                {(['SMALL', 'MEDIUM', 'LARGE'] as const).map(s => (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => handleSetScale(s)}
                                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                                      currentScale === s
                                        ? 'bg-slate-900 text-amber-300 font-black'
                                        : 'text-slate-600 hover:text-slate-950'
                                    }`}
                                  >
                                    {s === 'SMALL' ? 'Nhỏ' : s === 'MEDIUM' ? 'Vừa' : 'To'}
                                  </button>
                                ))}
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  void refreshPetTypesAndOwned();
                                  setIsPetSelectorOpen(true);
                                }}
                                className="h-8 px-3 rounded-md bg-[#231e36] hover:bg-[#332b4f] text-white text-xs font-bold border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[1px] active:shadow-none transition"
                              >
                                Đổi thú
                              </button>
                            </div>
                          </div>

                          {/* Pet Room Stage — With Top-Left Compact Status Pill */}
                          <div className="pixel-box-lg rounded-2xl border-4 border-slate-900 shadow-[5px_5px_0px_#0f172a] relative overflow-hidden flex-1 min-h-[460px] sm:min-h-[540px] flex flex-col items-center justify-end pb-14 select-none">
                            {/* Room Background */}
                            {petRoomTheme === 'room' ? (
                              <div className="absolute inset-0 z-0 bg-[#fbf5eb] bg-[radial-gradient(#dfcca6_1px,transparent_1px)] [background-size:16px_16px]">
                                <div className="absolute bottom-0 inset-x-0 h-44 bg-[#d8b888] border-t-4 border-[#8e6b45]">
                                  <div className="w-full h-full opacity-15 bg-[repeating-linear-gradient(90deg,#000_0px,#000_2px,transparent_2px,transparent_40px)]"></div>
                                </div>
                              </div>
                            ) : (
                              <div
                                className="absolute inset-0 z-0 bg-cover bg-center pixelated"
                                style={{
                                  backgroundImage: `url(${
                                    petRoomTheme === 'cafe' ? '/backgrounds/cafe_cozy.png?v=2' :
                                    petRoomTheme === 'garden' ? '/backgrounds/garden_spring.png' :
                                    petRoomTheme === 'office' ? '/backgrounds/office_zen.png' :
                                    '/backgrounds/beach_sunset.png'
                                  })`
                                }}
                              />
                            )}

                            {/* TOP-LEFT COMPACT PET STATUS PILL (Requested by User) */}
                            <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-3 bg-[#231e36]/95 backdrop-blur-xs border-2 border-slate-950 px-3.5 py-2 rounded-xl text-xs shadow-[3px_3px_0px_#000]">
                              <div className="flex items-center gap-1.5 font-black text-amber-300">
                                <span className="text-sm tracking-tight">{pet.name}</span>
                                <span className="bg-amber-400 text-slate-950 text-[10px] px-1.5 py-0.5 rounded-xs border border-slate-950 font-mono font-black ml-0.5">
                                  Lv.{pet.level}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => { setPetNameDraft(pet.name); setIsPetRenameOpen(true); }}
                                  aria-label="Đổi tên thú cưng"
                                  title="Đổi tên thú cưng"
                                  className="ml-0.5 rounded p-0.5 text-amber-200 hover:text-white transition"
                                >
                                  <Pencil size={12} />
                                </button>
                              </div>

                              {/* Heart / Happiness Bar */}
                              <div className="flex items-center gap-1.5 text-rose-400 text-[11px]" title={`Vui vẻ: ${pet.happiness}%`}>
                                <Heart size={13} className="fill-rose-500 text-rose-500" />
                                <div className="w-14 sm:w-16 h-2 bg-slate-950 border border-slate-700 rounded-none overflow-hidden p-[1px]">
                                  <div
                                    className="bg-rose-500 h-full transition-all duration-300"
                                    style={{ width: `${Math.min(100, pet.happiness)}%` }}
                                  />
                                </div>
                              </div>

                              {/* Energy / Hunger Bar */}
                              <div className="flex items-center gap-1.5 text-amber-300 text-[11px]" title={`No bụng: ${pet.hunger}%`}>
                                <Zap size={13} className="fill-amber-400 text-amber-400" />
                                <div className="w-14 sm:w-16 h-2 bg-slate-950 border border-slate-700 rounded-none overflow-hidden p-[1px]">
                                  <div
                                    className="bg-amber-400 h-full transition-all duration-300"
                                    style={{ width: `${Math.min(100, pet.hunger)}%` }}
                                  />
                                </div>
                              </div>

                              {/* Overall Percentage */}
                              <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono font-black pl-2 border-l border-slate-700">
                                <span>{pet.happiness}%</span>
                              </div>
                            </div>

                            {/* Pet & Speech Bubble inside the Room */}
                            <div className="relative z-10 flex flex-col items-center justify-center">
                              {speechBubble && (
                                <div className="pixel-speech-bubble mb-4 max-w-sm bg-[#fffdf7] text-slate-950 text-xs sm:text-sm font-bold px-4 py-2.5 rounded-lg relative text-center shadow-[3px_3px_0px_#000]">
                                  "{speechBubble}"
                                  <div className="w-3 h-3 bg-[#fffdf7] border-r-2 border-b-2 border-slate-900 rotate-45 absolute -bottom-[7px] left-1/2 -translate-x-1/2"></div>
                                </div>
                              )}

                              <div
                                className="relative cursor-pointer"
                                title="Nhấn vào thú cưng để tương tác"
                              >
                                <PixelPetCanvas
                                  petType={pet.petType}
                                  currentState={pet.currentState}
                                  scaleSize={currentScale}
                                  speechBubble={null}
                                  petName={pet.name}
                                  petLevel={pet.level}
                                  hunger={pet.hunger}
                                  happiness={pet.happiness}
                                  equippedItems={pet.userItems}
                                  showTooltip={false}
                                  onPetClick={() => void handleStroke()}
                                />
                                <div className="w-40 h-4 bg-slate-950/35 rounded-full mx-auto -mt-2"></div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* ================= RIGHT COLUMN (5 COLS): EXP TANK + LEVEL UP + ACTIONS ================= */}
                        <div className="lg:col-span-5 flex flex-col gap-4">
                          {/* 1. BỂ CHỨA EXP & THĂNG CẤP */}
                          <div className="pixel-box rounded-2xl p-4 sm:p-5">
                            <div className="flex items-stretch gap-4">
                              {/* Vertical Glass EXP Tank */}
                              <div className="flex flex-col items-center shrink-0">
                                {/* Tank Top Cap */}
                                <div className="w-16 h-2.5 bg-slate-800 border-2 border-b-0 border-slate-950 rounded-t-sm" />
                                {/* Tank Glass Cylinder */}
                                <div className="relative w-24 h-40 bg-[#151221] border-3 border-slate-950 rounded-lg overflow-hidden shadow-inner flex items-end">
                                  {/* Liquid Fill (Height scales with EXP) */}
                                  <div
                                    className="w-full bg-gradient-to-t from-amber-600 via-amber-400 to-yellow-300 transition-all duration-700 ease-out relative"
                                    style={{ height: `${Math.max(pet.exp > 0 ? 8 : 0, expPercent)}%` }}
                                  >
                                    {/* Bright Liquid Meniscus Surface */}
                                    <div className="w-full h-1.5 bg-yellow-100/90 border-b border-amber-500" />
                                  </div>

                                  {/* Graduation Marks on Glass */}
                                  <div className="absolute inset-0 pointer-events-none flex flex-col justify-between py-3 px-1.5">
                                    {[75, 50, 25].map(mark => (
                                      <div key={mark} className="w-full flex items-center justify-between border-b border-white/15 pb-0.5">
                                        <span className="text-[9px] font-mono font-bold text-white/50">{mark}%</span>
                                        <span className="w-2 h-[1px] bg-white/30" />
                                      </div>
                                    ))}
                                  </div>

                                  {/* Glass Vertical Highlight Reflection */}
                                  <div className="absolute top-2 bottom-2 left-2 w-1.5 bg-white/15 rounded-full pointer-events-none" />

                                  {/* Center EXP Percentage Readout */}
                                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <span className="px-1.5 py-0.5 rounded bg-slate-950/75 text-amber-300 font-mono font-black text-xs border border-amber-400/40">
                                      {expPercent}%
                                    </span>
                                  </div>
                                </div>
                                {/* Tank Bottom Base */}
                                <div className="w-20 h-2.5 bg-slate-800 border-2 border-t-0 border-slate-950 rounded-b-sm" />
                              </div>

                              {/* EXP Tank Details & Level Up Button */}
                              <div className="flex-1 flex flex-col justify-between py-1">
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                                      Bể chứa EXP
                                    </span>
                                    <span className="text-[11px] font-bold text-slate-500">
                                      Cấp {pet.level} → {pet.level + 1}
                                    </span>
                                  </div>

                                  <div className="text-xl font-black text-slate-950 font-mono tracking-tight">
                                    {pet.exp} <span className="text-sm font-bold text-slate-400">/ {nextLevelExp} EXP</span>
                                  </div>

                                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                                    {isReadyToLevelUp
                                      ? 'Bể chứa EXP đã đầy. Nhấn nút bên dưới để thăng cấp ngay!'
                                      : `Cần tích lũy thêm ${nextLevelExp - pet.exp} EXP vào bể để mở khóa cấp độ tiếp theo.`}
                                  </p>
                                </div>

                                <div className="pt-2">
                                  <button
                                    type="button"
                                    onClick={() => void handleLevelUp()}
                                    className={`w-full h-11 rounded-lg border-2 border-slate-900 font-black text-xs uppercase tracking-wider pixel-btn transition-all ${
                                      isReadyToLevelUp
                                        ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-[0_3px_0_#0f172a] animate-pulse'
                                        : 'bg-[#231e36] hover:bg-[#332b4f] text-amber-300 shadow-[0_3px_0_#0f172a]'
                                    }`}
                                  >
                                    {isReadyToLevelUp ? `Thăng lên Cấp ${pet.level + 1}` : 'Thăng cấp'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 2. BẢNG HÀNH ĐỘNG & BIỂU CẢM (Nằm ngay dưới Bể chứa EXP, không còn khoảng trắng thừa) */}
                          <div className="pixel-box rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
                            <div className="flex items-center justify-between border-b-2 border-slate-200 pb-2.5">
                              <h3 className="font-black text-slate-950 text-xs uppercase tracking-wider">
                                Hành động & Biểu cảm
                              </h3>
                              <span className="text-[11px] font-bold text-slate-500">
                                Trạng thái: <strong className="text-slate-900">{PET_ANIMATION_ACTIONS.find(a => a.state === pet.currentState)?.label || pet.currentState}</strong>
                              </span>
                            </div>

                            {/* Clean Uniform Text-Only Grid with comfortable height and tactile click */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-2.5">
                              {actionButtons.map(btn => {
                                const isActive = pet.currentState === btn.state;
                                return (
                                  <button
                                    key={btn.state}
                                    type="button"
                                    onClick={() => {
                                      if (btn.state === 'EATING') {
                                        void handleFeed();
                                      } else if (btn.state === 'DRINKING') {
                                        handleDrink();
                                      } else if (btn.state === 'PETTING') {
                                        void handleStroke();
                                      } else {
                                        handleInteraction(btn.state, btn.msg);
                                      }
                                    }}
                                    className={`h-11 px-2 rounded-lg border-2 border-slate-900 font-bold text-xs text-center truncate transition-all pixel-btn ${
                                      isActive
                                        ? 'bg-amber-400 text-slate-950 font-black shadow-none translate-y-[2px]'
                                        : 'bg-white hover:bg-amber-100/60 text-slate-800'
                                    }`}
                                  >
                                    {btn.label}
                                  </button>
                                );
                              })}
                            </div>

                            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                              <span>Nhấn động thái để tương tác trực tiếp cùng Bé Cưng</span>
                              <span className="font-mono font-bold text-slate-700">16 tương tác</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* BOTTOM BANNER: Daily Focus Tip & Desktop Overlay Controls */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-8 pixel-box-dark rounded-xl p-4 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-400 border-2 border-slate-900 flex items-center justify-center text-slate-950 shadow-[2px_2px_0px_#000] shrink-0 mt-0.5">
                          <Sparkles size={20} />
                        </div>
                        <div>
                          <h4 className="font-black text-sm text-amber-300">Mẹo tập trung & năng suất hôm nay cùng Bé Cưng</h4>
                          <p className="text-xs text-slate-200 mt-0.5 leading-relaxed font-medium">
                            Sử dụng chu kỳ 25 phút Pomodoro cùng Bé Cưng giúp giải tỏa áp lực công việc và duy trì sự tỉnh táo suốt ngày dài.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('FOCUS')}
                        className="pixel-btn px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-lg whitespace-nowrap shrink-0 shadow-[2px_2px_0px_#000]"
                      >
                        Bật Pomodoro
                      </button>
                    </div>

                    <div className="md:col-span-4 pixel-box rounded-xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-[#231e36] text-amber-300 flex items-center justify-center border-2 border-slate-900 shadow-[1px_1px_0px_#000]">
                          <Monitor size={17} />
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-900 leading-tight">
                            Nổi Trên Màn Hình
                          </div>
                          <div className="text-[10px] text-slate-500 font-bold">
                            Chế độ Desktop Overlay
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsOverlayVisible(!isOverlayVisible)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-slate-900 transition-colors duration-200 ease-in-out focus:outline-hidden ${
                          isOverlayVisible ? 'bg-amber-400' : 'bg-slate-300'
                        }`}
                        role="switch"
                        aria-checked={isOverlayVisible}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-slate-950 shadow-sm transition duration-200 ease-in-out ${
                            isOverlayVisible ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 pixel-box rounded-2xl p-8">
                  <h2 className="text-base font-black text-slate-900 mb-2">Bạn Chưa Sở Hữu Bé Cưng Nào</h2>
                  <p className="text-xs text-slate-600 max-w-md mx-auto mb-6 font-medium">
                    Hãy nhận nuôi một người bạn 2D Pixel Art đầu tiên để đồng hành trong suốt ca làm việc nhé!
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
                    {petTypes.map(pt => (
                      <button
                        type="button"
                        key={pt.id}
                        disabled={pt.isPurchaseRequired
                          ? !ownedPetTypeIds.includes(pt.id)
                          : pt.unlockLevel > 1}
                        onClick={() => void handleSelectPet(pt.id)}
                        className="p-4 bg-white border-2 border-slate-900 rounded-xl hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50 pixel-btn transition"
                      >
                        {pt.previewUrl && (
                          <img
                            src={pt.previewUrl}
                            alt={pt.name}
                            className="w-20 h-20 mx-auto object-contain mb-2"
                            style={{ imageRendering: 'pixelated' }}
                          />
                        )}
                        <div className="text-xs font-black text-slate-900 mb-1">{pt.name}</div>
                        <div className="text-[11px] text-slate-600 line-clamp-2">{pt.description}</div>
                        {pt.isPurchaseRequired && !ownedPetTypeIds.includes(pt.id) ? (
                          <div className="mt-2 text-[10px] font-bold text-amber-700">Mua ở cửa hàng để sử dụng</div>
                        ) : pt.unlockLevel > 1 && !pt.isPurchaseRequired ? (
                          <div className="mt-2 text-[10px] font-bold text-amber-700">Mở khóa ở cấp {pt.unlockLevel}</div>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: UNIFIED ROOM & SHARED VIRTUAL GARDEN */}
        {user && !canManageSystem && activeTab === 'GARDEN' && (
          <SharedGarden
            currentUserPet={pet || undefined}
            onRefreshPet={handleRefreshPet}
            canChangeBackground={true}
            currentUser={user}
            onMembershipChange={handleRefreshUser}
            onOpenFriends={() => setIsFriendsOpen(true)}
          />
        )}

        {user?.role === 'USER' && activeTab === 'SHOP' && (
          <PetShop
            hasPet={Boolean(pet)}
            currentPetTypeId={pet?.typeId}
            onPetRefresh={() => {
              void handleRefreshPet();
              schedulePetIdleAnimation();
            }}
            onOwnedPetTypesChange={setOwnedPetTypeIds}
            onPetTypesRefresh={refreshPetTypesAndOwned}
          />
        )}

        {/* TAB 3: POMODORO & WELLNESS (Persistently mounted so countdown & Pet wake-up alarm work across all tabs) */}
        {user?.role === 'USER' && pet && (
          <div className={activeTab === 'FOCUS' ? 'block' : 'hidden'}>
            <PomodoroTimer
              currentMode={pet.currentMode}
              timerRequest={timerRequest}
              onPetStateChange={handlePetStateChange}
              onPauseBgmForAlarm={pauseBgmForCustomSong}
              onModeChange={mode => {
                api.setPetMode(mode);
                setPet(prev => (prev ? { ...prev, currentMode: mode } : prev));
              }}
              onSessionFinish={exp => {
                handleRefreshPet();
                handlePetStateChange('CELEBRATING');
                setSpeechBubble(`🎉 Hoan hô! Đã hết thời gian hẹn giờ, bạn nhận được +${exp} EXP! 🌟`);
                setTimeout(() => setSpeechBubble(null), 6000);
                schedulePetIdleAnimation();
              }}
            />
          </div>
        )}

        {/* TAB 4: CONVERSATIONAL AI COMPANION */}
        {user?.role === 'USER' && activeTab === 'AI_CHAT' && pet && (
          <AICompanionChat
            pet={pet}
            onPetStateChange={handlePetStateChange}
            onMusicRequest={(query, autoPlay) => {
              pauseBgmForCustomSong();
              setMusicRequest({ query, autoPlay, requestId: Date.now() });
              setActiveTab('MUSIC');
            }}
            onStartBreathing={(duration) => {
              setBreathingDuration(duration);
              setIsBreathingModalOpen(true);
            }}
            onStartPomodoro={(duration) => {
              setTimerRequest({ minutes: duration || 25, autoStart: true, action: 'START', requestId: Date.now() });
              setActiveTab('FOCUS');
            }}
          />
        )}

        {/* TAB 5: MUSIC PLAYER & FLOATING YOUTUBE TV ABOVE PET */}
        {user?.role === 'USER' && (
          <MusicPlayer
            request={musicRequest}
            historyScope={user?.id || pet?.id || 'default'}
            petName={pet?.name || 'Mochi Neko'}
            pet={pet}
            isMinimizedToPet={activeTab !== 'MUSIC'}
            onExpandToMusicTab={() => setActiveTab('MUSIC')}
            onPlayingStateChange={setIsYoutubePlaying}
            onTrackSelect={t => {
              pauseBgmForCustomSong();
              setSpeechBubble(`Đang phát: ${t.title} 🎵`);
              setTimeout(() => setSpeechBubble(null), 3000);
            }}
          />
        )}

        {/* TAB 6: LEADERBOARD */}
        {user && !canManageSystem && activeTab === 'LEADERBOARD' && (
          <div className="max-w-5xl mx-auto space-y-5">
            {/* Top Navy Banner */}
            <div className="p-6 bg-[#1e1b2e] text-white rounded-2xl border-2 border-slate-950 shadow-[4px_4px_0px_#0f172a]">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 font-extrabold text-[11px] uppercase tracking-wide border border-amber-400/30">
                    <Trophy size={13} className="text-amber-400" />
                    <span>BẢNG VINH DANH • Chu kỳ tuần hiện tại</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                    Bảng Xếp Hạng Đóng Góp Phòng Ban & Đồng Nghiệp
                  </h2>
                  <p className="text-xs text-slate-300 max-w-xl">
                    Vinh danh các thành viên có thời lượng tập trung làm việc & chăm sóc bé cưng tích cực nhất
                  </p>
                </div>

                {/* 3 Stats Boxes */}
                <div className="flex items-center gap-2.5">
                  <div className="bg-white/10 backdrop-blur-xs border border-white/15 px-3.5 py-2.5 rounded-2xl text-center min-w-[95px]">
                    <div className="text-[10px] text-blue-200 uppercase font-semibold">Tổng thành viên</div>
                    <div className="text-base font-extrabold text-white font-mono mt-0.5">
                      {leaderboard?.totalParticipants || 482}
                    </div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs border border-white/15 px-3.5 py-2.5 rounded-2xl text-center min-w-[95px]">
                    <div className="text-[10px] text-blue-200 uppercase font-semibold">Tổng giờ Pomodoro</div>
                    <div className="text-base font-extrabold text-amber-300 font-mono mt-0.5">
                      1,420h
                    </div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs border border-white/15 px-3.5 py-2.5 rounded-2xl text-center min-w-[95px]">
                    <div className="text-[10px] text-blue-200 uppercase font-semibold">Khu vườn cấp</div>
                    <div className="text-base font-extrabold text-emerald-400 font-mono mt-0.5">
                      Lv.8
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-1.5">
                {[
                  { id: 'WEEK', label: 'Tuần này' },
                  { id: 'MONTH', label: 'Tháng này' },
                  { id: 'SEMESTER', label: 'Quý này' },
                  { id: 'ALL', label: 'Toàn công ty' }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setLeaderboardFilter(t.id as any)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                      leaderboardFilter === t.id
                        ? 'bg-amber-400 text-slate-950 shadow-xs'
                        : 'bg-white hover:bg-amber-50 text-slate-800 font-bold border-2 border-slate-900 shadow-[0_2px_0_#0f172a]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="text-[11px]">Cập nhật mỗi 5 phút</span>
                <button
                  onClick={() => loadLeaderboard()}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition"
                  title="Tải lại bảng xếp hạng"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>

            {/* 2-Column Content */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column (8 cols) */}
              <div className="lg:col-span-8 bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] p-5 sm:p-6 shadow-xs">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                  <h3 className="font-extrabold text-xs text-[#231e36] uppercase tracking-wider flex items-center gap-2">
                    <Trophy size={16} className="text-amber-500" />
                    <span>XẾP HẠNG ĐÓNG GÓP THÀNH VIÊN</span>
                  </h3>
                  <span className="text-[11px] text-slate-400 font-medium">Top 5 nổi bật</span>
                </div>

                <div className="space-y-3">
                  {/* Top 1 Card */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50/90 via-orange-50/40 to-amber-50/80 border-2 border-amber-300 shadow-sm flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="relative w-11 h-11 rounded-2xl bg-amber-400 text-slate-950 flex flex-col items-center justify-center shrink-0 font-extrabold shadow-xs">
                        <Crown size={16} className="text-slate-950 -mb-0.5" />
                        <span className="text-[10px]">TOP 1</span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-slate-900 truncate">
                            {leaderboard?.top10?.[0]?.fullName || user?.fullName || 'Phi Hùng'}
                          </span>
                          <span className="px-2 py-0.2 bg-blue-100 text-blue-800 text-[10px] font-extrabold rounded-md">
                            BẠN
                          </span>
                          <span className="px-2 py-0.2 bg-amber-100 text-amber-900 text-[10px] font-bold rounded-md border border-amber-300">
                            Siêu Cần Cù
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {leaderboard?.top10?.[0]?.petName || pet?.name || 'Mochi Neko'} • Lv.3 (Hạnh phúc: 98%) • 14.5h Pomodoro • 24 Nhiệm vụ
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-extrabold text-base text-amber-600 font-mono">
                        {leaderboard?.top10?.[0]?.totalExp || 650} EXP
                      </div>
                      <div className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 mt-0.5">
                        +120 hôm nay
                      </div>
                    </div>
                  </div>

                  {/* Top 2 Card */}
                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition shadow-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex flex-col items-center justify-center shrink-0 font-bold border border-slate-200">
                        <Award size={15} className="text-slate-400 -mb-0.5" />
                        <span className="text-[9px]">TOP 2</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 truncate">
                            {leaderboard?.top10?.[1]?.fullName || 'Trần Minh Anh'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">Phòng Kỹ Thuật</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {leaderboard?.top10?.[1]?.petName || 'Bento Boy'} • Lv.3 • 12.0h Pomodoro
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-extrabold text-sm text-slate-700 font-mono shrink-0">
                      {leaderboard?.top10?.[1]?.totalExp || 480} EXP
                    </div>
                  </div>

                  {/* Top 3 Card */}
                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition shadow-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-800 flex flex-col items-center justify-center shrink-0 font-bold border border-amber-200">
                        <Award size={15} className="text-amber-600 -mb-0.5" />
                        <span className="text-[9px]">TOP 3</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 truncate">
                            {leaderboard?.top10?.[2]?.fullName || 'Lê Thu Hà'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">Phòng Sáng Tạo</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {leaderboard?.top10?.[2]?.petName || 'Thỏ Bông'} • Lv.2 • 9.5h Pomodoro
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-extrabold text-sm text-slate-700 font-mono shrink-0">
                      {leaderboard?.top10?.[2]?.totalExp || 360} EXP
                    </div>
                  </div>

                  {/* #4 Card */}
                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition shadow-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center shrink-0 font-bold text-xs border border-slate-200">
                        #4
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-slate-800 truncate">
                            {leaderboard?.top10?.[3]?.fullName || 'Nguyễn Quốc Bảo'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">Phòng Vận Hành</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {leaderboard?.top10?.[3]?.petName || 'Hamster Ong Vàng'} • Lv.2 • 6.0h Pomodoro
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-bold text-xs text-slate-600 font-mono shrink-0">
                      {leaderboard?.top10?.[3]?.totalExp || 240} EXP
                    </div>
                  </div>

                  {/* #5 Card */}
                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition shadow-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center shrink-0 font-bold text-xs border border-slate-200">
                        #5
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-slate-800 truncate">
                            {leaderboard?.top10?.[4]?.fullName || 'OfficePet Admin'}
                          </span>
                          <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[9px] font-bold rounded">
                            QUẢN TRỊ VIÊN
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {leaderboard?.top10?.[4]?.petName || 'Saber Arthuria'} • Lv.2 • 5.5h Pomodoro
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-bold text-xs text-slate-600 font-mono shrink-0">
                      {leaderboard?.top10?.[4]?.totalExp || 210} EXP
                    </div>
                  </div>
                </div>

                {/* Footer Link */}
                <div className="pt-4 mt-4 border-t border-slate-100 text-center">
                  <button
                    type="button"
                    className="text-xs font-bold text-[#231e36] hover:text-blue-700 inline-flex items-center gap-1 transition"
                  >
                    <span>Xem danh sách đầy đủ (Top 50 thành viên)</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {/* Right Column (4 cols) */}
              <div className="lg:col-span-4 space-y-4">
                {/* Pet of the Week Card */}
                <div className="bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] p-5 shadow-xs">
                  <div className="flex items-center gap-2 mb-3">
                    <Crown size={16} className="text-amber-500" />
                    <h4 className="text-xs font-extrabold text-[#231e36] uppercase tracking-wider">
                      Thú Cưng Tiên Phong (Quán Quân Tuần)
                    </h4>
                  </div>

                  <div className="bg-white rounded-2xl border border-blue-100 p-4 text-center shadow-xs mb-3">
                    <div className="relative w-20 h-20 mx-auto mb-2 bg-gradient-to-b from-amber-100/60 to-blue-50 rounded-2xl flex items-center justify-center overflow-hidden border border-amber-200">
                      <span className="text-3xl">🐱</span>
                      <span className="absolute top-1 right-1 text-xs">👑</span>
                    </div>
                    <div className="font-extrabold text-xs text-slate-900">
                      {pet?.name || 'Mochi Neko'} (Đại ca: {user?.fullName || 'Phi Hùng'})
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">650 / 800 EXP (Cấp 3)</div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2 border border-slate-200">
                      <div className="bg-amber-400 h-full rounded-full" style={{ width: '81%' }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <div className="text-[10px] text-slate-400 font-medium">Giờ tập trung</div>
                      <div className="font-bold text-slate-900 mt-0.5 font-mono">14.5 Giờ</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <div className="text-[10px] text-slate-400 font-medium">Nhiệm vụ xong</div>
                      <div className="font-bold text-emerald-600 mt-0.5 font-mono">24 / 24</div>
                    </div>
                  </div>
                </div>

                {/* Department Race Top */}
                <div className="bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] p-5 shadow-xs">
                  <h4 className="text-xs font-extrabold text-[#231e36] uppercase tracking-wider mb-3">
                    Đua Top Theo Phòng Ban
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-bold text-[10px]">
                          1
                        </span>
                        <div>
                          <div className="font-bold text-slate-900">Phòng Kỹ Thuật & Phần Mềm</div>
                          <div className="text-[10px] text-slate-400">18 thành viên tham gia</div>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-amber-600">3,890 EXP</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                          2
                        </span>
                        <div>
                          <div className="font-bold text-slate-900">Phòng Thiết Kế & Sáng Tạo</div>
                          <div className="text-[10px] text-slate-400">15 thành viên tham gia</div>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-slate-700">3,120 EXP</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-[10px]">
                          3
                        </span>
                        <div>
                          <div className="font-bold text-slate-900">Phòng Vận Hành & Hạ Tầng</div>
                          <div className="text-[10px] text-slate-400">12 thành viên tham gia</div>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-amber-700">2,640 EXP</span>
                    </div>
                  </div>
                </div>

                {/* Scoring Rules Guide */}
                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4 text-xs space-y-2">
                  <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wide">
                    Cơ Chế Tích Lũy EXP & Đóng Góp
                  </div>
                  <ul className="text-[11px] text-slate-500 space-y-1">
                    <li>• Pomodoro 25p = <strong className="text-slate-700">+25 EXP</strong></li>
                    <li>• Hoàn thành nhiệm vụ = <strong className="text-slate-700">+15 - 50 EXP</strong></li>
                    <li>• Chăm sóc & vườn chung = <strong className="text-slate-700">+10 - 30 EXP</strong></li>
                  </ul>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setIsGuideModalOpen(true)}
                      className="text-[11px] font-bold text-[#231e36] hover:underline"
                    >
                      Xem hướng dẫn chi tiết &rarr;
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Current Rank Banner */}
            <div className="p-4 rounded-2xl bg-[#1e1b2e] border-2 border-slate-950 shadow-[3px_3px_0px_#0f172a] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-extrabold text-sm shadow-xs shrink-0">
                  #1
                </div>
                <div>
                  <div className="font-extrabold text-xs sm:text-sm">
                    Thứ hạng hiện tại của bạn: #1 Phòng Kỹ Thuật
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    Duy trì thêm 2 phiên để giữ vững danh hiệu Quán quân tuần!
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  alert('Đã sao chép liên kết chia sẻ thành tích của bạn!');
                }}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none font-extrabold text-xs shadow-xs transition active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
              >
                <Share2 size={14} />
                <span>Chia sẻ thành tích</span>
              </button>
            </div>
          </div>
        )}



        {/* TAB: QUESTS */}
        {user?.role === 'USER' && activeTab === 'QUESTS' && (
          <div className="max-w-3xl mx-auto">
            <QuestModal
              isEmbeddedTab={true}
              onPetUpdate={(updatedPet) => setPet(updatedPet)}
              onNavigateToAction={(actionType) => {
                if (actionType === 'POMODORO') setActiveTab('FOCUS');
                else if (actionType === 'CHAT') setActiveTab('AI_CHAT');
                else if (actionType === 'MUSIC') setActiveTab('MUSIC');
                else if (actionType === 'FEED') {
                  setActiveTab('PET');
                  void handleFeed();
                } else if (actionType === 'DRINK') {
                  setActiveTab('PET');
                  handlePetStateChange('DRINKING');
                  setSpeechBubble('Cùng nghỉ uống nước một chút nhé! 💧');
                  void api.recordQuestAction('DRINK', 1).catch(console.warn);
                } else if (actionType === 'STROKE') {
                  setActiveTab('PET');
                  void handleStroke();
                }
              }}
            />
          </div>
        )}

        {/* TAB 7: ADMIN CONSOLE */}
        {user && canManageSystem && activeTab === 'ADMIN' && <AdminConsole />}

        {isPetSelectorOpen && pet && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border-4 border-charcoal bg-cream-100 p-5 shadow-pixel-lg">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-pixel text-sm text-charcoal">Chọn người bạn đồng hành</h2>
                  <p className="mt-1 text-xs text-gray-600">
                    Giống thú mở khóa theo cấp của {pet.name}; đổi giống không làm mất cấp hay EXP.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPetSelectorOpen(false)}
                  className="rounded-lg border-2 border-charcoal bg-white px-3 py-1.5 text-xs"
                >
                  Đóng
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {petTypes.map(type => {
                  const isLocked = type.isPurchaseRequired
                    ? !ownedPetTypeIds.includes(type.id)
                    : type.unlockLevel > pet.level;
                  return (
                    <button
                      type="button"
                      key={type.id}
                      disabled={isLocked}
                      onClick={() => void handleSelectPet(type.id)}
                      className={`rounded-xl border-2 border-charcoal bg-white p-4 text-left shadow-pixel-sm transition ${
                        isLocked ? 'cursor-not-allowed opacity-50' : 'hover:border-terracotta-400'
                      }`}
                    >
                      {type.previewUrl && (
                        <img
                          src={type.previewUrl}
                          alt={type.name}
                          className="mx-auto mb-2 h-24 w-24 object-contain"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      )}
                      <div className="font-pixel text-xs text-charcoal">{type.name}</div>
                      <div className="mt-1 text-[11px] text-gray-600">{type.description}</div>
                      {isLocked ? (
                        <div className="mt-2 text-[10px] font-bold text-terracotta-600">
                          {type.isPurchaseRequired ? 'Cần mua ở cửa hàng trước' : `Mở khóa ở cấp ${type.unlockLevel}`}
                        </div>
                      ) : type.id === pet.typeId ? (
                        <div className="mt-2 text-[10px] font-bold text-sage-600">Đang đồng hành</div>
                      ) : (
                        <div className="mt-2 text-[10px] font-bold text-sage-600">Đã sở hữu (Bấm để đổi)</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {isPetRenameOpen && pet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={() => setIsPetRenameOpen(false)}>
          <form
            onSubmit={handleRenamePet}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pet-rename-title"
            onClick={event => event.stopPropagation()}
            className="w-full max-w-sm space-y-4 rounded-2xl border-2 border-charcoal bg-white p-5 shadow-pixel"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 id="pet-rename-title" className="font-pixel text-sm text-charcoal">Đổi tên bé cưng</h2>
                <p className="mt-1 text-xs text-gray-500">Tên mới sẽ được cập nhật trên thú cưng và khung overlay.</p>
              </div>
              <button type="button" onClick={() => setIsPetRenameOpen(false)} aria-label="Đóng" className="rounded p-1 text-gray-500 hover:bg-gray-100"><X size={17} /></button>
            </div>
            <label className="block text-xs font-bold text-gray-700">
              Tên thú cưng
              <input
                autoFocus
                required
                minLength={1}
                maxLength={24}
                value={petNameDraft}
                onChange={event => setPetNameDraft(event.target.value)}
                className="mt-1 w-full rounded-lg border-2 border-charcoal px-3 py-2 text-sm font-normal"
              />
              <span className="mt-1 block text-[11px] font-normal text-gray-500">Tối đa 24 ký tự.</span>
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsPetRenameOpen(false)} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50">Hủy</button>
              <button type="submit" disabled={!petNameDraft.trim() || petNameDraft.trim().length > 24 || isRenamingPet} className="rounded-lg border-2 border-charcoal bg-sage-500 px-4 py-2 text-xs font-bold text-white hover:bg-sage-600 disabled:opacity-50">
                {isRenamingPet ? 'Đang lưu...' : 'Lưu tên'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Floating Desktop Pet Overlay (hidden when Floating YouTube TV + Pet is active so there is no duplicate pet) */}
      {user?.role === 'USER' && pet && isOverlayVisible && !window.officePet && activeTab !== 'PET' && !(isYoutubePlaying && activeTab !== 'MUSIC') && (
        <DesktopOverlay
          pet={pet}
          onOpenPiP={handleOpenDesktopPetPiP}
          onFeed={handleFeed}
          onStroke={handleStroke}
          onDrink={handleDrink}
          onLevelUp={handleLevelUp}
          onCloseOverlay={() => setIsOverlayVisible(false)}
          onPetStateChange={handlePetStateChange}
          onModeChange={mode => {
            void api.setPetMode(mode).catch(error => console.warn('Could not update the Pomodoro mode:', error));
            setPet(prev => (prev ? { ...prev, currentMode: mode } : prev));
          }}
          onSessionFinish={() => {
            void handleRefreshPet();
            handlePetStateChange('CELEBRATING');
            setSpeechBubble('🎉 Hoan hô! Bạn đã hoàn thành một phiên tập trung xuất sắc! Tuyệt vời lắm! 🌟');
            setTimeout(() => setSpeechBubble(null), 5000);
            schedulePetIdleAnimation();
          }}
          onTrackSelect={track => {
            const clean = formatCleanSongTitle(track.title);
            setSpeechBubble(`🎵 Đang phát: ${clean}`);
            setTimeout(() => setSpeechBubble(null), 4500);
          }}
          onPetInteraction={(state, message) => {
            handlePetStateChange(state);
            setSpeechBubble(message);
            setTimeout(() => setSpeechBubble(null), 3500);
          }}
          onOpenQuests={() => setActiveTab('QUESTS')}
          speechBubble={speechBubble}
        />
      )}

      {/* Desktop Pet Picture-in-Picture Window Portal */}
      {pipContainer && pet && createPortal(
        <DesktopPetPiPView
          pet={pet}
          speechBubble={speechBubble}
          onFeed={handleFeed}
          onDrink={handleDrink}
          onStroke={handleStroke}
          onInteraction={(state, msg) => {
            handlePetStateChange(state);
            showTemporarySpeechBubble(msg, 4500);
            schedulePetIdleAnimation();
          }}
          onClose={() => {
            if (pipWindowRef.current && !pipWindowRef.current.closed) {
              pipWindowRef.current.close();
            }
            setPipContainer(null);
          }}
        />,
        pipContainer
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(u) => {
          setUser(u);
          setActiveTab(u.role === 'ADMIN' ? 'ADMIN' : 'PET');
          void loadInitialData();
        }}
      />

      {/* Help & Shortcut Guide Modal */}
      {isGuideModalOpen && user?.role !== 'ADMIN' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] max-w-lg w-full p-5 shadow-2xl text-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">🐾</span>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">HƯỚNG DẪN THAO TÁC & PHÍM TẮT</h3>
              </div>
              <button
                onClick={() => setIsGuideModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                title="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              {/* Shortcut Section */}
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                <div className="flex items-center gap-2 font-bold text-[#231e36] mb-1.5 text-xs">
                  ⌨️ TỔ HỢP PHÍM TẮT TOÀN CỤC
                </div>
                <div className="flex flex-wrap items-center gap-2 text-slate-700">
                  <kbd className="px-2.5 py-1 bg-[#231e36] text-white rounded-lg text-xs font-mono font-bold shadow-xs">
                    Ctrl + Shift + P
                  </kbd>
                  <span>(hoặc <strong>Cmd + Shift + P</strong> trên macOS)</span>
                </div>
                <p className="mt-1.5 text-slate-600 text-[11px]">
                  👉 <strong>Ẩn hoặc Hiện tức thì thú cưng</strong> trên màn hình desktop bất kỳ lúc nào, kể cả khi bạn đang mở game, xem YouTube, lướt web hay soạn thảo tài liệu.
                </p>
              </div>

              {/* Drag and Drop Section */}
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                <div className="flex items-center gap-2 font-bold text-amber-600 mb-1 text-xs">
                  🖱️ KÉO THẢ & DI CHUYỂN VỊ TRÍ
                </div>
                <p className="text-slate-600 text-[11.5px]">
                  • Giữ chuột vào <strong>thanh kéo tiêu đề trên đầu thú cưng</strong> (có biểu tượng ✥) để kéo và thả thú cưng đến bất kỳ vị trí nào trên màn hình desktop.
                </p>
              </div>

              {/* Quick Actions Section */}
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                <div className="flex items-center gap-2 font-bold text-rose-600 mb-1 text-xs">
                  ✨ CÁC NÚT THAO TÁC & CHĂM SÓC
                </div>
                <ul className="space-y-1.5 text-[11.5px] text-slate-700">
                  <li>
                    • 👆 <strong>Nhấp trực tiếp vào thú cưng:</strong> Vuốt ve nhận ngay <strong>+30 EXP</strong> và tăng điểm Hạnh phúc ❤️.
                  </li>
                  <li>
                    • 🍱 <strong>Cho ăn (Utensils):</strong> Tăng no bụng và nhận <strong>+50 EXP</strong> (giới hạn tương tác mỗi ngày).
                  </li>
                  <li>
                    • 💖 <strong>Vuốt ve (Heart):</strong> Tăng chỉ số vui vẻ, giảm stress.
                  </li>
                  <li>
                    • 💬 <strong>Trò chuyện AI (Message):</strong> Mở khung chat tâm sự, thư giãn với trợ lý ảo Gemini AI.
                  </li>
                  <li>
                    • ⏱️ <strong>Đồng hồ Pomodoro (Timer):</strong> Đếm ngược 25 phút tập trung làm việc, bé cưng cùng đồng hành.
                  </li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setIsGuideModalOpen(false)}
              className="w-full mt-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none font-bold text-xs rounded-xl shadow-xs transition active:scale-95"
            >
              ĐÃ HIỂU ✓
            </button>
          </div>
        </div>
      )}

      {user && (
        <FriendsModal
          isOpen={isFriendsOpen}
          onClose={() => setIsFriendsOpen(false)}
          currentUser={user}
        />
      )}

      <BreathingExerciseModal
        isOpen={isBreathingModalOpen}
        onClose={() => setIsBreathingModalOpen(false)}
        durationMinutes={breathingDuration}
      />

      {/* Profile & Account Settings Modal */}
      {isProfileOpen && user && (
        <ProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          currentUser={user}
          userPet={pet}
          onUserUpdated={(updatedUser) => {
            setUser(updatedUser);
            if (updatedUser.userPet) {
              setPet(updatedUser.userPet);
            }
          }}
          onNavigateTab={(tab) => {
            setActiveTab(tab as any);
          }}
        />
      )}

        {/* Modern OfficePet Footer */}
        <footer className="mt-auto border-t-2 border-slate-900 bg-[#fffdfa] py-4 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-950">OfficePet 2D Pixel</span>
              <span className="text-slate-300">•</span>
              <span className="font-medium">Không Gian Thú Cưng Thư Giãn & Đồng Hành Năng Suất</span>
            </div>
            <div className="text-center text-slate-500 text-[11px] font-medium">
              © 2024–2026 OfficePet Team.
            </div>
            <div className="flex items-center gap-4 text-[11.5px] font-bold text-slate-700">
              <a href="#rules" onClick={(e) => { e.preventDefault(); setIsGuideModalOpen(true); }} className="hover:text-amber-600 transition">Hướng dẫn sử dụng</a>
              <span className="text-slate-300">|</span>
              <a href="#community" onClick={(e) => { e.preventDefault(); setActiveTab('GARDEN'); }} className="hover:text-amber-600 transition">Phòng chung</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
    </div>
  );
};

export default App;
