import React, { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import {
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  XCircle,
  ToggleLeft,
  ToggleRight,
  Utensils,
  Coffee,
  Heart,
  Timer,
  MessageSquare,
  Music,
  Award,
  Package,
  Layers,
  Search,
  Filter,
  AlertCircle,
  X,
  TreePine
} from 'lucide-react';
import { api } from '../services/api';
import { Quest, ShopItem, QuestActionType } from '../types';

const categories = [
  { value: 'DAILY', label: 'Hàng ngày (Daily)', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'WEEKLY', label: 'Hàng tuần (Weekly)', color: 'bg-blue-50 text-[#231e36] border-blue-200' },
  { value: 'SPECIAL', label: 'Đặc biệt / Sự kiện', color: 'bg-amber-50 text-amber-800 border-amber-200' }
];

const actionTypes = [
  { value: 'FEED', label: 'Cho bé ăn (FEED)', icon: Utensils, color: 'text-amber-600' },
  { value: 'DRINK', label: 'Uống nước cùng bé (DRINK)', icon: Coffee, color: 'text-cyan-600' },
  { value: 'STROKE', label: 'Vuốt ve âu yếm (STROKE)', icon: Heart, color: 'text-rose-500' },
  { value: 'POMODORO', label: 'Tập trung Pomodoro (POMODORO)', icon: Timer, color: 'text-blue-600' },
  { value: 'CHAT', label: 'Trò chuyện AI (CHAT)', icon: MessageSquare, color: 'text-[#231e36]' },
  { value: 'MUSIC', label: 'Nghe nhạc thư giãn (MUSIC)', icon: Music, color: 'text-violet-600' },
  { value: 'GARDEN', label: 'Thăm Khu Vườn Chung (GARDEN)', icon: TreePine, color: 'text-emerald-600' }
];

function errorMessage(error: unknown) {
  return error instanceof AxiosError
    ? error.response?.data?.error || 'Không thể hoàn thành thao tác.'
    : 'Không thể hoàn thành thao tác.';
}

export const AdminQuestManagement: React.FC = () => {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State (Create or Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuest, setEditingQuest] = useState<Quest | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'DAILY' | 'WEEKLY' | 'SPECIAL'>('DAILY');
  const [actionType, setActionType] = useState<QuestActionType>('FEED');
  const [targetCount, setTargetCount] = useState<number>(1);
  const [rewardExp, setRewardExp] = useState<number>(50);
  const [rewardItemId, setRewardItemId] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [questsRes, itemsRes] = await Promise.all([
        api.getAdminQuests(),
        api.getAdminShopItems()
      ]);
      setQuests(questsRes.data || []);
      setShopItems(itemsRes.data || []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingQuest(null);
    setTitle('');
    setDescription('');
    setCategory('DAILY');
    setActionType('FEED');
    setTargetCount(1);
    setRewardExp(50);
    setRewardItemId('');
    setIsActive(true);
    setMessage('');
    setError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (q: Quest) => {
    setEditingQuest(q);
    setTitle(q.title);
    setDescription(q.description);
    setCategory(q.category);
    setActionType(q.actionType);
    setTargetCount(q.targetCount);
    setRewardExp(q.rewardExp);
    setRewardItemId(q.rewardItemId || '');
    setIsActive(q.isActive ?? true);
    setMessage('');
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Vui lòng nhập đầy đủ tiêu đề và mô tả nhiệm vụ.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        category,
        actionType,
        targetCount: Math.max(1, Number(targetCount) || 1),
        rewardExp: Math.max(0, Number(rewardExp) || 0),
        rewardItemId: rewardItemId || null,
        isActive
      };

      if (editingQuest) {
        const res = await api.updateAdminQuest(editingQuest.id, payload);
        setMessage(res.data.message || 'Cập nhật nhiệm vụ thành công!');
        setQuests(prev => prev.map(q => (q.id === editingQuest.id ? { ...q, ...res.data.quest } : q)));
      } else {
        const res = await api.createAdminQuest(payload);
        setMessage(res.data.message || 'Tạo nhiệm vụ thành công!');
        setQuests(prev => [res.data.quest, ...prev]);
      }

      setIsModalOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (q: Quest) => {
    setBusyId(q.id);
    try {
      const res = await api.toggleAdminQuest(q.id);
      setQuests(prev => prev.map(item => (item.id === q.id ? { ...item, isActive: res.data.quest.isActive } : item)));
      setMessage(res.data.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (q: Quest) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa nhiệm vụ "${q.title}"?`)) return;
    setBusyId(q.id);
    try {
      const res = await api.deleteAdminQuest(q.id);
      setQuests(prev => prev.filter(item => item.id !== q.id));
      setMessage(res.data.message || 'Đã xóa nhiệm vụ thành công!');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const filteredQuests = quests.filter(q => {
    const matchesCategory = filterCategory === 'ALL' || q.category === filterCategory;
    const matchesSearch =
      q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const activeCount = quests.filter(q => q.isActive).length;
  const dailyCount = quests.filter(q => q.category === 'DAILY').length;
  const weeklyCount = quests.filter(q => q.category === 'WEEKLY').length;

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {message && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 shadow-xs animate-in fade-in">
          <CheckCircle size={18} className="shrink-0 text-emerald-600" />
          <span className="flex-1">{message}</span>
          <button onClick={() => setMessage('')} className="text-slate-400 hover:text-slate-700 p-1">
            <X size={15} />
          </button>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 shadow-xs animate-in fade-in">
          <AlertCircle size={18} className="shrink-0 text-rose-600" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-slate-400 hover:text-slate-700 p-1">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Header & Stats Banner */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border-2 border-slate-900 bg-[#fffdfa] shadow-[3px_3px_0px_#0f172a] p-4 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">TỔNG NHIỆM VỤ</div>
          <div className="mt-1 text-2xl font-black text-slate-900">{quests.length}</div>
        </div>
        <div className="rounded-2xl border-2 border-slate-900 bg-[#fffdfa] shadow-[3px_3px_0px_#0f172a] p-4 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">ĐANG HOẠT ĐỘNG</div>
          <div className="mt-1 text-2xl font-black text-emerald-600">{activeCount}</div>
        </div>
        <div className="rounded-2xl border-2 border-slate-900 bg-[#fffdfa] shadow-[3px_3px_0px_#0f172a] p-4 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600">HÀNG NGÀY (DAILY)</div>
          <div className="mt-1 text-2xl font-black text-blue-600">{dailyCount}</div>
        </div>
        <div className="rounded-2xl border-2 border-slate-900 bg-[#fffdfa] shadow-[3px_3px_0px_#0f172a] p-4 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600">HÀNG TUẦN (WEEKLY)</div>
          <div className="mt-1 text-2xl font-black text-amber-600">{weeklyCount}</div>
        </div>
      </div>

      {/* Controls & Search */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm nhiệm vụ..."
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#231e36] focus:ring-2 focus:ring-[#231e36]/15"
            />
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
            <Filter size={14} className="ml-1 text-slate-400" />
            {(['ALL', 'DAILY', 'WEEKLY', 'SPECIAL'] as const).map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCategory(cat)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                  filterCategory === cat
                    ? 'bg-amber-400 text-slate-950 font-black border-2 border-slate-900 shadow-[0_2px_0_#0f172a]'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                {cat === 'ALL' ? 'Tất cả' : cat === 'DAILY' ? 'Hàng ngày' : cat === 'WEEKLY' ? 'Hàng tuần' : 'Đặc biệt'}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-xs transition active:scale-95 shrink-0"
        >
          <Plus size={16} /> THÊM NHIỆM VỤ MỚI
        </button>
      </div>

      {/* Quest List */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <Award size={18} />
            </div>
            <h3 className="text-sm font-bold text-slate-900">DANH SÁCH NHIỆM VỤ ({filteredQuests.length})</h3>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#231e36] border-t-transparent" />
            <p className="mt-3 text-xs text-slate-500 font-medium">Đang tải danh sách nhiệm vụ...</p>
          </div>
        ) : filteredQuests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400">
            <Award size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs text-slate-500">Không tìm thấy nhiệm vụ nào.</p>
            <button
              onClick={handleOpenCreateModal}
              className="mt-3 text-xs font-bold text-[#231e36] underline hover:text-[#332b4f]"
            >
              + Tạo nhiệm vụ đầu tiên ngay
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredQuests.map(q => {
              const actInfo = actionTypes.find(a => a.value === q.actionType) || actionTypes[0];
              const ActIcon = actInfo.icon;
              const catInfo = categories.find(c => c.value === q.category) || categories[0];

              return (
                <div
                  key={q.id}
                  className={`flex flex-col justify-between rounded-2xl border-2 border-slate-900 bg-[#fffdfa] shadow-[3px_3px_0px_#0f172a] p-4 shadow-xs hover:border-slate-300 transition ${
                    !q.isActive ? 'opacity-60 bg-slate-50/60' : ''
                  }`}
                >
                  <div className="space-y-2.5">
                    {/* Badges Row */}
                    <div className="flex items-center justify-between gap-1">
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${catInfo.color}`}>
                        {catInfo.label}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={`flex items-center gap-1 text-[11px] font-semibold ${actInfo.color}`}>
                          <ActIcon size={14} /> {actInfo.label.split(' ')[0]}
                        </span>
                      </div>
                    </div>

                    {/* Title & Desc */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{q.title}</h4>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{q.description}</p>
                    </div>

                    {/* Target & Reward Info */}
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Mục tiêu:</span>
                        <span className="font-bold text-slate-800">
                          {q.targetCount} {q.actionType === 'POMODORO' ? 'phiên' : 'lần'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Thưởng EXP:</span>
                        <span className="font-bold text-amber-600 flex items-center gap-1">
                          <Sparkles size={12} /> +{q.rewardExp} EXP
                        </span>
                      </div>
                      {q.rewardItem && (
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                          <span className="text-slate-500 font-medium">Vật phẩm:</span>
                          <span className="font-bold text-[#231e36] flex items-center gap-1.5">
                            <img
                              src={q.rewardItem.imageUrl}
                              alt={q.rewardItem.name}
                              className="h-5 w-5 object-contain"
                              onError={e => {
                                (e.currentTarget as HTMLImageElement).src = '/sprites/default_pet.png';
                              }}
                            />
                            {q.rewardItem.name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      disabled={busyId === q.id}
                      onClick={() => handleToggle(q)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50"
                      title={q.isActive ? 'Nhấp để tạm ngưng' : 'Nhấp để kích hoạt'}
                    >
                      {q.isActive ? (
                        <>
                          <ToggleRight size={22} className="text-emerald-500" />
                          <span className="text-[11px] text-emerald-700 font-bold">Đang bật</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft size={22} className="text-slate-400" />
                          <span className="text-[11px] text-slate-400">Tắt</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(q)}
                        className="rounded-lg p-1.5 text-slate-400 hover:text-[#231e36] hover:bg-slate-100 transition"
                        title="Chỉnh sửa nhiệm vụ"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        type="button"
                        disabled={busyId === q.id}
                        onClick={() => handleDelete(q)}
                        className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition disabled:opacity-50"
                        title="Xóa nhiệm vụ"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Quest Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-2xl text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Award size={18} />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  {editingQuest ? 'CHỈNH SỬA NHIỆM VỤ' : 'THIẾT LẬP NHIỆM VỤ MỚI'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tiêu đề nhiệm vụ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="VD: Bữa ăn thịnh soạn, Chinh phục Pomodoro..."
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#231e36] focus:ring-2 focus:ring-[#231e36]/15"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mô tả nhiệm vụ <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Mô tả cụ thể hành động người dùng cần làm để hoàn thành nhiệm vụ..."
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#231e36] focus:ring-2 focus:ring-[#231e36]/15 resize-y"
                />
              </div>

              {/* Category & Action Type Grid */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Chu kỳ nhiệm vụ</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:outline-none focus:border-[#231e36] focus:ring-2 focus:ring-[#231e36]/15"
                  >
                    {categories.map(c => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Loại hành động</label>
                  <select
                    value={actionType}
                    onChange={e => setActionType(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:outline-none focus:border-[#231e36] focus:ring-2 focus:ring-[#231e36]/15"
                  >
                    {actionTypes.map(a => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Target Count & Reward EXP Grid */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Số lần mục tiêu <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={targetCount}
                    onChange={e => setTargetCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:outline-none focus:border-[#231e36] focus:ring-2 focus:ring-[#231e36]/15"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">Số lần người dùng cần thực hiện hành động này.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phần thưởng EXP <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={rewardExp}
                    onChange={e => setRewardExp(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:outline-none focus:border-[#231e36] focus:ring-2 focus:ring-[#231e36]/15"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">Điểm kinh nghiệm thưởng cho bé cưng.</p>
                </div>
              </div>

              {/* Reward Item Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Vật phẩm thưởng kèm (Tùy chọn)
                </label>
                <select
                  value={rewardItemId}
                  onChange={e => setRewardItemId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:outline-none focus:border-[#231e36] focus:ring-2 focus:ring-[#231e36]/15"
                >
                  <option value="">-- Không có vật phẩm thưởng kèm --</option>
                  {shopItems.map(item => (
                    <option key={item.id} value={item.id}>
                      [{item.itemType}] {item.name} ({item.rarity})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-slate-400">
                  Người dùng sẽ nhận vật phẩm này vào túi đồ khi bấm nhận thưởng nhiệm vụ.
                </p>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#231e36] focus:ring-0"
                />
                <label htmlFor="isActive" className="text-xs font-semibold text-slate-700 select-none cursor-pointer">
                  Kích hoạt nhiệm vụ này ngay sau khi lưu
                </label>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  HỦY
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 px-5 py-2 text-xs font-bold text-slate-950 shadow-xs transition active:scale-95 disabled:opacity-50"
                >
                  {saving ? 'ĐANG LƯU...' : editingQuest ? 'LƯU THAY ĐỔI' : 'TẠO NHIỆM VỤ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
