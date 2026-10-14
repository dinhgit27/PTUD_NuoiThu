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

import {
  Heart, Utensils, MessageSquare, Timer, TreePine, Music, ShoppingBag,
  ShieldAlert, LogIn, LogOut, Sparkles, Trophy, Minimize2, Users,
  Maximize2, Activity, Coffee, Sun, Monitor, HelpCircle, X
} from 'lucide-react';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [pet, setPet] = useState<UserPet | null>(null);
  const [petTypes, setPetTypes] = useState<PetType[]>([]);
  const [ownedPetTypeIds, setOwnedPetTypeIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<
    'PET' | 'SHOP' | 'GARDEN' | 'FOCUS' | 'AI_CHAT' | 'MUSIC' | 'LEADERBOARD' | 'DEPARTMENT' | 'ADMIN'
  >('PET');

  const [isOverlayVisible, setIsOverlayVisible] = useState(true);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [isPetSelectorOpen, setIsPetSelectorOpen] = useState(false);
  const [speechBubble, setSpeechBubble] = useState<string | null>(null);
  const [musicRequest, setMusicRequest] = useState<MusicRequest>();
  const idleAnimationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auth modal
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<any | null>(null);

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

    try {
      const typesRes = await api.getPetTypes();
      setPetTypes(typesRes.data);
      if (isUserAccount) {
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

  const handleFeed = async () => {
    try {
      const res = await api.feedPet();
      setPet(res.data.pet);
      schedulePetIdleAnimation();
      const messages = [
        'Ngon quá đi! Cảm ơn chủ nhân nhiều nha! (+50 EXP) 🍱',
        'Măm măm, đúng món mình thích luôn! 🥰',
        'Được bạn chăm sóc, mình thấy ấm lòng quá! 💖',
        'No bụng rồi, mình sẽ cổ vũ bạn làm việc thật tốt! ✨'
      ];
      setSpeechBubble(messages[Math.floor(Math.random() * messages.length)]);
      setTimeout(() => setSpeechBubble(null), 4000);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Lỗi cho ăn');
    }
  };

  const handleStroke = async () => {
    try {
      const res = await api.strokePet();
      setPet(res.data.pet);
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
    <div className="min-h-screen bg-cream-100 flex flex-col font-sans select-none">
      {/* Top Retro Pixel Header */}
      <header className="bg-sage-400 border-b-4 border-charcoal px-4 py-3 shadow-pixel sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="text-2xl p-1 bg-white border-2 border-charcoal rounded-lg shadow-pixel-sm">
              🐾
            </div>
            <div>
              <h1 className="font-pixel text-sm text-white drop-shadow flex items-center gap-2">
                OfficePet <span className="text-[10px] bg-terracotta-400 px-1.5 py-0.5 rounded text-white">2D Pixel</span>
              </h1>
              <p className="text-[11px] text-sage-100 font-sans">
                {canManageSystem
                  ? 'Bảng điều khiển quản trị hệ thống'
                  : user?.department?.name || 'Chưa tham gia phòng ban'}
              </p>
            </div>
          </div>

          {/* User & Pet Quick Status */}
          {user?.role === 'USER' && pet && (
            <div className="flex items-center gap-3 bg-white/90 border-2 border-charcoal px-3 py-1.5 rounded-xl shadow-pixel-sm text-xs">
              <div className="font-pixel text-[10px] text-terracotta-500">
                {pet.name} (Lv.{pet.level})
              </div>
              <div className="flex items-center gap-1 text-[11px] text-gray-600 font-bold">
                <span title="Đói">🍱 {pet.hunger}%</span>
                <span className="text-gray-300">|</span>
                <span title="Hạnh phúc">❤️ {pet.happiness}%</span>
                <span className="text-gray-300">|</span>
                <span title="Lượt tương tác hôm nay" className="text-sage-600">⚡ {pet.dailyInteractionsLeft}/3</span>
              </div>
            </div>
          )}

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
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 bg-charcoal text-cream-100 rounded-lg text-[10px] font-pixel border-2 border-sage-300 shadow-pixel-sm hover:bg-black transition-transform active:scale-95"
                title="Cho phép thú cưng nổi đè lên màn hình khi sang trang web khác hoặc mở ứng dụng khác"
              >
                <Monitor size={13} className="text-yellow-400" />
                <span>Nổi Desktop</span>
              </button>
            )}

            {user?.role !== 'ADMIN' && (
              <button
                onClick={() => setIsGuideModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cream-100 text-charcoal rounded-lg text-[10px] font-pixel border-2 border-charcoal shadow-pixel-sm hover:bg-white transition-transform active:scale-95"
                title="Hướng dẫn phím tắt & các thao tác điều khiển"
              >
                <HelpCircle size={13} className="text-terracotta-500" />
                <span className="hidden sm:inline">Phím tắt & Hướng dẫn</span>
                <span className="sm:hidden">Hướng dẫn</span>
              </button>
            )}

            {/* User Account / Login */}
            <div className="flex items-center gap-2">
              {user ? (
                <div className="flex items-center gap-2">
                  <div className="text-right hidden sm:block">
                    <div className="text-xs font-bold text-white">{user.fullName}</div>
                    <div className="text-[10px] text-sage-100">{roleLabel[user.role] || user.role}</div>
                  </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg border-2 border-charcoal shadow-pixel-sm"
                  title="Đăng xuất"
                  aria-label="Đăng xuất"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="px-3 py-1.5 bg-terracotta-400 hover:bg-terracotta-500 text-white font-pixel text-xs rounded-lg border-2 border-charcoal shadow-pixel-sm flex items-center gap-1.5"
              >
                <LogIn size={14} /> Đăng nhập
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        {user && (
        <nav aria-label="Điều hướng chính" className="max-w-6xl mx-auto mt-3 flex gap-1.5 overflow-x-auto no-scrollbar font-pixel text-[11px]">
          {user.role === 'USER' && <button
            onClick={() => setActiveTab('PET')}
            className={`px-3 py-1.5 rounded-t-lg border-t-2 border-x-2 border-charcoal transition-colors flex items-center gap-1.5 ${
              activeTab === 'PET' ? 'bg-cream-100 text-charcoal font-bold -mb-3 pb-3' : 'bg-sage-500 text-white hover:bg-sage-600'
            }`}
          >
            🐾 Bé Cưng
          </button>}
          {user.role === 'USER' && <button
            onClick={() => setActiveTab('SHOP')}
            className={`px-3 py-1.5 rounded-t-lg border-t-2 border-x-2 border-charcoal transition-colors flex items-center gap-1.5 ${
              activeTab === 'SHOP' ? 'bg-cream-100 text-charcoal font-bold -mb-3 pb-3' : 'bg-sage-500 text-white hover:bg-sage-600'
            }`}
          >
            <ShoppingBag size={13} /> Cửa hàng
          </button>}
          {user.role === 'USER' && user.department && <button
            onClick={() => setActiveTab('GARDEN')}
            className={`px-3 py-1.5 rounded-t-lg border-t-2 border-x-2 border-charcoal transition-colors flex items-center gap-1.5 ${
              activeTab === 'GARDEN' ? 'bg-cream-100 text-charcoal font-bold -mb-3 pb-3' : 'bg-sage-500 text-white hover:bg-sage-600'
            }`}
          >
            <TreePine size={13} /> Khu Vườn Chung
          </button>}
          {user.role === 'USER' && <button
            onClick={() => setActiveTab('FOCUS')}
            className={`px-3 py-1.5 rounded-t-lg border-t-2 border-x-2 border-charcoal transition-colors flex items-center gap-1.5 ${
              activeTab === 'FOCUS' ? 'bg-cream-100 text-charcoal font-bold -mb-3 pb-3' : 'bg-sage-500 text-white hover:bg-sage-600'
            }`}
          >
            <Timer size={13} /> Pomodoro
          </button>}
          {user.role === 'USER' && <button
            onClick={() => setActiveTab(pet ? 'AI_CHAT' : 'PET')}
            className={`px-3 py-1.5 rounded-t-lg border-t-2 border-x-2 border-charcoal transition-colors flex items-center gap-1.5 ${
              activeTab === 'AI_CHAT' ? 'bg-cream-100 text-charcoal font-bold -mb-3 pb-3' : 'bg-sage-500 text-white hover:bg-sage-600'
            }`}
          >
            <MessageSquare size={13} /> Trợ Lý AI
          </button>}
          {user.role === 'USER' && <button
            onClick={() => setActiveTab('MUSIC')}
            className={`px-3 py-1.5 rounded-t-lg border-t-2 border-x-2 border-charcoal transition-colors flex items-center gap-1.5 ${
              activeTab === 'MUSIC' ? 'bg-cream-100 text-charcoal font-bold -mb-3 pb-3' : 'bg-sage-500 text-white hover:bg-sage-600'
            }`}
          >
            <Music size={13} /> Nhạc Lofi
          </button>}
          {user.role === 'USER' && user.department && <button
            onClick={() => setActiveTab('LEADERBOARD')}
            className={`px-3 py-1.5 rounded-t-lg border-t-2 border-x-2 border-charcoal transition-colors flex items-center gap-1.5 ${
              activeTab === 'LEADERBOARD' ? 'bg-cream-100 text-charcoal font-bold -mb-3 pb-3' : 'bg-sage-500 text-white hover:bg-sage-600'
            }`}
          >
            <Trophy size={13} /> Xếp Hạng
          </button>}
          {user.role === 'USER' && <button
            onClick={() => setActiveTab('DEPARTMENT')}
            className={`px-3 py-1.5 rounded-t-lg border-t-2 border-x-2 border-charcoal transition-colors flex items-center gap-1.5 ${
              activeTab === 'DEPARTMENT' ? 'bg-cream-100 text-charcoal font-bold -mb-3 pb-3' : 'bg-sage-500 text-white hover:bg-sage-600'
            }`}
          >
            <Users size={13} /> {user.department ? 'Phòng chung' : 'Tạo phòng chung'}
          </button>}
          {canManageSystem && (
          <button
            onClick={() => setActiveTab('ADMIN')}
            className={`px-3 py-1.5 rounded-t-lg border-t-2 border-x-2 border-charcoal transition-colors flex items-center gap-1.5 ${
              activeTab === 'ADMIN' ? 'bg-cream-100 text-charcoal font-bold -mb-3 pb-3' : 'bg-sage-500 text-white hover:bg-sage-600'
            }`}
          >
            <ShieldAlert size={13} /> Quản Trị Hệ Thống
          </button>
          )}
        </nav>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6">
        {/* TAB 1: PET MAIN VIEW */}
        {user?.role === 'USER' && activeTab === 'PET' && (
          <div className="space-y-6">
            {pet ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Pet Stage Card */}
                <div className="md:col-span-2 bg-white border-2 border-charcoal rounded-2xl shadow-pixel p-6 flex flex-col items-center justify-between relative min-h-[420px]">
                  {/* Mode Badge & EXP Bar */}
                  <div className="w-full flex flex-wrap items-center justify-between gap-2 mb-4">
                    <span
                      className={`font-pixel text-[10px] px-3 py-1 rounded-full text-white border border-charcoal ${
                        pet.currentMode === 'STRICT' ? 'bg-terracotta-400' : 'bg-sage-400'
                      }`}
                    >
                      {pet.currentMode === 'STRICT' ? '🔴 Chế độ Nghiêm túc' : '🟢 Chế độ Thư giãn'}
                    </span>

                    {/* Scale Size Selector (100px - 150px) */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1 text-[10px] font-pixel bg-cream-100 p-1 border border-charcoal rounded-lg">
                        <span className="text-gray-500 mr-1">Size:</span>
                        {(['SMALL', 'MEDIUM', 'LARGE'] as const).map(s => (
                          <button
                            key={s}
                            onClick={() => handleSetScale(s)}
                            className={`px-1.5 py-0.5 rounded ${
                              currentScale === s ? 'bg-sage-400 text-white' : 'text-charcoal hover:bg-gray-200'
                            }`}
                          >
                            {s === 'SMALL' ? '100px' : s === 'MEDIUM' ? '125px' : '150px'}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsPetSelectorOpen(true)}
                        className="rounded-lg border border-charcoal bg-white px-2.5 py-1.5 font-pixel text-[10px] text-charcoal hover:bg-cream-100"
                      >
                        Đổi thú cưng
                      </button>
                    </div>
                  </div>

                  {/* Pixel Pet Canvas Stage */}
                  <div className="my-auto py-8">
                    <PixelPetCanvas
                      petType={pet.petType}
                      currentState={pet.currentState}
                      scaleSize={currentScale}
                      speechBubble={speechBubble}
                      onPetClick={handleStroke}
                      petName={pet.name}
                      petLevel={pet.level}
                      hunger={pet.hunger}
                      happiness={pet.happiness}
                      equippedItems={pet.userItems}
                      showTooltip={true}
                    />
                  </div>

                  {/* Level & EXP Progress */}
                  <div className="w-full max-w-md bg-cream-100 border-2 border-charcoal rounded-xl p-3 shadow-inner">
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="font-pixel text-terracotta-500 text-[11px]">
                        Cấp {pet.level} ({pet.petType?.name || 'Thú Cưng'})
                      </span>
                      <span className="text-gray-600 font-mono text-[11px]">
                        {pet.exp} / {pet.nextLevelExp || 400} EXP ({pet.expProgress || 0}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 h-3 border border-charcoal rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-sage-400 to-terracotta-400 h-full transition-all duration-300"
                        style={{ width: `${pet.expProgress || 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Pet interaction controls */}
                <div className="space-y-4">
                  {/* Action Buttons Card */}
                  <div className="bg-white border-2 border-charcoal rounded-xl shadow-pixel p-4 space-y-3">
                    <h3 className="font-pixel text-xs text-charcoal">Chăm Sóc Hàng Ngày (US-U06)</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleFeed}
                        disabled={pet.dailyInteractionsLeft <= 0}
                        className="p-3 bg-terracotta-400 hover:bg-terracotta-500 disabled:opacity-50 text-white rounded-xl border-2 border-charcoal shadow-pixel-sm font-pixel text-[11px] flex flex-col items-center gap-1 transition-transform active:scale-95"
                      >
                        <Utensils size={18} />
                        <span>Cho Ăn (+50 EXP)</span>
                      </button>
                      <button
                        onClick={handleStroke}
                        disabled={pet.dailyInteractionsLeft <= 0}
                        className="p-3 bg-pink-400 hover:bg-pink-500 disabled:opacity-50 text-white rounded-xl border-2 border-charcoal shadow-pixel-sm font-pixel text-[11px] flex flex-col items-center gap-1 transition-transform active:scale-95"
                      >
                        <Heart size={18} />
                        <span>Vuốt Ve (+30 EXP)</span>
                      </button>
                    </div>
                    <div className="text-[11px] text-gray-500 font-sans text-center">
                      Còn {pet.dailyInteractionsLeft} lượt tương tác tăng EXP hôm nay
                    </div>
                  </div>

                </div>
              </div>
            ) : (
              <div className="text-center py-16 bg-white border-2 border-charcoal rounded-2xl shadow-pixel p-8">
                <div className="text-4xl mb-3">🥚</div>
                <h2 className="font-pixel text-sm text-charcoal mb-2">Bạn Chưa Sở Hữu Bé Cưng Nào</h2>
                <p className="text-xs text-gray-500 max-w-md mx-auto mb-6">
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
                      className="p-4 bg-cream-100 border-2 border-charcoal rounded-xl hover:border-terracotta-400 disabled:cursor-not-allowed disabled:opacity-50 shadow-pixel-sm transition-transform hover:scale-105"
                    >
                      {pt.previewUrl && (
                        <img
                          src={pt.previewUrl}
                          alt={pt.name}
                          className="w-20 h-20 mx-auto object-contain mb-2"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      )}
                      <div className="font-pixel text-xs text-charcoal mb-1">{pt.name}</div>
                      <div className="text-[11px] text-gray-500 line-clamp-2">{pt.description}</div>
                      {pt.isPurchaseRequired && !ownedPetTypeIds.includes(pt.id) ? (
                        <div className="mt-2 text-[10px] font-bold text-terracotta-600">Mua ở cửa hàng để sử dụng</div>
                      ) : pt.unlockLevel > 1 && !pt.isPurchaseRequired ? (
                        <div className="mt-2 text-[10px] font-bold text-terracotta-600">Mở khóa ở cấp {pt.unlockLevel}</div>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SHARED VIRTUAL GARDEN */}
        {user && !canManageSystem && user.department && activeTab === 'GARDEN' && (
          <SharedGarden
            currentUserPet={pet || undefined}
            onRefreshPet={handleRefreshPet}
            canChangeBackground={true}
          />
        )}

        {user?.role === 'USER' && activeTab === 'SHOP' && (
          <PetShop
            hasPet={Boolean(pet)}
            onPetRefresh={() => {
              void handleRefreshPet();
              schedulePetIdleAnimation();
            }}
            onOwnedPetTypesChange={setOwnedPetTypeIds}
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
          />
        )}

        {/* TAB 5: MUSIC PLAYER */}
        {user?.role === 'USER' && activeTab === 'MUSIC' && (
          <MusicPlayer
            request={musicRequest}
            historyScope={pet?.id || user?.id || 'default'}
            onTrackSelect={t => {
              setSpeechBubble(`Đang phát: ${t.title} 🎵`);
              setTimeout(() => setSpeechBubble(null), 3000);
            }}
          />
        )}

        {/* TAB 6: LEADERBOARD */}
        {user && !canManageSystem && user.department && activeTab === 'LEADERBOARD' && (
          <div className="bg-white border-2 border-charcoal rounded-xl shadow-pixel p-6 max-w-2xl mx-auto">
            <h3 className="font-pixel text-sm text-charcoal mb-4 flex items-center gap-2">
              <Trophy size={20} className="text-yellow-500" /> Bảng Xếp Hạng Đóng Góp Phòng Ban (US-U08)
            </h3>
            <div className="space-y-2">
              {leaderboard?.top10?.map((item: any, idx: number) => (
                <div
                  key={item.userId}
                  className={`p-3 rounded-lg border-2 flex items-center justify-between text-xs ${
                    item.isCurrentUser
                      ? 'bg-sage-50 border-sage-500 font-bold'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-pixel text-sm w-6">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </span>
                    <div>
                      <div className="text-charcoal font-bold">{item.fullName}</div>
                      <div className="text-[10px] text-gray-500">{item.petName} ({item.petType})</div>
                    </div>
                  </div>
                  <div className="font-pixel text-terracotta-500 text-xs">
                    {item.totalExp} EXP
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {user?.role === 'USER' && activeTab === 'DEPARTMENT' && (
          <DepartmentWorkspace user={user} onMembershipChange={handleRefreshUser} />
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
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

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
        <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-cream-100 border-4 border-charcoal rounded-2xl max-w-lg w-full p-5 shadow-pixel text-charcoal max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-3 border-b-2 border-charcoal/20">
              <div className="flex items-center gap-2">
                <span className="text-xl">🐾</span>
                <h3 className="font-pixel text-xs sm:text-sm text-terracotta-500 font-bold">HƯỚNG DẪN THAO TÁC & PHÍM TẮT</h3>
              </div>
              <button
                onClick={() => setIsGuideModalOpen(false)}
                className="p-1 hover:bg-charcoal/10 rounded-lg text-charcoal transition-colors"
                title="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              {/* Shortcut Section */}
              <div className="p-3 bg-white border-2 border-charcoal rounded-xl shadow-pixel-sm">
                <div className="flex items-center gap-2 font-bold text-sage-600 mb-1.5 font-pixel text-[11px]">
                  ⌨️ TỔ HỢP PHÍM TẮT TOÀN CỤC
                </div>
                <div className="flex flex-wrap items-center gap-2 text-charcoal">
                  <kbd className="px-2.5 py-1 bg-sage-500 text-white rounded-lg font-pixel text-[10px] border border-charcoal shadow-xs">
                    Ctrl + Shift + P
                  </kbd>
                  <span>(hoặc <strong>Cmd + Shift + P</strong> trên macOS)</span>
                </div>
                <p className="mt-1.5 text-gray-600 text-[11px]">
                  👉 <strong>Ẩn hoặc Hiện tức thì thú cưng</strong> trên màn hình desktop bất kỳ lúc nào, kể cả khi bạn đang mở game, xem YouTube, lướt web hay soạn thảo tài liệu.
                </p>
              </div>

              {/* Drag and Drop Section */}
              <div className="p-3 bg-white border-2 border-charcoal rounded-xl shadow-pixel-sm">
                <div className="flex items-center gap-2 font-bold text-terracotta-500 mb-1 font-pixel text-[11px]">
                  🖱️ KÉO THẢ & DI CHUYỂN VỊ TRÍ
                </div>
                <p className="text-gray-600 text-[11.5px]">
                  • Giữ chuột vào <strong>thanh kéo tiêu đề trên đầu thú cưng</strong> (có biểu tượng ✥) để kéo và thả thú cưng đến bất kỳ vị trí nào trên màn hình desktop (góc trên, góc dưới, hoặc màn hình phụ).
                </p>
              </div>

              {/* Quick Actions Section */}
              <div className="p-3 bg-white border-2 border-charcoal rounded-xl shadow-pixel-sm">
                <div className="flex items-center gap-2 font-bold text-pink-500 mb-1 font-pixel text-[11px]">
                  ✨ CÁC NÚT THAO TÁC & CHĂM SÓC
                </div>
                <ul className="space-y-1.5 text-[11.5px] text-gray-700">
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
                  <li>
                    • 🖥️ <strong>Bảng điều khiển (Monitor):</strong> Mở lại cửa sổ ứng dụng chính của OfficePet.
                  </li>
                  <li>
                    • ➖ <strong>Ẩn thú cưng (Minimize):</strong> Thu gọn thú cưng xuống khay hệ thống.
                  </li>
                </ul>
              </div>

              {/* System Tray Section */}
              <div className="p-3 bg-white border-2 border-charcoal rounded-xl shadow-pixel-sm">
                <div className="flex items-center gap-2 font-bold text-indigo-600 mb-1 font-pixel text-[11px]">
                  📌 KHAY HỆ THỐNG (SYSTEM TRAY Ở TASKBAR)
                </div>
                <p className="text-gray-600 text-[11px]">
                  Biểu tượng OfficePet nằm ở góc dưới bên phải thanh Taskbar của Windows (gần đồng hồ):
                  <br />
                  - <strong>Nhấp đúp chuột:</strong> Mở nhanh Bảng điều khiển chính.
                  <br />
                  - <strong>Nhấp chuột phải:</strong> Chọn Ẩn / Hiện thú cưng hoặc Thoát hoàn toàn ứng dụng.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsGuideModalOpen(false)}
              className="w-full mt-4 py-2.5 bg-sage-500 hover:bg-sage-600 text-white font-pixel text-xs rounded-xl border-2 border-charcoal shadow-pixel transition-transform active:scale-95"
            >
              ĐÃ HIỂU ✓
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
