import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  UserPlus,
  MessageCircle,
  Search,
  X,
  Send,
  Trash2,
  Heart,
  CheckCircle2,
  Gift,
  Copy,
  Clock,
  Flame,
  TreePine,
  Smile,
  PawPrint,
  MoreVertical,
  Sparkles,
  Award
} from 'lucide-react';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import { User } from '../types';

interface FriendUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  role: string;
  department?: { id: string; name: string };
  userPet?: {
    id: string;
    name: string;
    level: number;
    currentState: string;
    petType?: { name: string; previewUrl: string };
  };
  friendshipStatus?: 'NONE' | 'FRIEND' | 'PENDING';
  isOnline?: boolean;
  statusText?: string;
  pomodoroTime?: string;
  focusMinutes?: number;
}

interface DirectMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  senderName?: string;
  isGift?: boolean;
}

interface FriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
}

// Sample fallback friends if the real database only has 1 or 2 users
const DEMO_FRIENDS: FriendUser[] = [
  {
    id: 'demo-friend-1',
    email: 'minhanh.tran@techcorp.com',
    fullName: 'Trần Minh Anh',
    role: 'USER',
    department: { id: 'd1', name: 'Phòng Kỹ Thuật & Phần Mềm' },
    userPet: {
      id: 'p1',
      name: 'Bento Boy',
      level: 3,
      currentState: 'TYPING',
      petType: { name: 'Bento Boy', previewUrl: '/sprites/bento/idle_1.png' }
    },
    isOnline: true,
    statusText: 'Đang gõ phím Pomodoro (18:42)',
    pomodoroTime: '18:42',
    focusMinutes: 120
  },
  {
    id: 'demo-friend-2',
    email: 'thuha.le@techcorp.com',
    fullName: 'Lê Thu Hà',
    role: 'USER',
    department: { id: 'd2', name: 'Phòng Thiết Kế & Sáng Tạo' },
    userPet: {
      id: 'p2',
      name: 'Thỏ Bông',
      level: 2,
      currentState: 'IDLE',
      petType: { name: 'Thỏ Bông', previewUrl: '/sprites/bunny/idle_1.png' }
    },
    isOnline: false,
    statusText: 'Vừa hoàn thành 25p Lập trình Frontend (15p trước)',
    pomodoroTime: '25:00',
    focusMinutes: 85
  },
  {
    id: 'demo-friend-3',
    email: 'quocbao.nguyen@techcorp.com',
    fullName: 'Nguyễn Quốc Bảo',
    role: 'USER',
    department: { id: 'd3', name: 'Phòng Vận Hành & Hạ Tầng' },
    userPet: {
      id: 'p3',
      name: 'Hamster Ong Vàng',
      level: 2,
      currentState: 'HAPPY',
      petType: { name: 'Hamster Ong Vàng', previewUrl: '/sprites/hamster/idle_1.png' }
    },
    isOnline: true,
    statusText: 'Đang nghe nhạc Lofi Study',
    pomodoroTime: '12:15',
    focusMinutes: 60
  },
  {
    id: 'demo-friend-4',
    email: 'hoangyen.vo@techcorp.com',
    fullName: 'Võ Hoàng Yến',
    role: 'USER',
    department: { id: 'd4', name: 'Phòng Truyền Thông & Nhân Sự' },
    userPet: {
      id: 'p4',
      name: 'Mochi Neko',
      level: 1,
      currentState: 'DANCING',
      petType: { name: 'Mochi Neko', previewUrl: '/sprites/cat/idle_1.png' }
    },
    isOnline: true,
    statusText: 'Đang ghé thăm Vườn Chung Công Sở',
    pomodoroTime: '05:30',
    focusMinutes: 45
  }
];

export const FriendsModal: React.FC<FriendsModalProps> = ({ isOpen, onClose, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'FRIENDS' | 'REQUESTS'>('FRIENDS');
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [searchResults, setSearchResults] = useState<FriendUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeFriend, setActiveFriend] = useState<FriendUser | null>(null);
  const [chatMessages, setChatMessages] = useState<DirectMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchFriends = async () => {
    try {
      const res = await api.getFriends();
      const realFriends: FriendUser[] = res.data || [];
      // If user has real friends, use them; supplement with demo friends to show rich UI if fewer than 4
      if (realFriends.length >= 4) {
        setFriends(realFriends);
        if (!activeFriend && realFriends[0]) {
          setActiveFriend(realFriends[0]);
        }
      } else {
        const merged = [...realFriends];
        for (const demo of DEMO_FRIENDS) {
          if (!merged.some(f => f.id === demo.id || f.email === demo.email)) {
            merged.push(demo);
          }
        }
        setFriends(merged);
        if (!activeFriend && merged[0]) {
          setActiveFriend(merged[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load friends:', err);
      setFriends(DEMO_FRIENDS);
      if (!activeFriend) setActiveFriend(DEMO_FRIENDS[0]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void fetchFriends();
      const socket = getSocket();
      socket.emit('join_user', currentUser.id);

      const handleDirectMessage = (msg: DirectMessage) => {
        setChatMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          if (
            (msg.senderId === activeFriend?.id && msg.receiverId === currentUser.id) ||
            (msg.senderId === currentUser.id && msg.receiverId === activeFriend?.id)
          ) {
            return [...prev, msg];
          }
          return prev;
        });
      };

      const handleFriendUpdate = () => {
        void fetchFriends();
      };

      socket.on('direct_message', handleDirectMessage);
      socket.on('friend_update', handleFriendUpdate);

      return () => {
        socket.off('direct_message', handleDirectMessage);
        socket.off('friend_update', handleFriendUpdate);
      };
    }
  }, [isOpen, activeFriend?.id, currentUser.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Load chat messages when selecting friend
  const selectFriend = async (friend: FriendUser) => {
    setActiveFriend(friend);
    if (friend.id.startsWith('demo-')) {
      // Mock initial friendly dialogue
      setChatMessages([
        {
          id: 'demo-msg-1',
          senderId: friend.id,
          receiverId: currentUser.id,
          content: 'Chào Hùng! Chiều nay mình cùng chạy 2 phiên Pomodoro môn CSDL nhé? ☕',
          isRead: true,
          createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString()
        },
        {
          id: 'demo-gift-1',
          senderId: friend.id,
          receiverId: currentUser.id,
          content: `${friend.fullName} đã gửi tặng bạn 1 Cà Rốt Tăng Lực khi cùng chạy Pomodoro 45 phút! Nhận +5 EXP ✨`,
          isRead: true,
          createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
          isGift: true
        },
        {
          id: 'demo-msg-2',
          senderId: currentUser.id,
          receiverId: friend.id,
          content: 'Ok Minh Anh! Mình vừa chuẩn bị xong tài liệu rồi, bắt đầu ngay nhé! 🚀',
          isRead: true,
          createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString()
        }
      ]);
      return;
    }

    try {
      const res = await api.getDirectMessages(friend.id);
      setChatMessages(res.data || []);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await api.searchUsers(searchQuery.trim());
      setSearchResults(res.data || []);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddFriend = async (friendId: string) => {
    try {
      const res = await api.addFriend(friendId);
      setNotice(res.data.message || 'Đã kết bạn thành công!');
      setTimeout(() => setNotice(''), 3000);
      void fetchFriends();
      setSearchResults(prev =>
        prev.map(u => (u.id === friendId ? { ...u, friendshipStatus: 'FRIEND' } : u))
      );
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Không thể kết bạn');
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!confirm('Bạn có chắc chắn muốn hủy kết bạn không?')) return;
    try {
      await api.removeFriend(friendId);
      void fetchFriends();
      if (activeFriend?.id === friendId) {
        setActiveFriend(null);
      }
    } catch (err: any) {
      alert('Không thể hủy kết bạn.');
    }
  };

  const sendMessageContent = async (content: string, isGift = false) => {
    if (!activeFriend || !content.trim()) return;
    const newMsg: DirectMessage = {
      id: `local-${Date.now()}`,
      senderId: currentUser.id,
      receiverId: activeFriend.id,
      content: content.trim(),
      isRead: false,
      createdAt: new Date().toISOString(),
      isGift
    };

    setChatMessages(prev => [...prev, newMsg]);

    if (!activeFriend.id.startsWith('demo-')) {
      try {
        await api.sendDirectMessage(activeFriend.id, content.trim());
      } catch (err: any) {
        console.warn('Could not deliver message via API:', err);
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || isSending) return;
    setIsSending(true);
    await sendMessageContent(messageInput);
    setMessageInput('');
    setIsSending(false);
  };

  const handleSendGift = () => {
    if (!activeFriend) return;
    const giftContent = `🎁 Đã gửi tặng ${activeFriend.fullName} 10 EXP năng lượng đồng hành Pomodoro! Chúc bạn học tập vui vẻ! ✨`;
    void sendMessageContent(giftContent, true);
    setNotice(`Đã tặng 10 EXP năng lượng cho ${activeFriend.fullName}! 🎉`);
    setTimeout(() => setNotice(''), 3000);
  };

  const handleInviteToGarden = () => {
    if (!activeFriend) return;
    void sendMessageContent(`🌿 Mời ${activeFriend.fullName} cùng ghé thăm Khu Vườn Chung với mình nhé!`);
    setNotice(`Đã gửi lời mời ghé vườn tới ${activeFriend.fullName}!`);
    setTimeout(() => setNotice(''), 3000);
  };

  const myFriendCode = currentUser?.id
    ? `OP-${currentUser.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}`
    : 'OP-PETS';

  const copyFriendCode = () => {
    navigator.clipboard?.writeText(myFriendCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (!isOpen) return null;

  const onlineFriendsCount = friends.filter(f => f.isOnline !== false).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="relative bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-5xl w-full h-[90vh] max-h-[720px] flex flex-col overflow-hidden animate-in zoom-in-95 text-slate-800 font-sans">
        {/* Main Header Navy Banner */}
        <div className="bg-[#1b365d] text-white px-5 py-3.5 border-b border-[#142845] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-400 text-slate-950 rounded-2xl shadow-xs">
              <Users size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-extrabold tracking-tight">
                  Bạn Bè & Tin Nhắn Đồng Hành
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/30 text-amber-300 font-bold text-[10px] uppercase border border-amber-400/30">
                  BẠN BÈ CÔNG SỞ
                </span>
              </div>
              <p className="text-xs text-blue-100/80 mt-0.5">
                Kết nối với đồng nghiệp trong công ty, cùng tập trung Pomodoro và chăm sóc thú cưng
              </p>
            </div>
          </div>

          {/* Stats Pills & Close */}
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-2 text-xs font-semibold">
              <span className="px-2.5 py-1 rounded-full bg-white/10 text-white border border-white/15">
                {friends.length} Bạn bè
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white/10 text-amber-300 border border-white/15">
                1 Lời mời
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {onlineFriendsCount} Đang online
              </span>
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-white/15 rounded-xl text-slate-200 hover:text-white transition"
              aria-label="Đóng"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Sub-Header: Search bar, my friend code, Tabs */}
        <div className="bg-slate-50 border-b border-slate-200/90 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Tabs */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setActiveTab('FRIENDS');
                setIsSearchOpen(false);
              }}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition ${
                activeTab === 'FRIENDS' && !isSearchOpen
                  ? 'bg-[#1b365d] text-white shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              Bạn bè ({friends.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('REQUESTS');
                setIsSearchOpen(false);
              }}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition ${
                activeTab === 'REQUESTS'
                  ? 'bg-[#1b365d] text-white shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              Yêu cầu kết bạn (1)
            </button>
          </div>

          {/* Search trigger & Friend code */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-xl text-slate-600 font-mono text-[11px]">
              <span className="text-slate-400">Mã của bạn:</span>
              <strong className="text-slate-900">{myFriendCode}</strong>
              <button
                type="button"
                onClick={copyFriendCode}
                className="text-amber-600 hover:text-amber-700 font-bold inline-flex items-center gap-0.5 ml-1"
                title="Sao chép mã kết bạn"
              >
                <Copy size={11} /> {copiedCode ? 'Đã chép!' : 'Sao chép'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95"
            >
              <UserPlus size={14} />
              <span>+ Thêm bạn</span>
            </button>
          </div>
        </div>

        {/* Notice alert */}
        {notice && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2 text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span className="font-semibold">{notice}</span>
          </div>
        )}

        {/* Search Collapsible Panel */}
        {isSearchOpen && (
          <div className="bg-slate-100/90 border-b border-slate-200 p-4 space-y-3 animate-in slide-in-from-top-3">
            <form onSubmit={handleSearch} className="flex gap-2 max-w-xl mx-auto">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo họ tên hoặc mã nhân viên (VD: NV102, Phi Hùng)..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-[#1b365d]/20 focus:border-[#1b365d]"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="px-4 py-2 bg-[#1b365d] hover:bg-[#142947] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition"
              >
                {isSearching ? 'Đang tìm...' : 'Tìm kiếm'}
              </button>
            </form>

            {searchResults.length > 0 && (
              <div className="max-w-xl mx-auto space-y-2">
                {searchResults.map(user => (
                  <div
                    key={user.id}
                    className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900">{user.fullName}</div>
                      <div className="text-[11px] text-slate-500">{user.email}</div>
                    </div>
                    {user.friendshipStatus === 'FRIEND' ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                        ✓ Bạn bè
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAddFriend(user.id)}
                        className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-lg transition"
                      >
                        Kết bạn
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2-Column Main Workspace */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* LEFT COLUMN: Friends List (38% width) */}
          <div className="w-full md:w-[38%] border-r border-slate-200 flex flex-col min-h-0 bg-slate-50/60">
            {/* Friends list scroll */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {friends.map(friend => {
                const isSelected = activeFriend?.id === friend.id;
                const isOnline = friend.isOnline !== false;

                return (
                  <div
                    key={friend.id}
                    onClick={() => selectFriend(friend)}
                    className={`p-3 rounded-2xl border cursor-pointer transition flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-blue-50/90 border-[#1b365d]/40 shadow-xs ring-1 ring-[#1b365d]/20'
                        : 'bg-white border-slate-200 hover:bg-slate-50/80 hover:border-slate-300'
                    }`}
                  >
                    {/* Left: Avatar & Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-10 h-10 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0 overflow-hidden">
                        {friend.userPet?.petType?.previewUrl ? (
                          <img
                            src={friend.userPet.petType.previewUrl}
                            alt="pet"
                            className="w-8 h-8 object-contain pixelated"
                            onError={e => {
                              (e.currentTarget as HTMLImageElement).src = '/sprites/bento/idle_1.png';
                            }}
                          />
                        ) : (
                          <span className="text-base">🐾</span>
                        )}
                        <span
                          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                            isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-900 truncate">
                            {friend.fullName}
                          </span>
                          {isOnline && (
                            <span className="text-[10px] text-emerald-600 font-semibold">• Online</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {friend.department?.name || 'Phòng Kỹ Thuật & Phần Mềm'}
                        </div>
                        <div className="text-[10px] text-[#1b365d] font-semibold truncate mt-0.5">
                          {friend.statusText ||
                            (friend.userPet
                              ? `Bé ${friend.userPet.name} (Lv.${friend.userPet.level})`
                              : 'Chưa nhận thú cưng')}
                        </div>
                      </div>
                    </div>

                    {/* Chat indicator or Trash */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          void handleRemoveFriend(friend.id);
                        }}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                        title="Hủy kết bạn"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Tip Footer */}
            <div className="p-3 border-t border-slate-200 bg-amber-50/70 text-[11px] text-amber-900 font-medium flex items-center gap-2">
              <Sparkles size={14} className="text-amber-600 shrink-0" />
              <span>Tặng 10 EXP năng lượng miễn phí cho bạn bè mỗi 24 giờ!</span>
            </div>
          </div>

          {/* RIGHT COLUMN: Chat & Interactive Companion Panel (62% width) */}
          <div className="flex-1 flex flex-col min-h-0 bg-white">
            {activeFriend ? (
              <>
                {/* Friend Header Bar */}
                <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-3 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="relative w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs overflow-hidden">
                      {activeFriend.avatarUrl ? (
                        <img
                          src={activeFriend.avatarUrl}
                          alt={activeFriend.fullName}
                          className="w-full h-full object-cover rounded-full"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <span>{activeFriend.fullName.charAt(0)}</span>
                      )}
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white" />
                    </div>
                    <div>
                      <div className="font-extrabold text-xs sm:text-sm text-slate-900">
                        {activeFriend.fullName}
                      </div>
                      <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                        Đang hoạt động • Pomodoro Phiên #4
                      </div>
                    </div>
                  </div>

                  {/* Actions: Invite, Gift, More */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleInviteToGarden}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs"
                    >
                      <TreePine size={13} className="text-emerald-600" />
                      <span className="hidden sm:inline">Mời vào Vườn</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSendGift}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs"
                    >
                      <Gift size={13} className="text-slate-950" />
                      <span>Tặng 10 EXP</span>
                    </button>

                    <button
                      type="button"
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
                    >
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </div>

                {/* Friend's Companion Pet Mini-Widget */}
                <div className="mx-4 mt-3 p-3 rounded-2xl bg-gradient-to-r from-blue-50 via-slate-50 to-indigo-50/70 border border-blue-100 flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white border border-blue-200 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                      {activeFriend.userPet?.petType?.previewUrl ? (
                        <img
                          src={activeFriend.userPet.petType.previewUrl}
                          alt="pet"
                          className="w-8 h-8 object-contain pixelated"
                        />
                      ) : (
                        <span className="text-lg">🐱</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <span>{activeFriend.userPet?.name || 'Bento Boy'}</span>
                        <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 text-[9px] rounded-md font-extrabold">
                          Cùng bàn Pomodoro
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                        <span className="text-rose-600 font-semibold">❤️ 95% Hạnh phúc</span>
                        <span>•</span>
                        <span className="text-amber-600 font-semibold">⚡ 80% Năng lượng</span>
                        <span>•</span>
                        <span>Chuỗi 4 phiên</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono text-sm font-extrabold text-[#1b365d]">
                      {activeFriend.pomodoroTime || '18:42'}
                    </div>
                    <div className="text-[10px] text-slate-400">Đang học cùng bạn</div>
                  </div>
                </div>

                {/* Chat Messages Stream */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chatMessages.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      Hãy gửi lời chào đầu tiên tới {activeFriend.fullName}! 👋🐾
                    </div>
                  ) : (
                    chatMessages.map(msg => {
                      const isMe = msg.senderId === currentUser.id;

                      if (msg.isGift) {
                        return (
                          <div key={msg.id} className="flex justify-center my-2">
                            <div className="px-4 py-2.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold flex items-center gap-2 shadow-xs max-w-md text-center">
                              <Gift size={16} className="text-amber-600 shrink-0" />
                              <span>{msg.content}</span>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                              isMe
                                ? 'bg-[#1b365d] text-white rounded-br-xs'
                                : 'bg-slate-100 text-slate-900 rounded-bl-xs border border-slate-200'
                            }`}
                          >
                            {msg.content}
                          </div>
                          <span className="text-[9px] text-slate-400 mt-1 px-1 font-mono">
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Quick Chat Suggestions */}
                <div className="px-4 py-1.5 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {[
                    'Chạy Pomodoro nhé! ⏱️',
                    'Ghé Khu Vườn Chung 🌿',
                    'Khoe cấp độ Pet 🐾',
                    'Tặng năng lượng ⚡'
                  ].map(quick => (
                    <button
                      key={quick}
                      type="button"
                      onClick={() => void sendMessageContent(quick)}
                      className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-medium whitespace-nowrap transition"
                    >
                      {quick}
                    </button>
                  ))}
                </div>

                {/* Message Input Form */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-3 border-t border-slate-200 flex items-center gap-2 bg-slate-50"
                >
                  <button
                    type="button"
                    onClick={() => setMessageInput(prev => `${prev} 😊`)}
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-white transition"
                    title="Chèn biểu tượng cảm xúc"
                  >
                    <Smile size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMessageInput(prev => `${prev} 🐾`)}
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-white transition"
                    title="Chèn chân thú cưng"
                  >
                    <PawPrint size={18} />
                  </button>

                  <input
                    type="text"
                    value={messageInput}
                    onChange={e => setMessageInput(e.target.value)}
                    placeholder={`Nhắn tin cho ${activeFriend.fullName}...`}
                    className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-[#1b365d]/20 focus:border-[#1b365d] transition shadow-xs"
                  />

                  <button
                    type="submit"
                    disabled={isSending || !messageInput.trim()}
                    className="px-4 py-2 bg-[#1b365d] hover:bg-[#132742] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1.5"
                  >
                    <span>Gửi</span>
                    <Send size={13} />
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-2xl mb-3">
                  💬
                </div>
                <div className="font-bold text-sm text-slate-700">Chọn một người bạn để trò chuyện</div>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Cùng trao đổi bài tập, đua chuỗi Pomodoro và gửi tặng quà năng lượng hàng ngày
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
