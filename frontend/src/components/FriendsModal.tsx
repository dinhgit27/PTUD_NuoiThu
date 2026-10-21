import React, { useState, useEffect, useRef } from 'react';
import { Users, UserPlus, MessageCircle, Search, X, ArrowLeft, Send, Trash2, Heart, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import { User } from '../types';

interface FriendUser {
  id: string;
  email: string;
  fullName: string;
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
}

interface DirectMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  senderName?: string;
}

interface FriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
}

export const FriendsModal: React.FC<FriendsModalProps> = ({ isOpen, onClose, currentUser }) => {
  const [activeView, setActiveView] = useState<'LIST' | 'SEARCH' | 'CHAT'>('LIST');
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [searchResults, setSearchResults] = useState<FriendUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [activeFriend, setActiveFriend] = useState<FriendUser | null>(null);
  const [chatMessages, setChatMessages] = useState<DirectMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchFriends = async () => {
    try {
      const res = await api.getFriends();
      setFriends(res.data);
    } catch (err) {
      console.error('Failed to load friends:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFriends();
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
        fetchFriends();
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

  // Load chat messages when opening chat with a friend
  const openChatWithFriend = async (friend: FriendUser) => {
    setActiveFriend(friend);
    setActiveView('CHAT');
    try {
      const res = await api.getDirectMessages(friend.id);
      setChatMessages(res.data);
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
      setSearchResults(res.data);
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
      fetchFriends();
      // Update local search results state
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
      fetchFriends();
      if (activeFriend?.id === friendId) {
        setActiveView('LIST');
        setActiveFriend(null);
      }
    } catch (err: any) {
      alert('Không thể hủy kết bạn.');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFriend || !messageInput.trim() || isSending) return;
    const content = messageInput.trim();
    setMessageInput('');
    setIsSending(true);

    try {
      const res = await api.sendDirectMessage(activeFriend.id, content);
      setChatMessages(prev => [...prev, res.data]);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Không thể gửi tin nhắn.');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white border-4 border-charcoal rounded-2xl shadow-pixel-lg max-w-lg w-full h-[580px] flex flex-col overflow-hidden animate-in zoom-in-95 font-sans">
        {/* Header */}
        <div className="bg-sage-400 p-3.5 border-b-2 border-charcoal flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            {activeView === 'CHAT' ? (
              <button
                type="button"
                onClick={() => {
                  setActiveView('LIST');
                  setActiveFriend(null);
                }}
                className="p-1 hover:bg-white/20 rounded-lg text-white mr-1 transition-colors"
                title="Quay lại danh sách bạn bè"
              >
                <ArrowLeft size={18} />
              </button>
            ) : (
              <div className="p-1.5 bg-white/20 rounded-lg">
                <Users size={18} />
              </div>
            )}
            <div>
              <div className="font-pixel text-xs text-white drop-shadow">
                {activeView === 'CHAT' && activeFriend
                  ? `Nhắn tin với ${activeFriend.fullName}`
                  : 'Bạn Bè & Tin Nhắn'}
              </div>
              <div className="text-[11px] text-sage-100">
                {activeView === 'CHAT' && activeFriend
                  ? (activeFriend.userPet ? `Bé cưng: ${activeFriend.userPet.name} (Lv.${activeFriend.userPet.level})` : activeFriend.email)
                  : `${friends.length} người bạn đồng hành`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeView !== 'CHAT' && (
              <div className="flex bg-sage-500/80 p-0.5 rounded-lg border border-white/30 text-[11px] font-pixel">
                <button
                  type="button"
                  onClick={() => setActiveView('LIST')}
                  className={`px-2 py-1 rounded ${activeView === 'LIST' ? 'bg-white text-charcoal shadow-sm' : 'text-white'}`}
                >
                  Bạn bè ({friends.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('SEARCH')}
                  className={`px-2 py-1 rounded flex items-center gap-1 ${activeView === 'SEARCH' ? 'bg-white text-charcoal shadow-sm' : 'text-white'}`}
                >
                  <UserPlus size={11} /> Thêm bạn
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded-lg text-white transition-colors"
              aria-label="Đóng"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {notice && (
          <div className="bg-green-100 border-b border-green-300 px-4 py-2 text-xs text-green-800 flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-green-600" />
            {notice}
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto bg-cream-100 p-4">
          {/* VIEW 1: FRIENDS LIST */}
          {activeView === 'LIST' && (
            <div className="space-y-3">
              {friends.length === 0 ? (
                <div className="text-center py-12 text-gray-500 space-y-3">
                  <div className="text-3xl">🐾</div>
                  <div className="font-pixel text-xs text-charcoal">Chưa có bạn bè nào</div>
                  <p className="text-xs text-gray-500 max-w-xs mx-auto">
                    Hãy bấm vào tab <strong>"Thêm bạn"</strong> để kết bạn cùng các đồng nghiệp trong công ty nhé!
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveView('SEARCH')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sage-500 hover:bg-sage-600 text-white font-pixel text-xs rounded-lg border-2 border-charcoal shadow-pixel transition-transform active:scale-95"
                  >
                    <UserPlus size={13} /> Tìm bạn ngay
                  </button>
                </div>
              ) : (
                friends.map(friend => (
                  <div
                    key={friend.id}
                    className="bg-white border-2 border-charcoal rounded-xl p-3 shadow-pixel-sm flex items-center justify-between gap-3 hover:border-sage-500 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar / Pet preview */}
                      <div className="w-10 h-10 rounded-lg border-2 border-charcoal bg-cream-200 flex items-center justify-center shrink-0 overflow-hidden">
                        {friend.userPet?.petType?.previewUrl ? (
                          <img
                            src={friend.userPet.petType.previewUrl}
                            alt="pet"
                            className="w-8 h-8 object-contain pixelated"
                          />
                        ) : (
                          <span className="text-base">🐾</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-charcoal truncate">{friend.fullName}</div>
                        <div className="text-[10px] text-gray-500 truncate">
                          {friend.department?.name || 'Chưa vào phòng'} • {friend.userPet ? `Bé ${friend.userPet.name} (Lv.${friend.userPet.level})` : 'Chưa nhận nuôi'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openChatWithFriend(friend)}
                        className="px-2.5 py-1.5 bg-sage-500 hover:bg-sage-600 text-white font-pixel text-[10px] rounded-lg border-2 border-charcoal shadow-pixel-sm flex items-center gap-1 transition-transform active:scale-95"
                        title="Nhắn tin riêng 1-1"
                      >
                        <MessageCircle size={12} /> Nhắn tin
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveFriend(friend.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Hủy kết bạn"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* VIEW 2: SEARCH & ADD FRIENDS */}
          {activeView === 'SEARCH' && (
            <div className="space-y-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Tìm theo họ tên hoặc email..."
                    className="w-full pl-8 pr-3 py-2 border-2 border-charcoal rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sage-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="px-3 py-2 bg-sage-500 hover:bg-sage-600 disabled:opacity-50 text-white font-pixel text-xs rounded-lg border-2 border-charcoal shadow-pixel transition-transform active:scale-95 shrink-0"
                >
                  {isSearching ? 'Đang tìm...' : 'Tìm kiếm'}
                </button>
              </form>

              <div className="space-y-2">
                {searchResults.length === 0 && searchQuery && !isSearching && (
                  <p className="text-center text-xs text-gray-500 py-6">Không tìm thấy người dùng phù hợp.</p>
                )}
                {searchResults.map(user => (
                  <div
                    key={user.id}
                    className="bg-white border-2 border-charcoal rounded-xl p-3 shadow-pixel-sm flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-charcoal">{user.fullName}</div>
                      <div className="text-[10px] text-gray-500">{user.email}</div>
                    </div>
                    <div>
                      {user.friendshipStatus === 'FRIEND' ? (
                        <span className="text-[10px] font-bold text-sage-600 px-2 py-1 bg-sage-100 rounded-lg">
                          ✓ Bạn bè
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddFriend(user.id)}
                          className="px-2.5 py-1 bg-terracotta-400 hover:bg-terracotta-500 text-white font-pixel text-[10px] rounded-lg border-2 border-charcoal shadow-pixel-sm flex items-center gap-1 transition-transform active:scale-95"
                        >
                          <UserPlus size={11} /> Kết bạn
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW 3: DIRECT CHAT 1-1 */}
          {activeView === 'CHAT' && activeFriend && (
            <div className="flex flex-col h-full space-y-3">
              {/* Message List */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-xs">
                    <p>Hãy gửi lời chào đầu tiên tới {activeFriend.fullName}! 👋🐾</p>
                  </div>
                ) : (
                  chatMessages.map(msg => {
                    const isMe = msg.senderId === currentUser.id;
                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div
                          className={`max-w-[80%] p-2.5 rounded-xl border-2 border-charcoal shadow-pixel-sm text-xs ${
                            isMe ? 'bg-sage-400 text-white rounded-br-none' : 'bg-white text-charcoal rounded-bl-none'
                          }`}
                        >
                          {msg.content}
                        </div>
                        <span className="text-[9px] text-gray-400 mt-0.5 px-1 font-mono">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input form */}
              <form onSubmit={handleSendMessage} className="flex gap-2 pt-2 border-t border-gray-200">
                <input
                  type="text"
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  placeholder={`Nhắn tin cho ${activeFriend.fullName}...`}
                  maxLength={1000}
                  className="flex-1 px-3 py-2 border-2 border-charcoal rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sage-400"
                />
                <button
                  type="submit"
                  disabled={isSending || !messageInput.trim()}
                  className="p-2.5 bg-terracotta-400 hover:bg-terracotta-500 disabled:opacity-50 text-white rounded-xl border-2 border-charcoal shadow-pixel transition-transform active:scale-95 shrink-0"
                  aria-label="Gửi tin nhắn"
                >
                  <Send size={15} />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
