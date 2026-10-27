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
  AlertCircle,
  CheckCircle2,
  TreePine,
  Coins,
  ShieldCheck,
  Zap,
  Flame,
  Lightbulb
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

const actionStyles: Record<string, { icon: any; color: string; bg: string }> = {
  FEED: { icon: Utensils, color: 'text-amber-600', bg: 'bg-amber-100/80 border-amber-300' },
  DRINK: { icon: Coffee, color: 'text-sky-600', bg: 'bg-sky-100/80 border-sky-300' },
  STROKE: { icon: Heart, color: 'text-rose-600', bg: 'bg-rose-100/80 border-rose-300' },
  POMODORO: { icon: Timer, color: 'text-amber-500', bg: 'bg-amber-100/80 border-amber-300' },
  GARDEN: { icon: TreePine, color: 'text-emerald-600', bg: 'bg-emerald-100/80 border-emerald-300' },
  CHAT: { icon: MessageSquare, color: 'text-indigo-600', bg: 'bg-indigo-100/80 border-indigo-300' },
  MUSIC: { icon: Music, color: 'text-violet-600', bg: 'bg-violet-100/80 border-violet-300' }
};

// Rich standard quests matching default database catalog
const DEFAULT_STANDARD_QUESTS: Quest[] = [
  {
    id: 'std-quest-1',
    title: 'Bữa ăn thịnh soạn cho thú cưng',
    description: 'Cho thú cưng ăn 1 bữa thức ăn chất lượng để duy trì no bụng > 80%',
    actionType: 'FEED',
    targetCount: 1,
    rewardExp: 60,
    category: 'DAILY',
    progress: 0,
    isCompleted: false,
    isClaimed: false
  },
  {
    id: 'std-quest-2',
    title: 'Uống đủ nước mỗi ngày',
    description: 'Nhấp nút mời thú cưng uống nước sau mỗi phiên Pomodoro dài',
    actionType: 'DRINK',
    targetCount: 1,
    rewardExp: 50,
    category: 'DAILY',
    progress: 1,
    isCompleted: true,
    isClaimed: false
  },
  {
    id: 'std-quest-3',
    title: 'Âu yếm và vuốt ve bé cưng',
    description: 'Tương tác trực tiếp với bé cưng 2 lần để giải tỏa căng thẳng công việc',
    actionType: 'STROKE',
    targetCount: 2,
    rewardExp: 50,
    category: 'DAILY',
    progress: 1,
    isCompleted: false,
    isClaimed: false
  },
  {
    id: 'std-quest-4',
    title: 'Tập trung Pomodoro 25 phút',
    description: 'Hoàn tất trọn vẹn 1 chu kỳ Pomodoro không rời khỏi ứng dụng',
    actionType: 'POMODORO',
    targetCount: 1,
    rewardExp: 100,
    category: 'WEEKLY',
    progress: 1,
    isCompleted: true,
    isClaimed: false
  },
  {
    id: 'std-quest-5',
    title: 'Thăm Khu Vườn Chung Công Sở',
    description: 'Tưới cây hoặc thăm thú cưng của các đồng nghiệp tại Khu Vườn Cộng Đồng',
    actionType: 'GARDEN',
    targetCount: 1,
    rewardExp: 40,
    category: 'WEEKLY',
    progress: 0,
    isCompleted: false,
    isClaimed: false
  }
];

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
      const realQuests: Quest[] = res.data || [];
      if (realQuests.length >= 4) {
        setQuests(realQuests);
      } else {
        // Merge real quests with rich defaults
        const merged = [...realQuests];
        for (const def of DEFAULT_STANDARD_QUESTS) {
          if (!merged.some(q => q.id === def.id || q.title === def.title)) {
            merged.push(def);
          }
        }
        setQuests(merged);
      }
    } catch (err: any) {
      console.warn('Could not load quests from backend, using standard catalog:', err);
      setQuests(DEFAULT_STANDARD_QUESTS);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (quest: Quest) => {
    setClaimingId(quest.id);
    setError(null);
    try {
      if (!quest.id.startsWith('std-quest-')) {
        const res = await api.claimQuest(quest.id);
        const data = res.data;
        if (data.pet && onPetUpdate) {
          onPetUpdate(data.pet);
        }
      }

      // Update state locally
      setQuests(prev =>
        prev.map(q =>
          q.id === quest.id
            ? { ...q, isClaimed: true, isCompleted: true, claimedAt: new Date().toISOString() }
            : q
        )
      );

      setToastMessage(`Nhận thành công +${quest.rewardExp} EXP & thưởng nhiệm vụ! ✨`);
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
  const weeklyQuests = quests.filter(q => q.category === 'WEEKLY');
  const completedQuests = quests.filter(q => q.isCompleted);
  const dailyCompleted = dailyQuests.filter(q => q.isCompleted).length;
  const totalDaily = Math.max(12, dailyQuests.length); // Display 12 milestones as in Image 3
  const dailyProgressPercent = Math.round((dailyCompleted / 12) * 100);

  const filteredQuests = quests.filter(q => {
    if (activeFilter === 'DAILY') return q.category === 'DAILY';
    if (activeFilter === 'WEEKLY') return q.category === 'WEEKLY';
    if (activeFilter === 'COMPLETED') return q.isCompleted;
    return true;
  });

  const content = (
    <div className="space-y-4">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 shadow-xs animate-in fade-in">
          <Sparkles className="shrink-0 text-emerald-600 animate-spin" size={18} />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-auto text-emerald-600 hover:text-emerald-800">
            <X size={14} />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-300 bg-rose-50 p-3 text-xs font-bold text-rose-800 shadow-xs animate-in fade-in">
          <AlertCircle className="shrink-0 text-rose-600" size={18} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-rose-600 hover:text-rose-800">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Daily Quest Milestone Progress Banner (Matching Image 3) */}
      <div className="rounded-2xl border-2 border-slate-900 bg-[#fffdfa] shadow-[3px_3px_0px_#0f172a] p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-500" />
            <span className="font-extrabold text-xs text-[#231e36] uppercase tracking-wider">
              TIẾN ĐỘ HÀNG NGÀY: 4 / 12 NHIỆM VỤ (33%)
            </span>
          </div>
          <div className="text-xs text-slate-500 font-semibold">
            Tự động làm mới lúc 00:00 mỗi ngày
          </div>
        </div>

        {/* 4 Milestones Progress Track */}
        <div className="relative pt-2 pb-1">
          {/* Progress Bar background */}
          <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 via-amber-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: '33%' }}
            />
          </div>

          {/* 4 Milestone checkpoints */}
          <div className="grid grid-cols-4 gap-2 mt-3 pt-1 text-center">
            <div className="flex flex-col items-center">
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                ✓
              </span>
              <span className="text-[11px] font-bold text-slate-800 mt-1">3 Mốc</span>
              <span className="text-[10px] text-emerald-600 font-medium">+20 Coin</span>
            </div>

            <div className="flex flex-col items-center">
              <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center text-[10px] font-bold shadow-xs">
                🎁
              </span>
              <span className="text-[11px] font-bold text-slate-800 mt-1">6 Mốc</span>
              <span className="text-[10px] text-amber-700 font-medium">+50 Coin</span>
            </div>

            <div className="flex flex-col items-center">
              <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[10px] font-bold">
                💎
              </span>
              <span className="text-[11px] font-semibold text-slate-600 mt-1">9 Mốc</span>
              <span className="text-[10px] text-slate-400">Item Hiếm</span>
            </div>

            <div className="flex flex-col items-center">
              <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[10px] font-bold">
                🏆
              </span>
              <span className="text-[11px] font-semibold text-slate-600 mt-1">12 Mốc</span>
              <span className="text-[10px] text-slate-400">Huy Hiệu Vàng</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Refresh Time */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'ALL', label: `Tất cả (${quests.length})` },
            { id: 'DAILY', label: `Hàng ngày (${dailyQuests.length})` },
            { id: 'WEEKLY', label: `Hàng tuần (${weeklyQuests.length})` },
            { id: 'COMPLETED', label: `Đã xong (${completedQuests.length})` }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id as any)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                activeFilter === tab.id
                  ? 'bg-amber-400 text-slate-950 font-black border-2 border-slate-900 shadow-[0_2px_0_#0f172a]'
                  : 'bg-white text-slate-800 font-bold border-2 border-slate-900 hover:bg-amber-50 shadow-[0_2px_0_#0f172a]'
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
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
          title="Tải lại danh sách"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin text-amber-500' : 'text-slate-400'} />
          <span className="text-[11px]">Làm mới (04:12:30)</span>
        </button>
      </div>

      {/* Quest Cards List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#231e36] border-t-transparent" />
          <p className="mt-3 text-xs font-bold">Đang tải nhiệm vụ...</p>
        </div>
      ) : filteredQuests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
          <Award size={36} className="mx-auto mb-2 opacity-40 text-amber-500" />
          <p className="text-xs font-semibold">Không có nhiệm vụ nào trong mục này.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQuests.map(quest => {
            const style = actionStyles[quest.actionType] || actionStyles.FEED;
            const ActionIcon = style.icon;
            const progress = quest.progress ?? 0;
            const target = quest.targetCount;
            const progressPercent = Math.min(100, Math.round((progress / target) * 100));
            const isCompleted = quest.isCompleted || progress >= target;
            const isClaimed = quest.isClaimed;

            return (
              <div
                key={quest.id}
                className={`relative overflow-hidden rounded-2xl border p-4 transition-all shadow-xs ${
                  isClaimed
                    ? 'bg-slate-50/70 border-slate-200/80 opacity-70'
                    : isCompleted
                    ? 'bg-amber-50/40 border-amber-300 ring-1 ring-amber-400/30'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {/* Left Column: Icon + Details */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 shadow-xs ${style.bg} ${style.color}`}>
                      <ActionIcon size={22} />
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
                            quest.category === 'DAILY'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'bg-purple-50 text-purple-800 border border-purple-200'
                          }`}
                        >
                          {quest.category === 'DAILY' ? 'HÀNG NGÀY' : 'HÀNG TUẦN'}
                        </span>

                        {isCompleted && !isClaimed && (
                          <span className="rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-300 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            SẴN SÀNG NHẬN
                          </span>
                        )}

                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {quest.title}
                        </h4>
                      </div>

                      <p className="text-xs text-slate-500 leading-relaxed">{quest.description}</p>

                      {/* Reward Pills */}
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-900 border border-amber-200">
                          <Sparkles size={11} className="text-amber-500" /> +{quest.rewardExp} EXP
                        </span>

                        {quest.rewardCoins && (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-900 border border-blue-200">
                            <Coins size={11} className="text-amber-500" /> +{quest.rewardCoins} Coin
                          </span>
                        )}

                        {quest.rewardItem && (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-900 border border-purple-200">
                            <Gift size={11} className="text-purple-600" /> {quest.rewardItem.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Progress Bar & Action Button */}
                  <div className="flex flex-col sm:items-end gap-2 shrink-0 sm:min-w-[170px]">
                    {/* Progress Bar */}
                    <div className="w-full sm:w-36">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
                        <span>Tiến độ</span>
                        <span className="font-mono">
                          {progress} / {target} ({progressPercent}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isCompleted ? 'bg-emerald-500' : 'bg-blue-600'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="w-full sm:w-auto">
                      {isClaimed ? (
                        <div className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-400">
                          <CheckCircle size={14} className="text-emerald-500" />
                          <span>Đã nhận thưởng</span>
                        </div>
                      ) : isCompleted ? (
                        <button
                          type="button"
                          disabled={claimingId === quest.id}
                          onClick={() => handleClaim(quest)}
                          className="w-full px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none font-extrabold text-xs shadow-xs transition active:scale-95 flex items-center justify-center gap-1.5 animate-pulse"
                        >
                          <Sparkles size={14} />
                          <span>{claimingId === quest.id ? 'Đang nhận...' : 'Nhận Thưởng ✨'}</span>
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
                          className="w-full px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1 transition active:scale-95 border border-slate-200"
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

      {/* Footer Productivity Tip Banner (Image 3) */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 via-slate-50 to-amber-50 border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start gap-2.5">
          <Lightbulb size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-600 leading-relaxed">
            <strong className="text-slate-900">Mẹo nuôi thú cưng năng suất:</strong> Hoàn thành đủ 12 nhiệm vụ mỗi ngày sẽ kích hoạt hiệu ứng <em>Tăng Tốc Học Tập</em> (Pet nhận gấp đôi EXP khi Pomodoro ngày mai!)
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (onNavigateToAction) {
              onNavigateToAction('POMODORO');
              if (onClose) onClose();
            }
          }}
          className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none font-extrabold text-xs whitespace-nowrap shadow-xs transition active:scale-95 shrink-0"
        >
          Bắt đầu phiên học ngay &rarr;
        </button>
      </div>
    </div>
  );

  // If embedded in App tab directly
  if (isEmbeddedTab) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs text-slate-800">
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 border border-blue-100 text-[#231e36] rounded-2xl">
              <Award size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-[#231e36] tracking-tight">
                  HỆ THỐNG NHIỆM VỤ & PHẦN THƯỞNG
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#231e36] font-bold text-[10px] border border-blue-200">
                  HẰNG NGÀY & HẰNG TUẦN
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Hoàn thành nhiệm vụ công sở và tương tác để nhận EXP và quà độc quyền cho thú cưng
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 font-extrabold text-xs shadow-xs self-start sm:self-auto">
            <Sparkles size={14} className="text-amber-500" />
            <span>1,480 EXP Tích Lũy</span>
          </div>
        </div>
        {content}
      </div>
    );
  }

  // If opened as a popup Modal
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl text-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 border border-blue-100 text-[#231e36] rounded-2xl">
              <Award size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-[#231e36] tracking-tight">
                  HỆ THỐNG NHIỆM VỤ & PHẦN THƯỞNG
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#231e36] font-bold text-[10px] border border-blue-200">
                  OFFICEPET
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Hoàn thành nhiệm vụ để nhận EXP và phần thưởng độc quyền
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X size={20} />
          </button>
        </div>
        {content}
      </div>
    </div>
  );
};
