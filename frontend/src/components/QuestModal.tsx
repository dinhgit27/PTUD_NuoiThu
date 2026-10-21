import React, { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import {
  Award,
  Sparkles,
  CheckCircle,
  X,
  Utensils,
  Coffee,
  Heart,
  Timer,
  MessageSquare,
  Music,
  ChevronRight,
  Gift,
  RefreshCw,
  Clock,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { Quest, UserPet } from '../types';

interface QuestModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onPetUpdate?: (pet: UserPet) => void;
  onNavigateToAction?: (actionType: string) => void;
  isEmbeddedTab?: boolean;
}

const actionIcons: Record<string, any> = {
  FEED: { icon: Utensils, label: 'Cho ăn', color: 'bg-terracotta-100 text-terracotta-600 border-terracotta-300' },
  DRINK: { icon: Coffee, label: 'Uống nước', color: 'bg-cyan-100 text-cyan-700 border-cyan-300' },
  STROKE: { icon: Heart, label: 'Vuốt ve', color: 'bg-pink-100 text-pink-600 border-pink-300' },
  POMODORO: { icon: Timer, label: 'Pomodoro', color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  CHAT: { icon: MessageSquare, label: 'Trò chuyện AI', color: 'bg-sage-100 text-sage-700 border-sage-300' },
  MUSIC: { icon: Music, label: 'Nghe nhạc', color: 'bg-violet-100 text-violet-700 border-violet-300' }
};

export const QuestModal: React.FC<QuestModalProps> = ({
  isOpen = true,
  onClose,
  onPetUpdate,
  onNavigateToAction,
  isEmbeddedTab = false
}) => {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'DAILY' | 'WEEKLY' | 'COMPLETED'>('ALL');
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen || isEmbeddedTab) {
      void loadQuests();
    }
  }, [isOpen, isEmbeddedTab]);

  const loadQuests = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getQuests();
      setQuests(res.data || []);
    } catch (err: any) {
      const msg = err instanceof AxiosError ? err.response?.data?.error : 'Không thể tải danh sách nhiệm vụ.';
      setError(msg || 'Lỗi tải nhiệm vụ.');
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (quest: Quest) => {
    setClaimingId(quest.id);
    setError(null);
    try {
      const res = await api.claimQuest(quest.id);
      const data = res.data;

      // Update quest in local state
      setQuests(prev =>
        prev.map(q =>
          q.id === quest.id
            ? { ...q, isClaimed: true, isCompleted: true, claimedAt: new Date().toISOString() }
            : q
        )
      );

      // Notify parent to update pet EXP/Level
      if (data.pet && onPetUpdate) {
        onPetUpdate(data.pet);
      }

      setToastMessage(data.message || `+${quest.rewardExp} EXP đã được cộng cho bé cưng! ✨`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      const msg = err instanceof AxiosError ? err.response?.data?.error : 'Không thể nhận thưởng.';
      setError(msg || 'Lỗi nhận thưởng.');
    } finally {
      setClaimingId(null);
    }
  };

  if (!isOpen && !isEmbeddedTab) return null;

  const dailyQuests = quests.filter(q => q.category === 'DAILY');
  const dailyCompleted = dailyQuests.filter(q => q.isCompleted).length;
  const totalDaily = dailyQuests.length;
  const dailyProgressPercent = totalDaily > 0 ? Math.round((dailyCompleted / totalDaily) * 100) : 0;

  const filteredQuests = quests.filter(q => {
    if (activeFilter === 'DAILY') return q.category === 'DAILY';
    if (activeFilter === 'WEEKLY') return q.category === 'WEEKLY';
    if (activeFilter === 'COMPLETED') return q.isCompleted;
    return true;
  });

  const unclaimedCount = quests.filter(q => q.isCompleted && !q.isClaimed).length;

  const content = (
    <div className="space-y-4">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="flex items-center gap-2 rounded-xl border-2 border-emerald-500 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 shadow-pixel animate-in fade-in">
          <Sparkles className="shrink-0 text-emerald-600 animate-spin" size={18} />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-auto text-emerald-600 hover:text-emerald-800">
            <X size={14} />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border-2 border-terracotta-500 bg-terracotta-50 p-3 text-xs font-bold text-terracotta-800 shadow-pixel animate-in fade-in">
          <AlertCircle className="shrink-0 text-terracotta-600" size={18} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-terracotta-600 hover:text-terracotta-800">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Daily Progress Banner */}
      <div className="rounded-2xl border-2 border-charcoal bg-gradient-to-r from-cream-50 to-amber-50 p-4 shadow-pixel">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-terracotta-500" />
              <span className="font-pixel text-xs text-charcoal">TIẾN ĐỘ HÀNG NGÀY</span>
              {unclaimedCount > 0 && (
                <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse">
                  {unclaimedCount} chưa nhận
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-charcoal/70">
              Hoàn thành {dailyCompleted}/{totalDaily} nhiệm vụ hôm nay để giúp bé cưng nhanh lớn!
            </p>
          </div>
          <div className="font-pixel text-sm font-black text-terracotta-600 sm:text-right">
            {dailyProgressPercent}%
          </div>
        </div>

        <div className="mt-3 h-3 w-full overflow-hidden rounded-full border border-charcoal bg-white p-0.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500 transition-all duration-500"
            style={{ width: `${dailyProgressPercent}%` }}
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-charcoal/10 pb-3">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'ALL', label: 'Tất cả' },
            { id: 'DAILY', label: 'Hàng ngày' },
            { id: 'WEEKLY', label: 'Hàng tuần' },
            { id: 'COMPLETED', label: 'Đã xong' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id as any)}
              className={`rounded-lg px-3 py-1.5 font-pixel text-[11px] transition-all ${
                activeFilter === tab.id
                  ? 'bg-charcoal text-white shadow-pixel'
                  : 'bg-white text-charcoal/70 border border-charcoal/20 hover:bg-cream-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={loadQuests}
          disabled={loading}
          className="flex items-center gap-1 rounded-lg border border-charcoal/20 bg-white px-2.5 py-1.5 text-xs font-bold text-charcoal/70 hover:bg-cream-200 disabled:opacity-50"
          title="Tải lại danh sách"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span className="text-[11px]">Làm mới</span>
        </button>
      </div>

      {/* Quest Cards List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-charcoal/60">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-charcoal border-t-transparent" />
          <p className="mt-3 font-pixel text-xs">Đang tải nhiệm vụ...</p>
        </div>
      ) : filteredQuests.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-charcoal/30 p-8 text-center text-charcoal/60">
          <Award size={36} className="mx-auto mb-2 opacity-40" />
          <p className="font-pixel text-xs">Không có nhiệm vụ nào trong mục này.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQuests.map(quest => {
            const action = actionIcons[quest.actionType] || actionIcons.FEED;
            const ActionIcon = action.icon;
            const progress = quest.progress ?? 0;
            const target = quest.targetCount;
            const progressPercent = Math.min(100, Math.round((progress / target) * 100));
            const isCompleted = quest.isCompleted || progress >= target;
            const isClaimed = quest.isClaimed;

            return (
              <div
                key={quest.id}
                className={`relative overflow-hidden rounded-xl border-2 border-charcoal bg-white p-4 shadow-pixel transition-all ${
                  isClaimed
                    ? 'bg-gray-50/70 border-charcoal/30 opacity-75'
                    : isCompleted
                    ? 'border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-400/40'
                    : ''
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {/* Left Column: Icon + Details */}
                  <div className="flex items-start gap-3">
                    <div className={`rounded-xl border p-2.5 shrink-0 ${action.color}`}>
                      <ActionIcon size={22} />
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            quest.category === 'DAILY'
                              ? 'bg-amber-100 text-amber-800'
                              : quest.category === 'WEEKLY'
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {quest.category === 'DAILY' ? 'Hàng ngày' : quest.category === 'WEEKLY' ? 'Hàng tuần' : 'Đặc biệt'}
                        </span>
                        <h4 className="font-pixel text-xs text-charcoal">{quest.title}</h4>
                      </div>

                      <p className="text-xs text-charcoal/70 line-clamp-2">{quest.description}</p>

                      {/* Reward pills */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-900 border border-amber-300">
                          <Sparkles size={11} className="text-amber-600" /> +{quest.rewardExp} EXP
                        </span>

                        {quest.rewardItem && (
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-900 border border-purple-300">
                            <Gift size={11} className="text-purple-600" />
                            <img
                              src={quest.rewardItem.imageUrl}
                              alt={quest.rewardItem.name}
                              className="h-4 w-4 object-contain"
                              onError={e => {
                                (e.currentTarget as HTMLImageElement).src = '/sprites/default_pet.png';
                              }}
                            />
                            {quest.rewardItem.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Progress & Claim Button */}
                  <div className="flex flex-col sm:items-end gap-2 sm:min-w-[180px]">
                    {/* Progress Bar */}
                    <div className="w-full sm:w-36">
                      <div className="flex items-center justify-between text-[11px] font-bold text-charcoal mb-1">
                        <span>Tiến độ</span>
                        <span>
                          {progress} / {target}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full border border-charcoal/30 bg-cream-200">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isCompleted ? 'bg-emerald-500' : 'bg-amber-400'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="w-full sm:w-auto">
                      {isClaimed ? (
                        <div className="flex items-center justify-center gap-1.5 rounded-lg border border-charcoal/20 bg-gray-100 px-3 py-1.5 text-xs font-bold text-charcoal/50">
                          <CheckCircle size={14} className="text-emerald-600" />
                          <span>Đã nhận thưởng</span>
                        </div>
                      ) : isCompleted ? (
                        <button
                          type="button"
                          disabled={claimingId === quest.id}
                          onClick={() => handleClaim(quest)}
                          className="w-full flex items-center justify-center gap-1.5 rounded-xl border-2 border-charcoal bg-emerald-500 px-4 py-2 font-pixel text-xs text-white shadow-pixel hover:bg-emerald-600 active:translate-y-0.5 animate-bounce disabled:opacity-50"
                        >
                          <Sparkles size={14} />
                          <span>{claimingId === quest.id ? 'ĐANG NHẬN...' : 'NHẬN THƯỞNG ✨'}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (onNavigateToAction) {
                              onNavigateToAction(quest.actionType);
                              if (onClose) onClose();
                            }
                          }}
                          className="w-full flex items-center justify-center gap-1 rounded-xl border border-charcoal/30 bg-cream-100 px-3 py-1.5 text-xs font-bold text-charcoal hover:bg-cream-200 active:translate-y-0.5"
                        >
                          <span>Làm ngay</span>
                          <ChevronRight size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // If embedded in App tab directly
  if (isEmbeddedTab) {
    return (
      <div className="rounded-2xl border-4 border-charcoal bg-cream-100 p-5 shadow-pixel text-charcoal">
        <div className="mb-4 flex items-center justify-between border-b-2 border-charcoal/20 pb-3">
          <div className="flex items-center gap-2">
            <Award className="text-terracotta-500" size={24} />
            <div>
              <h2 className="font-pixel text-sm sm:text-base text-charcoal">HỆ THỐNG NHIỆM VỤ & PHẦN THƯỞNG</h2>
              <p className="text-xs text-charcoal/60">Hoàn thành nhiệm vụ để nhận EXP và vật phẩm độc quyền cho thú cưng</p>
            </div>
          </div>
        </div>
        {content}
      </div>
    );
  }

  // If opened as a popup Modal
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border-4 border-charcoal bg-cream-100 p-6 shadow-pixel text-charcoal">
        <div className="flex items-center justify-between border-b-2 border-charcoal/20 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Award className="text-terracotta-500" size={22} />
            <h3 className="font-pixel text-xs sm:text-sm text-charcoal">
              NHIỆM VỤ & PHẦN THƯỞNG
            </h3>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 hover:bg-charcoal/10"
              aria-label="Đóng"
            >
              <X size={18} />
            </button>
          )}
        </div>
        {content}
      </div>
    </div>
  );
};
