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
  X
} from 'lucide-react';
import { api } from '../services/api';
import { Quest, ShopItem } from '../types';

const categories = [
  { value: 'DAILY', label: 'Hàng ngày (Daily)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { value: 'WEEKLY', label: 'Hàng tuần (Weekly)', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { value: 'SPECIAL', label: 'Đặc biệt / Sự kiện', color: 'bg-amber-100 text-amber-800 border-amber-300' }
];

const actionTypes = [
  { value: 'FEED', label: 'Cho bé ăn (FEED)', icon: Utensils, color: 'text-terracotta-500' },
  { value: 'DRINK', label: 'Uống nước cùng bé (DRINK)', icon: Coffee, color: 'text-cyan-600' },
  { value: 'STROKE', label: 'Vuốt ve âu yếm (STROKE)', icon: Heart, color: 'text-pink-500' },
  { value: 'POMODORO', label: 'Tập trung Pomodoro (POMODORO)', icon: Timer, color: 'text-indigo-600' },
  { value: 'CHAT', label: 'Trò chuyện AI (CHAT)', icon: MessageSquare, color: 'text-sage-600' },
  { value: 'MUSIC', label: 'Nghe nhạc thư giãn (MUSIC)', icon: Music, color: 'text-violet-600' }
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
  const [actionType, setActionType] = useState<'FEED' | 'DRINK' | 'STROKE' | 'POMODORO' | 'CHAT' | 'MUSIC'>('FEED');
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
        <div className="flex items-center gap-2 rounded-xl border-2 border-emerald-500 bg-emerald-50 p-4 text-sm font-bold text-emerald-800 shadow-pixel animate-in fade-in">
          <CheckCircle size={18} className="shrink-0 text-emerald-600" />
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="ml-auto text-emerald-700 hover:text-emerald-900">
            <X size={16} />
          </button>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border-2 border-terracotta-500 bg-terracotta-50 p-4 text-sm font-bold text-terracotta-800 shadow-pixel animate-in fade-in">
          <AlertCircle size={18} className="shrink-0 text-terracotta-600" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-terracotta-700 hover:text-terracotta-900">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header & Stats Banner */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border-2 border-charcoal bg-white p-3 shadow-pixel">
          <div className="text-[10px] font-pixel text-charcoal/60">TỔNG NHIỆM VỤ</div>
          <div className="mt-1 text-2xl font-black text-charcoal">{quests.length}</div>
        </div>
        <div className="rounded-xl border-2 border-charcoal bg-white p-3 shadow-pixel">
          <div className="text-[10px] font-pixel text-emerald-600">ĐANG HOẠT ĐỘNG</div>
          <div className="mt-1 text-2xl font-black text-emerald-600">{activeCount}</div>
        </div>
        <div className="rounded-xl border-2 border-charcoal bg-white p-3 shadow-pixel">
          <div className="text-[10px] font-pixel text-indigo-600">HÀNG NGÀY (DAILY)</div>
          <div className="mt-1 text-2xl font-black text-indigo-600">{dailyCount}</div>
        </div>
        <div className="rounded-xl border-2 border-charcoal bg-white p-3 shadow-pixel">
          <div className="text-[10px] font-pixel text-amber-600">HÀNG TUẦN (WEEKLY)</div>
          <div className="mt-1 text-2xl font-black text-amber-600">{weeklyCount}</div>
        </div>
      </div>

      {/* Controls & Search */}
      <div className="flex flex-col gap-3 rounded-2xl border-4 border-charcoal bg-cream-100 p-4 shadow-pixel sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm nhiệm vụ..."
              className="w-full rounded-lg border-2 border-charcoal bg-white py-1.5 pl-9 pr-3 text-xs font-medium text-charcoal placeholder-charcoal/40 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg border-2 border-charcoal bg-white p-1">
            <Filter size={14} className="ml-1 text-charcoal/40" />
            {(['ALL', 'DAILY', 'WEEKLY', 'SPECIAL'] as const).map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCategory(cat)}
                className={`rounded px-2.5 py-1 text-[11px] font-bold transition-all ${
                  filterCategory === cat
                    ? 'bg-charcoal text-white'
                    : 'text-charcoal/70 hover:bg-charcoal/10'
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
          className="flex items-center justify-center gap-2 rounded-xl border-2 border-charcoal bg-emerald-500 px-4 py-2 font-pixel text-xs text-white shadow-pixel hover:bg-emerald-600 active:translate-y-0.5"
        >
          <Plus size={16} /> THÊM NHIỆM VỤ MỚI
        </button>
      </div>

      {/* Quest List */}
      <div className="rounded-2xl border-4 border-charcoal bg-cream-100 p-4 shadow-pixel">
        <div className="mb-4 flex items-center justify-between border-b-2 border-charcoal/20 pb-3">
          <div className="flex items-center gap-2">
            <Award className="text-terracotta-500" size={20} />
            <h3 className="font-pixel text-sm text-charcoal">DANH SÁCH NHIỆM VỤ ({filteredQuests.length})</h3>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-charcoal/60">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-charcoal border-t-transparent" />
            <p className="mt-3 font-pixel text-xs">Đang tải danh sách nhiệm vụ...</p>
          </div>
        ) : filteredQuests.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-charcoal/30 p-8 text-center text-charcoal/60">
            <Award size={36} className="mx-auto mb-2 opacity-40" />
            <p className="font-pixel text-xs">Không tìm thấy nhiệm vụ nào.</p>
            <button
              onClick={handleOpenCreateModal}
              className="mt-3 text-xs font-bold text-terracotta-600 underline hover:text-terracotta-700"
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
                  className={`flex flex-col justify-between rounded-xl border-2 border-charcoal bg-white p-4 shadow-pixel transition-all ${
                    !q.isActive ? 'opacity-60 bg-gray-50' : ''
                  }`}
                >
                  <div className="space-y-2.5">
                    {/* Badges Row */}
                    <div className="flex items-center justify-between gap-1">
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${catInfo.color}`}>
                        {catInfo.label}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={`flex items-center gap-1 text-[11px] font-bold ${actInfo.color}`}>
                          <ActIcon size={14} /> {actInfo.label.split(' ')[0]}
                        </span>
                      </div>
                    </div>

                    {/* Title & Desc */}
                    <div>
                      <h4 className="font-pixel text-xs text-charcoal">{q.title}</h4>
                      <p className="mt-1 line-clamp-2 text-xs text-charcoal/70">{q.description}</p>
                    </div>

                    {/* Target & Reward Info */}
                    <div className="rounded-lg border border-charcoal/20 bg-cream-50 p-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-charcoal/60 font-medium">Mục tiêu:</span>
                        <span className="font-bold text-charcoal">
                          {q.targetCount} {q.actionType === 'POMODORO' ? 'phiên' : 'lần'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-charcoal/60 font-medium">Thưởng EXP:</span>
                        <span className="font-black text-emerald-600 flex items-center gap-1">
                          <Sparkles size={12} /> +{q.rewardExp} EXP
                        </span>
                      </div>
                      {q.rewardItem && (
                        <div className="flex items-center justify-between pt-1 border-t border-charcoal/10">
                          <span className="text-charcoal/60 font-medium">Vật phẩm:</span>
                          <span className="font-bold text-terracotta-600 flex items-center gap-1.5">
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
                  <div className="mt-4 flex items-center justify-between border-t border-charcoal/10 pt-3">
                    <button
                      type="button"
                      disabled={busyId === q.id}
                      onClick={() => handleToggle(q)}
                      className="flex items-center gap-1.5 text-xs font-bold text-charcoal/80 hover:text-charcoal disabled:opacity-50"
                      title={q.isActive ? 'Nhấp để tạm ngưng' : 'Nhấp để kích hoạt'}
                    >
                      {q.isActive ? (
                        <>
                          <ToggleRight size={20} className="text-emerald-500" />
                          <span className="text-[11px] text-emerald-700">Đang bật</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft size={20} className="text-charcoal/40" />
                          <span className="text-[11px] text-charcoal/40">Tắt</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(q)}
                        className="rounded p-1.5 text-charcoal/70 hover:bg-charcoal/10 hover:text-charcoal"
                        title="Chỉnh sửa nhiệm vụ"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        type="button"
                        disabled={busyId === q.id}
                        onClick={() => handleDelete(q)}
                        className="rounded p-1.5 text-terracotta-500 hover:bg-terracotta-50 hover:text-terracotta-700 disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border-4 border-charcoal bg-cream-100 p-6 shadow-pixel text-charcoal">
            <div className="flex items-center justify-between border-b-2 border-charcoal/20 pb-3">
              <div className="flex items-center gap-2">
                <Award className="text-terracotta-500" size={20} />
                <h3 className="font-pixel text-xs text-charcoal">
                  {editingQuest ? 'CHỈNH SỬA NHIỆM VỤ' : 'THIẾT LẬP NHIỆM VỤ MỚI'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded p-1 hover:bg-charcoal/10"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-charcoal mb-1">
                  Tiêu đề nhiệm vụ <span className="text-terracotta-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="VD: Bữa ăn thịnh soạn, Chinh phục Pomodoro..."
                  className="w-full rounded-lg border-2 border-charcoal bg-white p-2.5 text-xs font-medium focus:outline-hidden"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-charcoal mb-1">
                  Mô tả nhiệm vụ <span className="text-terracotta-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Mô tả cụ thể hành động người dùng cần làm để hoàn thành nhiệm vụ..."
                  className="w-full rounded-lg border-2 border-charcoal bg-white p-2.5 text-xs font-medium focus:outline-hidden"
                />
              </div>

              {/* Category & Action Type Grid */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-charcoal mb-1">Chu kỳ nhiệm vụ</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="w-full rounded-lg border-2 border-charcoal bg-white p-2 text-xs font-medium focus:outline-hidden"
                  >
                    {categories.map(c => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-charcoal mb-1">Loại hành động</label>
                  <select
                    value={actionType}
                    onChange={e => setActionType(e.target.value as any)}
                    className="w-full rounded-lg border-2 border-charcoal bg-white p-2 text-xs font-medium focus:outline-hidden"
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
                  <label className="block text-xs font-bold text-charcoal mb-1">
                    Số lần mục tiêu <span className="text-terracotta-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={targetCount}
                    onChange={e => setTargetCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full rounded-lg border-2 border-charcoal bg-white p-2 text-xs font-medium focus:outline-hidden"
                  />
                  <p className="mt-1 text-[10px] text-charcoal/60">Số lần người dùng cần thực hiện hành động này.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-charcoal mb-1">
                    Phần thưởng EXP <span className="text-terracotta-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={rewardExp}
                    onChange={e => setRewardExp(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full rounded-lg border-2 border-charcoal bg-white p-2 text-xs font-medium focus:outline-hidden"
                  />
                  <p className="mt-1 text-[10px] text-charcoal/60">Điểm kinh nghiệm thưởng cho bé cưng.</p>
                </div>
              </div>

              {/* Reward Item Selector */}
              <div>
                <label className="block text-xs font-bold text-charcoal mb-1">
                  Vật phẩm thưởng kèm (Tùy chọn)
                </label>
                <select
                  value={rewardItemId}
                  onChange={e => setRewardItemId(e.target.value)}
                  className="w-full rounded-lg border-2 border-charcoal bg-white p-2 text-xs font-medium focus:outline-hidden"
                >
                  <option value="">-- Không có vật phẩm thưởng kèm --</option>
                  {shopItems.map(item => (
                    <option key={item.id} value={item.id}>
                      [{item.itemType}] {item.name} ({item.rarity})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-charcoal/60">
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
                  className="h-4 w-4 rounded border-2 border-charcoal text-emerald-600 focus:ring-0"
                />
                <label htmlFor="isActive" className="text-xs font-bold text-charcoal select-none cursor-pointer">
                  Kích hoạt nhiệm vụ này ngay sau khi lưu
                </label>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-2 border-t-2 border-charcoal/10 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border-2 border-charcoal bg-white px-4 py-2 font-pixel text-xs text-charcoal hover:bg-charcoal/5"
                >
                  HỦY
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-xl border-2 border-charcoal bg-emerald-500 px-5 py-2 font-pixel text-xs text-white shadow-pixel hover:bg-emerald-600 disabled:opacity-50"
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
