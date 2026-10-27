import React, { useState, useEffect, useRef } from 'react';
import { api } from './services/api';
import { User, UserPet, AnimationState, MusicRequest, PetType } from './types';
import { PixelPetCanvas } from './components/PixelPetCanvas';
import { DesktopOverlay } from './components/DesktopOverlay';
import { PomodoroTimer } from './components/PomodoroTimer';
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
import { getSocket } from './services/socket';

import {
  Heart, Utensils, MessageSquare, Timer, TreePine, Music, ShoppingBag,
  ShieldAlert, LogIn, LogOut, Sparkles, Trophy, Minimize2, Users,
  Maximize2, Activity, Coffee, Sun, Monitor, HelpCircle, X, Pencil, Award,
  Moon, Smile, ThumbsUp, Footprints, Flame, Zap, Camera, Volume2,
  GraduationCap, ShieldCheck, Coins, RefreshCw, Hand, Droplets,
  Crown, Share2, ChevronRight, Clock
} from 'lucide-react';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [pet, setPet] = useState<UserPet | null>(null);
  const [petTypes, setPetTypes] = useState<PetType[]>([]);
  const [ownedPetTypeIds, setOwnedPetTypeIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<
    'PET' | 'SHOP' | 'GARDEN' | 'FOCUS' | 'AI_CHAT' | 'MUSIC' | 'LEADERBOARD' | 'DEPARTMENT' | 'QUESTS' | 'ADMIN'
  >('PET');

  const [isOverlayVisible, setIsOverlayVisible] = useState(true);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [isPetSelectorOpen, setIsPetSelectorOpen] = useState(false);
  const [isPetRenameOpen, setIsPetRenameOpen] = useState(false);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [isBreathingModalOpen, setIsBreathingModalOpen] = useState(false);
  const [breathingDuration, setBreathingDuration] = useState(2);
  const [petNameDraft, setPetNameDraft] = useState('');
  const [isRenamingPet, setIsRenamingPet] = useState(false);
  const [speechBubble, setSpeechBubble] = useState<string | null>(null);
  const [musicRequest, setMusicRequest] = useState<MusicRequest>();
  const idleAnimationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auth modal
  const [isAuthOpen, setIsAuthOpen] = useState(() =>
    Boolean(new URLSearchParams(window.location.search).get('resetToken'))
  );

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<any | null>(null);
  const [leaderboardFilter, setLeaderboardFilter] = useState<'WEEK' | 'MONTH' | 'SEMESTER' | 'ALL'>('WEEK');

  // Scale size selection (100px - 150px)
  const [currentScale, setCurrentScale] = useState<'SMALL' | 'MEDIUM' | 'LARGE'>('MEDIUM');

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

  const schedulePetIdleAnimation = () => {
    if (idleAnimationTimeout.current) clearTimeout(idleAnimationTimeout.current);
    idleAnimationTimeout.current = setTimeout(async () => {
      try {
        await api.setPetState('IDLE');
        setPet(prev => (prev ? { ...prev, currentState: 'IDLE' } : prev));
      } catch (error) {
        console.warn('Could not restore the pet idle animation:', error);
      }
    }, 3500);
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
    setSpeechBubble(bubbleMsg);
    setTimeout(() => setSpeechBubble(null), 4000);
    schedulePetIdleAnimation();
  };

  const handleFeed = async () => {
    if (pet?.dailyInteractionsLeft && pet.dailyInteractionsLeft > 0) {
      try {
        const prevLevel = pet.level;
        const res = await api.feedPet();
        const updatedPet = res.data.pet;
        setPet(updatedPet);

        // Check for level up -> trigger EVOLVING animation!
        if (updatedPet.level > prevLevel) {
          handlePetStateChange('EVOLVING');
          setSpeechBubble(`🎉 Chúc mừng! Bé cưng đã tiến hóa & tăng lên Cấp ${updatedPet.level}! ✨`);
          setTimeout(() => setSpeechBubble(null), 5000);
          return;
        }

        schedulePetIdleAnimation();
        const messages = [
          'Ngon quá đi! Cảm ơn chủ nhân nhiều nha! (+50 EXP) 🍱',
          'Măm măm, đúng món mình thích luôn! 🥰',
          'Được bạn chăm sóc, mình thấy ấm lòng quá! 💖',
          'No bụng rồi, mình sẽ cổ vũ bạn làm việc thật tốt! ✨'
        ];
        setSpeechBubble(messages[Math.floor(Math.random() * messages.length)]);
        setTimeout(() => setSpeechBubble(null), 4000);
        return;
      } catch (err: any) {
        console.warn('Feed API error:', err);
      }
    }
    handlePetStateChange('EATING');
    const messages = [
      'Măm măm ngon quá! Cảm ơn bạn nhiều nha! 🍱',
      'Bé cưng ăn thêm bữa nhẹ ngon lành! 🥰',
      'Ngon tuyệt cú mèo! Giờ thì tràn đầy năng lượng rồi! ✨'
    ];
    setSpeechBubble(messages[Math.floor(Math.random() * messages.length)]);
    setTimeout(() => setSpeechBubble(null), 4000);
    schedulePetIdleAnimation();
  };

  const handleDrink = () => {
    handlePetStateChange('DRINKING');
    const messages = [
      'Nước mát lành quá! Bạn nhớ uống đủ 2 lít nước mỗi ngày nha! 💧',
      'ực ực... Đã khát quá! Cảm ơn bạn nhiều nhé! 🧃',
      'Nghỉ tay uống một ngụm nước mát cùng mình nào! 🍵'
    ];
    setSpeechBubble(messages[Math.floor(Math.random() * messages.length)]);
    setTimeout(() => setSpeechBubble(null), 4000);
    schedulePetIdleAnimation();
  };

  const handleStroke = async () => {
    try {
      const prevLevel = pet?.level || 1;
      const res = await api.strokePet();
      const updatedPet = res.data.pet;
      setPet(updatedPet);

      // Check for level up -> trigger EVOLVING animation!
      if (updatedPet.level > prevLevel) {
        handlePetStateChange('EVOLVING');
        setSpeechBubble(`🎉 Bé cưng đã thăng cấp lên Cấp ${updatedPet.level}! Hào quang tiến hóa bùng nổ! ✨`);
        setTimeout(() => setSpeechBubble(null), 5000);
        return;
      }

      schedulePetIdleAnimation();
      const messages = [
        'Hì hì, được bạn vuốt ve thích thật đó! (+30 EXP) ❤️',
        'Ôi, mình thích được bạn xoa đầu lắm! 🥰',
        'Có bạn ở đây là mình vui nhất rồi! 💕',
        'Mình sẽ nhớ khoảnh khắc dễ thương này nha! 🐾'
      ];
      setSpeechBubble(messages[Math.floor(Math.random() * messages.length)]);
      setTimeout(() => setSpeechBubble(null), 4000);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Lỗi vuốt ve');
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
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col font-sans select-none text-slate-800">
      {/* Top Modern Navy Header */}
      <header className="bg-[#1b365d] text-white shadow-sm sticky top-0 z-40 border-b border-[#162b49]">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/10 border border-white/20 rounded-xl flex items-center justify-center text-xl shadow-xs">
              🐾
            </div>
            <div className="flex items-center gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-white flex items-center gap-1.5">
                    OfficePet
                  </h1>
                  <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                    2D PIXEL
                  </span>
                </div>
                <p className="text-[11px] text-blue-200/80 font-normal">
                  {canManageSystem
                    ? 'Bảng điều khiển quản trị hệ thống'
                    : user?.department?.name || 'Thú Cưng Công Sở & Đồng Hành Năng Suất'}
                </p>
              </div>
            </div>
          </div>

          {/* User & Pet Quick Status Widget */}
          {user?.role === 'USER' && pet && (
            <div className="flex items-center gap-3 bg-white/10 hover:bg-white/15 border border-white/20 px-3.5 py-1.5 rounded-full text-xs transition">
              <div className="flex items-center gap-1 font-bold text-amber-300">
                <span>🐾 {pet.name}</span>
                <span className="bg-amber-400/20 text-amber-300 text-[10px] px-1.5 py-0.2 rounded font-mono ml-0.5">
                  Lv.{pet.level}
                </span>
                <button
                  type="button"
                  onClick={() => { setPetNameDraft(pet.name); setIsPetRenameOpen(true); }}
                  aria-label="Đổi tên thú cưng"
                  title="Đổi tên thú cưng"
                  className="ml-0.5 rounded p-0.5 text-white/70 hover:text-white"
                >
                  <Pencil size={11} />
                </button>
              </div>

              {/* Heart Bar */}
              <div className="hidden sm:flex items-center gap-1.5 text-pink-300 text-[11px]">
                <Heart size={12} className="fill-pink-400 text-pink-400" />
                <div className="w-12 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="bg-pink-400 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, pet.happiness)}%` }}
                  />
                </div>
              </div>

              {/* Energy Bar */}
              <div className="hidden sm:flex items-center gap-1.5 text-amber-300 text-[11px]">
                <Zap size={12} className="fill-amber-400 text-amber-400" />
                <div className="w-12 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-400 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, pet.hunger)}%` }}
                  />
                </div>
              </div>

              {/* Battery / Focus indicator */}
              <div className="flex items-center gap-1 text-[11px] text-blue-200 font-mono font-bold pl-1 border-l border-white/20">
                <span>🔋 {pet.happiness}%</span>
              </div>
            </div>
          )}

          {/* Quick Actions & Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Desktop Mode / PiP Button */}
            {user?.role === 'USER' && pet && (
              <button
                onClick={() => {
                  if ('documentPictureInPicture' in window) {
                    const pipBtn = document.querySelector('button[title*="Picture-in-Picture"]') as HTMLButtonElement;
                    if (pipBtn) pipBtn.click();
                  } else {
                    alert('📌 Để thú cưng luôn nổi trên mọi ứng dụng và màn hình desktop khi chuyển trang web hay mở ứng dụng khác:\n\n1. Bạn chạy lệnh: npm run desktop (trong thư mục frontend).\n2. Hoặc sử dụng Google Chrome / Microsoft Edge để bật chế độ nổi Picture-in-Picture!');
                  }
                }}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium border border-white/20 transition active:scale-95"
                title="Cho phép thú cưng nổi đè lên màn hình khi sang trang web khác hoặc mở ứng dụng khác"
              >
                <Monitor size={14} className="text-blue-300" />
                <span>Nối Desktop</span>
              </button>
            )}

            {user?.role !== 'ADMIN' && (
              <button
                onClick={() => setIsGuideModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium border border-white/20 transition active:scale-95"
                title="Hướng dẫn phím tắt & các thao tác điều khiển"
              >
                <HelpCircle size={14} className="text-amber-300" />
                <span className="hidden sm:inline">Phím tắt & Hướng dẫn</span>
                <span className="sm:hidden">Hướng dẫn</span>
              </button>
            )}

            {/* User Account / Profile */}
            <div className="flex items-center gap-2 pl-1 border-l border-white/15">
              {user ? (
                <div className="flex items-center gap-2">
                  <div className="text-right hidden sm:block">
                    <div className="text-xs font-bold text-white leading-tight">{user.fullName}</div>
                    <div className="text-[10px] text-blue-200/90 leading-tight">
                      {canManageSystem
                        ? 'Quản trị viên'
                        : user.department?.name || 'Người dùng'}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-blue-700/60 border border-blue-400/40 flex items-center justify-center text-xs font-bold text-white shadow-xs">
                    {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-1.5 bg-red-600/90 hover:bg-red-600 text-white rounded-lg border border-red-500/50 shadow-xs transition"
                    title="Đăng xuất"
                    aria-label="Đăng xuất"
                  >
                    <LogOut size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsAuthOpen(true)}
                  className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition"
                >
                  <LogIn size={14} /> Đăng nhập
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Secondary Navigation Tabs Bar */}
        {user && (
          <div className="border-t border-white/10 bg-[#162b49]/95 px-4">
            <nav aria-label="Điều hướng chính" className="max-w-7xl mx-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1.5 text-xs">
              {user.role === 'USER' && (
                <button
                  onClick={() => setActiveTab('PET')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'PET'
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  Bé Cưng
                </button>
              )}
              {user.role === 'USER' && (
                <button
                  onClick={() => setActiveTab('SHOP')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'SHOP'
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <ShoppingBag size={13} /> Cửa hàng
                </button>
              )}
              {user.role === 'USER' && (
                <button
                  onClick={() => setActiveTab('GARDEN')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'GARDEN'
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Users size={13} /> {user.department ? 'Phòng chung (Khu Vườn)' : 'Phòng chung'}
                </button>
              )}
              {user.role === 'USER' && (
                <button
                  onClick={() => setActiveTab('FOCUS')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'FOCUS'
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Timer size={13} /> Pomodoro
                </button>
              )}
              {user.role === 'USER' && (
                <button
                  onClick={() => setActiveTab(pet ? 'AI_CHAT' : 'PET')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'AI_CHAT'
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <MessageSquare size={13} /> Trợ Lý AI
                </button>
              )}
              {user.role === 'USER' && (
                <button
                  onClick={() => setActiveTab('MUSIC')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'MUSIC'
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Music size={13} /> Nhạc Lofi
                </button>
              )}
              {user.role === 'USER' && user.department && (
                <button
                  onClick={() => setActiveTab('LEADERBOARD')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'LEADERBOARD'
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Trophy size={13} /> Xếp Hạng
                </button>
              )}
              {user.role === 'USER' && (
                <button
                  onClick={() => setActiveTab('QUESTS')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'QUESTS'
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Award size={13} className="text-amber-300" /> Nhiệm vụ
                </button>
              )}
              {user.role === 'USER' && (
                <button
                  type="button"
                  onClick={() => setIsFriendsOpen(true)}
                  className="px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap text-white/80 hover:text-white hover:bg-white/10"
                >
                  <Heart size={13} className="text-pink-300" /> Bạn bè & Tin nhắn
                </button>
              )}
              {canManageSystem && (
                <button
                  onClick={() => setActiveTab('ADMIN')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'ADMIN'
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <ShieldAlert size={13} /> Quản Trị Hệ Thống
                </button>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {/* Top Announcement Banner (Office Desk & Streak & EXP) */}
        {user?.role === 'USER' && (
          <div className="bg-white border border-slate-200/80 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700 shadow-xs mb-5">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-blue-50 text-[#1b365d]">
                <ShieldCheck size={16} />
              </span>
              <span className="font-semibold text-slate-800">
                {user.department?.name || 'Không gian làm việc nuôi thú ảo'}
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-500">Bàn làm việc văn phòng</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-slate-700">
                <Award size={15} className="text-amber-500" />
                <span>Chuỗi chăm sóc: <strong className="text-slate-900 font-bold">14 ngày liên tiếp</strong></span>
              </div>
              {pet && (
                <>
                  <span className="text-slate-300">|</span>
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Sparkles size={15} className="text-amber-500" />
                    <span>Tích lũy: <strong className="text-amber-600 font-bold">{pet.exp} EXP</strong></span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* TAB 1: PET MAIN VIEW */}
        {user?.role === 'USER' && activeTab === 'PET' && (
          <div className="space-y-6">
            {pet ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Pet Stage, Stats, Daily Tip (7 cols) */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Pet Stage Box */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-4 sm:p-5">
                    {/* Top Stage Bar: Mode, Size, Switch Pet */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                        {pet.currentMode === 'STRICT' ? 'Chế độ Nghiêm túc' : 'Chế độ Thư giãn'}
                      </span>

                      <div className="flex items-center gap-2">
                        {/* Size Switcher */}
                        <div className="flex items-center gap-1 text-xs bg-slate-100 p-1 border border-slate-200 rounded-lg">
                          <span className="text-slate-500 font-medium px-1 text-[11px]">SIZE:</span>
                          {(['SMALL', 'MEDIUM', 'LARGE'] as const).map(s => (
                            <button
                              key={s}
                              onClick={() => handleSetScale(s)}
                              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                                currentScale === s
                                  ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              {s === 'SMALL' ? '96px' : s === 'MEDIUM' ? '128px' : '192px'}
                            </button>
                          ))}
                        </div>

                        {/* Switch Pet Button */}
                        <button
                          type="button"
                          onClick={() => {
                            void refreshPetTypesAndOwned();
                            setIsPetSelectorOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium transition active:scale-95 shadow-xs"
                        >
                          <RefreshCw size={12} />
                          <span>Đổi thú cưng</span>
                        </button>
                      </div>
                    </div>

                    {/* Stage Canvas Container */}
                    <div className="relative rounded-2xl bg-gradient-to-b from-[#eef4ff] to-[#f8faff] border border-blue-100/80 min-h-[350px] p-4 flex flex-col justify-between overflow-hidden shadow-inner">
                      {/* Top Badges inside Canvas */}
                      <div className="flex items-center justify-between w-full z-10">
                        <div className="bg-white/80 backdrop-blur-xs border border-blue-100 px-2.5 py-1 rounded-lg text-[11px] text-slate-600 font-mono shadow-xs">
                          Tọa độ: X:24, Y:68 <span className="text-slate-300">|</span> Nhiệt độ: 24°C
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => alert('📸 Đã lưu ảnh chụp màn hình bé cưng vào thư viện!')}
                            title="Chụp ảnh thú cưng"
                            className="p-1.5 bg-white/80 hover:bg-white border border-blue-100 text-slate-600 hover:text-slate-900 rounded-lg shadow-xs transition"
                          >
                            <Camera size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => alert('🔊 Đã bật âm thanh tiếng kêu và hiệu ứng hoạt ảnh!')}
                            title="Âm thanh"
                            className="p-1.5 bg-white/80 hover:bg-white border border-blue-100 text-slate-600 hover:text-slate-900 rounded-lg shadow-xs transition"
                          >
                            <Volume2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Floating Chat Bubble & Centered Pet Canvas */}
                      <div className="my-auto py-6 flex flex-col items-center justify-center relative z-10">
                        {speechBubble && (
                          <div className="mb-3 max-w-sm bg-white border border-blue-100 shadow-md text-slate-800 text-xs font-medium px-4 py-2 rounded-2xl relative text-center animate-bounce-short">
                            <span className="text-amber-500 mr-1.5">💬</span>
                            "{speechBubble}"
                            <div className="w-2.5 h-2.5 bg-white border-r border-b border-blue-100 rotate-45 absolute -bottom-1.5 left-1/2 -translate-x-1/2"></div>
                          </div>
                        )}

                        <div className="relative">
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
                            showTooltip={true}
                          />
                          {/* Soft Floor Shadow Under Pet */}
                          <div className="w-24 h-4 bg-slate-400/20 rounded-full filter blur-[2px] mx-auto -mt-2"></div>
                        </div>
                      </div>

                      {/* Bottom Stage Bar: Intimacy Rank & Gentle Touch */}
                      <div className="flex items-center justify-between w-full z-10 pt-2 border-t border-blue-100/60">
                        <div className="flex items-center gap-1.5 text-xs text-rose-700 font-semibold">
                          <Heart size={14} className="fill-rose-500 text-rose-500" />
                          <span>Độ thân mật: <strong className="text-slate-900 font-bold">Thân thiết (Rank S)</strong></span>
                        </div>
                        <button
                          type="button"
                          onClick={handleStroke}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-xs transition active:scale-95"
                        >
                          <Hand size={13} className="text-amber-500" />
                          <span>Chạm nhẹ cưng</span>
                        </button>
                      </div>
                    </div>

                    {/* Pet Level & EXP Progress Card */}
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <div className="flex flex-wrap items-center justify-between text-xs mb-2">
                        <div className="flex items-center gap-2">
                          <span className="bg-amber-400 text-slate-950 font-bold text-xs px-2.5 py-0.5 rounded-md shadow-xs">
                            Cấp {pet.level}
                          </span>
                          <span className="font-bold text-slate-800 text-sm">
                            {pet.name} <span className="text-slate-500 font-normal text-xs">({pet.petType?.name || 'Bé cưng'})</span>
                          </span>
                        </div>
                        <div className="text-slate-600 font-mono text-xs">
                          <strong className="text-slate-900 font-bold">{pet.exp}</strong> / {pet.nextLevelExp || 400} EXP{' '}
                          <span className="text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                            {pet.expProgress || 92.5}%
                          </span>
                        </div>
                      </div>

                      {/* Smooth Gold Gradient Progress Bar */}
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden my-3 border border-slate-200/60">
                        <div
                          className="bg-gradient-to-r from-amber-400 to-amber-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(5, pet.expProgress || 0)}%` }}
                        />
                      </div>

                      {/* 3 Status Tiles */}
                      <div className="grid grid-cols-3 gap-3 pt-1">
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center">
                          <div className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">NO BỤNG</div>
                          <div className="text-base font-extrabold text-slate-800 mt-0.5">{pet.hunger}%</div>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center">
                          <div className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">TẬP TRUNG</div>
                          <div className="text-base font-extrabold text-slate-800 mt-0.5">{pet.happiness}%</div>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center">
                          <div className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">THỂ LỰC</div>
                          <div className="text-base font-extrabold text-slate-800 mt-0.5">100%</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Daily Focus Tip Banner */}
                  <div className="bg-[#1b365d] text-white rounded-2xl p-4 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-300 shrink-0 mt-0.5">
                        <Sparkles size={18} />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-white">Mẹo tập trung & năng suất hôm nay</h4>
                        <p className="text-xs text-blue-200/90 mt-0.5 leading-relaxed">
                          Sử dụng chu kỳ 25 phút Pomodoro cùng Bé Cưng giúp giải tỏa áp lực công việc và duy trì sự tỉnh táo suốt ngày dài.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('FOCUS')}
                      className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-xs whitespace-nowrap transition active:scale-95 shrink-0"
                    >
                      Bật Pomodoro
                    </button>
                  </div>
                </div>

                {/* Right Column: Interaction Controls (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Section 1: Chăm Sóc Hàng Ngày */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="text-amber-500">🍴</span> Chăm Sóc Hàng Ngày
                      </h3>
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        Còn {pet.dailyInteractionsLeft} lượt tăng EXP
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-3">
                      Cho ăn, bù nước và giúp thú cưng nghỉ ngơi để duy trì các chỉ số sức khỏe tối ưu.
                    </p>

                    <div className="grid grid-cols-3 gap-2.5">
                      {/* Cho Ăn */}
                      <button
                        type="button"
                        onClick={handleFeed}
                        className="bg-[#f8fafc] hover:bg-[#f1f5f9] border border-slate-200/70 rounded-xl p-3 flex flex-col items-center justify-center text-center transition cursor-pointer hover:shadow-xs active:scale-95"
                        title="Cho bé ăn (+50 EXP khi còn lượt)"
                      >
                        <div className="w-8 h-8 rounded-lg bg-amber-100/80 text-amber-700 flex items-center justify-center mb-1.5">
                          <Utensils size={16} />
                        </div>
                        <span className="text-xs font-bold text-slate-800">Cho Ăn</span>
                        <span className="text-[10px] text-slate-500 font-medium">+10 No bụng</span>
                      </button>

                      {/* Cho Uống */}
                      <button
                        type="button"
                        onClick={handleDrink}
                        className="bg-[#f8fafc] hover:bg-[#f1f5f9] border border-slate-200/70 rounded-xl p-3 flex flex-col items-center justify-center text-center transition cursor-pointer hover:shadow-xs active:scale-95"
                        title="Cho bé uống nước"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-100/80 text-blue-700 flex items-center justify-center mb-1.5">
                          <Coffee size={16} />
                        </div>
                        <span className="text-xs font-bold text-slate-800">Cho Uống</span>
                        <span className="text-[10px] text-slate-500 font-medium">+5 Thể lực</span>
                      </button>

                      {/* Vuốt Ve */}
                      <button
                        type="button"
                        onClick={handleStroke}
                        className="bg-[#f8fafc] hover:bg-[#f1f5f9] border border-slate-200/70 rounded-xl p-3 flex flex-col items-center justify-center text-center transition cursor-pointer hover:shadow-xs active:scale-95"
                        title="Vuốt ve bé (+30 EXP)"
                      >
                        <div className="w-8 h-8 rounded-lg bg-pink-100/80 text-pink-700 flex items-center justify-center mb-1.5">
                          <Heart size={16} />
                        </div>
                        <span className="text-xs font-bold text-slate-800">Vuốt Ve</span>
                        <span className="text-[10px] text-slate-500 font-medium">+15 Thân mật</span>
                      </button>

                      {/* Đi Ngủ */}
                      <button
                        type="button"
                        onClick={() => handleInteraction('SLEEPING', 'Bé cưng chợp mắt ngủ khò khò... Zzz 💤')}
                        className="bg-[#f8fafc] hover:bg-[#f1f5f9] border border-slate-200/70 rounded-xl p-3 flex flex-col items-center justify-center text-center transition cursor-pointer hover:shadow-xs active:scale-95"
                        title="Cho bé đi ngủ"
                      >
                        <div className="w-8 h-8 rounded-lg bg-indigo-100/80 text-indigo-700 flex items-center justify-center mb-1.5">
                          <Moon size={16} />
                        </div>
                        <span className="text-xs font-bold text-slate-800">Đi Ngủ</span>
                        <span className="text-[10px] text-slate-500 font-medium">Hồi thể lực</span>
                      </button>

                      {/* Thức Dậy */}
                      <button
                        type="button"
                        onClick={() => handleInteraction('WAKING_UP', 'Oáp... Bé cưng vươn vai thức dậy tràn đầy năng lượng! ☀️')}
                        className="bg-[#f8fafc] hover:bg-[#f1f5f9] border border-slate-200/70 rounded-xl p-3 flex flex-col items-center justify-center text-center transition cursor-pointer hover:shadow-xs active:scale-95"
                        title="Đánh thức bé dậy"
                      >
                        <div className="w-8 h-8 rounded-lg bg-amber-100/80 text-amber-700 flex items-center justify-center mb-1.5">
                          <Sun size={16} />
                        </div>
                        <span className="text-xs font-bold text-slate-800">Thức Dậy</span>
                        <span className="text-[10px] text-slate-500 font-medium">Sẵn sàng</span>
                      </button>

                      {/* Ngáp Ngủ */}
                      <button
                        type="button"
                        onClick={() => handleInteraction('YAWNING', 'Hơi mỏi mắt rồi nè, cùng duỗi người nghỉ ngơi xíu nào! 🥱')}
                        className="bg-[#f8fafc] hover:bg-[#f1f5f9] border border-slate-200/70 rounded-xl p-3 flex flex-col items-center justify-center text-center transition cursor-pointer hover:shadow-xs active:scale-95"
                        title="Bé ngáp ngủ mệt mỏi"
                      >
                        <div className="w-8 h-8 rounded-lg bg-slate-200/80 text-slate-700 flex items-center justify-center mb-1.5">
                          <Smile size={16} />
                        </div>
                        <span className="text-xs font-bold text-slate-800">Ngáp Ngủ</span>
                        <span className="text-[10px] text-slate-500 font-medium">Thả lỏng</span>
                      </button>
                    </div>
                  </div>

                  {/* Section 2: Đồng Hành & Vận Động */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="text-teal-600">⚔️</span> Đồng Hành & Vận Động
                      </h3>
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded uppercase tracking-wider">
                        WORK & PLAY
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-3">
                      Các hoạt động thể chất và tư thế vui vẻ giữa các phiên ngồi máy tính lâu.
                    </p>

                    <div className="grid grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => handleInteraction('EXERCISING', 'Cùng tập thể dục vươn vai thư giãn gân cốt nào! 🏃‍♂️')}
                        className="bg-[#f8fafc] hover:bg-[#f1f5f9] border border-slate-200/70 rounded-xl p-2.5 flex flex-col items-center justify-center text-center transition cursor-pointer hover:shadow-xs active:scale-95"
                        title="Tập thể dục vươn vai"
                      >
                        <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-1">
                          <Activity size={14} />
                        </div>
                        <span className="text-xs font-semibold text-slate-800">Thể Dục</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleInteraction('DANCING', 'Lên nhạc thôi! Nhảy một điệu vui vẻ giải tỏa căng thẳng! 🎵')}
                        className="bg-[#f8fafc] hover:bg-[#f1f5f9] border border-slate-200/70 rounded-xl p-2.5 flex flex-col items-center justify-center text-center transition cursor-pointer hover:shadow-xs active:scale-95"
                        title="Nhảy múa vui nhộn"
                      >
                        <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-1">
                          <Sparkles size={14} />
                        </div>
                        <span className="text-xs font-semibold text-slate-800">Nhảy Múa</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleInteraction('WALKING', 'Đi dạo loanh quanh thư giãn đầu óc một chút nhé! 🐾')}
                        className="bg-[#f8fafc] hover:bg-[#f1f5f9] border border-slate-200/70 rounded-xl p-2.5 flex flex-col items-center justify-center text-center transition cursor-pointer hover:shadow-xs active:scale-95"
                        title="Đi dạo loanh quanh"
                      >
                        <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center mb-1">
                          <Footprints size={14} />
                        </div>
                        <span className="text-xs font-semibold text-slate-800">Đi Dạo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleInteraction('TYPING', 'Gõ phím liên tục, cùng tập trung hoàn thành công việc nào! 💻')}
                        className="bg-[#f8fafc] hover:bg-[#f1f5f9] border border-slate-200/70 rounded-xl p-2.5 flex flex-col items-center justify-center text-center transition cursor-pointer hover:shadow-xs active:scale-95"
                        title="Tập trung gõ phím"
                      >
                        <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center mb-1">
                          <Monitor size={14} />
                        </div>
                        <span className="text-xs font-semibold text-slate-800">Gõ Phím</span>
                      </button>
                    </div>
                  </div>

                  {/* Section 3: Tương Tác Cảm Xúc */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="text-rose-500">✨</span> Tương Tác Cảm Xúc
                      </h3>
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded uppercase tracking-wider">
                        EMOTIONS
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-3">
                      Bày tỏ cảm xúc, lan tỏa tinh thần đồng nghiệp và mở khóa tiến hóa cấp bậc mới.
                    </p>

                    <div className="grid grid-cols-3 gap-2.5">
                      {/* Vẫy Chào */}
                      <button
                        type="button"
                        onClick={() => handleInteraction('WAVING', 'Bé cưng vẫy tay chào bạn nè! Chúc bạn làm việc thật tốt! 👋')}
                        className="bg-[#f8fafc] hover:bg-[#f1f5f9] border border-slate-200/70 rounded-xl p-3 flex flex-col items-center justify-center text-center transition cursor-pointer hover:shadow-xs active:scale-95"
                      >
                        <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-1.5">
                          <Smile size={16} />
                        </div>
                        <span className="text-xs font-semibold text-slate-800">Vẫy Chào</span>
                      </button>

                      {/* Cảm Ơn */}
                      <button
                        type="button"
                        onClick={() => handleInteraction('THANKING', 'Bé cưng cúi đầu cảm ơn bạn rất nhiều vì đã luôn yêu thương! 💖')}
                        className="bg-[#f8fafc] hover:bg-[#f1f5f9] border border-slate-200/70 rounded-xl p-3 flex flex-col items-center justify-center text-center transition cursor-pointer hover:shadow-xs active:scale-95"
                      >
                        <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center mb-1.5">
                          <ThumbsUp size={16} />
                        </div>
                        <span className="text-xs font-semibold text-slate-800">Cảm Ơn</span>
                      </button>

                      {/* Ăn Mừng */}
                      <button
                        type="button"
                        onClick={() => handleInteraction('CELEBRATING', 'Hoan hô! Bạn làm việc xuất sắc lắm, chúc mừng bạn! 🎉')}
                        className="bg-[#f8fafc] hover:bg-[#f1f5f9] border border-slate-200/70 rounded-xl p-3 flex flex-col items-center justify-center text-center transition cursor-pointer hover:shadow-xs active:scale-95"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center mb-1.5">
                          <Trophy size={16} />
                        </div>
                        <span className="text-xs font-semibold text-slate-800">Ăn Mừng</span>
                      </button>

                      {/* Vui Vẻ */}
                      <button
                        type="button"
                        onClick={() => handleInteraction('HAPPY', 'Bé cưng đang cực kỳ vui vẻ và tràn ngập niềm vui! ✨')}
                        className="bg-[#f8fafc] hover:bg-[#f1f5f9] border border-slate-200/70 rounded-xl p-3 flex flex-col items-center justify-center text-center transition cursor-pointer hover:shadow-xs active:scale-95"
                      >
                        <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-1.5">
                          <Smile size={16} />
                        </div>
                        <span className="text-xs font-semibold text-slate-800">Vui Vẻ</span>
                      </button>

                      {/* Làm Nũng */}
                      <button
                        type="button"
                        onClick={() => handleInteraction('SAD', 'Bé cưng đang làm nũng phụng phịu nè, xoa đầu bé nha! 🥺')}
                        className="bg-[#f8fafc] hover:bg-[#f1f5f9] border border-slate-200/70 rounded-xl p-3 flex flex-col items-center justify-center text-center transition cursor-pointer hover:shadow-xs active:scale-95"
                      >
                        <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center mb-1.5">
                          <Heart size={16} />
                        </div>
                        <span className="text-xs font-semibold text-slate-800">Làm Nũng</span>
                      </button>

                      {/* Tiến Hóa (Golden Highlight Button) */}
                      <button
                        type="button"
                        onClick={() => handleInteraction('EVOLVING', 'Hào quang bùng nổ! Sức mạnh tiến hóa cấp độ mới! ⚡✨')}
                        className="bg-amber-400 hover:bg-amber-500 border border-amber-500/80 rounded-xl p-3 flex flex-col items-center justify-center text-center transition cursor-pointer shadow-xs active:scale-95"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#1b365d] text-amber-300 flex items-center justify-center mb-1.5">
                          <Zap size={16} />
                        </div>
                        <span className="text-xs font-bold text-slate-950">Tiến Hóa</span>
                      </button>
                    </div>
                  </div>

                  {/* Desktop PiP Switch at bottom of Right Column */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1b365d] flex items-center justify-center border border-blue-100">
                        <Monitor size={16} />
                      </div>
                      <span className="text-xs font-bold text-slate-800">
                        Hiển thị nổi trên màn hình Windows
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsOverlayVisible(!isOverlayVisible)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        isOverlayVisible ? 'bg-[#1b365d]' : 'bg-slate-200'
                      }`}
                      role="switch"
                      aria-checked={isOverlayVisible}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          isOverlayVisible ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 bg-white border border-slate-200/80 rounded-2xl shadow-xs p-8">
                <div className="text-4xl mb-3">🥚</div>
                <h2 className="text-base font-bold text-slate-800 mb-2">Bạn Chưa Sở Hữu Bé Cưng Nào</h2>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
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
                      className="p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-50 shadow-xs transition hover:scale-105"
                    >
                      {pt.previewUrl && (
                        <img
                          src={pt.previewUrl}
                          alt={pt.name}
                          className="w-20 h-20 mx-auto object-contain mb-2"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      )}
                      <div className="text-xs font-bold text-slate-800 mb-1">{pt.name}</div>
                      <div className="text-[11px] text-slate-500 line-clamp-2">{pt.description}</div>
                      {pt.isPurchaseRequired && !ownedPetTypeIds.includes(pt.id) ? (
                        <div className="mt-2 text-[10px] font-bold text-amber-600">Mua ở cửa hàng để sử dụng</div>
                      ) : pt.unlockLevel > 1 && !pt.isPurchaseRequired ? (
                        <div className="mt-2 text-[10px] font-bold text-amber-600">Mở khóa ở cấp {pt.unlockLevel}</div>
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

        {/* TAB 3: POMODORO & WELLNESS */}
        {user?.role === 'USER' && activeTab === 'FOCUS' && pet && (
          <PomodoroTimer
            currentMode={pet.currentMode}
            onPetStateChange={handlePetStateChange}
            onModeChange={mode => {
              api.setPetMode(mode);
              setPet(prev => (prev ? { ...prev, currentMode: mode } : prev));
            }}
            onSessionFinish={exp => {
              handleRefreshPet();
              handlePetStateChange('CELEBRATING');
              setSpeechBubble('🎉 Hoan hô! Bạn đã hoàn thành một phiên tập trung xuất sắc! Tuyệt vời lắm! 🌟');
              setTimeout(() => setSpeechBubble(null), 5000);
              schedulePetIdleAnimation();
            }}
          />
        )}

        {/* TAB 4: CONVERSATIONAL AI COMPANION */}
        {user?.role === 'USER' && activeTab === 'AI_CHAT' && pet && (
          <AICompanionChat
            pet={pet}
            onPetStateChange={handlePetStateChange}
            onMusicRequest={(query, autoPlay) => {
              setMusicRequest({ query, autoPlay, requestId: Date.now() });
              setActiveTab('MUSIC');
            }}
            onStartBreathing={(duration) => {
              setBreathingDuration(duration);
              setIsBreathingModalOpen(true);
            }}
            onStartPomodoro={(_duration) => {
              setActiveTab('FOCUS');
            }}
          />
        )}

        {/* TAB 5: MUSIC PLAYER */}
        {user?.role === 'USER' && activeTab === 'MUSIC' && (
          <MusicPlayer
            request={musicRequest}
            historyScope={pet?.id || user?.id || 'default'}
            petName={pet?.name || 'Mochi Neko'}
            onTrackSelect={t => {
              setSpeechBubble(`Đang phát: ${t.title} 🎵`);
              setTimeout(() => setSpeechBubble(null), 3000);
            }}
          />
        )}

        {/* TAB 6: LEADERBOARD */}
        {user && !canManageSystem && activeTab === 'LEADERBOARD' && (
          <div className="max-w-5xl mx-auto space-y-5">
            {/* Top Navy Banner */}
            <div className="p-6 bg-gradient-to-br from-[#12223a] via-[#1b365d] to-[#152a4a] text-white rounded-3xl shadow-md border border-blue-900/40">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 font-extrabold text-[11px] uppercase tracking-wide border border-amber-400/30">
                    <Trophy size={13} className="text-amber-400" />
                    <span>BẢNG VINH DANH • Chu kỳ tuần hiện tại</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                    Bảng Xếp Hạng Đóng Góp Phòng Ban & Đồng Nghiệp
                  </h2>
                  <p className="text-xs text-blue-100/80 max-w-xl">
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
            <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
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
                        : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
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
              <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                  <h3 className="font-extrabold text-xs text-[#1b365d] uppercase tracking-wider flex items-center gap-2">
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
                    className="text-xs font-bold text-[#1b365d] hover:text-blue-700 inline-flex items-center gap-1 transition"
                  >
                    <span>Xem danh sách đầy đủ (Top 50 thành viên)</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {/* Right Column (4 cols) */}
              <div className="lg:col-span-4 space-y-4">
                {/* Pet of the Week Card */}
                <div className="bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50/60 border border-blue-200/80 rounded-3xl p-5 shadow-xs">
                  <div className="flex items-center gap-2 mb-3">
                    <Crown size={16} className="text-amber-500" />
                    <h4 className="text-xs font-extrabold text-[#1b365d] uppercase tracking-wider">
                      Thú Cưng Tiên Phong (Quán Quân Tuần)
                    </h4>
                  </div>

                  <div className="bg-white rounded-2xl border border-blue-100 p-4 text-center shadow-xs mb-3">
                    <div className="relative w-20 h-20 mx-auto mb-2 bg-gradient-to-b from-amber-100/60 to-blue-50 rounded-2xl flex items-center justify-center overflow-hidden border border-amber-200">
                      <span className="text-3xl">🐱</span>
                      <span className="absolute top-1 right-1 text-xs">👑</span>
                    </div>
                    <div className="font-extrabold text-xs text-slate-900">
                      {pet?.name || 'Mochi Neko'} (Chủ nhân: {user?.fullName || 'Phi Hùng'})
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
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
                  <h4 className="text-xs font-extrabold text-[#1b365d] uppercase tracking-wider mb-3">
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
                      className="text-[11px] font-bold text-[#1b365d] hover:underline"
                    >
                      Xem hướng dẫn chi tiết &rarr;
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Current Rank Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#1b365d] via-[#1f4273] to-[#1b365d] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-extrabold text-sm shadow-xs shrink-0">
                  #1
                </div>
                <div>
                  <div className="font-extrabold text-xs sm:text-sm">
                    Thứ hạng hiện tại của bạn: #1 Phòng Kỹ Thuật
                  </div>
                  <div className="text-[11px] text-blue-100/80 mt-0.5">
                    Duy trì thêm 2 phiên để giữ vững danh hiệu Quán quân tuần!
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  alert('Đã sao chép liên kết chia sẻ thành tích của bạn!');
                }}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold text-xs shadow-xs transition active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
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

      {/* Floating Desktop Pet Overlay (when not in full overlay mode) */}
      {user?.role === 'USER' && pet && isOverlayVisible && !window.officePet && (
        <DesktopOverlay
          pet={pet}
          onFeed={handleFeed}
          onStroke={handleStroke}
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
            setSpeechBubble(`Đang phát: ${track.title} 🎵`);
            setTimeout(() => setSpeechBubble(null), 3000);
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
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-5 shadow-2xl text-slate-800 max-h-[90vh] overflow-y-auto">
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
                <div className="flex items-center gap-2 font-bold text-[#1b365d] mb-1.5 text-xs">
                  ⌨️ TỔ HỢP PHÍM TẮT TOÀN CỤC
                </div>
                <div className="flex flex-wrap items-center gap-2 text-slate-700">
                  <kbd className="px-2.5 py-1 bg-[#1b365d] text-white rounded-lg text-xs font-mono font-bold shadow-xs">
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
              className="w-full mt-4 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition active:scale-95"
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

      {/* Modern OfficePet Footer */}
      <footer className="mt-auto border-t border-slate-200/80 bg-white/80 backdrop-blur-xs py-4 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-[#1b365d]">OfficePet 2D Pixel</span>
            <span className="text-slate-300">•</span>
            <span>Hệ Thống Thú Cưng Công Sở & Đồng Hành Năng Suất</span>
          </div>
          <div className="text-center text-slate-400 text-[11px]">
            © 2024–2026 OfficePet Team. Nền tảng chăm sóc thú ảo văn phòng.
          </div>
          <div className="flex items-center gap-4 text-[11.5px] font-medium text-slate-600">
            <a href="#rules" onClick={(e) => { e.preventDefault(); setIsGuideModalOpen(true); }} className="hover:text-blue-700 transition">Hướng dẫn sử dụng</a>
            <span className="text-slate-300">|</span>
            <a href="#community" onClick={(e) => { e.preventDefault(); setActiveTab('GARDEN'); }} className="hover:text-blue-700 transition">Khu vườn chung</a>
            <span className="text-slate-300">|</span>
            <a href="#support" onClick={(e) => { e.preventDefault(); setIsGuideModalOpen(true); }} className="hover:text-blue-700 transition">Hỗ trợ kỹ thuật</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
