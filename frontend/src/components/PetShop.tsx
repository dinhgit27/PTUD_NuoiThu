import React, { useCallback, useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { Heart, Package, ShoppingBag, Sparkles, Utensils, PawPrint } from 'lucide-react';
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
  const [activeView, setActiveView] = useState<'SHOP' | 'PETS' | 'INVENTORY' | 'BACKGROUNDS'>('SHOP');
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

  return (
    <section className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-charcoal bg-white p-4 shadow-pixel">
        <div>
          <h2 className="flex items-center gap-2 font-pixel text-sm text-charcoal">
            <ShoppingBag size={18} className="text-terracotta-500" /> Cửa hàng thú cưng
          </h2>
          <p className="mt-1 text-xs text-gray-600">Dùng EXP tích lũy để mua vật phẩm và mở khóa bối cảnh phòng chung.</p>
        </div>
        <div className="rounded-lg border-2 border-charcoal bg-yellow-50 px-3 py-2 text-xs font-bold text-charcoal">
          <Sparkles size={14} className="mr-1 inline text-yellow-600" />
          Số dư: <span className="font-pixel text-terracotta-600">{shop?.expBalance ?? 0} EXP</span>
        </div>
      </header>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setActiveView('SHOP')}
          className={`flex items-center gap-2 rounded-lg border-2 border-charcoal px-4 py-2 text-xs font-pixel ${
            activeView === 'SHOP' ? 'bg-sage-400 text-white' : 'bg-white text-charcoal'
          }`}
        >
          <ShoppingBag size={15} /> Cửa hàng
        </button>
        <button
          type="button"
          onClick={() => setActiveView('PETS')}
          className={`flex items-center gap-2 rounded-lg border-2 border-charcoal px-4 py-2 text-xs font-pixel ${
            activeView === 'PETS' ? 'bg-sage-400 text-white' : 'bg-white text-charcoal'
          }`}
        >
          <PawPrint size={15} /> Thú cưng ({shop?.ownedPetTypeIds.length || 0}/{shop?.petTypes.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveView('INVENTORY')}
          className={`flex items-center gap-2 rounded-lg border-2 border-charcoal px-4 py-2 text-xs font-pixel ${
            activeView === 'INVENTORY' ? 'bg-sage-400 text-white' : 'bg-white text-charcoal'
          }`}
        >
          <Package size={15} /> Túi đồ ({shop?.inventory.reduce((sum, owned) => sum + owned.quantity, 0) || 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveView('BACKGROUNDS')}
          className={`flex items-center gap-2 rounded-lg border-2 border-charcoal px-4 py-2 text-xs font-pixel ${
            activeView === 'BACKGROUNDS' ? 'bg-sage-400 text-white' : 'bg-white text-charcoal'
          }`}
        >
          <ShoppingBag size={15} /> Bối cảnh ({shop?.ownedBackgroundIds.length || 0}/{shop?.backgrounds.length || 0})
        </button>
      </div>

      {errorMessage && <div role="alert" className="rounded-lg border-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>}
      {successMessage && <div role="status" className="rounded-lg border-2 border-sage-500 bg-sage-50 px-4 py-3 text-sm text-sage-800">{successMessage}</div>}

      {!hasPet && (activeView === 'SHOP' || activeView === 'INVENTORY') && (
        <div className="rounded-xl border-2 border-charcoal bg-white p-4 text-sm text-charcoal shadow-pixel">
          Hãy nhận nuôi thú cưng trước khi mua hoặc sử dụng vật phẩm.
        </div>
      )}
      {activeView === 'BACKGROUNDS' && !shop?.departmentId && (
        <div className="rounded-xl border-2 border-charcoal bg-yellow-50 p-4 text-sm text-charcoal shadow-pixel">
          Bối cảnh thuộc sở hữu chung của phòng. Hãy vào <strong>Tạo phòng chung</strong> để tạo hoặc tham gia phòng trước khi mua.
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border-2 border-charcoal bg-white p-8 text-center font-pixel text-xs text-charcoal">
          Đang tải cửa hàng...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeView === 'SHOP' && shop?.items.map(item => {
            const ownedCount = shop.inventory
              .filter(owned => owned.itemId === item.id)
              .reduce((sum, owned) => sum + owned.quantity, 0);
            const canAfford = shop.expBalance >= item.expPrice;
            const isOwnedSkin = item.itemType === 'SKIN' && ownedCount > 0;

            return (
              <article key={item.id} className="flex flex-col rounded-xl border-2 border-charcoal bg-white p-4 shadow-pixel-sm">
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="mb-3 h-36 w-full rounded-lg border border-charcoal bg-cream-100 object-contain p-3"
                  style={{ imageRendering: 'pixelated' }}
                />
                <div className="mb-1 flex items-start justify-between gap-2">
                  <h3 className="font-pixel text-[11px] leading-relaxed text-charcoal">{item.name}</h3>
                  <span className="shrink-0 rounded bg-sage-100 px-2 py-1 text-[10px] text-sage-700">
                    {itemTypeName[item.itemType] || item.itemType}
                  </span>
                </div>
                {(() => {
                  const compat = getCompatibilityInfo(item, shop.petTypes || []);
                  return (
                    <div className={`mt-0.5 mb-2 inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold border ${
                      compat.isAll ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-purple-50 text-purple-800 border-purple-200'
                    }`}>
                      <PawPrint size={10} /> {compat.text}
                    </div>
                  );
                })()}
                <p className="mb-3 flex-1 text-xs text-gray-600">{item.description || 'Vật phẩm dành cho thú cưng.'}</p>
                {item.effect === 'EXP_BOOST' && (
                  <p className="mb-3 text-xs font-bold text-sage-700">Trang bị: +{item.effectValue || 10}% EXP</p>
                )}
                <div className="mb-3 flex items-center justify-between text-xs">
                  <span className="font-bold text-terracotta-600">{item.expPrice} EXP</span>
                  {ownedCount > 0 && <span className="text-gray-500">Đang có: {ownedCount}</span>}
                </div>
                <button
                  type="button"
                  disabled={!hasPet || !canAfford || isOwnedSkin || busyItem === item.id}
                  onClick={() => void buyItem(item)}
                  className="w-full rounded-lg border-2 border-charcoal bg-terracotta-400 px-3 py-2 font-pixel text-[10px] text-white hover:bg-terracotta-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyItem === item.id ? 'Đang mua...' : isOwnedSkin ? 'Đã sở hữu skin' : canAfford ? 'Mua vật phẩm' : 'Chưa đủ EXP'}
                </button>
              </article>
            );
          })}

          {activeView === 'PETS' && shop?.petTypes.map(pet => {
            const owned = shop.ownedPetTypeIds.includes(pet.id);
            const canAfford = shop.expBalance >= pet.expPrice;
            return (
              <article key={pet.id} className="flex flex-col rounded-xl border-2 border-charcoal bg-white p-4 shadow-pixel-sm">
                <img
                  src={pet.previewUrl || pet.spriteSheetUrl}
                  alt={pet.name}
                  className="mb-3 h-36 w-full rounded-lg border border-charcoal bg-cream-100 object-contain p-2"
                  style={{ imageRendering: 'pixelated' }}
                />
                <h3 className="mb-1 font-pixel text-[11px] text-charcoal">{pet.name}</h3>
                <p className="mb-3 flex-1 text-xs text-gray-600">{pet.description || 'Thú cưng đồng hành cùng bạn.'}</p>
                <div className="mb-3 flex items-center justify-between text-xs">
                  <span className="font-bold text-terracotta-600">{owned ? 'Đã sở hữu' : `${pet.expPrice} EXP`}</span>
                  {pet.unlockLevel > 1 && <span className="text-gray-500">Cấp {pet.unlockLevel}+</span>}
                </div>
                <button
                  type="button"
                  disabled={owned || !canAfford || busyItem === pet.id}
                  onClick={() => void buyPet(pet)}
                  className="w-full rounded-lg border-2 border-charcoal bg-terracotta-400 px-3 py-2 font-pixel text-[10px] text-white hover:bg-terracotta-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {owned ? 'Đã sở hữu' : busyItem === pet.id ? 'Đang mua...' : canAfford ? 'Mua thú cưng' : 'Chưa đủ EXP'}
                </button>
              </article>
            );
          })}

          {activeView === 'INVENTORY' && shop?.inventory.map(userItem => (
            <article key={userItem.id} className="flex flex-col rounded-xl border-2 border-charcoal bg-white p-4 shadow-pixel-sm">
              <img
                src={userItem.item.imageUrl}
                alt={userItem.item.name}
                className="mb-3 h-36 w-full rounded-lg border border-charcoal bg-cream-100 object-contain p-3"
                style={{ imageRendering: 'pixelated' }}
              />
              <div className="mb-1 flex items-start justify-between gap-2">
                <h3 className="font-pixel text-[11px] leading-relaxed text-charcoal">{userItem.item.name}</h3>
                <span className="shrink-0 rounded bg-sage-100 px-2 py-1 text-[10px] text-sage-700">
                  x{userItem.quantity}
                </span>
              </div>
              <p className="mb-1 text-xs text-gray-600">
                {userItem.isEquipped ? 'Đang trang bị cho thú cưng.' : itemTypeName[userItem.item.itemType] || userItem.item.itemType}
              </p>
              {(() => {
                const compat = getCompatibilityInfo(userItem.item, shop.petTypes || []);
                const isCompatible = compat.isAll || (currentPetTypeId ? compat.compatIds.includes(currentPetTypeId) : true);
                return (
                  <div className="space-y-1 mb-3">
                    <div className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold border ${
                      compat.isAll ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-purple-50 text-purple-800 border-purple-200'
                    }`}>
                      <PawPrint size={10} /> {compat.text}
                    </div>
                    {!isCompatible && (
                      <p className="text-[10px] font-bold text-terracotta-600">
                        ⚠️ Bé cưng hiện tại không thể mặc món này.
                      </p>
                    )}
                  </div>
                );
              })()}
              {userItem.item.itemType === 'FOOD' ? (
                <button
                  type="button"
                  disabled={!hasPet || busyItem === userItem.id}
                  onClick={() => void performItemAction(userItem, 'use')}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-charcoal bg-sage-400 px-3 py-2 font-pixel text-[10px] text-white hover:bg-sage-500 disabled:opacity-50"
                >
                  <Utensils size={14} /> {busyItem === userItem.id ? 'Đang dùng...' : 'Cho thú cưng ăn'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!hasPet || busyItem === userItem.id || (!userItem.isEquipped && !(() => {
                    const compat = getCompatibilityInfo(userItem.item, shop.petTypes || []);
                    return compat.isAll || (currentPetTypeId ? compat.compatIds.includes(currentPetTypeId) : true);
                  })())}
                  onClick={() => void performItemAction(userItem, userItem.isEquipped ? 'unequip' : 'equip')}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-charcoal bg-pink-400 px-3 py-2 font-pixel text-[10px] text-white hover:bg-pink-500 disabled:opacity-50"
                >
                  <Heart size={14} /> {busyItem === userItem.id ? 'Đang cập nhật...' : userItem.isEquipped ? 'Tháo trang bị' : 'Trang bị'}
                </button>
              )}
            </article>
          ))}

          {activeView === 'BACKGROUNDS' && shop?.backgrounds.map(background => {
            const owned = shop.ownedBackgroundIds.includes(background.id);
            const active = shop.activeBackgroundId === background.id;
            const canAfford = shop.expBalance >= background.expPrice;

            return (
              <article key={background.id} className="flex flex-col rounded-xl border-2 border-charcoal bg-white p-4 shadow-pixel-sm">
                <BackgroundThumb
                  {...background}
                  className="mb-3 h-36 w-full rounded-lg border border-charcoal bg-cream-100"
                />
                <div className="mb-1 flex items-start justify-between gap-2">
                  <h3 className="font-pixel text-[11px] leading-relaxed text-charcoal">{background.name}</h3>
                  {active && <span className="shrink-0 rounded bg-sage-100 px-2 py-1 text-[10px] text-sage-700">Đang dùng</span>}
                </div>
                <p className="mb-3 flex-1 text-xs text-gray-600">{background.description || 'Bối cảnh cho phòng chung.'}</p>
                <div className="mb-3 flex items-center justify-between text-xs">
                  <span className="font-bold text-terracotta-600">{owned ? 'Đã mở khóa' : `${background.expPrice} EXP`}</span>
                  {background.isRecommended && <span className="text-yellow-600">★ Đề xuất</span>}
                </div>
                <button
                  type="button"
                  disabled={!shop.departmentId || (!owned && !canAfford) || busyItem === background.id || active}
                  onClick={() => void buyBackground(background)}
                  className="w-full rounded-lg border-2 border-charcoal bg-terracotta-400 px-3 py-2 font-pixel text-[10px] text-white hover:bg-terracotta-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyItem === background.id
                    ? 'Đang xử lý...'
                    : active
                      ? 'Đang dùng'
                      : owned
                        ? 'Dùng bối cảnh'
                        : canAfford
                          ? 'Mua và áp dụng'
                          : 'Chưa đủ EXP'}
                </button>
              </article>
            );
          })}

          {activeView === 'SHOP' && !shop?.items.length && (
            <div className="col-span-full rounded-xl border-2 border-charcoal bg-white p-8 text-center text-sm text-gray-600">
              Hiện chưa có vật phẩm nào được mở bán.
            </div>
          )}
          {activeView === 'PETS' && !shop?.petTypes.length && (
            <div className="col-span-full rounded-xl border-2 border-charcoal bg-white p-8 text-center text-sm text-gray-600">
              Hiện chưa có thú cưng nào được mở bán.
            </div>
          )}
          {activeView === 'INVENTORY' && !shop?.inventory.length && (
            <div className="col-span-full rounded-xl border-2 border-charcoal bg-white p-8 text-center text-sm text-gray-600">
              Túi đồ đang trống. Hãy ghé cửa hàng để chọn vật phẩm nhé!
            </div>
          )}
        </div>
      )}
    </section>
  );
};
