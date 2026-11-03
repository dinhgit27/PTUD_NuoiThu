import React, { useState, useEffect, useRef } from 'react';
import { PixelPetCanvas } from './PixelPetCanvas';
import { PixelArtBackground, getBackgroundFrameStyle } from './PixelArtBackground';
import { BackgroundThumb } from './BackgroundThumb';
import {
  SharedGardenData,
  GardenBackground,
  UserPet,
  User,
  PublicRoom,
  RoomCategoryInfo,
  RoomTopicId
} from '../types';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import {
  TreePine,
  Image as ImageIcon,
  Users,
  RefreshCw,
  Copy,
  Check,
  Send,
  MessageSquare,
  LogOut,
  Camera,
  Music,
  Maximize2,
  Droplets,
  Heart,
  Clock,
  MessageCircle,
  ThumbsUp,
  Flame,
  PlusCircle,
  Sparkles,
  Crown,
  Search,
  KeyRound,
  LayoutGrid
} from 'lucide-react';

const DEFAULT_ROOM_CATEGORIES: RoomCategoryInfo[] = [
  {
    id: 'WORK',
    label: 'Làm việc',
    icon: '💼',
    description: 'Tập trung làm việc, chạy deadline, coding & năng suất công sở'
  },
  {
    id: 'STUDY',
    label: 'Học tập',
    icon: '📚',
    description: 'Tự học, đọc sách, ôn thi & nghiên cứu tài liệu yên tĩnh'
  },
  {
    id: 'CHILL',
    label: 'Thư giãn',
    icon: '☕',
    description: 'Nghe nhạc Lofi, nghỉ ngơi xả stress & thưởng trà chiều'
  },
  {
    id: 'CREATIVE',
    label: 'Sáng tạo',
    icon: '🎨',
    description: 'Thiết kế, lên ý tưởng, nghệ thuật Pixel & sáng tạo nội dung'
  },
  {
    id: 'SOCIAL',
    label: 'Giao lưu',
    icon: '💬',
    description: 'Trò chuyện vui vẻ, kết bạn đồng nghiệp & khoe thú cưng'
  }
];

const LIKE_REQUIRED_SECONDS = 5 * 60; // 5 minutes (300 seconds)

function formatCountdown(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

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
  const [showRoomDirectoryModal, setShowRoomDirectoryModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Public Room Directory & Categories States
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [categories, setCategories] = useState<RoomCategoryInfo[]>(DEFAULT_ROOM_CATEGORIES);
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<RoomTopicId | 'ALL'>('ALL');
  const [roomSearchQuery, setRoomSearchQuery] = useState('');
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);

  // Create Own Room / Join by Code States
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptTopic, setNewDeptTopic] = useState<RoomTopicId>('WORK');
  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [deptActionError, setDeptActionError] = useState('');
  const [deptActionSuccess, setDeptActionSuccess] = useState('');
  const [deptActionBusy, setDeptActionBusy] = useState(false);

  // Room Like & 5-minute Stay Timer States
  const [secondsInRoom, setSecondsInRoom] = useState<number>(0);
  const [likesCount, setLikesCount] = useState<number>(0);
  const [hasLikedRoom, setHasLikedRoom] = useState<boolean>(false);
  const [isLikingRoom, setIsLikingRoom] = useState<boolean>(false);
  const [likeBannerMsg, setLikeBannerMsg] = useState<string | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  const fetchPublicRooms = async (topic?: RoomTopicId | 'ALL') => {
    try {
      setIsLoadingRooms(true);
      const res = await api.getPublicDepartments(topic ?? selectedTopicFilter);
      if (res.data?.categories) {
        setCategories(res.data.categories);
      }
      setPublicRooms(res.data?.rooms || []);
    } catch (err) {
      console.error('Failed to load public rooms:', err);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  const fetchGarden = async () => {
    try {
      setIsLoading(true);
      const res = await api.getGarden();
      const data: SharedGardenData = res.data;
      setGardenData(data);
      setLikesCount(data.likesCount ?? 0);
      setHasLikedRoom(Boolean(data.hasLiked));
      setSecondsInRoom(data.elapsedSeconds ?? 0);
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
    void fetchPublicRooms(selectedTopicFilter);
  }, [selectedTopicFilter]);

  useEffect(() => {
    if (!currentUser?.department) {
      setIsLoading(false);
      void fetchPublicRooms(selectedTopicFilter);
      return;
    }

    void fetchGarden();
    void fetchBackgrounds();
    void fetchMembers();
    void fetchMessages();

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
      void fetchGarden();
    };

    const handleRoomLiked = (data: { deptId: string; likesCount: number; userName?: string }) => {
      if (data.deptId === currentUser.department?.id) {
        setLikesCount(data.likesCount);
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

  // 1-second timer to track stay duration in the current room for the 5-minute Like requirement
  useEffect(() => {
    if (!currentUser?.department?.id) return;
    const interval = setInterval(() => {
      setSecondsInRoom(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [currentUser?.department?.id]);

  useEffect(() => {
    chatContainerRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roomMessages]);

  const remainingSecondsToLike = Math.max(0, LIKE_REQUIRED_SECONDS - secondsInRoom);
  const canLikeNow = !hasLikedRoom && remainingSecondsToLike === 0;

  const handleLikeRoom = async () => {
    if (isLikingRoom) return;

    if (hasLikedRoom) {
      setLikeBannerMsg('💖 Mỗi người mỗi lần chỉ được 1 Like! Bạn đã tặng Like cho phòng này rồi.');
      setTimeout(() => setLikeBannerMsg(null), 4000);
      return;
    }

    if (remainingSecondsToLike > 0) {
      const mins = Math.floor(remainingSecondsToLike / 60);
      const secs = remainingSecondsToLike % 60;
      setLikeBannerMsg(
        `⏳ Yêu cầu vào phòng hơn 5 phút mới được Like! Bạn cần ở trong phòng thêm ${mins} phút ${secs} giây nữa nhé.`
      );
      setTimeout(() => setLikeBannerMsg(null), 4500);
      return;
    }

    setIsLikingRoom(true);
    try {
      const res = await api.likeDepartment();
      setLikesCount(res.data.likesCount);
      setHasLikedRoom(true);
      setLikeBannerMsg(
        res.data.message || '🎉 Đã tặng 1 Like cho phòng! Phòng được +25 EXP và đẩy lên Top nhiều Like!'
      );
      setTimeout(() => setLikeBannerMsg(null), 5000);
      void fetchGarden();
      void fetchPublicRooms(selectedTopicFilter);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Không thể Like phòng lúc này.';
      if (typeof err?.response?.data?.remainingSeconds === 'number') {
        const serverElapsed = LIKE_REQUIRED_SECONDS - err.response.data.remainingSeconds;
        setSecondsInRoom(Math.max(0, serverElapsed));
      }
      setLikeBannerMsg(`⚠️ ${msg}`);
      setTimeout(() => setLikeBannerMsg(null), 4500);
    } finally {
      setIsLikingRoom(false);
    }
  };

  const copyInviteCode = async () => {
    const code = gardenData?.inviteCode || currentUser?.department?.inviteCode;
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
      void fetchGarden();
    } catch {
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
      void fetchGarden();
      if (onRefreshPet) onRefreshPet();
    } catch {
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
    if (!confirm('Bạn có chắc chắn muốn rời phòng chung này để ra danh sách phòng bên ngoài không?')) return;
    try {
      await api.leaveDepartment();
      if (onMembershipChange) await onMembershipChange();
      void fetchPublicRooms(selectedTopicFilter);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Không thể rời phòng');
    }
  };

  const handleCreateOwnRoom = async (e?: React.FormEvent, quickPersonal = false) => {
    if (e) e.preventDefault();
    if (deptActionBusy) return;

    const selectedCat = categories.find(c => c.id === newDeptTopic) || DEFAULT_ROOM_CATEGORIES[0];
    const roomName = quickPersonal
      ? newDeptName.trim() || `Phòng ${selectedCat.label} của ${currentUser?.fullName || 'Tôi'}`
      : newDeptName.trim();

    if (!roomName) {
      setDeptActionError('Vui lòng nhập tên phòng hoặc bấm "Tạo nhanh phòng của tôi".');
      return;
    }

    setDeptActionBusy(true);
    setDeptActionError('');
    setDeptActionSuccess('');
    try {
      await api.createDepartment(roomName, newDeptTopic, true);
      setNewDeptName('');
      setShowCreateForm(false);
      setShowRoomDirectoryModal(false);
      if (onMembershipChange) await onMembershipChange();
    } catch (err: any) {
      setDeptActionError(err?.response?.data?.error || 'Không thể tạo phòng mới');
    } finally {
      setDeptActionBusy(false);
    }
  };

  const handleJoinRoomByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinInviteCode.trim() || deptActionBusy) return;
    setDeptActionBusy(true);
    setDeptActionError('');
    try {
      await api.joinDepartment(joinInviteCode.trim().toUpperCase());
      setJoinInviteCode('');
      setShowRoomDirectoryModal(false);
      if (onMembershipChange) await onMembershipChange();
    } catch (err: any) {
      setDeptActionError(err?.response?.data?.error || 'Không thể tham gia phòng này');
    } finally {
      setDeptActionBusy(false);
    }
  };

  const handleJoinRoomDirect = async (room: PublicRoom) => {
    if (deptActionBusy) return;
    setDeptActionBusy(true);
    setDeptActionError('');
    try {
      await api.joinDepartment(room.inviteCode, room.id);
      setShowRoomDirectoryModal(false);
      if (onMembershipChange) await onMembershipChange();
    } catch (err: any) {
      setDeptActionError(err?.response?.data?.error || 'Không thể vào phòng này');
    } finally {
      setDeptActionBusy(false);
    }
  };

  const handleJoinHotRoomByTopic = async (topic: RoomTopicId | 'ALL') => {
    if (deptActionBusy) return;
    setDeptActionBusy(true);
    setDeptActionError('');
    try {
      await api.joinHotDepartment(topic);
      setShowRoomDirectoryModal(false);
      if (onMembershipChange) await onMembershipChange();
    } catch (err: any) {
      setDeptActionError(err?.response?.data?.error || 'Không tìm thấy phòng đang hot');
    } finally {
      setDeptActionBusy(false);
    }
  };

  const filteredPublicRooms = publicRooms.filter(room => {
    if (selectedTopicFilter !== 'ALL' && room.themeId !== selectedTopicFilter) return false;
    if (!roomSearchQuery.trim()) return true;
    const q = roomSearchQuery.toLowerCase().trim();
    return (
      room.name.toLowerCase().includes(q) ||
      room.inviteCode.toLowerCase().includes(q) ||
      room.themeLabel.toLowerCase().includes(q)
    );
  });

  // Reusable Room Directory & Creation Content (shown on main page when outside room, or inside modal when in room)
  const renderRoomLobbyAndDirectory = () => (
    <div className="space-y-5">
      {/* 1. TOP HERO BANNER: CREATE ROOM FOR YOURSELF & QUICK HOT JOIN */}
      <div className="bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b-2 border-slate-100">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-400 border-2 border-slate-900 flex items-center justify-center text-slate-950 shadow-[2px_2px_0px_#0f172a] shrink-0">
              <TreePine size={24} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Khu Vườn Chung & Danh Sách Các Phòng Hiện Có
                </h2>
                <span className="text-[10px] font-black px-2.5 py-0.5 bg-amber-100 text-amber-900 rounded-full border border-amber-300">
                  TOP LIKE ĐẨY LÊN ĐẦU
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-2xl">
                Chọn một loại phòng theo chủ đề để tham gia cùng đồng nghiệp, tạo phòng riêng cho chính mình, hoặc gọi{' '}
                <strong className="text-slate-900">"HEY ANY, hãy vào phòng chủ đề làm việc"</strong> để vào ngay phòng đang HOT nhất!
              </p>
            </div>
          </div>

          {/* Primary Buttons: Create Own Room & Join Hottest Work Room */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowCreateForm(prev => !prev)}
              className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none transition flex items-center gap-1.5"
            >
              <PlusCircle size={15} />
              <span>{showCreateForm ? 'Đóng khung tạo phòng' : 'Tạo phòng cho chính mình'}</span>
            </button>

            <button
              type="button"
              disabled={deptActionBusy}
              onClick={() => void handleCreateOwnRoom(undefined, true)}
              className="px-4 py-2.5 bg-[#231e36] hover:bg-[#332b4f] text-amber-300 font-black text-xs rounded-xl border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none transition flex items-center gap-1.5"
              title="Khởi tạo ngay phòng riêng mang tên bạn với 1 cú nhấp"
            >
              <Sparkles size={14} />
              <span>Tạo nhanh phòng của tôi</span>
            </button>
          </div>
        </div>

        {deptActionError && (
          <p
            role="alert"
            className="mt-4 p-3 bg-rose-50 border-2 border-rose-300 rounded-xl text-xs text-rose-700 font-bold"
          >
            {deptActionError}
          </p>
        )}
        {deptActionSuccess && (
          <p
            role="status"
            className="mt-4 p-3 bg-emerald-50 border-2 border-emerald-300 rounded-xl text-xs text-emerald-800 font-bold"
          >
            {deptActionSuccess}
          </p>
        )}

        {/* EXPANDABLE / VISIBLE FORM: CREATE OWN ROOM + JOIN BY INVITE CODE */}
        <div className={`grid gap-4 sm:grid-cols-12 mt-5 ${showCreateForm ? 'block' : 'hidden sm:grid'}`}>
          {/* Left 7 cols: Tạo Phòng Cho Chính Mình (with Topic Selection) */}
          <form
            onSubmit={e => void handleCreateOwnRoom(e, false)}
            className="sm:col-span-7 rounded-2xl border-2 border-slate-900 bg-[#f7f2e7] p-4 shadow-[2px_2px_0px_#0f172a] flex flex-col justify-between space-y-3"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                  <PlusCircle size={15} className="text-amber-600" />
                  <span>Tạo Phòng Cho Chính Mình</span>
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    const cat = categories.find(c => c.id === newDeptTopic) || DEFAULT_ROOM_CATEGORIES[0];
                    setNewDeptName(`Phòng ${cat.label} của ${currentUser?.fullName || 'Tôi'}`);
                  }}
                  className="text-[10px] font-bold text-blue-700 hover:underline bg-blue-50 px-2 py-0.5 rounded border border-blue-200"
                >
                  + Điền tên mẫu của tôi
                </button>
              </div>

              {/* Chọn Loại Phòng / Chủ Đề Phòng */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  1. Chọn loại phòng (Chủ đề phòng) <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setNewDeptTopic(cat.id)}
                      className={`px-2 py-1.5 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition ${
                        newDeptTopic === cat.id
                          ? 'bg-[#231e36] text-amber-300 border-2 border-slate-900 font-black shadow-[0_2px_0_#0f172a]'
                          : 'bg-white hover:bg-amber-50 text-slate-700 border-slate-300'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span className="truncate">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Nhập Tên Phòng */}
              <div>
                <label htmlFor="dept-name-input" className="block text-[11px] font-bold text-slate-700 mb-1">
                  2. Tên phòng của bạn <span className="text-rose-500">*</span>
                </label>
                <input
                  id="dept-name-input"
                  type="text"
                  value={newDeptName}
                  onChange={e => setNewDeptName(e.target.value)}
                  maxLength={80}
                  placeholder={`VD: Phòng Làm Việc của ${currentUser?.fullName || 'Phi Hùng'}`}
                  className="w-full rounded-xl border-2 border-slate-300 focus:border-slate-900 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 focus:outline-hidden"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={deptActionBusy}
              className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none transition"
            >
              {deptActionBusy ? 'Đang khởi tạo...' : '🚀 Tạo Phòng Của Tôi Ngay'}
            </button>
          </form>

          {/* Right 5 cols: Vào bằng Mã Mời hoặc Tìm Phòng HOT Theo Chủ Đề */}
          <div className="sm:col-span-5 rounded-2xl border-2 border-slate-900 bg-[#f7f2e7] p-4 shadow-[2px_2px_0px_#0f172a] flex flex-col justify-between space-y-3">
            <form onSubmit={handleJoinRoomByCode} className="space-y-2.5">
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                <KeyRound size={15} className="text-blue-600" />
                <span>Vào Phòng Bằng Mã Mời</span>
              </h3>
              <p className="text-[11px] text-slate-600">
                Nhập mã mời phòng (VD: <code className="font-mono font-bold text-slate-900">WORK01</code>,{' '}
                <code className="font-mono font-bold text-slate-900">TECH01</code>) để vào thẳng phòng.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinInviteCode}
                  onChange={e => setJoinInviteCode(e.target.value.toUpperCase())}
                  placeholder="Nhập mã phòng (VD: WORK01)"
                  className="flex-1 rounded-xl border-2 border-slate-300 focus:border-slate-900 bg-white px-3 py-2 text-xs uppercase font-mono font-bold tracking-wider focus:outline-hidden"
                />
                <button
                  type="submit"
                  disabled={deptActionBusy || !joinInviteCode.trim()}
                  className="px-4 py-2 bg-[#231e36] hover:bg-[#332b4f] disabled:opacity-50 text-white font-black text-xs rounded-xl border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none transition shrink-0"
                >
                  Vào ngay
                </button>
              </div>
            </form>

            <div className="pt-3 border-t border-slate-300/80 space-y-2">
              <div className="text-[11px] font-black text-slate-800 flex items-center gap-1.5">
                <Flame size={14} className="text-rose-500 fill-rose-500" />
                <span>Vào nhanh phòng đang HOT theo chủ đề:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    disabled={deptActionBusy}
                    onClick={() => void handleJoinHotRoomByTopic(cat.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-amber-100 border border-slate-300 hover:border-slate-900 text-[11px] font-bold text-slate-800 transition flex items-center gap-1 shadow-2xs"
                  >
                    <span>{cat.icon}</span>
                    <span>Hot {cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. DANH SÁCH CÁC LOẠI PHÒNG (TOPIC CATEGORY TABS) & SEARCH */}
      <div className="bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <LayoutGrid size={16} className="text-amber-600" />
            <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
              Danh Sách Các Loại Phòng (Chủ Đề)
            </h3>
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={roomSearchQuery}
              onChange={e => setRoomSearchQuery(e.target.value)}
              placeholder="Tìm tên phòng hoặc mã #..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border-2 border-slate-300 focus:border-slate-900 bg-slate-50 focus:bg-white text-xs font-medium focus:outline-hidden"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedTopicFilter('ALL')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black border-2 transition flex items-center gap-1.5 ${
              selectedTopicFilter === 'ALL'
                ? 'bg-amber-400 text-slate-950 border-slate-900 shadow-[0_2px_0_#0f172a]'
                : 'bg-white hover:bg-amber-50 text-slate-700 border-slate-300'
            }`}
          >
            <Flame size={14} className="text-rose-600 fill-rose-500" />
            <span>Tất cả phòng ({publicRooms.length})</span>
          </button>

          {categories.map(cat => {
            const isSelected = selectedTopicFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedTopicFilter(cat.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border-2 transition flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#231e36] text-amber-300 border-slate-900 font-black shadow-[0_2px_0_#0f172a]'
                    : 'bg-white hover:bg-amber-50 text-slate-700 border-slate-300'
                }`}
              >
                <span>{cat.icon}</span>
                <span>Chủ đề: {cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Category Description & Quick Hot Button */}
        {selectedTopicFilter !== 'ALL' && (
          <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-300 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-base">
                {categories.find(c => c.id === selectedTopicFilter)?.icon}
              </span>
              <span className="font-bold text-slate-800">
                {categories.find(c => c.id === selectedTopicFilter)?.description}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void handleJoinHotRoomByTopic(selectedTopicFilter)}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-lg border border-slate-900 shadow-[0_2px_0_#000] flex items-center gap-1.5"
            >
              <Flame size={13} className="fill-amber-300 text-amber-300" />
              <span>
                Vào ngay phòng {categories.find(c => c.id === selectedTopicFilter)?.label} đang HOT nhất
              </span>
            </button>
          </div>
        )}
      </div>

      {/* 3. DANH SÁCH CÁC PHÒNG HIỆN CÓ (RANKED BY TOP LIKES FIRST!) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Crown size={17} className="text-amber-500 fill-amber-400" />
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Bảng Xếp Hạng Các Phòng Hiện Có (Xếp theo lượt Like cao nhất)
            </h3>
          </div>
          <button
            type="button"
            onClick={() => void fetchPublicRooms(selectedTopicFilter)}
            className="text-xs font-bold text-slate-600 hover:text-slate-950 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300"
          >
            <RefreshCw size={12} className={isLoadingRooms ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>

        {isLoadingRooms ? (
          <div className="p-10 text-center bg-[#fffdfa] border-2 border-slate-900 rounded-2xl text-xs font-bold text-slate-500">
            Đang tải danh sách các phòng hiện có...
          </div>
        ) : filteredPublicRooms.length === 0 ? (
          <div className="p-10 text-center bg-[#fffdfa] border-2 border-slate-900 rounded-2xl space-y-2">
            <div className="text-sm font-black text-slate-800">Chưa có phòng nào thuộc bộ lọc này</div>
            <p className="text-xs text-slate-500">
              Hãy nhấn "Tạo phòng cho chính mình" ở trên để mở phòng đầu tiên cho chủ đề này nhé!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPublicRooms.map((room, idx) => {
              const isTop1 = idx === 0;
              const isTop2 = idx === 1;
              const isTop3 = idx === 2;
              const isMyCurrentRoom = currentUser?.department?.id === room.id;

              return (
                <div
                  key={room.id}
                  className={`rounded-2xl border-2 border-slate-900 overflow-hidden flex flex-col justify-between transition hover:-translate-y-0.5 ${
                    isTop1
                      ? 'bg-gradient-to-b from-amber-50/90 to-[#fffdfa] shadow-[4px_4px_0px_#0f172a] ring-2 ring-amber-400'
                      : 'bg-[#fffdfa] shadow-[3px_3px_0px_#0f172a]'
                  }`}
                >
                  <div>
                    {/* Room Background Preview Header */}
                    <div className="relative h-32 w-full overflow-hidden border-b-2 border-slate-900 bg-slate-900">
                      <BackgroundThumb
                        imageUrl={room.background?.imageUrl || '/backgrounds/garden_spring.png'}
                        thumbnailUrl={room.background?.thumbnailUrl}
                        name={room.name}
                        animationFrames={room.background?.animationFrames}
                        animationFps={room.background?.animationFps}
                        animationColumns={room.background?.animationColumns}
                        animationRows={room.background?.animationRows}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />

                      {/* Top-Left Rank / Hot Badge */}
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                        {isTop1 ? (
                          <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-black text-[10px] border-2 border-slate-950 shadow-[1px_1px_0_#000] flex items-center gap-1">
                            <Crown size={12} className="fill-slate-950" />
                            TOP 1 NHIỀU LIKE • HOT
                          </span>
                        ) : isTop2 ? (
                          <span className="px-2.5 py-1 rounded-lg bg-rose-500 text-white font-black text-[10px] border-2 border-slate-950 shadow-[1px_1px_0_#000] flex items-center gap-1">
                            <Flame size={12} className="fill-amber-300 text-amber-300" />
                            TOP 2 ĐANG HOT
                          </span>
                        ) : isTop3 ? (
                          <span className="px-2.5 py-1 rounded-lg bg-orange-500 text-white font-black text-[10px] border-2 border-slate-950 shadow-[1px_1px_0_#000] flex items-center gap-1">
                            <Flame size={12} />
                            TOP 3 YÊU THÍCH
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-slate-900/80 text-white font-bold text-[10px] border border-white/20">
                            Hạng #{idx + 1}
                          </span>
                        )}
                      </div>

                      {/* Top-Right Likes Counter Pill */}
                      <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-xl bg-rose-600 text-white font-black text-xs border-2 border-slate-950 shadow-[2px_2px_0_#000] flex items-center gap-1">
                        <Heart size={13} className="fill-white text-white" />
                        <span>{room.likesCount} Like</span>
                      </div>

                      {/* Bottom-Left Topic & Code inside Banner */}
                      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg bg-[#231e36]/95 text-amber-300 font-black text-[10px] border border-amber-400/40">
                          {room.themeIcon} Chủ đề: {room.themeLabel}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white/90 text-slate-900 font-mono font-black text-[10px]">
                          #{room.inviteCode}
                        </span>
                      </div>
                    </div>

                    {/* Room Card Details */}
                    <div className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-black text-sm text-slate-900 leading-snug line-clamp-1">
                          {room.name}
                        </h4>
                        {isMyCurrentRoom && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-black text-[10px] rounded border border-emerald-300 shrink-0">
                            Đang ở đây
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 font-semibold">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                          <Users size={12} className="text-blue-600" />
                          <span>{room.memberCount} thành viên</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900">
                          🌱 Vườn Lv.{room.gardenLevel} ({room.gardenExp} EXP)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Button */}
                  <div className="px-4 pb-4 pt-1">
                    <button
                      type="button"
                      disabled={deptActionBusy}
                      onClick={() => void handleJoinRoomDirect(room)}
                      className={`w-full py-2.5 rounded-xl font-black text-xs border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none transition flex items-center justify-center gap-1.5 ${
                        isMyCurrentRoom
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                          : isTop1
                          ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                          : 'bg-[#231e36] hover:bg-[#332b4f] text-white'
                      }`}
                    >
                      <span>{isMyCurrentRoom ? 'Đang ở trong phòng này' : 'Vào phòng ngay'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ============================================================================
  // CASE 1: USER HAS NOT JOINED ANY ROOM YET -> SHOW ROOM LOBBY & TOP LIKED LIST
  // ============================================================================
  if (!currentUser?.department) {
    return <div className="max-w-7xl mx-auto font-sans text-slate-800">{renderRoomLobbyAndDirectory()}</div>;
  }

  // ============================================================================
  // CASE 2: USER IS INSIDE A ROOM -> SHOW GARDEN + 5-MIN LIKE BUTTON + DIRECTORY MODAL
  // ============================================================================
  if (isLoading || !gardenData) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 font-sans">
        <div className="animate-spin text-3xl mb-2">🌸</div>
        <div className="text-xs font-semibold">Đang tải Phòng Chung & Khu Vườn...</div>
      </div>
    );
  }

  const inviteCode = gardenData.inviteCode || currentUser.department.inviteCode || 'TECH01';
  const themeLabel = gardenData.themeLabel || 'Làm việc';
  const themeIcon = gardenData.themeIcon || '💼';

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
                <span className="text-[10px] font-black px-2.5 py-0.5 bg-[#231e36] text-amber-300 rounded-full border border-slate-900">
                  {themeIcon} Chủ đề: {themeLabel}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                  PHÒNG #{inviteCode}
                </span>
                <span className="text-[10px] font-black text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200 flex items-center gap-1">
                  <Heart size={11} className="fill-rose-500 text-rose-500" />
                  <span>{likesCount} Like</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-2xl">
                Ở trong phòng trên 5 phút để mở khóa nút <strong>Like phòng</strong> (mỗi người 1 Like) giúp đẩy phòng lên Top thịnh hành!
              </p>
            </div>
          </div>

          {/* Action buttons: Like Room (5-min rule), Browse/Switch Rooms, Copy Code, Change BG, Leave Room */}
          <div className="flex flex-wrap items-center gap-2">
            {/* LIKE ROOM BUTTON WITH 5-MINUTE REQUIREMENT */}
            <button
              type="button"
              onClick={() => void handleLikeRoom()}
              disabled={isLikingRoom}
              title={
                hasLikedRoom
                  ? 'Bạn đã tặng 1 Like cho phòng này'
                  : remainingSecondsToLike > 0
                  ? `Cần ở trong phòng hơn 5 phút mới được Like (còn ${formatCountdown(remainingSecondsToLike)})`
                  : 'Nhấn để tặng 1 Like cho phòng (+25 EXP vườn)'
              }
              className={`px-3.5 py-2 rounded-xl border-2 border-slate-900 text-xs font-black shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none transition flex items-center gap-1.5 ${
                hasLikedRoom
                  ? 'bg-rose-100 text-rose-800 border-rose-400'
                  : canLikeNow
                  ? 'bg-rose-500 hover:bg-rose-400 text-white animate-pulse'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <ThumbsUp size={14} className={hasLikedRoom || canLikeNow ? 'fill-current' : ''} />
              {hasLikedRoom ? (
                <span>Đã Like ({likesCount}) ❤️</span>
              ) : canLikeNow ? (
                <span>Like phòng (+1) • {likesCount} ❤️</span>
              ) : (
                <span>
                  Like ({likesCount}) • ⏳ {formatCountdown(remainingSecondsToLike)}
                </span>
              )}
            </button>

            {/* Open Room Directory / Create Own Room Modal */}
            <button
              type="button"
              onClick={() => {
                void fetchPublicRooms(selectedTopicFilter);
                setShowRoomDirectoryModal(true);
              }}
              className="px-3.5 py-2 bg-[#231e36] hover:bg-[#332b4f] text-amber-300 text-xs font-black rounded-xl border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none flex items-center gap-1.5 transition"
            >
              <LayoutGrid size={14} />
              <span>Danh sách phòng & Tạo phòng</span>
            </button>

            <button
              type="button"
              onClick={copyInviteCode}
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 shadow-xs flex items-center gap-1.5 transition active:scale-95"
              title="Sao chép mã mời phòng ban"
            >
              {copiedCode ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>
                Mã: <strong className="font-mono text-slate-900">{inviteCode}</strong>
              </span>
            </button>

            {canChangeBackground && (
              <button
                type="button"
                onClick={() => setShowBgSelector(true)}
                className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
                title="Đổi bối cảnh pixel"
              >
                <ImageIcon size={14} /> <span>Đổi cảnh</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void fetchGarden()}
              className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-xl border border-slate-200 shadow-xs transition"
              title="Làm mới"
            >
              <RefreshCw size={14} />
            </button>

            <button
              type="button"
              onClick={() => void handleLeaveDepartment()}
              className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 text-xs font-bold flex items-center gap-1 transition"
              title="Rời phòng ra ngoài danh sách phòng"
            >
              <LogOut size={14} />
              <span>Rời phòng</span>
            </button>
          </div>
        </div>

        {/* Like Status Notification Banner */}
        {likeBannerMsg && (
          <div className="mt-3 p-3 rounded-xl bg-amber-50 border-2 border-slate-900 text-xs font-bold text-slate-900 flex items-center justify-between">
            <span>{likeBannerMsg}</span>
            <button
              type="button"
              onClick={() => setLikeBannerMsg(null)}
              className="text-slate-500 hover:text-slate-900 font-black ml-2"
            >
              ✕
            </button>
          </div>
        )}
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
                <span className="text-slate-500 font-normal">• 🐾 {member.userPet.name}</span>
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
        className="relative w-full h-[460px] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] overflow-hidden select-none"
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
          animationColumns={
            gardenData.background?.animationColumns || gardenData.background?.animationFrames || 1
          }
          animationRows={gardenData.background?.animationRows || 1}
        />

        {/* Top Badges inside Canvas */}
        <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2 z-20">
          <div className="bg-slate-900/75 backdrop-blur-xs text-white px-3 py-1.5 rounded-xl text-xs font-medium border border-white/20 shadow-xs flex items-center gap-1.5">
            <span>📍</span>
            <span>{gardenData.background?.name || 'Khu Vườn Mùa Xuân'}</span>
          </div>
          <div className="bg-slate-900/75 backdrop-blur-xs text-amber-300 px-3 py-1.5 rounded-xl text-xs font-bold border border-white/20 shadow-xs flex items-center gap-1.5">
            <Clock size={13} />
            <span>
              Thời gian ở phòng: {Math.floor(secondsInRoom / 60)}p {secondsInRoom % 60}s
            </span>
          </div>
        </div>

        <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
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
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-2.5 z-20 w-full px-4">
          <button
            type="button"
            onClick={() => void handleLikeRoom()}
            className={`px-4 py-2 rounded-xl text-xs font-black border-2 border-slate-950 shadow-md transition active:scale-95 flex items-center gap-1.5 ${
              hasLikedRoom
                ? 'bg-rose-600 text-white'
                : canLikeNow
                ? 'bg-rose-500 hover:bg-rose-400 text-white animate-bounce'
                : 'bg-slate-900/85 hover:bg-slate-900 text-amber-300 border-white/20'
            }`}
          >
            <ThumbsUp size={14} />
            {hasLikedRoom ? (
              <span>Đã Like Phòng ({likesCount})</span>
            ) : canLikeNow ? (
              <span>Like Phòng Ngay (+1)</span>
            ) : (
              <span>Like Phòng (đợi {formatCountdown(remainingSecondsToLike)})</span>
            )}
          </button>

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
              const inputEl = document.querySelector(
                'input[placeholder*="Gửi tin nhắn"]'
              ) as HTMLInputElement;
              if (inputEl) inputEl.focus();
            }}
            className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none rounded-xl text-xs font-bold transition active:scale-95 flex items-center gap-1.5"
          >
            <MessageCircle size={14} />
            <span>Nhắn tin phòng</span>
          </button>
        </div>
      </div>

      {/* 5. BOTTOM 2 COLUMNS: Real-time Interaction History & Quick Room Chat */}
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
                <span className="text-rose-500 text-base">❤️</span>
                <span className="text-slate-700">
                  Phòng <strong className="text-slate-900 font-bold">{gardenData.departmentName}</strong> hiện đang có{' '}
                  <strong className="text-rose-600 font-black">{likesCount} lượt Like</strong> trong chủ đề{' '}
                  <strong>{themeLabel}</strong>.
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap ml-2">Vừa xong</span>
            </div>

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

      {/* Modal: Room Directory & Create Room (when user is already inside a room and wants to browse/switch/create) */}
      {showRoomDirectoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#f5efe6] border-3 border-slate-950 rounded-2xl shadow-[5px_5px_0px_#000] max-w-6xl w-full max-h-[90vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
              <div className="flex items-center gap-2">
                <Crown size={18} className="text-amber-500" />
                <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase">
                  Danh Sách Các Phòng Hiện Có & Tạo Phòng Riêng
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRoomDirectoryModal(false)}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-lg border-2 border-slate-950"
              >
                Đóng ✕
              </button>
            </div>
            {renderRoomLobbyAndDirectory()}
          </div>
        </div>
      )}

      {/* Modal Gift for colleague pet */}
      {selectedPetToGift && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] max-w-sm w-full p-5 animate-in zoom-in-95">
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
                onClick={() => void handleSendGift()}
                className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none text-xs font-bold rounded-xl"
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
          <div className="bg-[#fffdfa] border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_#0f172a] max-w-2xl w-full p-6 animate-in zoom-in-95">
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
                  onClick={() => void handleChangeBackground(bg.id)}
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
