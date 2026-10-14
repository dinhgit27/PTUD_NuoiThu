import React, { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { ImagePlus, PackagePlus, ShoppingBag, Sparkles, TreePine } from 'lucide-react';
import { api } from '../services/api';
import { GardenBackground, PetType, ShopItem } from '../types';

const itemTypes = [
  { value: 'FOOD', label: 'Thức ăn' },
  { value: 'SKIN', label: 'Skin / Trang phục' },
  { value: 'HAT', label: 'Mũ' },
  { value: 'ACCESSORY', label: 'Phụ kiện' },
  { value: 'BADGE', label: 'Huy hiệu' },
  { value: 'THEME', label: 'Chủ đề' }
];
const rarities = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];
const equipSlots = [
  { value: 'AUTO', label: 'Tự động theo loại' },
  { value: 'HEAD', label: 'Đầu / mũ' },
  { value: 'BODY', label: 'Thân / skin' },
  { value: 'HAND', label: 'Tay / bên cạnh' },
  { value: 'FEET', label: 'Chân / dưới' },
  { value: 'AURA', label: 'Hào quang xung quanh' }
];
const effects = [
  { value: 'NONE', label: 'Không hiệu ứng' },
  { value: 'BOUNCE', label: 'Nảy nhẹ' },
  { value: 'FLOAT', label: 'Bay lơ lửng' },
  { value: 'SPARKLE', label: 'Lấp lánh' },
  { value: 'GLOW', label: 'Phát sáng' },
  { value: 'HEARTS', label: 'Trái tim' }
];

function errorMessage(error: unknown) {
  return error instanceof AxiosError
    ? error.response?.data?.error || 'Không thể hoàn thành thao tác.'
    : 'Không thể hoàn thành thao tác.';
}

export const AdminShopManagement: React.FC = () => {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [pets, setPets] = useState<PetType[]>([]);
  const [backgrounds, setBackgrounds] = useState<GardenBackground[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [itemType, setItemType] = useState('SKIN');
  const [rarity, setRarity] = useState('COMMON');
  const [expPrice, setExpPrice] = useState(100);
  const [imageUrl, setImageUrl] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [equipSlot, setEquipSlot] = useState('AUTO');
  const [effect, setEffect] = useState('NONE');
  const [backgroundName, setBackgroundName] = useState('');
  const [backgroundDescription, setBackgroundDescription] = useState('');
  const [backgroundPrice, setBackgroundPrice] = useState(100);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState('');
  const [backgroundImage, setBackgroundImage] = useState<File | null>(null);
  const [petPrices, setPetPrices] = useState<Record<string, number>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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
      setPetPrices(Object.fromEntries(
        (petResponse.data as PetType[]).map(pet => [pet.id, pet.expPrice])
      ));
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const createItem = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusyId('create');
    setError('');
    setMessage('');
    try {
      const form = new FormData();
      form.set('name', name.trim());
      form.set('description', description.trim());
      form.set('itemType', itemType);
      form.set('rarity', rarity);
      form.set('expPrice', String(expPrice));
      form.set('equipSlot', equipSlot);
      form.set('effect', effect);
      if (image) form.set('image', image);
      else form.set('imageUrl', imageUrl.trim());
      const response = await api.createAdminShopItem(form);
      setMessage(response.data.message);
      setName('');
      setDescription('');
      setImageUrl('');
      setImage(null);
      await loadData();
    } catch (createError) {
      setError(errorMessage(createError));
    } finally {
      setBusyId(null);
    }
  };

  const createBackground = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusyId('background-create');
    setError('');
    setMessage('');
    try {
      if (backgroundImage) {
        const form = new FormData();
        form.set('name', backgroundName.trim());
        form.set('description', backgroundDescription.trim());
        form.set('expPrice', String(backgroundPrice));
        form.set('isRecommended', 'false');
        form.set('image', backgroundImage);
        await api.uploadAdminBackground(form);
      } else {
        await api.addAdminBackground({
          name: backgroundName.trim(),
          description: backgroundDescription.trim(),
          imageUrl: backgroundImageUrl.trim(),
          expPrice: backgroundPrice,
          isRecommended: false
        });
      }
      setMessage('Đã tạo bối cảnh và mở bán trong cửa hàng.');
      setBackgroundName('');
      setBackgroundDescription('');
      setBackgroundImageUrl('');
      setBackgroundImage(null);
      await loadData();
    } catch (createError) {
      setError(errorMessage(createError));
    } finally {
      setBusyId(null);
    }
  };

  const updateBackground = async (background: GardenBackground, changes: { expPrice?: number; isActive?: boolean }) => {
    setBusyId(background.id);
    setError('');
    try {
      await api.updateAdminBackgroundShop(background.id, {
        expPrice: changes.expPrice ?? background.expPrice,
        isActive: changes.isActive ?? background.isActive
      });
      await loadData();
    } catch (updateError) {
      setError(errorMessage(updateError));
    } finally {
      setBusyId(null);
    }
  };

  const updateItem = async (item: ShopItem, changes: { expPrice?: number; isAvailable?: boolean }) => {
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

  const updatePetListing = async (pet: PetType, enabled: boolean) => {
    setBusyId(pet.id);
    setError('');
    try {
      await api.updateAdminShopPet(pet.id, {
        isShopEnabled: enabled,
        expPrice: petPrices[pet.id] ?? pet.expPrice
      });
      setMessage(enabled
        ? `Đã mở bán ${pet.name}; người dùng phải mua trước khi chọn.`
        : `Đã gỡ ${pet.name} khỏi cửa hàng; quyền sở hữu đã mua vẫn được giữ.`);
      await loadData();
    } catch (updateError) {
      setError(errorMessage(updateError));
    } finally {
      setBusyId(null);
    }
  };

  const savePetPrice = async (pet: PetType) => {
    setBusyId(pet.id);
    setError('');
    try {
      await api.updateAdminShopPet(pet.id, {
        isShopEnabled: pet.isShopEnabled,
        expPrice: petPrices[pet.id] ?? pet.expPrice
      });
      setMessage(`Đã cập nhật giá ${pet.name}.`);
      await loadData();
    } catch (updateError) {
      setError(errorMessage(updateError));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border-2 border-charcoal bg-white p-5 shadow-pixel">
        <h3 className="mb-4 flex items-center gap-2 font-pixel text-sm text-charcoal">
          <PackagePlus size={18} /> Tạo vật phẩm / skin
        </h3>
        <form onSubmit={createItem} className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold">Tên
            <input required value={name} onChange={event => setName(event.target.value)} className="mt-1 w-full rounded border-2 border-charcoal px-3 py-2" />
          </label>
          <label className="text-xs font-bold">Loại
            <select value={itemType} onChange={event => setItemType(event.target.value)} className="mt-1 w-full rounded border-2 border-charcoal bg-white px-3 py-2">
              {itemTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold">Độ hiếm
            <select value={rarity} onChange={event => setRarity(event.target.value)} className="mt-1 w-full rounded border-2 border-charcoal bg-white px-3 py-2">
              {rarities.map(value => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold">Vị trí gắn lên thú
            <select value={equipSlot} onChange={event => setEquipSlot(event.target.value)} className="mt-1 w-full rounded border-2 border-charcoal bg-white px-3 py-2">
              {equipSlots.map(slot => <option key={slot.value} value={slot.value}>{slot.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold">Hiệu ứng phụ kiện
            <select value={effect} onChange={event => setEffect(event.target.value)} className="mt-1 w-full rounded border-2 border-charcoal bg-white px-3 py-2">
              {effects.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold">Giá bán (EXP)
            <input type="number" min="0" step="1" required value={expPrice} onChange={event => setExpPrice(Number(event.target.value))} className="mt-1 w-full rounded border-2 border-charcoal px-3 py-2" />
          </label>
          <label className="text-xs font-bold sm:col-span-2">Mô tả
            <textarea value={description} onChange={event => setDescription(event.target.value)} rows={2} className="mt-1 w-full rounded border-2 border-charcoal px-3 py-2" />
          </label>
          <label className="text-xs font-bold">Ảnh tải lên
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => setImage(event.target.files?.[0] || null)} className="mt-1 block w-full text-xs" />
          </label>
          <label className="text-xs font-bold">Hoặc URL ảnh
            <input type="url" value={imageUrl} onChange={event => setImageUrl(event.target.value)} disabled={Boolean(image)} className="mt-1 w-full rounded border-2 border-charcoal px-3 py-2 disabled:bg-gray-100" />
          </label>
          <button disabled={busyId === 'create'} className="flex items-center justify-center gap-2 rounded-lg border-2 border-charcoal bg-terracotta-400 px-4 py-2 font-pixel text-xs text-white disabled:opacity-50 sm:col-span-2">
            <ImagePlus size={16} /> {busyId === 'create' ? 'Đang tạo...' : itemType === 'SKIN' ? 'Tạo skin và mở bán' : 'Tạo vật phẩm và mở bán'}
          </button>
        </form>
      </section>

      {(error || message) && (
        <div role={error ? 'alert' : 'status'} className={`rounded-lg border-2 p-3 text-sm ${error ? 'border-red-500 bg-red-50 text-red-700' : 'border-sage-500 bg-sage-50 text-sage-800'}`}>
          {error || message}
        </div>
      )}

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 font-pixel text-sm"><ShoppingBag size={17} /> Quản lý vật phẩm đang có</h3>
        {items.map(item => (
          <article key={item.id} className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-charcoal bg-white p-3">
            <img src={item.imageUrl} alt="" className="h-14 w-14 rounded border border-charcoal object-contain p-1" />
            <div className="min-w-32 flex-1">
              <strong className="text-xs">{item.name}</strong>
              <p className="text-[10px] text-gray-500">{item.itemType} · {item.rarity}</p>
            </div>
            <label className="text-[10px] font-bold">EXP
              <input aria-label={`Giá EXP ${item.name}`} type="number" min="0" defaultValue={item.expPrice} onBlur={event => {
                const price = Number(event.target.value);
                if (Number.isInteger(price) && price >= 0 && price !== item.expPrice) void updateItem(item, { expPrice: price });
              }} className="ml-2 w-24 rounded border-2 border-charcoal px-2 py-1 text-xs" />
            </label>
            <button disabled={busyId === item.id} onClick={() => void updateItem(item, { isAvailable: !item.isAvailable })} className={`rounded border-2 border-charcoal px-3 py-1.5 text-[10px] font-bold ${item.isAvailable ? 'bg-sage-100' : 'bg-gray-100'}`}>
              {item.isAvailable ? 'Đang mở bán' : 'Đã ẩn'}
            </button>
            {item.itemType !== 'FOOD' && (
              <>
                <select aria-label={`Vị trí gắn ${item.name}`} value={item.equipSlot || 'AUTO'} disabled={busyId === item.id} onChange={event => void api.updateAdminShopItem(item.id, { equipSlot: event.target.value }).then(loadData).catch(error => setError(errorMessage(error)))} className="rounded border-2 border-charcoal bg-white px-2 py-1.5 text-[10px]">
                  {equipSlots.map(slot => <option key={slot.value} value={slot.value}>{slot.label}</option>)}
                </select>
                <select aria-label={`Hiệu ứng ${item.name}`} value={item.effect || 'NONE'} disabled={busyId === item.id} onChange={event => void api.updateAdminShopItem(item.id, { effect: event.target.value }).then(loadData).catch(error => setError(errorMessage(error)))} className="rounded border-2 border-charcoal bg-white px-2 py-1.5 text-[10px]">
                  {effects.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </>
            )}
          </article>
        ))}
      </section>

      <section className="rounded-xl border-2 border-charcoal bg-white p-5 shadow-pixel">
        <h3 className="mb-4 flex items-center gap-2 font-pixel text-sm text-charcoal">
          <TreePine size={18} /> Tạo và bán bối cảnh
        </h3>
        <form onSubmit={createBackground} className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold">Tên bối cảnh
            <input required value={backgroundName} onChange={event => setBackgroundName(event.target.value)} className="mt-1 w-full rounded border-2 border-charcoal px-3 py-2" />
          </label>
          <label className="text-xs font-bold">Giá bán (EXP)
            <input required type="number" min="0" step="1" value={backgroundPrice} onChange={event => setBackgroundPrice(Number(event.target.value))} className="mt-1 w-full rounded border-2 border-charcoal px-3 py-2" />
          </label>
          <label className="text-xs font-bold sm:col-span-2">Mô tả
            <textarea value={backgroundDescription} onChange={event => setBackgroundDescription(event.target.value)} rows={2} className="mt-1 w-full rounded border-2 border-charcoal px-3 py-2" />
          </label>
          <label className="text-xs font-bold">Tải ảnh nền
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => setBackgroundImage(event.target.files?.[0] || null)} className="mt-1 block w-full text-xs" />
          </label>
          <label className="text-xs font-bold">Hoặc URL ảnh nền
            <input type="url" value={backgroundImageUrl} disabled={Boolean(backgroundImage)} onChange={event => setBackgroundImageUrl(event.target.value)} className="mt-1 w-full rounded border-2 border-charcoal px-3 py-2 disabled:bg-gray-100" />
          </label>
          <button disabled={busyId === 'background-create'} className="rounded-lg border-2 border-charcoal bg-sage-400 px-4 py-2 font-pixel text-xs text-white disabled:opacity-50 sm:col-span-2">
            {busyId === 'background-create' ? 'Đang tạo...' : 'Tạo bối cảnh và mở bán'}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 font-pixel text-sm"><TreePine size={17} /> Quản lý bán bối cảnh</h3>
        {backgrounds.map(background => (
          <article key={background.id} className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-charcoal bg-white p-3">
            <img src={background.thumbnailUrl || background.imageUrl} alt="" className="h-14 w-20 rounded border border-charcoal object-cover" />
            <strong className="min-w-36 flex-1 text-xs">{background.name}</strong>
            <label className="text-[10px] font-bold">EXP
              <input aria-label={`Giá nền ${background.name}`} type="number" min="0" defaultValue={background.expPrice} onBlur={event => {
                const price = Number(event.target.value);
                if (Number.isInteger(price) && price >= 0 && price !== background.expPrice) void updateBackground(background, { expPrice: price });
              }} className="ml-2 w-24 rounded border-2 border-charcoal px-2 py-1 text-xs" />
            </label>
            <button disabled={busyId === background.id} onClick={() => void updateBackground(background, { isActive: !background.isActive })} className={`rounded border-2 border-charcoal px-3 py-1.5 text-[10px] font-bold ${background.isActive ? 'bg-sage-100' : 'bg-gray-100'}`}>
              {background.isActive ? 'Đang bán' : 'Đã ẩn'}
            </button>
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 font-pixel text-sm"><Sparkles size={17} /> Mở bán skin thú (loài thú)</h3>
        <p className="text-xs text-gray-600">Chọn thú đã tạo/xuất bản ở mục Sprite Forge, đặt giá rồi bật bán. Người dùng chỉ đổi sang thú đã mua; thú đang sở hữu vẫn dùng được nếu sau này gỡ khỏi cửa hàng.</p>
        {pets.map(pet => (
          <article key={pet.id} className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-charcoal bg-white p-3">
            <img src={pet.previewUrl || pet.spriteSheetUrl} alt="" className="h-14 w-14 rounded border border-charcoal bg-cream-100 object-contain p-1" />
            <div className="min-w-32 flex-1">
              <strong className="text-xs">{pet.name}</strong>
              <p className="text-[10px] text-gray-500">{pet.isActive ? 'Đã xuất bản' : 'Chưa xuất bản'} · {pet.isShopEnabled ? 'Đang bán' : 'Chưa bán'}</p>
            </div>
            <label className="text-[10px] font-bold">Giá EXP
              <input aria-label={`Giá thú ${pet.name}`} type="number" min="0" value={petPrices[pet.id] ?? pet.expPrice} onChange={event => setPetPrices(current => ({ ...current, [pet.id]: Number(event.target.value) }))} className="ml-2 w-24 rounded border-2 border-charcoal px-2 py-1 text-xs" />
            </label>
            <button disabled={busyId === pet.id || !pet.isActive} onClick={() => void (pet.isShopEnabled ? savePetPrice(pet) : updatePetListing(pet, true))} className="rounded border-2 border-charcoal bg-sage-100 px-3 py-1.5 text-[10px] font-bold disabled:opacity-50">
              {pet.isShopEnabled ? 'Lưu giá' : 'Mở bán'}
            </button>
            {pet.isShopEnabled && <button disabled={busyId === pet.id} onClick={() => void updatePetListing(pet, false)} className="rounded border-2 border-charcoal bg-gray-100 px-3 py-1.5 text-[10px] font-bold disabled:opacity-50">Gỡ bán</button>}
          </article>
        ))}
        {!pets.length && <p className="rounded-lg border border-dashed border-charcoal p-4 text-xs text-gray-600">Chưa có thú cưng. Hãy tạo thú ở Sprite Forge và xuất bản trước.</p>}
      </section>
    </div>
  );
};
