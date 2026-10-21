import React, { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import {
  ImagePlus,
  PackagePlus,
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
  Edit3
} from 'lucide-react';
import { api } from '../services/api';
import { GardenBackground, PetType, ShopItem } from '../types';
import { BackgroundThumb } from './BackgroundThumb';

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
  { value: 'HEARTS', label: 'Trái tim' },
  { value: 'EXP_BOOST', label: 'Tăng EXP khi trang bị' }
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

  // Create Item Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [itemType, setItemType] = useState('SKIN');
  const [rarity, setRarity] = useState('COMMON');
  const [expPrice, setExpPrice] = useState(100);
  const [imageUrl, setImageUrl] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [spriteSheetFile, setSpriteSheetFile] = useState<File | null>(null);
  const [equipSlot, setEquipSlot] = useState('AUTO');
  const [effect, setEffect] = useState('NONE');
  const [effectValue, setEffectValue] = useState(10);

  // Pet Compatibility Options
  const [isSpecificPets, setIsSpecificPets] = useState(false);
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>([]);

  // Multi-Pet Sheet Management Modal
  const [sheetModalItem, setSheetModalItem] = useState<ShopItem | null>(null);
  const [uploadingPetId, setUploadingPetId] = useState<string | null>(null);
  const [sheetUploadMessage, setSheetUploadMessage] = useState('');
  const [sheetUploadError, setSheetUploadError] = useState('');

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
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleTogglePetSelection = (petId: string) => {
    setSelectedPetIds(prev =>
      prev.includes(petId) ? prev.filter(id => id !== petId) : [...prev, petId]
    );
  };

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
      form.set('effectValue', String(effect === 'EXP_BOOST' ? effectValue : 0));

      // Pet compatibility
      if (isSpecificPets && selectedPetIds.length > 0) {
        form.set('compatiblePetIds', JSON.stringify(selectedPetIds));
        if (selectedPetIds.length === 1) {
          form.set('petTypeId', selectedPetIds[0]);
        }
      }

      if (image) form.set('image', image);
      if (spriteSheetFile) form.set('spriteSheet', spriteSheetFile);
      else if (!image) form.set('imageUrl', imageUrl.trim());

      const response = await api.createAdminShopItem(form);
      setMessage(response.data.message);
      setName('');
      setDescription('');
      setImageUrl('');
      setImage(null);
      setSpriteSheetFile(null);
      setEffect('NONE');
      setEffectValue(10);
      setIsSpecificPets(false);
      setSelectedPetIds([]);
      await loadData();
    } catch (createError) {
      setError(errorMessage(createError));
    } finally {
      setBusyId(null);
    }
  };

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
      {/* Create Item Form */}
      <section className="rounded-xl border-2 border-charcoal bg-white p-5 shadow-pixel">
        <h3 className="mb-4 flex items-center gap-2 font-pixel text-sm text-charcoal">
          <PackagePlus size={18} /> Tạo vật phẩm / skin (Hỗ trợ nón & phụ kiện theo sheet)
        </h3>
        <form onSubmit={createItem} className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold">
            Tên vật phẩm <span className="text-terracotta-500">*</span>
            <input
              required
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="VD: Nón Phù Thủy, Khăn Choàng Đỏ..."
              className="mt-1 w-full rounded border-2 border-charcoal px-3 py-2 text-xs"
            />
          </label>

          <label className="text-xs font-bold">
            Loại vật phẩm
            <select
              value={itemType}
              onChange={event => {
                setItemType(event.target.value);
                if (event.target.value === 'FOOD') setSpriteSheetFile(null);
              }}
              className="mt-1 w-full rounded border-2 border-charcoal bg-white px-3 py-2 text-xs"
            >
              {itemTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-bold">
            Độ hiếm
            <select
              value={rarity}
              onChange={event => setRarity(event.target.value)}
              className="mt-1 w-full rounded border-2 border-charcoal bg-white px-3 py-2 text-xs"
            >
              {rarities.map(value => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-bold">
            Vị trí gắn lên thú
            <select
              value={equipSlot}
              onChange={event => setEquipSlot(event.target.value)}
              className="mt-1 w-full rounded border-2 border-charcoal bg-white px-3 py-2 text-xs"
            >
              {equipSlots.map(slot => (
                <option key={slot.value} value={slot.value}>
                  {slot.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-bold">
            Hiệu ứng phụ kiện
            <select
              value={effect}
              onChange={event => setEffect(event.target.value)}
              className="mt-1 w-full rounded border-2 border-charcoal bg-white px-3 py-2 text-xs"
            >
              {effects.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {effect === 'EXP_BOOST' && (
            <div>
              <label className="text-xs font-bold">
                Tăng EXP khi trang bị (%)
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  required
                  value={effectValue}
                  onChange={event => setEffectValue(Number(event.target.value))}
                  className="mt-1 w-full rounded border-2 border-charcoal px-3 py-2 text-xs"
                />
              </label>
              <p className="mt-1 text-[10px] text-gray-500">
                Áp dụng cho EXP thú nhận được khi cho ăn, vuốt ve và Pomodoro. Cộng dồn tối đa +100%.
              </p>
            </div>
          )}

          <label className="text-xs font-bold">
            Giá bán (EXP) <span className="text-terracotta-500">*</span>
            <input
              type="number"
              min="0"
              step="1"
              required
              value={expPrice}
              onChange={event => setExpPrice(Number(event.target.value))}
              className="mt-1 w-full rounded border-2 border-charcoal px-3 py-2 text-xs"
            />
          </label>

          <label className="text-xs font-bold sm:col-span-2">
            Mô tả
            <textarea
              value={description}
              onChange={event => setDescription(event.target.value)}
              rows={2}
              placeholder="Mô tả về vật phẩm hoặc skin này..."
              className="mt-1 w-full rounded border-2 border-charcoal px-3 py-2 text-xs"
            />
          </label>

          {/* PET COMPATIBILITY CONFIGURATION */}
          <div className="sm:col-span-2 rounded-xl border-2 border-charcoal/30 bg-cream-50 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-pixel text-xs text-charcoal">
                <PawPrint size={15} className="text-terracotta-500" /> QUY ĐỊNH THÚ CƯNG MẶC ĐƯỢC
              </span>
              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-1 font-bold text-charcoal cursor-pointer">
                  <input
                    type="radio"
                    name="compatMode"
                    checked={!isSpecificPets}
                    onChange={() => {
                      setIsSpecificPets(false);
                      setSelectedPetIds([]);
                    }}
                    className="text-emerald-600"
                  />
                  Tất cả thú cưng
                </label>
                <label className="flex items-center gap-1 font-bold text-charcoal cursor-pointer">
                  <input
                    type="radio"
                    name="compatMode"
                    checked={isSpecificPets}
                    onChange={() => setIsSpecificPets(true)}
                    className="text-emerald-600"
                  />
                  Chỉ định thú cụ thể
                </label>
              </div>
            </div>

            {isSpecificPets && (
              <div className="mt-2 pt-2 border-t border-charcoal/20">
                <p className="text-[11px] font-bold text-charcoal/70 mb-2">
                  Chọn những loài thú cưng có thể mặc vật phẩm này:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {pets.map(pet => {
                    const isChecked = selectedPetIds.includes(pet.id);
                    return (
                      <label
                        key={pet.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-amber-100 border-amber-500 text-charcoal'
                            : 'bg-white border-charcoal/20 text-charcoal/70 hover:bg-cream-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleTogglePetSelection(pet.id)}
                          className="rounded text-amber-500"
                        />
                        <img
                          src={pet.previewUrl || pet.spriteSheetUrl}
                          alt=""
                          className="w-5 h-5 object-contain"
                          onError={e => {
                            (e.currentTarget as HTMLImageElement).src = '/sprites/default_pet.png';
                          }}
                        />
                        <span className="truncate">{pet.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Explanatory Note */}
            <div className="rounded-lg bg-white/80 p-2 text-[11px] text-charcoal/70 border border-charcoal/10">
              {isSpecificPets && selectedPetIds.length > 0 ? (
                <span>
                  💡 <strong>Ghi chú:</strong> Vật phẩm này sẽ chỉ cho phép{' '}
                  <strong className="text-terracotta-600">
                    {pets.filter(p => selectedPetIds.includes(p.id)).map(p => p.name).join(', ')}
                  </strong>{' '}
                  mặc. Sau khi tạo, bạn có thể tải sprite sheet riêng cho từng loài này!
                </span>
              ) : (
                <span>
                  💡 <strong>Ghi chú:</strong> Vật phẩm này có thể trang bị cho{' '}
                  <strong className="text-emerald-700">mọi loài thú cưng</strong>.
                </span>
              )}
            </div>
          </div>

          <label className="text-xs font-bold">
            Ảnh đại diện hiển thị trong shop (tùy chọn)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={Boolean(imageUrl)}
              onChange={event => setImage(event.target.files?.[0] || null)}
              className="mt-1 block w-full text-xs disabled:opacity-50"
            />
          </label>

          <label className="text-xs font-bold">
            Hoặc URL ảnh đại diện
            <input
              type="url"
              value={imageUrl}
              onChange={event => setImageUrl(event.target.value)}
              disabled={Boolean(image)}
              placeholder="https://..."
              className="mt-1 w-full rounded border-2 border-charcoal px-3 py-2 text-xs disabled:bg-gray-100"
            />
          </label>

          {itemType !== 'FOOD' && (
            <label className="text-xs font-bold sm:col-span-2">
              Sprite sheet hoạt ảnh mặc định (tùy chọn)
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={event => {
                  const file = event.target.files?.[0] || null;
                  setSpriteSheetFile(file);
                }}
                className="mt-1 block w-full text-xs"
              />
              <span className="mt-1 block font-normal text-gray-500">
                4 cột × 17 hàng. Bạn có thể tải sheet chung tại đây, hoặc sau khi tạo bấm <strong>"Quản lý Sheet theo thú"</strong> để tải sheet riêng cho từng loài thú khác nhau!
              </span>
            </label>
          )}

          <button
            disabled={busyId === 'create'}
            className="flex items-center justify-center gap-2 rounded-lg border-2 border-charcoal bg-terracotta-400 px-4 py-2.5 font-pixel text-xs text-white shadow-pixel hover:bg-terracotta-500 active:translate-y-0.5 disabled:opacity-50 sm:col-span-2"
          >
            <ImagePlus size={16} />{' '}
            {busyId === 'create'
              ? 'Đang tạo...'
              : itemType === 'SKIN'
              ? 'Tạo skin và mở bán'
              : 'Tạo vật phẩm và mở bán'}
          </button>
        </form>
      </section>

      {(error || message) && (
        <div
          role={error ? 'alert' : 'status'}
          className={`flex items-center gap-2 rounded-lg border-2 p-3 text-sm font-bold shadow-pixel ${
            error
              ? 'border-terracotta-500 bg-terracotta-50 text-terracotta-800'
              : 'border-emerald-500 bg-emerald-50 text-emerald-800'
          }`}
        >
          {error ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          <span>{error || message}</span>
          <button onClick={() => { setError(''); setMessage(''); }} className="ml-auto text-charcoal/50 hover:text-charcoal">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Item Management Section */}
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 font-pixel text-sm">
          <ShoppingBag size={17} /> Quản lý vật phẩm & Skin đang có ({items.length})
        </h3>

        <div className="grid gap-3">
          {items.map(item => {
            const compat = getCompatibilityText(item);
            const customSheetCount = item.petSheets ? Object.keys(item.petSheets).length : 0;

            return (
              <article
                key={item.id}
                className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-3 rounded-xl border-2 border-charcoal bg-white p-4 shadow-pixel"
              >
                <div className="flex items-start gap-3 flex-1 min-w-[240px]">
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="h-14 w-14 rounded-lg border-2 border-charcoal object-contain p-1 bg-cream-50 shrink-0"
                    style={{ imageRendering: 'pixelated' }}
                    onError={e => {
                      (e.currentTarget as HTMLImageElement).src = '/sprites/default_pet.png';
                    }}
                  />
                  <div className="space-y-1">
                    <strong className="text-xs font-bold text-charcoal flex items-center gap-2">
                      {item.name}
                      <span className="rounded bg-cream-200 px-1.5 py-0.5 text-[9px] font-bold text-charcoal">
                        {item.itemType} · {item.rarity}
                      </span>
                    </strong>
                    <p className="text-[11px] text-gray-600 line-clamp-1">{item.description || 'Không có mô tả.'}</p>

                    {/* Compatibility Badge / Note */}
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                          compat.isAll
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-purple-50 text-purple-800 border-purple-300'
                        }`}
                      >
                        <PawPrint size={11} /> {compat.text}
                      </span>

                      {item.spriteSheetUrl && (
                        <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200">
                          ✨ Hoạt ảnh 17 trạng thái
                        </span>
                      )}

                      {customSheetCount > 0 && (
                        <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-300">
                          🐾 {customSheetCount} sheet riêng theo thú
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Controls & Actions */}
                <div className="flex flex-wrap items-center gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto justify-end">
                  <label className="text-[10px] font-bold text-charcoal flex items-center gap-1">
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
                      className="w-20 rounded border-2 border-charcoal px-2 py-1 text-xs"
                    />
                  </label>

                  <button
                    disabled={busyId === item.id}
                    onClick={() => void updateItem(item, { isAvailable: !item.isAvailable })}
                    className={`rounded border-2 border-charcoal px-2.5 py-1 text-[10px] font-bold transition-all ${
                      item.isAvailable ? 'bg-sage-100 text-sage-800' : 'bg-gray-100 text-gray-500'
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
                      className="flex items-center gap-1 rounded-lg border-2 border-charcoal bg-amber-400 px-3 py-1 text-[11px] font-bold text-charcoal hover:bg-amber-500 shadow-pixel-sm active:translate-y-0.5"
                      title="Quản lý hoặc thêm sprite sheet cho từng loài thú cưng"
                    >
                      <Layers size={13} />
                      <span>Quản lý Sheet theo thú</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Backgrounds Section */}
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 font-pixel text-sm">
          <TreePine size={17} /> Quản lý bán bối cảnh khu vườn ({backgrounds.length})
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {backgrounds.map(background => (
            <article
              key={background.id}
              className="flex items-center gap-3 rounded-lg border-2 border-charcoal bg-white p-3 shadow-pixel"
            >
              <BackgroundThumb {...background} className="h-14 w-20 rounded border border-charcoal object-cover" />
              <div className="flex-1 min-w-0">
                <strong className="text-xs truncate block">{background.name}</strong>
                <p className="text-[10px] text-gray-500 truncate">{background.description || 'Bối cảnh khu vườn'}</p>
                <span className="text-[11px] font-bold text-terracotta-600">{background.expPrice} EXP</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* MULTI-PET SPRITE SHEET MANAGEMENT MODAL */}
      {sheetModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border-4 border-charcoal bg-cream-100 p-6 shadow-pixel text-charcoal">
            <div className="flex items-center justify-between border-b-2 border-charcoal/20 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Layers className="text-terracotta-500" size={22} />
                <div>
                  <h3 className="font-pixel text-xs sm:text-sm text-charcoal">
                    QUẢN LÝ SPRITE SHEET THEO LOÀI THÚ
                  </h3>
                  <p className="text-[11px] text-charcoal/70">
                    Vật phẩm: <strong className="text-terracotta-600">{sheetModalItem.name}</strong> ({sheetModalItem.itemType})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSheetModalItem(null)}
                className="rounded p-1 hover:bg-charcoal/10"
              >
                <X size={18} />
              </button>
            </div>

            {sheetUploadMessage && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border-2 border-emerald-500 bg-emerald-50 p-2.5 text-xs font-bold text-emerald-800">
                <CheckCircle size={16} />
                <span>{sheetUploadMessage}</span>
              </div>
            )}
            {sheetUploadError && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border-2 border-terracotta-500 bg-terracotta-50 p-2.5 text-xs font-bold text-terracotta-800">
                <AlertCircle size={16} />
                <span>{sheetUploadError}</span>
              </div>
            )}

            {/* Instruction Callout */}
            <div className="rounded-xl border-2 border-charcoal/20 bg-white p-3.5 text-xs text-charcoal/80 mb-4 space-y-1">
              <p className="font-bold text-charcoal flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" /> Cách hoạt động của Sheet theo từng loài thú:
              </p>
              <p>
                Vì mỗi loài thú cưng (Bồ câu, Thỏ, Mèo...) có hình dáng khác nhau, bạn có thể tải lên <strong>sprite sheet vẽ riêng cái nón/skin</strong> cho từng loài thú đó. Khi người dùng đổi sang bé cưng nào, game sẽ tự động hiển thị sheet của đúng bé đó!
              </p>
            </div>

            {/* Default Sheet Info */}
            <div className="mb-4 rounded-xl border border-charcoal/20 bg-cream-50 p-3 flex items-center justify-between">
              <div>
                <strong className="text-xs text-charcoal block">Sprite sheet mặc định (Sheet chung):</strong>
                <span className="text-[11px] text-charcoal/60">
                  {sheetModalItem.spriteSheetUrl
                    ? `Đang có: ${sheetModalItem.spriteSheetUrl}`
                    : 'Chưa có sheet mặc định.'}
                </span>
              </div>
              <label className="flex items-center gap-1 rounded-lg border-2 border-charcoal bg-white px-3 py-1.5 text-xs font-bold text-charcoal hover:bg-cream-100 cursor-pointer shadow-pixel-sm">
                <Upload size={13} /> Tải sheet mặc định
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
            <div className="space-y-2.5">
              <h4 className="font-pixel text-xs text-charcoal">DANH SÁCH CÁC LOÀI THÚ CƯNG TRONG GAME:</h4>

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
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border-2 transition-all ${
                        hasCustomSheet
                          ? 'border-amber-500 bg-amber-50/50'
                          : isCompatible
                          ? 'border-charcoal/30 bg-white'
                          : 'border-gray-200 bg-gray-50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={pet.previewUrl || pet.spriteSheetUrl}
                          alt=""
                          className="h-10 w-10 object-contain rounded border border-charcoal/30 p-1 bg-cream-100"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-xs text-charcoal">{pet.name}</strong>
                            {hasCustomSheet ? (
                              <span className="rounded bg-amber-200 px-1.5 py-0.2 text-[9px] font-black text-amber-900">
                                Đã có Sheet riêng
                              </span>
                            ) : (
                              <span className="rounded bg-gray-200 px-1.5 py-0.2 text-[9px] font-bold text-gray-700">
                                Dùng sheet chung
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-charcoal/60 truncate block max-w-xs">
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
                            className="p-1.5 text-terracotta-500 hover:bg-terracotta-50 rounded"
                            title="Xóa sheet riêng này"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}

                        <label
                          className={`flex items-center gap-1.5 rounded-lg border-2 border-charcoal px-3 py-1.5 text-xs font-bold shadow-pixel-sm cursor-pointer transition-all ${
                            uploadingPetId === pet.id
                              ? 'bg-gray-200 opacity-50 cursor-not-allowed'
                              : hasCustomSheet
                              ? 'bg-white text-charcoal hover:bg-cream-100'
                              : 'bg-emerald-500 text-white hover:bg-emerald-600'
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
            <div className="mt-5 border-t-2 border-charcoal/10 pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setSheetModalItem(null)}
                className="rounded-xl border-2 border-charcoal bg-charcoal text-white px-5 py-2 font-pixel text-xs shadow-pixel hover:bg-charcoal/90"
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
