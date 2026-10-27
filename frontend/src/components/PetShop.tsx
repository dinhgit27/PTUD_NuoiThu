import React, { useCallback, useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { Heart, Package, ShoppingBag, Sparkles, Utensils, PawPrint, History, LayoutGrid, List, Lightbulb, CheckCircle2, ShieldCheck, Coins } from 'lucide-react';
import { api } from '../services/api';
import { GardenBackground, PetType, ShopItem, UserItem } from '../types';
import { BackgroundThumb } from './BackgroundThumb';

interface ShopData {
  items: ShopItem[];
  inventory: UserItem[];
  backgrounds: GardenBackground[];
  departmentId: string | null;
  expBalance: number;
  activeBackgroundId: string | null;
  ownedBackgroundIds: string[];
  petId: string | null;
  petTypes: PetType[];
  ownedPetTypeIds: string[];
}

interface PetShopProps {
  hasPet: boolean;
  currentPetTypeId?: string;
  onPetRefresh: () => void;
  onOwnedPetTypesChange: (ids: string[]) => void;
  onPetTypesRefresh?: () => Promise<void> | void;
}

function getCompatibilityInfo(item: ShopItem, petTypes: PetType[]) {
  const compat = item.compatiblePetIds || (item.petTypeId ? [item.petTypeId] : []);
  if (!compat || compat.length === 0) {
    return { isAll: true, text: 'Dành cho mọi thú cưng', petNames: [] as string[], compatIds: [] as string[] };
  }
  const matched = petTypes.filter(p => compat.includes(p.id));
  const names = matched.map(p => p.name);
  return {
    isAll: false,
    text: `Chỉ dành cho: ${names.join(', ') || 'Loài thú nhất định'}`,
    petNames: names,
    compatIds: compat
  };
}

const itemTypeName: Record<string, string> = {
  FOOD: 'Thức ăn',
  HAT: 'Mũ',
  ACCESSORY: 'Phụ kiện',
  SKIN: 'Trang phục',
  BADGE: 'Huy hiệu',
  THEME: 'Chủ đề'
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AxiosError) {
    return error.response?.data?.error || fallback;
  }
  return fallback;
}

export const PetShop: React.FC<PetShopProps> = ({ hasPet, currentPetTypeId, onPetRefresh, onOwnedPetTypesChange, onPetTypesRefresh }) => {
  const [shop, setShop] = useState<ShopData | null>(null);
  const [activeView, setActiveView] = useState<'SHOP' | 'PETS' | 'INVENTORY' | 'BACKGROUNDS'>('PETS');
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
  const [loading, setLoading] = useState(true);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadShop = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const response = await api.getShop();
      setShop(response.data);
      onOwnedPetTypesChange(response.data.ownedPetTypeIds || []);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Không thể tải cửa hàng. Vui lòng thử lại.'));
    } finally {
      setLoading(false);
    }
  }, [onOwnedPetTypesChange]);

  useEffect(() => {
    void loadShop();
  }, [loadShop]);

  const performItemAction = async (
    userItem: UserItem,
    action: 'use' | 'equip' | 'unequip'
  ) => {
    setBusyItem(userItem.id);
    setErrorMessage('');
    try {
      if (action === 'use') {
        await api.useShopItem(userItem.id);
      } else {
        await api.equipShopItem(userItem.id, action === 'equip');
      }
      onPetRefresh();
      await loadShop();
      if (onPetTypesRefresh) {
        await onPetTypesRefresh();
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Không thể cập nhật vật phẩm. Vui lòng thử lại.'));
    } finally {
      setBusyItem(null);
    }
  };

  const buyItem = async (item: ShopItem) => {
    setBusyItem(item.id);
    setErrorMessage('');
    try {
      await api.buyShopItem(item.id);
      await loadShop();
      if (onPetTypesRefresh) {
        await onPetTypesRefresh();
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Không thể mua vật phẩm. Vui lòng thử lại.'));
    } finally {
      setBusyItem(null);
    }
  };

  const buyBackground = async (background: GardenBackground) => {
    setBusyItem(background.id);
    setErrorMessage('');
    try {
      await api.buyShopBackground(background.id);
      await loadShop();
      if (onPetTypesRefresh) {
        await onPetTypesRefresh();
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Không thể mua bối cảnh. Vui lòng thử lại.'));
    } finally {
      setBusyItem(null);
    }
  };

  const buyPet = async (pet: PetType) => {
    setBusyItem(pet.id);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const response = await api.buyShopPet(pet.id);
      setSuccessMessage(response.data.message);
      await loadShop();
      if (onPetTypesRefresh) {
        await onPetTypesRefresh();
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Không thể mua thú cưng. Vui lòng thử lại.'));
    } finally {
      setBusyItem(null);
    }
  };

  const displayedCount = activeView === 'PETS'
    ? (shop?.petTypes.length || 0)
    : activeView === 'SHOP'
      ? (shop?.items.length || 0)
      : activeView === 'INVENTORY'
        ? (shop?.inventory.length || 0)
        : (shop?.backgrounds.length || 0);

  return (
    <section className="mx-auto max-w-7xl space-y-5 text-slate-800">
      {/* Modern Store Header Banner */}
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-slate-900 bg-[#fffdfa] shadow-[3px_3px_0px_#0f172a] p-5 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-400 border-2 border-slate-900 flex items-center justify-center text-slate-950 shadow-[2px_2px_0px_#0f172a] shrink-0">
            <ShoppingBag size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                Cửa hàng thú cưng
              </h2>
              <span className="text-[10px] bg-amber-100 text-slate-950 font-black px-2 py-0.5 rounded-md uppercase tracking-wider border border-slate-900">
                VẬT PHẨM & THÚ CƯNG
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-2xl">
              Dùng <strong>EXP</strong> tích lũy qua các phiên làm việc Pomodoro để nhận nuôi bạn đồng hành và mở khóa bối cảnh phòng chung.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-amber-400 border-2 border-slate-900 px-4 py-2 text-xs font-black text-slate-950 flex items-center gap-1.5 shadow-[0_2px_0_#0f172a]">
            <Sparkles size={14} className="fill-slate-950" />
            <span>SỐ DƯ: <span className="text-sm font-black">{shop?.expBalance ?? 0}</span> EXP</span>
          </div>
          <button
            type="button"
            onClick={() => alert('📜 Lịch sử giao dịch: Bạn đã tích lũy thành công EXP từ các phiên Pomodoro gần đây.')}
            className="rounded-xl border-2 border-slate-900 bg-white hover:bg-amber-50 px-3 py-2 text-xs font-bold text-slate-800 transition flex items-center gap-1.5 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none"
          >
            <History size={14} />
            <span>Lịch sử</span>
          </button>
        </div>
      </header>

      {/* Category Tabs & View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveView('SHOP')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeView === 'SHOP'
                ? 'bg-amber-400 text-slate-950 font-black border-2 border-slate-900 shadow-[0_2px_0_#0f172a]'
                : 'bg-white hover:bg-amber-50 text-slate-800 font-bold border-2 border-slate-900 shadow-[0_2px_0_#0f172a]'
            }`}
          >
            <ShoppingBag size={14} /> Cửa hàng
          </button>
          <button
            type="button"
            onClick={() => setActiveView('PETS')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeView === 'PETS'
                ? 'bg-amber-400 text-slate-950 font-black border-2 border-slate-900 shadow-[0_2px_0_#0f172a]'
                : 'bg-white hover:bg-amber-50 text-slate-800 font-bold border-2 border-slate-900 shadow-[0_2px_0_#0f172a]'
            }`}
          >
            <PawPrint size={14} /> Thú cưng ({shop?.ownedPetTypeIds.length || 0}/{shop?.petTypes.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveView('INVENTORY')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeView === 'INVENTORY'
                ? 'bg-amber-400 text-slate-950 font-black border-2 border-slate-900 shadow-[0_2px_0_#0f172a]'
                : 'bg-white hover:bg-amber-50 text-slate-800 font-bold border-2 border-slate-900 shadow-[0_2px_0_#0f172a]'
            }`}
          >
            <Package size={14} /> Túi đồ ({shop?.inventory.reduce((sum, owned) => sum + owned.quantity, 0) || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveView('BACKGROUNDS')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeView === 'BACKGROUNDS'
                ? 'bg-amber-400 text-slate-950 font-black border-2 border-slate-900 shadow-[0_2px_0_#0f172a]'
                : 'bg-white hover:bg-amber-50 text-slate-800 font-bold border-2 border-slate-900 shadow-[0_2px_0_#0f172a]'
            }`}
          >
            <Sparkles size={14} /> Bối cảnh ({shop?.ownedBackgroundIds.length || 0}/{shop?.backgrounds.length || 0})
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
          <span>HIỂN THỊ: <strong className="text-slate-800">{displayedCount}</strong> {activeView === 'PETS' ? 'LINH VẬT' : 'MỤC'}</span>
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('GRID')}
              className={`p-1.5 rounded-md transition ${viewMode === 'GRID' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}
              title="Xem dạng lưới"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('LIST')}
              className={`p-1.5 rounded-md transition ${viewMode === 'LIST' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}
              title="Xem dạng danh sách"
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 shadow-xs">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 shadow-xs">
          {successMessage}
        </div>
      )}

      {!hasPet && (activeView === 'SHOP' || activeView === 'INVENTORY') && (
        <div className="rounded-2xl border-2 border-slate-900 bg-[#fffdfa] shadow-[3px_3px_0px_#0f172a] p-5 text-xs text-slate-700 shadow-xs">
          Hãy nhận nuôi thú cưng trước khi mua hoặc sử dụng vật phẩm.
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border-2 border-slate-900 bg-[#fffdfa] shadow-[3px_3px_0px_#0f172a] p-12 text-center text-xs text-slate-500 shadow-xs">
          Đang tải dữ liệu cửa hàng...
        </div>
      ) : (
        <div className={`grid gap-4 ${viewMode === 'GRID' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
          {/* TAB: PETS (Matches Image 2) */}
          {activeView === 'PETS' && shop?.petTypes.map((petItem, idx) => {
            const owned = shop.ownedPetTypeIds.includes(petItem.id);
            const isCurrent = currentPetTypeId === petItem.id;
            const canAfford = shop.expBalance >= petItem.expPrice;

            // Tier assignment styling
            const tierBadge = idx === 2
              ? { text: 'Tier SSR', bg: 'bg-amber-100 text-amber-800 border-amber-200' }
              : idx === 0
                ? { text: 'Tier A', bg: 'bg-blue-100 text-blue-800 border-blue-200' }
                : idx === 1
                  ? { text: 'Tier B', bg: 'bg-purple-100 text-purple-800 border-purple-200' }
                  : idx === 4
                    ? { text: 'Độc Quyền', bg: 'bg-amber-100 text-amber-800 border-amber-200' }
                    : { text: 'Tier A', bg: 'bg-slate-100 text-slate-700 border-slate-200' };

            const categoryTag = idx === 0
              ? 'Thú Cưng Khởi Đầu'
              : idx === 1
                ? 'Cổ Phong Tiên Hiệp'
                : idx === 2
                  ? 'Huyền Thoại'
                  : idx === 3
                    ? 'Tập Trung Cao'
                    : 'Độc Quyền';

            return (
              <article
                key={petItem.id}
                className="flex flex-col justify-between rounded-2xl border-2 border-slate-900 bg-[#fffdfa] shadow-[3px_3px_0px_#0f172a] p-5 shadow-xs hover:shadow-md transition"
              >
                <div>
                  {/* Top Header Tags */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                      <ShieldCheck size={13} className="text-blue-600" />
                      {categoryTag}
                    </span>
                    {isCurrent ? (
                      <span className="text-[10px] font-bold bg-rose-700 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                        ĐANG HOẠT ĐỘNG
                      </span>
                    ) : (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${tierBadge.bg}`}>
                        {tierBadge.text}
                      </span>
                    )}
                  </div>

                  {/* Pet Preview Canvas / Image Box */}
                  <div className="relative my-3 flex min-h-[140px] items-center justify-center rounded-xl bg-[#f7f2e7] border-2 border-slate-900 p-4">
                    <img
                      src={petItem.previewUrl || petItem.spriteSheetUrl}
                      alt={petItem.name}
                      className="h-28 w-28 object-contain transition-transform duration-200 hover:scale-105"
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <div className="w-20 h-3 bg-slate-400/20 rounded-full filter blur-[2px] absolute bottom-3"></div>
                  </div>

                  {/* Title & Sprite ID */}
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                      {petItem.name}
                    </h3>
                    <span className="text-[10px] font-mono text-slate-400 font-semibold">
                      SPRITE ID #{String(idx + 1).padStart(3, '0')}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
                    {petItem.description || 'Linh vật văn phòng thông minh đồng hành cùng bạn suốt ca làm việc.'}
                  </p>

                  {/* Status & Level info */}
                  <div className="flex items-center justify-between text-xs py-2 border-t border-slate-100 mb-3">
                    {owned ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs">
                        <CheckCircle2 size={13} /> Đã sở hữu
                      </span>
                    ) : (
                      <span className="font-bold text-amber-600 text-xs flex items-center gap-1">
                        <Coins size={13} /> {petItem.expPrice} EXP
                      </span>
                    )}
                    <span className="text-slate-500 text-[11px] font-medium">
                      {isCurrent ? 'Đang gắn trên màn hình' : petItem.unlockLevel > 1 ? `Mở ở Cấp ${petItem.unlockLevel}` : 'Sẵn sàng kích hoạt'}
                    </span>
                  </div>
                </div>

                {/* Bottom Action Button */}
                <div>
                  {isCurrent ? (
                    <button
                      type="button"
                      disabled
                      className="w-full rounded-xl bg-[#231e36] text-amber-300 border-2 border-slate-900 py-2.5 text-xs font-black shadow-[0_2px_0_#0f172a] cursor-default flex items-center justify-center gap-1.5"
                    >
                      <span>🐾 Đang Chọn (Hiện Tại)</span>
                    </button>
                  ) : owned ? (
                    <button
                      type="button"
                      disabled
                      className="w-full rounded-xl bg-slate-100 text-slate-700 py-2.5 text-xs font-black border-2 border-slate-900 cursor-default"
                    >
                      Đã sở hữu
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAfford || busyItem === petItem.id}
                      onClick={() => void buyPet(petItem)}
                      className="w-full rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none py-2.5 text-xs font-bold shadow-xs transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      <ShoppingBag size={14} />
                      <span>{busyItem === petItem.id ? 'Đang xử lý...' : `Nhận Nuôi (${petItem.expPrice} EXP)`}</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}

          {/* TAB: SHOP ITEMS */}
          {activeView === 'SHOP' && shop?.items.map(item => {
            const ownedCount = shop.inventory
              .filter(owned => owned.itemId === item.id)
              .reduce((sum, owned) => sum + owned.quantity, 0);
            const canAfford = shop.expBalance >= item.expPrice;
            const isOwnedSkin = item.itemType === 'SKIN' && ownedCount > 0;

            return (
              <article key={item.id} className="flex flex-col justify-between rounded-2xl border-2 border-slate-900 bg-[#fffdfa] shadow-[3px_3px_0px_#0f172a] p-5 shadow-xs hover:shadow-md transition">
                <div>
                  <div className="relative mb-3 flex min-h-[140px] items-center justify-center rounded-xl bg-[#f7f2e7] border-2 border-slate-900 p-4">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-24 w-24 object-contain"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </div>
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">{item.name}</h3>
                    <span className="shrink-0 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200/60">
                      {itemTypeName[item.itemType] || item.itemType}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2 mb-3">{item.description || 'Vật phẩm tăng lực cho thú cưng.'}</p>
                  <div className="flex items-center justify-between text-xs py-2 border-t border-slate-100 mb-3">
                    <span className="font-extrabold text-amber-600">{item.expPrice} EXP</span>
                    {ownedCount > 0 && <span className="text-slate-500 font-medium">Đang có: {ownedCount}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!hasPet || !canAfford || isOwnedSkin || busyItem === item.id}
                  onClick={() => void buyItem(item)}
                  className="w-full rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none py-2.5 text-xs font-bold shadow-xs transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busyItem === item.id ? 'Đang mua...' : isOwnedSkin ? 'Đã sở hữu trang phục' : canAfford ? 'Mua vật phẩm' : 'Chưa đủ EXP'}
                </button>
              </article>
            );
          })}

          {/* TAB: INVENTORY */}
          {activeView === 'INVENTORY' && shop?.inventory.map(userItem => (
            <article key={userItem.id} className="flex flex-col justify-between rounded-2xl border-2 border-slate-900 bg-[#fffdfa] shadow-[3px_3px_0px_#0f172a] p-5 shadow-xs hover:shadow-md transition">
              <div>
                <div className="relative mb-3 flex min-h-[140px] items-center justify-center rounded-xl bg-[#f7f2e7] border-2 border-slate-900 p-4">
                  <img
                    src={userItem.item.imageUrl}
                    alt={userItem.item.name}
                    className="h-24 w-24 object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
                <div className="mb-1 flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900">{userItem.item.name}</h3>
                  <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                    x{userItem.quantity}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  {userItem.isEquipped ? 'Đang trang bị cho thú cưng.' : itemTypeName[userItem.item.itemType] || userItem.item.itemType}
                </p>
              </div>

              {userItem.item.itemType === 'FOOD' ? (
                <button
                  type="button"
                  disabled={!hasPet || busyItem === userItem.id}
                  onClick={() => void performItemAction(userItem, 'use')}
                  className="w-full rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none py-2.5 text-xs font-bold shadow-xs transition active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Utensils size={14} /> <span>{busyItem === userItem.id ? 'Đang dùng...' : 'Cho thú cưng ăn'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!hasPet || busyItem === userItem.id}
                  onClick={() => void performItemAction(userItem, userItem.isEquipped ? 'unequip' : 'equip')}
                  className={`w-full rounded-xl py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    userItem.isEquipped ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300' : 'bg-pink-500 hover:bg-pink-600 text-white shadow-xs'
                  }`}
                >
                  <Heart size={14} /> <span>{busyItem === userItem.id ? 'Đang cập nhật...' : userItem.isEquipped ? 'Tháo trang bị' : 'Trang bị ngay'}</span>
                </button>
              )}
            </article>
          ))}

          {/* TAB: BACKGROUNDS */}
          {activeView === 'BACKGROUNDS' && shop?.backgrounds.map(background => {
            const owned = shop.ownedBackgroundIds.includes(background.id);
            const active = shop.activeBackgroundId === background.id;
            const canAfford = shop.expBalance >= background.expPrice;

            return (
              <article key={background.id} className="flex flex-col justify-between rounded-2xl border-2 border-slate-900 bg-[#fffdfa] shadow-[3px_3px_0px_#0f172a] p-5 shadow-xs hover:shadow-md transition">
                <div>
                  <BackgroundThumb
                    {...background}
                    className="mb-3 h-36 w-full rounded-xl border border-slate-200 object-cover"
                  />
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">{background.name}</h3>
                    {active && <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">Đang dùng</span>}
                  </div>
                  <p className="text-xs text-slate-500 mb-3">{background.description || 'Bối cảnh nghệ thuật cho phòng chung.'}</p>
                </div>
                <button
                  type="button"
                  disabled={!shop.departmentId || (!owned && !canAfford) || busyItem === background.id || active}
                  onClick={() => void buyBackground(background)}
                  className={`w-full rounded-xl py-2.5 text-xs font-bold transition ${
                    active ? 'bg-emerald-600 text-white cursor-default' : 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-900 shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none shadow-xs'
                  }`}
                >
                  {busyItem === background.id ? 'Đang xử lý...' : active ? 'Đang áp dụng' : owned ? 'Dùng bối cảnh' : canAfford ? 'Mở khóa bối cảnh' : 'Chưa đủ EXP'}
                </button>
              </article>
            );
          })}
        </div>
      )}

      {/* Bottom CTA Banner (Matches Image 2) */}
      <div className="rounded-2xl border-2 border-slate-900 bg-[#fffdfa] shadow-[3px_3px_0px_#0f172a] p-4 sm:p-5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-600 flex items-center justify-center shrink-0">
            <Lightbulb size={20} />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-900">
              Mẹo tích lũy EXP nhanh hơn:
            </h4>
            <p className="text-xs text-slate-600 mt-0.5">
              Mỗi phiên Pomodoro 25 phút mang lại <strong>25 EXP</strong>. Duy trì chuỗi 3 phiên liên tiếp để nhận thưởng x1.5 kinh nghiệm.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            const focusTabBtn = document.querySelector('nav button:nth-child(4)') as HTMLButtonElement;
            if (focusTabBtn) focusTabBtn.click();
          }}
          className="rounded-xl bg-[#231e36] hover:bg-[#332b4f] text-white border-2 border-slate-900 px-5 py-2.5 text-xs font-black shadow-[0_2px_0_#0f172a] active:translate-y-[2px] active:shadow-none whitespace-nowrap transition active:scale-95"
        >
          Bắt đầu Pomodoro
        </button>
      </div>
    </section>
  );
};
