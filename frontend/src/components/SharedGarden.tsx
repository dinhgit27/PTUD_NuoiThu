import React, { useState, useEffect, useRef } from 'react';
import { PixelPetCanvas } from './PixelPetCanvas';
import { PixelArtBackground, getBackgroundFrameStyle } from './PixelArtBackground';
import { BackgroundThumb } from './BackgroundThumb';
import { SharedGardenData, GardenBackground, UserPet, User } from '../types';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import {
  TreePine,
  Gift,
  Image as ImageIcon,
  Sparkles,
  Users,
  RefreshCw,
  Copy,
  Check,
  Send,
  MessageSquare,
  LogOut,
  UserPlus,
  Camera,
  Music,
  Maximize2,
  Droplets,
  Heart,
  Clock,
  MessageCircle,
  ShieldCheck
} from 'lucide-react';

interface DepartmentMember {
  id: string;
  email: string;
  fullName: string;
  role: string;
  userPet?: {
    name: string;
    level: number;
    currentState: string;
    petType?: { name: string; previewUrl: string };
  };
}

interface RoomMessage {
  id: string;
  deptId?: string;
  senderId?: string;
  senderName?: string;
  petName?: string;
  content: string;
  createdAt: string;
}

interface SharedGardenProps {
  currentUserPet?: UserPet;
  onRefreshPet?: () => void;
  canChangeBackground?: boolean;
  currentUser?: User | null;
  onMembershipChange?: () => Promise<void>;
  onOpenFriends?: () => void;
}

export const SharedGarden: React.FC<SharedGardenProps> = ({
  currentUserPet,
  onRefreshPet,
  canChangeBackground = true,
  currentUser,
  onMembershipChange,
  onOpenFriends
}) => {
  const [gardenData, setGardenData] = useState<SharedGardenData | null>(null);
  const [backgrounds, setBackgrounds] = useState<GardenBackground[]>([]);
  const [members, setMembers] = useState<DepartmentMember[]>([]);
  const [roomMessages, setRoomMessages] = useState<RoomMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPetToGift, setSelectedPetToGift] = useState<any | null>(null);
  const [giftMessage, setGiftMessage] = useState('Cố lên nhé đồng nghiệp ơi!');
  const [showBgSelector, setShowBgSelector] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // States for No-Department view
  const [newDeptName, setNewDeptName] = useState('');
  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [deptActionError, setDeptActionError] = useState('');
  const [deptActionBusy, setDeptActionBusy] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  const fetchGarden = async () => {
    try {
      setIsLoading(true);
      const res = await api.getGarden();
      setGardenData(res.data);
    } catch (err) {
      console.error('Failed to load garden:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBackgrounds = async () => {
    try {
      const res = await api.getGardenBackgrounds();
      setBackgrounds(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await api.getDepartmentMembers();
      setMembers(res.data.members || []);
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await api.getDepartmentMessages();
      setRoomMessages(res.data || []);
    } catch (err) {
      console.error('Failed to load room messages:', err);
    }
  };

  useEffect(() => {
    if (!currentUser?.department) {
      setIsLoading(false);
      return;
    }

    fetchGarden();
    fetchBackgrounds();
    fetchMembers();
    fetchMessages();

    const socket = getSocket();

    if (currentUser.department.id) {
      socket.emit('join_garden', currentUser.department.id);
    }

    const handlePetUpdated = (data: any) => {
      setGardenData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          pets: prev.pets.map(p => (p.id === data.petId ? { ...p, currentState: data.state } : p))
        };
      });
    };

    const handleRoomMessage = (msg: RoomMessage) => {
      setRoomMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };

    const handleGardenLevelUp = () => {
      fetchGarden();
    };

    socket.on('pet_updated', handlePetUpdated);
    socket.on('room_chat_message', handleRoomMessage);
    socket.on('garden_leveled_up', handleGardenLevelUp);

    return () => {
      socket.off('pet_updated', handlePetUpdated);
      socket.off('room_chat_message', handleRoomMessage);
      socket.off('garden_leveled_up', handleGardenLevelUp);
    };
  }, [currentUser?.department?.id]);

  useEffect(() => {
    chatContainerRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roomMessages]);

  const copyInviteCode = async () => {
    const code = currentUser?.department?.inviteCode;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      alert(`Mã mời phòng ban là: ${code}`);
    }
  };

  const handleSendRoomMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isSendingMessage) return;
    const content = chatInput.trim();
    setChatInput('');
    setIsSendingMessage(true);

    try {
      const res = await api.sendDepartmentMessage(content);
      setRoomMessages(prev => (prev.some(m => m.id === res.data.id) ? prev : [...prev, res.data]));
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Không thể gửi tin nhắn.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleChangeBackground = async (bgId: string) => {
    try {
      await api.setGardenBackground(bgId);
      setShowBgSelector(false);
      fetchGarden();
    } catch (err) {
      alert('Lỗi thay đổi bối cảnh');
    }
  };

  const handleSendGift = async () => {
    if (!selectedPetToGift) return;
    try {
      await api.sendGift({
        receiverId: selectedPetToGift.ownerId,
        itemId: 'item_fish_01',
        message: giftMessage
      });
      alert(`Đã gửi quà tặng bé cưng của ${selectedPetToGift.ownerName}! (+20 EXP cho Khu Vườn)`);
      setSelectedPetToGift(null);
      fetchGarden();
      if (onRefreshPet) onRefreshPet();
    } catch (err) {
      alert('Lỗi gửi quà');
    }
  };

  const handleWaterGarden = () => {
    alert('💧 Bạn đã tưới nước cho cây vườn! Toàn bộ hoa màu nở rộ và nhận thêm +15 EXP Khu Vườn.');
  };

  const handleSendHearts = () => {
    alert('💖 Bạn đã thả tim lan tỏa năng lượng tích cực cho tất cả thú cưng trong phòng!');
  };

  const handleLeaveDepartment = async () => {
    if (!confirm('Bạn có chắc chắn muốn rời phòng chung này không? Thú cưng và cấp độ của bạn vẫn sẽ được giữ nguyên.')) return;
    try {
      await api.leaveDepartment();
      if (onMembershipChange) await onMembershipChange();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Không thể rời phòng');
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim() || deptActionBusy) return;
    setDeptActionBusy(true);
    setDeptActionError('');
    try {
      await api.createDepartment(newDeptName.trim());
      if (onMembershipChange) await onMembershipChange();
    } catch (err: any) {
      setDeptActionError(err?.response?.data?.error || 'Không thể tạo phòng mới');
    } finally {
      setDeptActionBusy(false);
    }
  };

  const handleJoinDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinInviteCode.trim() || deptActionBusy) return;
    setDeptActionBusy(true);
    setDeptActionError('');
    try {
      await api.joinDepartment(joinInviteCode.trim().toUpperCase());
      if (onMembershipChange) await onMembershipChange();
    } catch (err: any) {
      setDeptActionError(err?.response?.data?.error || 'Không thể tham gia phòng này');
    } finally {
      setDeptActionBusy(false);
    }
  };

  // IF USER DOES NOT HAVE A DEPARTMENT: Show Creation / Join UI
  if (!currentUser?.department) {
    return (
      <section className="max-w-2xl mx-auto bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] p-6 font-sans text-slate-800">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-[#231e36]">
            <Users size={24} />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Phòng Chung & Khu Vườn</h2>
            <p className="text-xs text-slate-500 mt-1">
              Tham gia phòng chung để đưa thú cưng của bạn vào khu vườn sinh thái cùng các đồng nghiệp!
            </p>
          </div>
        </div>

        {deptActionError && (
          <p role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold">
            {deptActionError}
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Create room form */}
          <form onSubmit={handleCreateDepartment} className="rounded-2xl border-2 border-slate-900 bg-[#f7f2e7] shadow-[2px_2px_0px_#0f172a] p-5 flex flex-col justify-between shadow-xs">
            <div>
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <span>🏢</span> Tạo phòng chung mới
              </h3>
              <p className="mt-1 text-[11px] text-slate-500">Khởi tạo không gian phòng ban mới và nhận mã mời riêng.</p>
              <label htmlFor="dept-name-input" className="mt-3 block text-[11px] font-bold text-slate-700">
                Tên phòng ban <span className="text-red-500">*</span>
              </label>
              <input
                id="dept-name-input"
                type="text"
                value={newDeptName}
                onChange={e => setNewDeptName(e.target.value)}
                maxLength={80}
                placeholder="VD: Phòng Kỹ Thuật Công Nghệ"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={deptActionBusy || !newDeptName.trim()}
              className="mt-4 w-full py-2.5 bg-[#231e36] hover:bg-[#332b4f] disabled:opacity-50 text-white font-black text-xs rounded-xl border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none transition active:scale-95"
            >
              {deptActionBusy ? 'Đang tạo...' : 'Tạo phòng'}
            </button>
          </form>

          {/* Join room form */}
          <form onSubmit={handleJoinDepartment} className="rounded-2xl border-2 border-slate-900 bg-[#f7f2e7] shadow-[2px_2px_0px_#0f172a] p-5 flex flex-col justify-between shadow-xs">
            <div>
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <span>🔑</span> Tham gia phòng chung
              </h3>
              <p className="mt-1 text-[11px] text-slate-500">Nhập mã mời phòng ban do đồng nghiệp chia sẻ.</p>
              <label htmlFor="dept-join-code-input" className="mt-3 block text-[11px] font-bold text-slate-700">
                Mã mời phòng ban <span className="text-red-500">*</span>
              </label>
              <input
                id="dept-join-code-input"
                type="text"
                value={joinInviteCode}
                onChange={e => setJoinInviteCode(e.target.value)}
                placeholder="VD: TECH01"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs uppercase font-mono tracking-wider focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={deptActionBusy || !joinInviteCode.trim()}
              className="mt-4 w-full py-2.5 bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition active:scale-95"
            >
              {deptActionBusy ? 'Đang tham gia...' : 'Vào phòng ngay'}
            </button>
          </form>
        </div>
      </section>
    );
  }

  if (isLoading || !gardenData) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 font-sans">
        <div className="animate-spin text-3xl mb-2">🌸</div>
        <div className="text-xs font-semibold">Đang tải Phòng Chung & Khu Vườn...</div>
      </div>
    );
  }

  const inviteCode = currentUser.department.inviteCode || 'TECH01';

  return (
    <div className="max-w-7xl mx-auto space-y-4 font-sans text-slate-800">
      {/* 1. TOP ROOM HEADER (Matches Image 4) */}
      <div className="bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-400 border-2 border-slate-900 flex items-center justify-center text-slate-950 shadow-[2px_2px_0px_#0f172a] shrink-0">
              <TreePine size={22} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                  {gardenData.departmentName || 'Khu Vườn Hoa Anh Đào'}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                  PHÒNG #{inviteCode}
                </span>
                <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  Khu Vườn Đồng Nghiệp
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-2xl">
                Không gian chung kết nối đồng nghiệp, cùng chăm sóc thú cưng, thư giãn và tương tác trò chuyện sau giờ làm việc.
              </p>
            </div>
          </div>

          {/* Action buttons: Copy Invite Code, Change BG, Leave Room */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyInviteCode}
              className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 shadow-xs flex items-center gap-1.5 transition active:scale-95"
              title="Sao chép mã mời phòng ban"
            >
              {copiedCode ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>Mã mời: <strong className="font-mono text-slate-900">{inviteCode}</strong></span>
              {copiedCode && <span className="text-[10px] text-emerald-600 font-bold">(Đã chép)</span>}
            </button>

            {canChangeBackground && (
              <button
                type="button"
                onClick={() => setShowBgSelector(true)}
                className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition active:scale-95"
                title="Đổi bối cảnh pixel"
              >
                <ImageIcon size={14} /> <span>Đổi cảnh</span>
              </button>
            )}

            <button
              type="button"
              onClick={fetchGarden}
              className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-xl border border-slate-200 shadow-xs transition"
              title="Làm mới"
            >
              <RefreshCw size={14} />
            </button>

            <button
              type="button"
              onClick={handleLeaveDepartment}
              className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition"
              title="Rời phòng chung"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. MEMBERS LIST BAR (Matches Image 4) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 px-4 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-slate-600">Thành viên trong phòng ({members.length}):</span>
          {members.map(member => (
            <div
              key={member.id}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded-full text-xs font-medium text-slate-800"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span className="font-bold">{member.fullName}</span>
              {member.userPet && (
                <span className="text-slate-500 font-normal">
                  • 🐾 {member.userPet.name}
                </span>
              )}
              {member.id === currentUser.id && (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1 rounded">Bạn</span>
              )}
            </div>
          ))}
        </div>

        {onOpenFriends && (
          <button
            type="button"
            onClick={onOpenFriends}
            className="px-3.5 py-1.5 bg-[#231e36] hover:bg-[#332b4f] text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
          >
            <Users size={13} />
            <span>Bạn bè & Tin nhắn riêng</span>
          </button>
        )}
      </div>

      {/* 3. EXP PROGRESS BAR (Matches Image 4) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-3 px-4 shadow-xs flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 font-bold text-slate-800 shrink-0">
          <span className="text-amber-500">🏆</span>
          <span>Tiến trình Khu Vườn Chung</span>
          <span className="text-slate-400">•</span>
          <span className="text-blue-700">Cấp độ Vườn Lv.{gardenData.gardenLevel}</span>
        </div>

        <div className="flex-1 w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/60">
          <div
            className="bg-gradient-to-r from-[#231e36] to-blue-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.max(5, gardenData.expProgress)}%` }}
          />
        </div>

        <div className="text-xs font-mono font-bold text-slate-700 shrink-0">
          {gardenData.gardenExp} / {gardenData.expNeededForNextLevel} EXP{' '}
          <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
            {gardenData.expProgress}%
          </span>
        </div>
      </div>

      {/* 4. MAIN CANVAS GARDEN STAGE (Matches Image 4) */}
      <div
        className="relative w-full h-[460px] border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden select-none"
        style={{
          backgroundImage: `url(${gardenData.background?.imageUrl || '/backgrounds/garden_spring.png'})`,
          ...(gardenData.background
            ? getBackgroundFrameStyle(gardenData.background)
            : { backgroundSize: 'cover', backgroundPosition: 'center', imageRendering: 'pixelated' as const })
        }}
      >
        <PixelArtBackground
          imageUrl={gardenData.background?.imageUrl || '/backgrounds/garden_spring.png'}
          animationFrames={gardenData.background?.animationFrames || 1}
          animationFps={gardenData.background?.animationFps || 0}
          animationColumns={gardenData.background?.animationColumns || gardenData.background?.animationFrames || 1}
          animationRows={gardenData.background?.animationRows || 1}
        />

        {/* Top Badges inside Canvas */}
        <div className="absolute top-4 left-4 bg-slate-900/70 backdrop-blur-xs text-white px-3 py-1.5 rounded-xl text-xs font-medium border border-white/20 shadow-xs flex items-center gap-1.5">
          <span>📍</span>
          <span>{gardenData.background?.name || 'Hoa Anh Đào • Cầu Gỗ Hoàng Hôn'}</span>
        </div>

        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => alert('📸 Đã chụp khoảnh khắc khu vườn!')}
            className="px-3 py-1.5 bg-slate-900/70 hover:bg-slate-900/90 backdrop-blur-xs text-white text-xs font-medium rounded-xl border border-white/20 shadow-xs transition flex items-center gap-1.5"
          >
            <Camera size={13} /> <span>Chụp hình</span>
          </button>
          <button
            type="button"
            onClick={() => alert('🎵 Đang phát nhạc nền Lofi thư giãn khu vườn')}
            className="p-2 bg-slate-900/70 hover:bg-slate-900/90 backdrop-blur-xs text-white rounded-xl border border-white/20 shadow-xs transition"
          >
            <Music size={13} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen();
              else document.documentElement.requestFullscreen();
            }}
            className="p-2 bg-slate-900/70 hover:bg-slate-900/90 backdrop-blur-xs text-white rounded-xl border border-white/20 shadow-xs transition"
          >
            <Maximize2 size={13} />
          </button>
        </div>

        {/* Roaming Pets in the Garden */}
        {gardenData.pets.map((p, idx) => {
          const defaultLefts = [22, 48, 75, 34, 62];
          const leftPercent = p.positionX || defaultLefts[idx % defaultLefts.length];
          const topPercent = p.positionY || 62 + (idx % 3) * 6;

          return (
            <div
              key={p.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all hover:scale-105"
              style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
              onClick={() => !p.isCurrentUsersPet && setSelectedPetToGift(p)}
            >
              {/* Pet Info Tag above pet */}
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-white/95 border border-slate-200 rounded-full px-2 py-0.5 text-[10px] font-bold text-slate-800 whitespace-nowrap shadow-xs flex items-center gap-1">
                <span>{p.name}</span>
                <span className="text-amber-600 text-[9px] font-mono">Lv.{p.level}</span>
                {p.isCurrentUsersPet && (
                  <span className="text-[8px] bg-amber-400 text-slate-950 font-black px-1 rounded-sm">Bạn</span>
                )}
              </div>

              {/* Pixel Pet Renderer */}
              <PixelPetCanvas
                petType={p.petType}
                currentState={(p.currentState as any) || 'IDLE'}
                scaleSize="MEDIUM"
              />
              <div className="w-16 h-3 bg-slate-800/20 rounded-full filter blur-[2px] mx-auto -mt-2"></div>
            </div>
          );
        })}

        {/* Bottom Floating Interactive Overlay Buttons */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20">
          <button
            type="button"
            onClick={handleWaterGarden}
            className="px-4 py-2 bg-slate-900/80 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold backdrop-blur-xs border border-white/20 shadow-md transition active:scale-95 flex items-center gap-1.5"
          >
            <Droplets size={14} className="text-blue-400" />
            <span>Tưới cây vườn</span>
          </button>
          <button
            type="button"
            onClick={handleSendHearts}
            className="px-4 py-2 bg-slate-900/80 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold backdrop-blur-xs border border-white/20 shadow-md transition active:scale-95 flex items-center gap-1.5"
          >
            <Heart size={14} className="text-pink-400 fill-pink-400" />
            <span>Thả tim chung</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const inputEl = document.querySelector('input[placeholder*="Gửi tin nhắn"]') as HTMLInputElement;
              if (inputEl) inputEl.focus();
            }}
            className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none rounded-xl text-xs font-bold shadow-md transition active:scale-95 flex items-center gap-1.5"
          >
            <MessageCircle size={14} />
            <span>Nhắn tin phòng</span>
          </button>
        </div>
      </div>

      {/* 5. BOTTOM 2 COLUMNS: Real-time Interaction History & Quick Room Chat (Matches Image 4) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Nhật Ký Tương Tác Vườn (7 cols) */}
        <div className="lg:col-span-7 bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Clock size={16} className="text-slate-500" />
              <span>Nhật Ký Tương Tác Vườn</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">Cập nhật theo thời gian thực</span>
          </div>

          <div className="space-y-3 pt-1">
            <div className="flex items-start justify-between text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-amber-500 text-base">🍯</span>
                <span className="text-slate-700">
                  <strong className="text-slate-900 font-bold">Trần Minh Anh</strong> vừa thu hoạch quả táo năng lượng cùng Bento Boy.
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap ml-2">2 phút trước</span>
            </div>

            <div className="flex items-start justify-between text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-rose-500 text-base">💖</span>
                <span className="text-slate-700">
                  <strong className="text-slate-900 font-bold">{currentUser?.fullName || 'Phi Hùng'}</strong> đã gửi lời chào và tim năng lượng đến Thỏ Bông (+15 EXP).
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap ml-2">5 phút trước</span>
            </div>

            <div className="flex items-start justify-between text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-blue-500 text-base">🎉</span>
                <span className="text-slate-700">
                  Toàn bộ phòng <strong className="text-slate-900 font-bold">{inviteCode}</strong> hoàn thành mốc Focus Pomodoro tập thể 45 phút!
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap ml-2">14 phút trước</span>
            </div>
          </div>
        </div>

        {/* Right Column: Chat Nhanh (5 cols) */}
        <div className="lg:col-span-5 bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <MessageSquare size={16} className="text-amber-500" />
              <span>Chat Nhanh</span>
            </h3>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>

          {/* Chat message bubbles */}
          <div className="h-44 overflow-y-auto space-y-2 p-2 bg-slate-50/70 border border-slate-100 rounded-xl text-xs">
            {roomMessages.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                Chưa có tin nhắn trong phòng. Gửi tin chào mọi người nhé! 👋🐾
              </div>
            ) : (
              roomMessages.map(msg => {
                const isMe = msg.senderId === currentUser.id;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-0.5 px-1">
                      <span className="font-bold text-slate-700">{msg.senderName || 'Đồng nghiệp'}</span>
                      {msg.petName && <span className="text-amber-600">({msg.petName})</span>}
                      <span className="text-slate-400 font-mono">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-xl text-xs ${
                        isMe
                          ? 'bg-[#231e36] text-white rounded-br-none shadow-xs'
                          : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none shadow-xs'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatContainerRef} />
          </div>

          {/* Chat input box */}
          <form onSubmit={handleSendRoomMessage} className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Gửi tin nhắn trong phòng..."
              maxLength={500}
              className="flex-1 px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={isSendingMessage || !chatInput.trim()}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center justify-center shrink-0"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      </div>

      {/* Modal Gift for colleague pet */}
      {selectedPetToGift && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] shadow-2xl max-w-sm w-full p-5 animate-in zoom-in-95">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Tặng quà cho bé cưng của {selectedPetToGift.ownerName}
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Gửi một món ăn ngon để giúp thú cưng của bạn bè vui vẻ hơn và nhận thêm +20 EXP cho cả khu vườn!
            </p>
            <textarea
              value={giftMessage}
              onChange={e => setGiftMessage(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs mb-4 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedPetToGift(null)}
                className="px-3.5 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSendGift}
                className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none text-xs font-bold rounded-xl shadow-xs"
              >
                Gửi Quà 🎁
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Background Selector */}
      {showBgSelector && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] shadow-2xl max-w-2xl w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">Chọn bối cảnh khu vườn phòng ban</h3>
              <button
                type="button"
                onClick={() => setShowBgSelector(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto p-1">
              {backgrounds.map(bg => (
                <div
                  key={bg.id}
                  onClick={() => handleChangeBackground(bg.id)}
                  className={`border rounded-2xl p-2.5 cursor-pointer transition-all hover:scale-105 ${
                    gardenData.background?.id === bg.id
                      ? 'border-blue-600 bg-blue-50/50 shadow-md ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white shadow-xs'
                  }`}
                >
                  <BackgroundThumb
                    imageUrl={bg.imageUrl}
                    thumbnailUrl={bg.thumbnailUrl}
                    name={bg.name}
                    animationFrames={bg.animationFrames}
                    animationFps={bg.animationFps}
                    animationColumns={bg.animationColumns}
                    animationRows={bg.animationRows}
                    className="h-24 w-full rounded-xl"
                  />
                  <div className="mt-2 text-xs font-bold text-slate-800 truncate">{bg.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
