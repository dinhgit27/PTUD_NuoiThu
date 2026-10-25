import React, { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import {
  ShoppingBag,
  Sparkles,
  TreePine,
  PawPrint,
  Upload,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
  Layers,
  Search,
  Check,
  Coins
} from 'lucide-react';
import { api } from '../services/api';
import { GardenBackground, PetType, ShopItem } from '../types';
import { BackgroundThumb } from './BackgroundThumb';

function errorMessage(error: unknown) {
  return error instanceof AxiosError
    ? error.response?.data?.error || 'Không thể hoàn thành thao tác.'
    : 'Không thể hoàn thành thao tác.';
}

export const AdminShopManagement: React.FC = () => {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [pets, setPets] = useState<PetType[]>([]);
  const [backgrounds, setBackgrounds] = useState<GardenBackground[]>([]);

  // Multi-Pet Sheet Management Modal
  const [sheetModalItem, setSheetModalItem] = useState<ShopItem | null>(null);
  const [uploadingPetId, setUploadingPetId] = useState<string | null>(null);
  const [sheetUploadMessage, setSheetUploadMessage] = useState('');
  const [sheetUploadError, setSheetUploadError] = useState('');

  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Sub-tabs & Pet Market Management State
  const [activeSubTab, setActiveSubTab] = useState<'PETS' | 'ITEMS' | 'BACKGROUNDS'>('PETS');
  const [petSearch, setPetSearch] = useState('');
  const [petFilter, setPetFilter] = useState<'ALL' | 'ENABLED' | 'DISABLED'>('ALL');
  const [editingPetPrices, setEditingPetPrices] = useState<Record<string, number>>({});

  const handleToggleShopPet = async (pet: PetType) => {
    setBusyId(`pet-${pet.id}`);
    setError('');
    setMessage('');
    try {
      const nextEnabled = !pet.isShopEnabled;
      const currentPrice = editingPetPrices[pet.id] !== undefined ? editingPetPrices[pet.id] : (pet.expPrice || 100);
      const res = await api.updateAdminShopPet(pet.id, {
        isShopEnabled: nextEnabled,
        expPrice: currentPrice
      });
      setMessage(res.data.message || (nextEnabled ? `Đã mở bán thú cưng "${pet.name}" trong Shop!` : `Đã gỡ thú cưng "${pet.name}" khỏi Shop!`));
      await loadData();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleUpdatePetPrice = async (pet: PetType, newPrice: number) => {
    if (!Number.isInteger(newPrice) || newPrice < 0) return;
    setBusyId(`pet-price-${pet.id}`);
    setError('');
    setMessage('');
    try {
      await api.updateAdminShopPet(pet.id, {
        isShopEnabled: pet.isShopEnabled,
        expPrice: newPrice
      });
      setMessage(`Đã cập nhật giá bán thú cưng "${pet.name}" thành ${newPrice} EXP.`);
      await loadData();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleDeletePet = async (pet: PetType) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa thú cưng "${pet.name}" không?\nThao tác này sẽ xóa vĩnh viễn khỏi CSDL và gỡ khỏi Cửa Hàng, không thể hoàn tác!`)) {
      return;
    }
    setBusyId(`pet-del-${pet.id}`);
    setError('');
    setMessage('');
    try {
      await api.deletePet(pet.id);
      setMessage(`Đã xóa vĩnh viễn thú cưng "${pet.name}" thành công!`);
      await loadData();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteItem = async (item: ShopItem) => {
    if (!window.confirm(`Bạn có chắc muốn xóa vĩnh viễn vật phẩm "${item.name}" không?\nThao tác này không thể hoàn tác!`)) {
      return;
    }
    setBusyId(`del-item-${item.id}`);
    setError('');
    setMessage('');
    try {
      await api.deleteAdminShopItem(item.id);
      setMessage(`Đã xóa vĩnh viễn vật phẩm "${item.name}" thành công!`);
      await loadData();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const filteredPets = pets.filter(pet => {
    const matchesSearch = !petSearch.trim() || pet.name.toLowerCase().includes(petSearch.toLowerCase().trim());
    if (!matchesSearch) return false;
    if (petFilter === 'ENABLED') return pet.isShopEnabled;
    if (petFilter === 'DISABLED') return !pet.isShopEnabled;
    return true;
  });

  const loadData = async () => {
    try {
      const [itemResponse, petResponse, backgroundResponse] = await Promise.all([
        api.getAdminShopItems(),
        api.getAdminShopPets(),
        api.getAdminBackgrounds()
      ]);
      setItems(itemResponse.data);
      setPets(petResponse.data);
      setBackgrounds(backgroundResponse.data);
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const updateItem = async (item: ShopItem, changes: { expPrice?: number; isAvailable?: boolean; compatiblePetIds?: string[] | null }) => {
    setBusyId(item.id);
    setError('');
    try {
      await api.updateAdminShopItem(item.id, changes);
      await loadData();
    } catch (updateError) {
      setError(errorMessage(updateError));
    } finally {
      setBusyId(null);
    }
  };

  // Upload pet-specific sprite sheet
  const handleUploadPetSheet = async (itemId: string, petTypeId: string, file: File) => {
    setUploadingPetId(petTypeId);
    setSheetUploadError('');
    setSheetUploadMessage('');
    try {
      const form = new FormData();
      form.set('spriteSheet', file);
      form.set('petTypeId', petTypeId);
      const res = await api.uploadItemPetSheet(itemId, form);
      setSheetUploadMessage(res.data.message || 'Đã tải lên sprite sheet cho thú cưng!');
      setSheetModalItem(res.data.item);
      await loadData();
    } catch (err) {
      setSheetUploadError(errorMessage(err));
    } finally {
      setUploadingPetId(null);
    }
  };

  // Delete pet-specific sprite sheet
  const handleDeletePetSheet = async (itemId: string, petTypeId: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa sheet riêng của loài thú này?')) return;
    setUploadingPetId(petTypeId);
    setSheetUploadError('');
    setSheetUploadMessage('');
    try {
      const res = await api.deleteItemPetSheet(itemId, petTypeId);
      setSheetUploadMessage(res.data.message || 'Đã xóa sprite sheet cho loài thú này!');
      setSheetModalItem(res.data.item);
      await loadData();
    } catch (err) {
      setSheetUploadError(errorMessage(err));
    } finally {
      setUploadingPetId(null);
    }
  };

  // Format compatibility text
  const getCompatibilityText = (item: ShopItem) => {
    const compat = item.compatiblePetIds || (item.petTypeId ? [item.petTypeId] : []);
    if (!compat || compat.length === 0) {
      return { isAll: true, text: 'Dành cho mọi thú cưng' };
    }
    const matchedNames = pets.filter(p => compat.includes(p.id)).map(p => p.name);
    return {
      isAll: false,
      text: `Chỉ dành cho: ${matchedNames.join(', ') || 'Loài thú nhất định'}`
    };
  };

  return (
    <div className="space-y-6">
      {/* Top Sub-Tab Navigation Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab('PETS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition shadow-xs ${
            activeSubTab === 'PETS'
              ? 'bg-[#1b365d] text-white'
              : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80'
          }`}
        >
          <PawPrint size={15} /> Quản lý bán Thú cưng ({pets.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('ITEMS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition shadow-xs ${
            activeSubTab === 'ITEMS'
              ? 'bg-[#1b365d] text-white'
              : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80'
          }`}
        >
          <ShoppingBag size={15} /> Vật phẩm & Skin ({items.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('BACKGROUNDS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition shadow-xs ${
            activeSubTab === 'BACKGROUNDS'
              ? 'bg-[#1b365d] text-white'
              : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80'
          }`}
        >
          <TreePine size={15} /> Bối cảnh khu vườn ({backgrounds.length})
        </button>
      </div>

      {(error || message) && (
        <div
          role={error ? 'alert' : 'status'}
          className={`flex items-center gap-2 rounded-xl border p-3.5 text-xs font-semibold shadow-xs animate-in fade-in ${
            error
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {error ? <AlertCircle size={17} className="text-rose-600 shrink-0" /> : <CheckCircle size={17} className="text-emerald-600 shrink-0" />}
          <span className="flex-1">{error || message}</span>
          <button onClick={() => { setError(''); setMessage(''); }} className="text-slate-400 hover:text-slate-700 p-1">
            <X size={15} />
          </button>
        </div>
      )}

      {/* 1. PET MANAGEMENT SECTION */}
      {activeSubTab === 'PETS' && (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-sm text-slate-900">
                <PawPrint size={18} className="text-amber-500" /> Quản Lý Mở Bán Thú Cưng Trong Shop ({pets.length})
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Bật mở bán để thú cưng xuất hiện trong Cửa Hàng (tab Thú Cưng) cho nhân viên mua bằng điểm EXP tích lũy.
              </p>
            </div>

            {/* Filter and Search */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  value={petSearch}
                  onChange={e => setPetSearch(e.target.value)}
                  placeholder="Tìm theo tên thú..."
                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/15 w-44 text-slate-900 placeholder:text-slate-400"
                />
                <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              </div>

              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs">
                <button
                  type="button"
                  onClick={() => setPetFilter('ALL')}
                  className={`px-3 py-1 rounded-lg font-bold transition ${petFilter === 'ALL' ? 'bg-[#1b365d] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Tất cả ({pets.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPetFilter('ENABLED')}
                  className={`px-3 py-1 rounded-lg font-bold transition ${petFilter === 'ENABLED' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:text-emerald-900'}`}
                >
                  Đang bán ({pets.filter(p => p.isShopEnabled).length})
                </button>
                <button
                  type="button"
                  onClick={() => setPetFilter('DISABLED')}
                  className={`px-3 py-1 rounded-lg font-bold transition ${petFilter === 'DISABLED' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Chưa bán ({pets.filter(p => !p.isShopEnabled).length})
                </button>
              </div>
            </div>
          </div>

          {/* Pet Cards List */}
          {filteredPets.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-slate-500 text-xs shadow-xs">
              Không tìm thấy thú cưng nào phù hợp với bộ lọc.
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredPets.map(pet => {
                const currentPrice = editingPetPrices[pet.id] !== undefined ? editingPetPrices[pet.id] : (pet.expPrice || 100);
                const isBusy = busyId === `pet-${pet.id}` || busyId === `pet-price-${pet.id}`;

                return (
                  <article
                    key={pet.id}
                    className={`flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-4 rounded-2xl border bg-white p-4 shadow-xs transition ${
                      pet.isShopEnabled ? 'border-emerald-300 bg-emerald-50/15' : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    {/* Pet Info & Thumbnail */}
                    <div className="flex items-start gap-3 flex-1 min-w-[260px]">
                      <div className="h-16 w-16 rounded-xl border border-slate-200 p-1 bg-slate-50 shrink-0 flex items-center justify-center overflow-hidden">
                        <img
                          src={pet.previewUrl || pet.spriteSheetUrl}
                          alt={pet.name}
                          className="max-h-full max-w-full object-contain"
                          style={{ imageRendering: 'pixelated' }}
                          onError={e => {
                            (e.currentTarget as HTMLImageElement).src = '/sprites/default_pet.png';
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-xs font-bold text-slate-900">
                            {pet.name}
                          </strong>
                          {pet.isShopEnabled ? (
                            <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold flex items-center gap-1">
                              <Check size={11} /> Đang mở bán trong Shop
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-0.5 text-[10px] font-semibold">
                              Chưa mở bán
                            </span>
                          )}
                          {pet.isActive ? (
                            <span className="rounded-full bg-blue-50 text-[#1b365d] border border-blue-200 px-2.5 py-0.5 text-[10px] font-bold">
                              Đã xuất bản
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 text-[10px] font-semibold">
                              Bản nháp (Draft)
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 line-clamp-1">
                          {pet.description || 'Thú cưng 2D Pixel Art 17 trạng thái hoạt ảnh'}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                          <span>Mở khóa cấp: {pet.unlockLevel || 1}</span>
                          <span>•</span>
                          <span>Ô: {pet.frameConfig?.frameWidth || 64}×{pet.frameConfig?.frameHeight || 64}px</span>
                          <span>•</span>
                          <span className="text-amber-700 font-bold">{pet.expPrice || 0} EXP</span>
                        </div>
                      </div>
                    </div>

                    {/* Shop Controls */}
                    <div className="flex flex-wrap items-center gap-2.5 border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto justify-end">
                      {/* Price Setting */}
                      <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                        <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                          <Coins size={13} className="text-amber-500" /> Giá EXP:
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={currentPrice}
                          onChange={e => {
                            const val = parseInt(e.target.value) || 0;
                            setEditingPetPrices(prev => ({ ...prev, [pet.id]: val }));
                          }}
                          onBlur={() => {
                            if (currentPrice !== pet.expPrice) {
                              void handleUpdatePetPrice(pet, currentPrice);
                            }
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              void handleUpdatePetPrice(pet, currentPrice);
                            }
                          }}
                          className="w-16 rounded-lg border border-slate-300 px-1.5 py-0.5 text-xs font-mono font-bold text-center bg-white text-slate-900 focus:outline-none focus:border-[#1b365d]"
                        />
                        {editingPetPrices[pet.id] !== undefined && editingPetPrices[pet.id] !== pet.expPrice && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleUpdatePetPrice(pet, currentPrice)}
                            className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-700 transition"
                            title="Lưu giá mới"
                          >
                            Lưu
                          </button>
                        )}
                      </div>

                      {/* Toggle Shop Button */}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleToggleShopPet(pet)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs active:scale-95 disabled:opacity-50 ${
                          pet.isShopEnabled
                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        <ShoppingBag size={14} />
                        <span>
                          {isBusy
                            ? 'Đang xử lý...'
                            : pet.isShopEnabled
                            ? 'Gỡ khỏi Shop'
                            : '🛒 Mở bán trong Shop'}
                        </span>
                      </button>

                      {/* Delete Pet Button */}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleDeletePet(pet)}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white shadow-xs transition active:scale-95 disabled:opacity-50"
                        title="Xóa vĩnh viễn thú cưng này khỏi hệ thống"
                      >
                        <Trash2 size={14} />
                        <span>Xóa</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 2. Item Management Section */}
      {activeSubTab === 'ITEMS' && (
      <section className="space-y-4">
        <h3 className="flex items-center gap-2 font-bold text-sm text-slate-900">
          <ShoppingBag size={17} className="text-amber-500" /> Quản lý vật phẩm & Skin đang có ({items.length})
        </h3>

        <div className="grid gap-3">
          {items.map(item => {
            const compat = getCompatibilityText(item);
            const customSheetCount = item.petSheets ? Object.keys(item.petSheets).length : 0;

            return (
              <article
                key={item.id}
                className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-4 rounded-2xl border border-slate-200/80 hover:border-slate-300 bg-white p-4 shadow-xs transition"
              >
                <div className="flex items-start gap-3 flex-1 min-w-[240px]">
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="h-14 w-14 rounded-xl border border-slate-200 object-contain p-1 bg-slate-50 shrink-0"
                    style={{ imageRendering: 'pixelated' }}
                    onError={e => {
                      (e.currentTarget as HTMLImageElement).src = '/sprites/default_pet.png';
                    }}
                  />
                  <div className="space-y-1">
                    <strong className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      {item.name}
                      <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[9px] font-bold text-slate-700">
                        {item.itemType} · {item.rarity}
                      </span>
                    </strong>
                    <p className="text-[11px] text-slate-600 line-clamp-1">{item.description || 'Không có mô tả.'}</p>

                    {/* Compatibility Badge / Note */}
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
                          compat.isAll
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-purple-50 text-purple-800 border-purple-200'
                        }`}
                      >
                        <PawPrint size={11} /> {compat.text}
                      </span>

                      {item.spriteSheetUrl && (
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-[#1b365d] border border-blue-200">
                          ✨ Hoạt ảnh 17 trạng thái
                        </span>
                      )}

                      {customSheetCount > 0 && (
                        <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
                          🐾 {customSheetCount} sheet riêng theo thú
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Controls & Actions */}
                <div className="flex flex-wrap items-center gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto justify-end">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    EXP:
                    <input
                      aria-label={`Giá EXP ${item.name}`}
                      type="number"
                      min="0"
                      defaultValue={item.expPrice}
                      onBlur={event => {
                        const price = Number(event.target.value);
                        if (Number.isInteger(price) && price >= 0 && price !== item.expPrice) {
                          void updateItem(item, { expPrice: price });
                        }
                      }}
                      className="w-20 rounded-xl border border-slate-300 px-2.5 py-1 text-xs text-slate-900 font-mono font-bold text-center focus:border-[#1b365d] focus:ring-1 focus:ring-[#1b365d]"
                    />
                  </label>

                  <button
                    disabled={busyId === item.id}
                    onClick={() => void updateItem(item, { isAvailable: !item.isAvailable })}
                    className={`rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition ${
                      item.isAvailable
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {item.isAvailable ? 'Đang mở bán' : 'Đã ẩn'}
                  </button>

                  {/* Multi-Pet Sheets Management Button */}
                  {item.itemType !== 'FOOD' && (
                    <button
                      type="button"
                      onClick={() => {
                        setSheetModalItem(item);
                        setSheetUploadError('');
                        setSheetUploadMessage('');
                      }}
                      className="flex items-center gap-1.5 rounded-xl bg-amber-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-500 shadow-xs transition active:scale-95"
                      title="Quản lý hoặc thêm sprite sheet cho từng loài thú cưng"
                    >
                      <Layers size={13} />
                      <span>Sheet theo thú</span>
                    </button>
                  )}

                  {/* Delete Item Button */}
                  <button
                    type="button"
                    disabled={busyId === `del-item-${item.id}`}
                    onClick={() => void handleDeleteItem(item)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white shadow-xs transition active:scale-95 disabled:opacity-50"
                    title="Xóa vĩnh viễn vật phẩm này khỏi hệ thống"
                  >
                    <Trash2 size={13} />
                    <span>Xóa</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      )}

      {/* 3. Backgrounds Section */}
      {activeSubTab === 'BACKGROUNDS' && (
      <section className="space-y-4">
        <h3 className="flex items-center gap-2 font-bold text-sm text-slate-900">
          <TreePine size={17} className="text-emerald-600" /> Quản lý bán bối cảnh khu vườn ({backgrounds.length})
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {backgrounds.map(background => (
            <article
              key={background.id}
              className="flex items-center gap-3 rounded-2xl border border-slate-200/80 hover:border-slate-300 bg-white p-3.5 shadow-xs transition"
            >
              <BackgroundThumb {...background} className="h-16 w-24 rounded-xl border border-slate-200 object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <strong className="text-xs font-bold text-slate-900 truncate block">{background.name}</strong>
                <p className="text-[11px] text-slate-500 truncate">{background.description || 'Bối cảnh khu vườn'}</p>
                <span className="text-xs font-bold text-amber-700 font-mono mt-1 block">{background.expPrice} EXP</span>
              </div>
            </article>
          ))}
        </div>
      </section>
      )}

      {/* MULTI-PET SPRITE SHEET MANAGEMENT MODAL */}
      {sheetModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-2xl text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shadow-xs">
                  <Layers size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    QUẢN LÝ SPRITE SHEET THEO LOÀI THÚ
                  </h3>
                  <p className="text-xs text-slate-500">
                    Vật phẩm: <strong className="text-[#1b365d]">{sheetModalItem.name}</strong> ({sheetModalItem.itemType})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSheetModalItem(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            {sheetUploadMessage && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                <span>{sheetUploadMessage}</span>
              </div>
            )}
            {sheetUploadError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                <AlertCircle size={16} className="text-rose-600 shrink-0" />
                <span>{sheetUploadError}</span>
              </div>
            )}

            {/* Instruction Callout */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-slate-700 mb-4 space-y-1 leading-relaxed">
              <p className="font-bold text-[#1b365d] flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" /> Cách hoạt động của Sheet theo từng loài thú:
              </p>
              <p>
                Vì mỗi loài thú cưng (Bồ câu, Thỏ, Mèo...) có hình dáng khác nhau, bạn có thể tải lên <strong>sprite sheet vẽ riêng cái nón/skin</strong> cho từng loài thú đó. Khi người dùng đổi sang bé cưng nào, game sẽ tự động hiển thị sheet của đúng bé đó!
              </p>
            </div>

            {/* Default Sheet Info */}
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <strong className="text-xs text-slate-900 block">Sprite sheet mặc định (Sheet chung):</strong>
                <span className="text-[11px] text-slate-500 block truncate max-w-sm">
                  {sheetModalItem.spriteSheetUrl
                    ? `Đang có: ${sheetModalItem.spriteSheetUrl}`
                    : 'Chưa có sheet mặc định.'}
                </span>
                <span className="text-[10px] text-slate-400">
                  Chuẩn ô 64×64 px, 17 hàng trạng thái theo danh sách hành động chuẩn.
                </span>
              </div>
              <label className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs transition shrink-0">
                <Upload size={14} /> Tải sheet mặc định
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) void handleUploadPetSheet(sheetModalItem.id, '', file);
                  }}
                />
              </label>
            </div>

            {/* Per-Pet Sheet List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">DANH SÁCH CÁC LOÀI THÚ CƯNG TRONG GAME:</h4>

              <div className="space-y-2">
                {pets.map(pet => {
                  const hasCustomSheet = Boolean(sheetModalItem.petSheets?.[pet.id]);
                  const customSheetUrl = sheetModalItem.petSheets?.[pet.id]?.spriteSheetUrl;
                  const isCompatible =
                    !sheetModalItem.compatiblePetIds ||
                    sheetModalItem.compatiblePetIds.length === 0 ||
                    sheetModalItem.compatiblePetIds.includes(pet.id);

                  return (
                    <div
                      key={pet.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all ${
                        hasCustomSheet
                          ? 'border-amber-300 bg-amber-50/40'
                          : isCompatible
                          ? 'border-slate-200 bg-white'
                          : 'border-slate-100 bg-slate-50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={pet.previewUrl || pet.spriteSheetUrl}
                          alt=""
                          className="h-10 w-10 object-contain rounded-xl border border-slate-200 p-1 bg-slate-50"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-xs font-bold text-slate-900">{pet.name}</strong>
                            {hasCustomSheet ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-900">
                                Đã có Sheet riêng
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-600">
                                Dùng sheet chung
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 truncate block max-w-xs font-mono">
                            {hasCustomSheet ? customSheetUrl : 'Chưa có sheet riêng cho loài này'}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {hasCustomSheet && (
                          <button
                            type="button"
                            disabled={uploadingPetId === pet.id}
                            onClick={() => void handleDeletePetSheet(sheetModalItem.id, pet.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                            title="Xóa sheet riêng này"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}

                        <label
                          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-xs cursor-pointer transition ${
                            uploadingPetId === pet.id
                              ? 'bg-slate-200 opacity-50 cursor-not-allowed'
                              : hasCustomSheet
                              ? 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                              : 'bg-[#1b365d] text-white hover:bg-[#162b49]'
                          }`}
                        >
                          <Upload size={13} />
                          <span>{uploadingPetId === pet.id ? 'Đang xử lý...' : hasCustomSheet ? 'Đổi Sheet' : '+ Thêm Sheet'}</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            disabled={uploadingPetId === pet.id}
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) void handleUploadPetSheet(sheetModalItem.id, pet.id, file);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-6 border-t border-slate-100 pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setSheetModalItem(null)}
                className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 font-bold text-xs shadow-xs transition"
              >
                ĐÓNG
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
