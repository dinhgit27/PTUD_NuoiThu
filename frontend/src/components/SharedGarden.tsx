import React, { useState, useEffect, useRef } from 'react';
import { PixelPetCanvas } from './PixelPetCanvas';
import { PixelArtBackground, getBackgroundFrameStyle } from './PixelArtBackground';
import { BackgroundThumb } from './BackgroundThumb';
import { SharedGardenData, GardenBackground, UserPet, User, PublicRoom, MainRoomType } from '../types';
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
  ShieldCheck,
  Search,
  Compass,
  Flame,
  Coffee,
  Timer,
  Plus,
  X,
  ChevronRight,
  Star,
  Award
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

  // Like state for current room
  const [currentRoomLikes, setCurrentRoomLikes] = useState(0);
  const [currentRoomHasLiked, setCurrentRoomHasLiked] = useState(false);
  const [isLikingCurrentRoom, setIsLikingCurrentRoom] = useState(false);

  // Modals for room discovery & creation
  const [showRoomDiscoveryModal, setShowRoomDiscoveryModal] = useState(false);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);

  // States for Room Discovery (Public list)
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [isLoadingPublicRooms, setIsLoadingPublicRooms] = useState(false);
  const [roomFilter, setRoomFilter] = useState<'ALL' | 'RELAX' | 'FOCUS'>('ALL');
  const [roomSearchQuery, setRoomSearchQuery] = useState('');
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);

  // States for Room Creation
  const [createRoomType, setCreateRoomType] = useState<MainRoomType>('RELAX');
  const [createRoomName, setCreateRoomName] = useState('');
  const [createRoomBusy, setCreateRoomBusy] = useState(false);
  const [createRoomError, setCreateRoomError] = useState('');

  // States for Direct Invite Code join
  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [joinCodeBusy, setJoinCodeBusy] = useState(false);
  const [joinCodeError, setJoinCodeError] = useState('');

  // Active tab when user has no department: 'BROWSE' | 'CREATE'
  const [noDeptTab, setNoDeptTab] = useState<'BROWSE' | 'CREATE'>('BROWSE');

  const chatContainerRef = useRef<HTMLDivElement>(null);

  const fetchGarden = async () => {
    try {
      setIsLoading(true);
      const res = await api.getGarden();
      setGardenData(res.data);
      if (res.data) {
        setCurrentRoomLikes(res.data.likesCount || 0);
        setCurrentRoomHasLiked(Boolean(res.data.hasLiked));
      }
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

  const fetchPublicRooms = async () => {
    try {
      setIsLoadingPublicRooms(true);
      const res = await api.getPublicDepartments({
        type: roomFilter,
        search: roomSearchQuery.trim()
      });
      setPublicRooms(res.data.rooms || []);
    } catch (err) {
      console.error('Failed to load public rooms:', err);
    } finally {
      setIsLoadingPublicRooms(false);
    }
  };

  useEffect(() => {
    fetchPublicRooms();
  }, [roomFilter, roomSearchQuery]);

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

    const handleRoomLiked = (data: { deptId: string; likesCount: number; hasLiked?: boolean }) => {
      // Update public rooms list
      setPublicRooms(prev =>
        prev
          .map(r => (r.id === data.deptId ? { ...r, likesCount: data.likesCount } : r))
          .sort((a, b) => b.likesCount - a.likesCount)
      );

      // If it's current garden
      if (currentUser?.department?.id === data.deptId) {
        setCurrentRoomLikes(data.likesCount);
        if (data.hasLiked !== undefined) {
          setCurrentRoomHasLiked(data.hasLiked);
        }
      }
    };

    socket.on('pet_updated', handlePetUpdated);
    socket.on('room_chat_message', handleRoomMessage);
    socket.on('garden_leveled_up', handleGardenLevelUp);
    socket.on('room_liked', handleRoomLiked);

    return () => {
      socket.off('pet_updated', handlePetUpdated);
      socket.off('room_chat_message', handleRoomMessage);
      socket.off('garden_leveled_up', handleGardenLevelUp);
      socket.off('room_liked', handleRoomLiked);
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
      alert(`Mã mời phòng là: ${code}`);
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

  const handleWaterGarden = async () => {
    try {
      const res = await api.waterGarden();
      alert(res.data.message || '💧 Bạn đã tưới nước cho cây vườn! Toàn bộ hoa màu nở rộ và nhận thêm EXP.');
      await fetchGarden();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Lỗi khi tưới cây vườn.');
    }
  };

  const handleSendHearts = async () => {
    try {
      const res = await api.sendGardenHearts();
      alert(res.data.message || '💖 Bạn đã thả tim lan tỏa năng lượng tích cực cho tất cả thú cưng trong phòng!');
      await fetchGarden();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Lỗi khi thả tim.');
    }
  };

  const handleLikeCurrentRoom = async () => {
    if (!currentUser?.department?.id || isLikingCurrentRoom) return;
    setIsLikingCurrentRoom(true);
    try {
      const res = await api.likeDepartment(currentUser.department.id);
      setCurrentRoomLikes(res.data.likesCount);
      setCurrentRoomHasLiked(res.data.hasLiked);
      fetchPublicRooms();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Không thể thích phòng lúc này.');
    } finally {
      setIsLikingCurrentRoom(false);
    }
  };

  const handleLikePublicRoom = async (room: PublicRoom, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await api.likeDepartment(room.id);
      setPublicRooms(prev =>
        prev
          .map(r => (r.id === room.id ? { ...r, likesCount: res.data.likesCount, hasLiked: res.data.hasLiked } : r))
          .sort((a, b) => b.likesCount - a.likesCount)
      );
      if (currentUser?.department?.id === room.id) {
        setCurrentRoomLikes(res.data.likesCount);
        setCurrentRoomHasLiked(res.data.hasLiked);
      }
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Không thể thích phòng lúc này.');
    }
  };

  const handleJoinRoom = async (deptId: string) => {
    setJoiningRoomId(deptId);
    try {
      await api.joinDepartment(undefined, deptId);
      setShowRoomDiscoveryModal(false);
      if (onMembershipChange) await onMembershipChange();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Không thể vào phòng này.');
    } finally {
      setJoiningRoomId(null);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinInviteCode.trim() || joinCodeBusy) return;
    setJoinCodeBusy(true);
    setJoinCodeError('');
    try {
      await api.joinDepartment(joinInviteCode.trim().toUpperCase());
      setJoinInviteCode('');
      setShowRoomDiscoveryModal(false);
      if (onMembershipChange) await onMembershipChange();
    } catch (err: any) {
      setJoinCodeError(err?.response?.data?.error || 'Mã phòng không hợp lệ hoặc phòng không tồn tại.');
    } finally {
      setJoinCodeBusy(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = createRoomName.trim() || (
      createRoomType === 'RELAX'
        ? `Góc Thư Giãn của ${currentUser?.fullName || 'Đồng Nghiệp'}`
        : `Phòng Tập Trung của ${currentUser?.fullName || 'Đồng Nghiệp'}`
    );

    setCreateRoomBusy(true);
    setCreateRoomError('');
    try {
      await api.createDepartment({
        name: finalName,
        roomType: createRoomType
      });
      setCreateRoomName('');
      setShowCreateRoomModal(false);
      if (onMembershipChange) await onMembershipChange();
    } catch (err: any) {
      setCreateRoomError(err?.response?.data?.error || 'Không thể tạo phòng lúc này.');
    } finally {
      setCreateRoomBusy(false);
    }
  };

  const handleSuggestRoomName = () => {
    const userFirst = currentUser?.fullName?.split(' ')?.pop() || 'Đồng Nghiệp';
    if (createRoomType === 'RELAX') {
      const relaxIdeas = [
        `Trạm Dừng Lofi của ${userFirst}`,
        `Góc Cà Phê Mèo & Thư Giãn`,
        `Khu Vườn Hoa Anh Đào Chill`,
        `Hội Quán Trà Chiều & Nuôi Pet`,
        `Phòng Thư Thái Cuối Tuần`
      ];
      setCreateRoomName(relaxIdeas[Math.floor(Math.random() * relaxIdeas.length)]);
    } else {
      const focusIdeas = [
        `Phòng Dev & Deep Focus của ${userFirst}`,
        `Biệt Đội Chạy Deadline & Pomodoro`,
        `Thư Viện Tự Học & Coding Đêm`,
        `Phòng Kỹ Thuật Công Nghệ Cao`,
        `Trạm Năng Suất 100%`
      ];
      setCreateRoomName(focusIdeas[Math.floor(Math.random() * focusIdeas.length)]);
    }
  };

  const handleCaptureGardenSnapshot = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      alert('Không tìm thấy khung ảnh khu vườn để chụp!');
      return;
    }
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `khu_vuon_${gardenData?.departmentName || 'chung'}_snapshot.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      alert('Đã chụp hình khoảnh khắc khu vườn!');
    }
  };

  const handlePlayGardenMusic = () => {
    const musicNavBtn = (document.querySelector('nav button:has(svg.lucide-music)') ||
      document.querySelector('nav button:nth-child(5)')) as HTMLButtonElement;
    if (musicNavBtn) {
      musicNavBtn.click();
    } else {
      alert('🎵 Bạn có thể chuyển sang tab Nhạc Lofi để phát danh sách bài hát thư giãn!');
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

  // =========================================================================
  // RENDER: ROOM DISCOVERY COMPONENT (Reusable for both No-Dept screen & Modal)
  // =========================================================================
  const renderRoomDiscoveryContent = () => (
    <div className="space-y-4">
      {/* Search & Filter Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={roomSearchQuery}
            onChange={e => setRoomSearchQuery(e.target.value)}
            placeholder="Tìm theo tên phòng hoặc mã mời (VD: CHILL01)..."
            className="w-full pl-10 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-400 shadow-xs"
          />
          {roomSearchQuery && (
            <button
              onClick={() => setRoomSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter chips: Tất cả, Thư giãn, Tập trung */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold border border-slate-200/80 shrink-0">
          <button
            type="button"
            onClick={() => setRoomFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg transition ${
              roomFilter === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả ({publicRooms.length})
          </button>
          <button
            type="button"
            onClick={() => setRoomFilter('RELAX')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition ${
              roomFilter === 'RELAX'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs'
                : 'text-slate-600 hover:text-emerald-700'
            }`}
          >
            <span>☕</span> <span>Thư giãn</span>
          </button>
          <button
            type="button"
            onClick={() => setRoomFilter('FOCUS')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition ${
              roomFilter === 'FOCUS'
                ? 'bg-indigo-50 text-indigo-800 border border-indigo-200 shadow-xs'
                : 'text-slate-600 hover:text-indigo-700'
            }`}
          >
            <span>⏱️</span> <span>Tập trung</span>
          </button>
        </div>
      </div>

      {/* Sorting Banner: Clarifies "Phòng nào được ưa thích thì xếp trên" */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900">
        <div className="flex items-center gap-2 font-medium">
          <Flame size={15} className="text-amber-500 fill-amber-500 shrink-0 animate-pulse" />
          <span>
            <strong>Bảng xếp hạng thịnh hành:</strong> Các phòng được nhiều người <strong>ưa thích (Like ❤️)</strong> nhất luôn được xếp lên trên cùng!
          </span>
        </div>
        <span className="hidden sm:inline-block text-[10px] font-mono font-bold bg-amber-200/70 px-2 py-0.5 rounded-md text-amber-950 shrink-0">
          TỰ ĐỘNG CẬP NHẬT
        </span>
      </div>

      {/* Rooms List */}
      <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
        {isLoadingPublicRooms ? (
          <div className="py-12 text-center text-slate-400 font-medium text-xs flex flex-col items-center gap-2">
            <span className="animate-spin text-2xl">🌸</span>
            <span>Đang tải danh sách phòng...</span>
          </div>
        ) : publicRooms.length === 0 ? (
          <div className="py-12 text-center text-slate-400 font-medium text-xs bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6">
            <p className="text-sm">Không tìm thấy phòng nào phù hợp.</p>
            <p className="mt-1 text-[11px] text-slate-400">Bạn có thể tạo một phòng mới ngay bây giờ!</p>
            <button
              onClick={() => {
                setShowRoomDiscoveryModal(false);
                setShowCreateRoomModal(true);
                setNoDeptTab('CREATE');
              }}
              className="mt-3 px-4 py-2 bg-[#231e36] text-white font-bold text-xs rounded-xl shadow-xs"
            >
              ➕ Tạo phòng ngay
            </button>
          </div>
        ) : (
          publicRooms.map((room, index) => {
            const isCurrent = currentUser?.department?.id === room.id;
            const isRelax = room.roomType === 'RELAX' || room.themeId === 'CHILL';
            const isTop1 = index === 0;
            const isTop2 = index === 1;
            const isTop3 = index === 2;

            return (
              <div
                key={room.id}
                className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
                  isCurrent
                    ? 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-500/20'
                    : isTop1
                    ? 'border-amber-400 bg-gradient-to-r from-amber-50/50 via-white to-amber-50/20 hover:border-amber-500'
                    : 'border-slate-200 bg-white hover:border-slate-400'
                }`}
              >
                {/* Left: Info & Badges */}
                <div className="flex items-start gap-3">
                  {/* Rank badge */}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 border ${
                      isTop1
                        ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-[1px_1px_0_#b45309]'
                        : isTop2
                        ? 'bg-slate-200 text-slate-800 border-slate-300'
                        : isTop3
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : 'bg-slate-50 text-slate-500 border-slate-200'
                    }`}
                    title={`Thứ hạng: #${index + 1}`}
                  >
                    {isTop1 ? '🥇' : isTop2 ? '🥈' : isTop3 ? '🥉' : `#${index + 1}`}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight">
                        {room.name}
                      </h4>

                      {/* Type Badge (Thư giãn / Tập trung) */}
                      {isRelax ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span>☕</span> <span>Thư giãn</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <span>⏱️</span> <span>Tập trung</span>
                        </span>
                      )}

                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md border border-slate-200">
                        #{room.inviteCode}
                      </span>
                    </div>

                    {/* Stats bar */}
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Users size={12} className="text-slate-400" />
                        <strong>{room.memberCount}</strong> thành viên
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <TreePine size={12} className="text-emerald-600" />
                        <span>Vườn Lv.{room.gardenLevel}</span>
                      </span>
                      <span>•</span>
                      <span className="text-slate-400">{room.workHours || '24/7 Tự do'}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Likes Button & Join Button */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {/* Clickable Like Button */}
                  <button
                    type="button"
                    onClick={(e) => handleLikePublicRoom(room, e)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer ${
                      room.hasLiked
                        ? 'bg-rose-50 border-rose-300 text-rose-600'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600'
                    }`}
                    title={room.hasLiked ? 'Bạn đã thích phòng này (Bấm để bỏ thích)' : 'Bấm để tặng 1 Like cho phòng'}
                  >
                    <Heart
                      size={14}
                      className={room.hasLiked ? 'text-rose-500 fill-rose-500 animate-bounce' : 'text-slate-400'}
                    />
                    <span>{room.likesCount}</span>
                  </button>

                  {/* Join Room Button */}
                  {isCurrent ? (
                    <span className="px-3.5 py-1.5 bg-blue-100 text-blue-800 text-xs font-bold rounded-xl border border-blue-200">
                      ✓ Đang ở phòng này
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={joiningRoomId === room.id}
                      onClick={() => handleJoinRoom(room.id)}
                      className="px-4 py-1.5 bg-[#231e36] hover:bg-[#342d4f] disabled:opacity-50 text-white text-xs font-bold rounded-xl border border-slate-900 shadow-xs active:scale-95 transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>{joiningRoomId === room.id ? 'Đang vào...' : 'Vào phòng'}</span>
                      <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick join by code section at bottom */}
      <form
        onSubmit={handleJoinByCode}
        className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"
      >
        <div className="flex items-center gap-2 text-slate-600 font-medium">
          <span>🔑</span>
          <span>Có mã mời riêng tư?</span>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            value={joinInviteCode}
            onChange={e => setJoinInviteCode(e.target.value)}
            placeholder="Nhập mã (VD: TECH01)"
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white uppercase font-mono tracking-wider text-xs focus:ring-2 focus:ring-amber-400 focus:outline-hidden w-full sm:w-44"
          />
          <button
            type="submit"
            disabled={joinCodeBusy || !joinInviteCode.trim()}
            className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-bold rounded-xl shadow-xs transition shrink-0 active:scale-95"
          >
            {joinCodeBusy ? 'Đang vào...' : 'Vào ngay'}
          </button>
        </div>
      </form>
      {joinCodeError && (
        <p className="text-[11px] text-red-600 font-semibold">{joinCodeError}</p>
      )}
    </div>
  );

  // =========================================================================
  // RENDER: ROOM CREATION COMPONENT (Select Relax or Focus)
  // =========================================================================
  const renderRoomCreationContent = () => (
    <form onSubmit={handleCreateRoom} className="space-y-4">
      {createRoomError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold">
          {createRoomError}
        </div>
      )}

      {/* 1. Chọn loại phòng: Thư giãn hay Tập trung (Yêu cầu chính) */}
      <div>
        <label className="block text-xs font-bold text-slate-900 mb-2">
          1. Chọn loại phòng của bạn <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Card: Thư giãn */}
          <div
            onClick={() => setCreateRoomType('RELAX')}
            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
              createRoomType === 'RELAX'
                ? 'border-emerald-500 bg-emerald-50/40 shadow-md ring-2 ring-emerald-500/20'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-xl shadow-xs">
                ☕
              </div>
              {createRoomType === 'RELAX' && (
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
                  ✓
                </span>
              )}
            </div>
            <h4 className="mt-2.5 text-xs font-black text-slate-900 flex items-center gap-1.5">
              <span>Phòng Thư Giãn</span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded">CHILL</span>
            </h4>
            <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
              Nghe nhạc Lofi êm ái, nghỉ ngơi xả stress, tán gẫu giao lưu và thả thú cưng dạo chơi tự do.
            </p>
            <div className="mt-2.5 pt-2 border-t border-emerald-100/80 text-[10px] text-emerald-700 font-medium flex items-center gap-1">
              <span>🍃</span> <span>Nhạc Lofi • Giao lưu • Nuôi thú cưng</span>
            </div>
          </div>

          {/* Card: Tập trung */}
          <div
            onClick={() => setCreateRoomType('FOCUS')}
            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
              createRoomType === 'FOCUS'
                ? 'border-indigo-500 bg-indigo-50/40 shadow-md ring-2 ring-indigo-500/20'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center text-xl shadow-xs">
                ⏱️
              </div>
              {createRoomType === 'FOCUS' && (
                <span className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-bold">
                  ✓
                </span>
              )}
            </div>
            <h4 className="mt-2.5 text-xs font-black text-slate-900 flex items-center gap-1.5">
              <span>Phòng Tập Trung</span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded">FOCUS</span>
            </h4>
            <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
              Làm việc nghiêm túc, chu kỳ Pomodoro, chạy deadline và cùng nhau nâng cao năng suất công việc.
            </p>
            <div className="mt-2.5 pt-2 border-t border-indigo-100/80 text-[10px] text-indigo-700 font-medium flex items-center gap-1">
              <span>🎯</span> <span>Pomodoro • Chạy deadline • Năng suất</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Nhập tên phòng */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="create-room-name-input" className="text-xs font-bold text-slate-900">
            2. Tên phòng của bạn <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={handleSuggestRoomName}
            className="text-[11px] text-amber-600 hover:text-amber-700 font-bold flex items-center gap-1 cursor-pointer"
          >
            <span>💡</span> <span>Gợi ý tên hay</span>
          </button>
        </div>
        <input
          id="create-room-name-input"
          type="text"
          value={createRoomName}
          onChange={e => setCreateRoomName(e.target.value)}
          maxLength={80}
          placeholder={
            createRoomType === 'RELAX'
              ? `VD: Trạm Dừng Lofi của ${currentUser?.fullName || 'Đồng Nghiệp'}`
              : `VD: Biệt Đội Chạy Deadline & Pomodoro`
          }
          className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-400 shadow-xs"
        />
        <p className="mt-1 text-[10px] text-slate-400">
          Tên phòng sẽ được hiển thị công khai trên danh sách phòng để các đồng nghiệp tìm thấy và tham gia.
        </p>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={createRoomBusy}
        className="w-full py-3 bg-[#231e36] hover:bg-[#342d4f] disabled:opacity-50 text-white font-black text-xs rounded-xl border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none transition flex items-center justify-center gap-2 cursor-pointer"
      >
        <span>✨</span>
        <span>{createRoomBusy ? 'Đang tạo phòng...' : 'Tạo và Vào Phòng Ngay'}</span>
      </button>
    </form>
  );

  // =========================================================================
  // VIEW A: USER DOES NOT HAVE A ROOM (NO DEPARTMENT JOINED YET)
  // =========================================================================
  if (!currentUser?.department) {
    return (
      <section className="max-w-4xl mx-auto bg-[#fffdfa] border-2 border-slate-900 rounded-3xl shadow-[4px_4px_0px_#0f172a] p-6 sm:p-7 font-sans text-slate-800 space-y-6">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 border-2 border-slate-900 flex items-center justify-center text-slate-950 shadow-[2px_2px_0px_#0f172a] shrink-0">
              <TreePine size={24} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                Khu Vườn & Phòng Chung Sinh Thái
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Khám phá các phòng được yêu thích nhất hoặc tự tạo không gian Thư giãn / Tập trung cho riêng bạn!
              </p>
            </div>
          </div>

          {/* Tab buttons */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setNoDeptTab('BROWSE')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                noDeptTab === 'BROWSE'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Compass size={14} />
              <span>Tìm phòng ({publicRooms.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setNoDeptTab('CREATE')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                noDeptTab === 'CREATE'
                  ? 'bg-amber-400 text-slate-950 shadow-xs border border-amber-500'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Plus size={14} />
              <span>Tạo phòng mới</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {noDeptTab === 'BROWSE' ? renderRoomDiscoveryContent() : renderRoomCreationContent()}
      </section>
    );
  }

  // =========================================================================
  // VIEW B: LOADING GARDEN DATA
  // =========================================================================
  if (isLoading || !gardenData) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 font-sans">
        <div className="animate-spin text-3xl mb-2">🌸</div>
        <div className="text-xs font-semibold">Đang tải Phòng Chung & Khu Vườn...</div>
      </div>
    );
  }

  const inviteCode = currentUser.department.inviteCode || 'TECH01';
  const isRelaxType = currentUser.department.themeId === 'RELAX' || currentUser.department.themeId === 'CHILL';

  // =========================================================================
  // VIEW C: FULL INTERACTIVE GARDEN (AS IN PREVIOUS VERSION + NEW CONTROLS)
  // =========================================================================
  return (
    <div className="max-w-7xl mx-auto space-y-4 font-sans text-slate-800">
      {/* 1. TOP ROOM HEADER */}
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

                {/* Room Type Pill */}
                {isRelaxType ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span>☕</span> <span>Phòng Thư Giãn</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
                    <span>⏱️</span> <span>Phòng Tập Trung</span>
                  </span>
                )}

                <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                  PHÒNG #{inviteCode}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-2xl">
                Không gian chung kết nối đồng nghiệp, cùng chăm sóc thú cưng, thư giãn và tương tác trò chuyện sau giờ làm việc.
              </p>
            </div>
          </div>

          {/* Action buttons: Like room, Browse other rooms, Create room, Copy Code, Change BG, Leave */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Live Like Room Button */}
            <button
              type="button"
              onClick={handleLikeCurrentRoom}
              disabled={isLikingCurrentRoom}
              className={`px-3 py-2 text-xs font-bold rounded-xl border transition flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer ${
                currentRoomHasLiked
                  ? 'bg-rose-50 border-rose-300 text-rose-600 shadow-[0_2px_0_#fda4af]'
                  : 'bg-slate-50 hover:bg-rose-50 border-slate-200 hover:border-rose-200 text-slate-700 hover:text-rose-600'
              }`}
              title={currentRoomHasLiked ? 'Bạn đã thích phòng này (Bấm để bỏ thích)' : 'Bấm để tặng 1 Like cho phòng này!'}
            >
              <Heart
                size={14}
                className={currentRoomHasLiked ? 'text-rose-500 fill-rose-500' : 'text-slate-400'}
              />
              <span>{currentRoomLikes} Thích</span>
            </button>

            {/* Browse rooms button (Opens Room Discovery Modal) */}
            <button
              type="button"
              onClick={() => {
                fetchPublicRooms();
                setShowRoomDiscoveryModal(true);
              }}
              className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              title="Tìm và đổi phòng khác"
            >
              <Compass size={14} className="text-blue-600" />
              <span>Tìm phòng</span>
            </button>

            {/* Create new room button */}
            <button
              type="button"
              onClick={() => setShowCreateRoomModal(true)}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              title="Tạo phòng Thư giãn / Tập trung mới"
            >
              <Plus size={14} className="text-emerald-600" />
              <span>Tạo phòng</span>
            </button>

            {/* Copy invite code */}
            <button
              type="button"
              onClick={copyInviteCode}
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              title="Sao chép mã mời phòng"
            >
              {copiedCode ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>Mã: <strong className="font-mono text-slate-900">{inviteCode}</strong></span>
              {copiedCode && <span className="text-[10px] text-emerald-600 font-bold">(Đã chép)</span>}
            </button>

            {canChangeBackground && (
              <button
                type="button"
                onClick={() => setShowBgSelector(true)}
                className="px-3 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                title="Đổi bối cảnh pixel"
              >
                <ImageIcon size={14} /> <span>Đổi cảnh</span>
              </button>
            )}

            <button
              type="button"
              onClick={fetchGarden}
              className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-xl border border-slate-200 shadow-xs transition cursor-pointer"
              title="Làm mới"
            >
              <RefreshCw size={14} />
            </button>

            <button
              type="button"
              onClick={handleLeaveDepartment}
              className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition cursor-pointer"
              title="Rời phòng chung"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. MEMBERS LIST BAR */}
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
            className="px-3.5 py-1.5 bg-[#231e36] hover:bg-[#332b4f] text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Users size={13} />
            <span>Bạn bè & Tin nhắn riêng</span>
          </button>
        )}
      </div>

      {/* 3. EXP PROGRESS BAR */}
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

      {/* 4. MAIN CANVAS GARDEN STAGE */}
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
            onClick={handleCaptureGardenSnapshot}
            className="px-3 py-1.5 bg-slate-900/70 hover:bg-slate-900/90 backdrop-blur-xs text-white text-xs font-medium rounded-xl border border-white/20 shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Camera size={13} /> <span>Chụp hình</span>
          </button>
          <button
            type="button"
            onClick={handlePlayGardenMusic}
            title="Nghe nhạc Lofi thư giãn"
            className="p-2 bg-slate-900/70 hover:bg-slate-900/90 backdrop-blur-xs text-white rounded-xl border border-white/20 shadow-xs transition cursor-pointer"
          >
            <Music size={13} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen();
              else document.documentElement.requestFullscreen();
            }}
            className="p-2 bg-slate-900/70 hover:bg-slate-900/90 backdrop-blur-xs text-white rounded-xl border border-white/20 shadow-xs transition cursor-pointer"
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
            className="px-4 py-2 bg-slate-900/80 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold backdrop-blur-xs border border-white/20 shadow-md transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <Droplets size={14} className="text-blue-400" />
            <span>Tưới cây vườn</span>
          </button>
          <button
            type="button"
            onClick={handleSendHearts}
            className="px-4 py-2 bg-slate-900/80 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold backdrop-blur-xs border border-white/20 shadow-md transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
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
            className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none rounded-xl text-xs font-bold shadow-md transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <MessageCircle size={14} />
            <span>Nhắn tin phòng</span>
          </button>
        </div>
      </div>

      {/* 5. BOTTOM 2 COLUMNS: Interaction History & Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Nhật Ký Tương Tác Vườn */}
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
                  <strong className="text-slate-900 font-bold">Trần Minh Anh</strong> vừa thu hoạch quả táo năng lượng cùng thú cưng.
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap ml-2">2 phút trước</span>
            </div>

            <div className="flex items-start justify-between text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-rose-500 text-base">💖</span>
                <span className="text-slate-700">
                  <strong className="text-slate-900 font-bold">{currentUser?.fullName || 'Phi Hùng'}</strong> đã gửi lời chào và tim năng lượng đến thú cưng trong phòng (+15 EXP).
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap ml-2">5 phút trước</span>
            </div>

            <div className="flex items-start justify-between text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-blue-500 text-base">🎉</span>
                <span className="text-slate-700">
                  Toàn bộ phòng <strong className="text-slate-900 font-bold">{inviteCode}</strong> hoàn thành chu kỳ Pomodoro tập thể 45 phút!
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap ml-2">14 phút trước</span>
            </div>
          </div>
        </div>

        {/* Right Column: Chat Nhanh */}
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
              className="px-4 py-2 bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center justify-center shrink-0 cursor-pointer"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: ROOM DISCOVERY / FIND ROOM ("Phòng nào được ưa thích thì xếp trên") */}
      {/* ========================================================================= */}
      {showRoomDiscoveryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fffdfa] border-2 border-slate-900 rounded-3xl shadow-[4px_4px_0px_#0f172a] shadow-2xl max-w-3xl w-full p-6 animate-in zoom-in-95 max-h-[90vh] flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 rounded-xl text-amber-800">
                  <Compass size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Khám Phá & Đổi Phòng Chung
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Chọn phòng để chuyển sang khu vườn mới cùng đồng nghiệp!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRoomDiscoveryModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {renderRoomDiscoveryContent()}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE ROOM ("Khi tạo phòng chọn phòng thư giãn hay tập trung")     */}
      {/* ========================================================================= */}
      {showCreateRoomModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fffdfa] border-2 border-slate-900 rounded-3xl shadow-[4px_4px_0px_#0f172a] shadow-2xl max-w-lg w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-400 rounded-xl text-slate-950 font-bold">
                  <Plus size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Tạo Phòng Chung Mới</h3>
                  <p className="text-[11px] text-slate-500">
                    Chọn phòng Thư giãn hoặc Tập trung và đặt tên phòng
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateRoomModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition"
              >
                <X size={18} />
              </button>
            </div>

            {renderRoomCreationContent()}
          </div>
        </div>
      )}

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
                className="px-3.5 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSendGift}
                className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none text-xs font-bold rounded-xl shadow-xs cursor-pointer"
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
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
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
