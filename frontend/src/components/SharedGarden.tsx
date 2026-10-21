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
  LogIn
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
      // Optimistically append if not already received from socket
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
      <section className="max-w-2xl mx-auto bg-white border-2 border-charcoal rounded-2xl shadow-pixel p-6 font-sans">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 bg-sage-100 border-2 border-charcoal rounded-xl text-sage-600">
            <Users size={24} />
          </div>
          <div>
            <h2 className="font-pixel text-sm text-charcoal">Phòng Chung & Khu Vườn</h2>
            <p className="text-xs text-gray-500 mt-1">
              Tham gia phòng chung để đưa thú cưng của bạn vào khu vườn sinh thái cùng các đồng nghiệp!
            </p>
          </div>
        </div>

        {deptActionError && (
          <p role="alert" className="mb-4 p-2.5 bg-red-50 border border-red-300 rounded-lg text-xs text-red-700">
            {deptActionError}
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Create room form */}
          <form onSubmit={handleCreateDepartment} className="rounded-xl border-2 border-charcoal bg-cream-100 p-4 flex flex-col justify-between">
            <div>
              <h3 className="font-pixel text-xs text-charcoal flex items-center gap-1.5">
                <span>🏢</span> Tạo phòng chung mới
              </h3>
              <p className="mt-1 text-[11px] text-gray-600">Khởi tạo không gian phòng ban mới và nhận mã mời riêng.</p>
              <label htmlFor="dept-name-input" className="mt-3 block text-[11px] font-bold text-gray-700">
                Tên phòng ban <span className="text-red-500">*</span>
              </label>
              <input
                id="dept-name-input"
                type="text"
                value={newDeptName}
                onChange={e => setNewDeptName(e.target.value)}
                maxLength={80}
                placeholder="VD: Phòng Kỹ Thuật & Phần Mềm"
                className="mt-1 w-full rounded-lg border-2 border-charcoal bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sage-400"
              />
            </div>
            <button
              type="submit"
              disabled={deptActionBusy || !newDeptName.trim()}
              className="mt-4 w-full py-2 bg-sage-500 hover:bg-sage-600 disabled:opacity-50 text-white font-pixel text-xs rounded-lg border-2 border-charcoal shadow-pixel transition-transform active:scale-95"
            >
              {deptActionBusy ? 'Đang tạo...' : 'Tạo phòng'}
            </button>
          </form>

          {/* Join room form */}
          <form onSubmit={handleJoinDepartment} className="rounded-xl border-2 border-charcoal bg-cream-100 p-4 flex flex-col justify-between">
            <div>
              <h3 className="font-pixel text-xs text-charcoal flex items-center gap-1.5">
                <span>🔑</span> Tham gia phòng chung
              </h3>
              <p className="mt-1 text-[11px] text-gray-600">Nhập mã mời phòng ban do đồng nghiệp hoặc quản trị chia sẻ.</p>
              <label htmlFor="dept-join-code-input" className="mt-3 block text-[11px] font-bold text-gray-700">
                Mã mời phòng ban <span className="text-red-500">*</span>
              </label>
              <input
                id="dept-join-code-input"
                type="text"
                value={joinInviteCode}
                onChange={e => setJoinInviteCode(e.target.value)}
                placeholder="VD: TECH01"
                className="mt-1 w-full rounded-lg border-2 border-charcoal bg-white px-3 py-2 text-xs uppercase font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-sage-400"
              />
            </div>
            <button
              type="submit"
              disabled={deptActionBusy || !joinInviteCode.trim()}
              className="mt-4 w-full py-2 bg-terracotta-400 hover:bg-terracotta-500 disabled:opacity-50 text-white font-pixel text-xs rounded-lg border-2 border-charcoal shadow-pixel transition-transform active:scale-95"
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
      <div className="flex flex-col items-center justify-center p-12 text-charcoal font-sans">
        <div className="animate-spin text-3xl mb-2 font-pixel">🌸</div>
        <div className="font-pixel text-xs">Đang tải Phòng Chung & Khu Vườn...</div>
      </div>
    );
  }

  const inviteCode = currentUser.department.inviteCode || 'TECH01';

  return (
    <div className="max-w-5xl mx-auto space-y-4 font-sans">
      {/* 1. TOP ROOM HEADER: Tên phòng, Số người, Mời bạn, Buff EXP & Rời phòng */}
      <div className="bg-white border-2 border-charcoal rounded-xl shadow-pixel p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sage-100 border-2 border-charcoal rounded-xl text-sage-600 shrink-0">
              <TreePine size={24} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-pixel text-sm text-charcoal">{gardenData.departmentName}</h2>
                <span className="font-pixel text-[10px] px-2 py-0.5 bg-terracotta-400 text-white rounded-full">
                  Khu Vườn Cấp {gardenData.gardenLevel}
                </span>
                <span className="text-[11px] font-bold text-sage-700 bg-sage-100 px-2.5 py-0.5 rounded-full border border-sage-300 flex items-center gap-1">
                  <Users size={12} /> {members.length} thành viên
                </span>
              </div>
              <div className="text-xs text-gray-500 font-sans mt-0.5">
                Không gian chung kết nối đồng nghiệp, chăm sóc thú cưng và tương tác trò chuyện
              </div>
            </div>
          </div>

          {/* Action buttons: Copy Invite Code, Change BG, Leave Room */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Invite Code button */}
            <button
              type="button"
              onClick={copyInviteCode}
              className="px-3 py-1.5 bg-cream-100 hover:bg-cream-200 text-charcoal text-xs font-bold rounded-lg border-2 border-charcoal shadow-pixel-sm flex items-center gap-1.5 transition-transform active:scale-95"
              title="Sao chép mã mời phòng ban"
            >
              {copiedCode ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              <span>Mã mời: <strong className="font-mono text-sage-700">{inviteCode}</strong></span>
              {copiedCode && <span className="text-[10px] text-green-600">(Đã chép)</span>}
            </button>

            {canChangeBackground && (
              <button
                type="button"
                onClick={() => setShowBgSelector(true)}
                className="px-3 py-1.5 bg-sage-400 hover:bg-sage-500 text-white text-xs font-pixel rounded-lg border-2 border-charcoal shadow-pixel-sm flex items-center gap-1.5 transition-transform active:scale-95"
                title="Đổi bối cảnh pixel"
              >
                <ImageIcon size={14} /> Bối cảnh
              </button>
            )}

            <button
              type="button"
              onClick={handleLeaveDepartment}
              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg border border-charcoal transition-colors"
              title="Rời phòng chung"
            >
              <LogOut size={16} />
            </button>

            <button
              type="button"
              onClick={fetchGarden}
              className="p-1.5 bg-gray-100 hover:bg-gray-200 text-charcoal rounded-lg border border-charcoal"
              title="Làm mới"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Members Pill List */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-gray-500">Thành viên trong phòng:</span>
          {members.map(member => (
            <div
              key={member.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cream-100 border border-charcoal rounded-lg text-xs"
            >
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="font-bold text-charcoal">{member.fullName}</span>
              {member.userPet && (
                <span className="text-[10px] text-terracotta-600 font-pixel">
                  🐾 {member.userPet.name}
                </span>
              )}
            </div>
          ))}
          {onOpenFriends && (
            <button
              type="button"
              onClick={onOpenFriends}
              className="text-[11px] text-sage-600 hover:underline font-bold ml-1 flex items-center gap-1"
            >
              <UserPlus size={12} /> Bạn bè & Tin nhắn riêng
            </button>
          )}
        </div>
      </div>

      {/* 2. EXP Progress Bar */}
      <div className="bg-white border-2 border-charcoal rounded-lg p-2.5 shadow-pixel-sm flex items-center gap-3 text-xs">
        <span className="font-pixel text-[10px] text-gray-600 whitespace-nowrap">
          Tiến trình Khu Vườn:
        </span>
        <div className="flex-1 bg-gray-200 h-3.5 border border-charcoal rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-sage-400 to-terracotta-400 h-full transition-all duration-500"
            style={{ width: `${gardenData.expProgress}%` }}
          />
        </div>
        <span className="font-pixel text-[10px] text-terracotta-600 whitespace-nowrap">
          {gardenData.gardenExp} / {gardenData.expNeededForNextLevel} EXP ({gardenData.expProgress}%)
        </span>
      </div>

      {/* 3. Main Pixel Art Shared Garden Stage */}
      <div
        className="relative w-full h-[420px] border-4 border-charcoal rounded-2xl shadow-pixel-lg overflow-hidden select-none"
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

        {/* Background Name Badge */}
        <div className="absolute top-3 left-3 bg-pixelDark/80 backdrop-blur-sm text-white px-3 py-1 rounded-md text-[11px] font-pixel border border-white/20">
          📍 {gardenData.background?.name || 'Khu Vườn Mùa Xuân'}
        </div>

        {/* Roaming Pets in the Garden */}
        {gardenData.pets.map((p, idx) => {
          const defaultLefts = [20, 50, 78, 35, 65];
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
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white/90 border border-charcoal rounded px-1.5 py-0.5 text-[9px] font-bold text-charcoal whitespace-nowrap shadow-sm flex items-center gap-1">
                <span>{p.name}</span>
                <span className="text-terracotta-500 text-[8px] font-pixel">Lv.{p.level}</span>
                {p.isCurrentUsersPet && <span className="text-[7px] text-green-600 font-bold">(Bạn)</span>}
              </div>

              {/* Pixel Pet Renderer */}
              <PixelPetCanvas
                petType={p.petType}
                currentState={(p.currentState as any) || 'IDLE'}
                scaleSize="MEDIUM"
              />
            </div>
          );
        })}
      </div>

      {/* 4. Real-time Room Chat: Nhắn tin khi chung phòng */}
      <div className="bg-white border-2 border-charcoal rounded-2xl shadow-pixel p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-sage-600" />
            <h3 className="font-pixel text-xs text-charcoal">Trò chuyện chung phòng ban</h3>
          </div>
          <span className="text-[10px] text-gray-500">Tin nhắn tức thời giữa các đồng nghiệp trong phòng</span>
        </div>

        {/* Chat message history list */}
        <div className="h-44 overflow-y-auto space-y-2.5 p-3 bg-cream-100 border border-charcoal rounded-xl text-xs">
          {roomMessages.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              Chưa có tin nhắn nào trong phòng. Hãy là người đầu tiên chào đồng nghiệp nhé! 👋🐾
            </div>
          ) : (
            roomMessages.map(msg => {
              const isMe = msg.senderId === currentUser.id;
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-0.5 px-1">
                    <span className="font-bold text-charcoal">{msg.senderName || 'Đồng nghiệp'}</span>
                    {msg.petName && <span className="text-terracotta-500 font-pixel">({msg.petName})</span>}
                    <span className="text-gray-400 font-mono">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div
                    className={`max-w-[75%] px-3 py-2 rounded-xl border-2 border-charcoal shadow-pixel-sm ${
                      isMe ? 'bg-sage-400 text-white rounded-br-none' : 'bg-white text-charcoal rounded-bl-none'
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
            placeholder="Nhập tin nhắn gửi tới cả phòng..."
            maxLength={500}
            className="flex-1 px-3 py-2 border-2 border-charcoal rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sage-400"
          />
          <button
            type="submit"
            disabled={isSendingMessage || !chatInput.trim()}
            className="px-4 py-2 bg-terracotta-400 hover:bg-terracotta-500 disabled:opacity-50 text-white font-pixel text-xs rounded-xl border-2 border-charcoal shadow-pixel transition-transform active:scale-95 flex items-center gap-1.5 shrink-0"
          >
            <Send size={14} /> Gửi
          </button>
        </form>
      </div>

      {/* Modal Gift for colleague pet */}
      {selectedPetToGift && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-4 border-charcoal rounded-2xl shadow-pixel-lg max-w-sm w-full p-5 animate-in zoom-in-95">
            <h3 className="font-pixel text-xs text-charcoal mb-2">
              Tặng quà cho bé cưng của {selectedPetToGift.ownerName}
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Gửi một món ăn ngon để giúp thú cưng của bạn bè vui vẻ hơn và nhận thêm +20 EXP cho cả khu vườn!
            </p>
            <textarea
              value={giftMessage}
              onChange={e => setGiftMessage(e.target.value)}
              className="w-full p-2 border-2 border-charcoal rounded-lg text-xs mb-4 focus:outline-none focus:ring-2 focus:ring-sage-400"
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedPetToGift(null)}
                className="px-3 py-1.5 bg-gray-200 text-charcoal font-pixel text-xs rounded-lg border border-charcoal"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSendGift}
                className="px-3 py-1.5 bg-terracotta-400 hover:bg-terracotta-500 text-white font-pixel text-xs rounded-lg border-2 border-charcoal shadow-pixel"
              >
                Gửi Quà 🎁
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Background Selector */}
      {showBgSelector && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-4 border-charcoal rounded-2xl shadow-pixel-lg max-w-2xl w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-pixel text-sm text-charcoal">Chọn bối cảnh khu vườn phòng ban</h3>
              <button
                type="button"
                onClick={() => setShowBgSelector(false)}
                className="p-1 hover:bg-gray-100 rounded-lg text-charcoal"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto p-1">
              {backgrounds.map(bg => (
                <div
                  key={bg.id}
                  onClick={() => handleChangeBackground(bg.id)}
                  className={`border-2 rounded-xl p-2 cursor-pointer transition-all hover:scale-105 ${
                    gardenData.background?.id === bg.id
                      ? 'border-terracotta-500 bg-terracotta-50 shadow-pixel'
                      : 'border-charcoal bg-white shadow-pixel-sm'
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
                    className="h-24 w-full"
                  />
                  <div className="mt-2 font-pixel text-[11px] text-charcoal truncate">{bg.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
