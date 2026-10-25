import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Upload,
  RefreshCw,
  Layers,
  CheckCircle,
  PawPrint,
  Coins,
  Check,
  ShoppingBag
} from 'lucide-react';
import { api } from '../services/api';
import { PetType, AnimationState } from '../types';
import {
  SPRITE_SHEET_SPEC,
  ActionSliceConfig,
  detectGridAndContent,
  ActionSlicePreview
} from './AdminConsole';
import { PixelPetCanvas } from './PixelPetCanvas';

interface AdminSkinForgeProps {
  petTypes?: PetType[];
  onNavigateToShop?: () => void;
}

export const AdminSkinForge: React.FC<AdminSkinForgeProps> = ({ petTypes: initialPets, onNavigateToShop }) => {
  const [pets, setPets] = useState<PetType[]>(initialPets || []);
  const [forgeMode, setForgeMode] = useState<'ACTIONS' | 'IMAGE'>('ACTIONS');

  // Shared Skin Metadata
  const [skinName, setSkinName] = useState('');
  const [skinDesc, setSkinDesc] = useState('');
  const [expPrice, setExpPrice] = useState<number>(150);
  const [rarity, setRarity] = useState<string>('COMMON');
  const [isSpecificPets, setIsSpecificPets] = useState<boolean>(false);
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>([]);
  const [removeBg, setRemoveBg] = useState<boolean>(true);

  // Mode: ACTIONS states
  const [actionFiles, setActionFiles] = useState<Record<string, File>>({});
  const [actionPreviews, setActionPreviews] = useState<Record<string, string>>({});
  const [actionFrameCounts, setActionFrameCounts] = useState<Record<string, number>>({});
  const [actionSliceConfigs, setActionSliceConfigs] = useState<Record<string, ActionSliceConfig>>({});
  const [actionImageDimensions, setActionImageDimensions] = useState<Record<string, { width: number; height: number }>>({});
  const [expandedSheetState, setExpandedSheetState] = useState<string | null>(null);
  const [actionCategoryFilter, setActionCategoryFilter] = useState<'ALL' | 'BASIC' | 'WORK' | 'INTERACTION' | 'EMOTION'>('ALL');
  const [isGenerating, setIsGenerating] = useState(false);

  // Mode: IMAGE states
  const [sheetFile, setSheetFile] = useState<File | null>(null);
  const [sheetPreviewUrl, setSheetPreviewUrl] = useState<string | null>(null);
  const sheetInputRef = useRef<HTMLInputElement>(null);

  // Result state
  const [createdResult, setCreatedResult] = useState<any | null>(null);
  const [previewActionState, setPreviewActionState] = useState<AnimationState>('IDLE');

  // Fetch pet types if not provided
  useEffect(() => {
    if (!initialPets || initialPets.length === 0) {
      api.getPetTypes().then((res: any) => setPets(res.data)).catch(() => {});
    } else {
      setPets(initialPets);
    }
  }, [initialPets]);

  const handleResetForm = () => {
    setSkinName('');
    setSkinDesc('');
    setExpPrice(150);
    setRarity('COMMON');
    setIsSpecificPets(false);
    setSelectedPetIds([]);
    setRemoveBg(true);

    // Revoke object URLs
    Object.values(actionPreviews).forEach(url => {
      try { URL.revokeObjectURL(url); } catch {}
    });
    if (sheetPreviewUrl) {
      try { URL.revokeObjectURL(sheetPreviewUrl); } catch {}
    }

    setActionFiles({});
    setActionPreviews({});
    setActionFrameCounts({});
    setActionSliceConfigs({});
    setActionImageDimensions({});
    setExpandedSheetState(null);
    setSheetFile(null);
    setSheetPreviewUrl(null);
    if (sheetInputRef.current) sheetInputRef.current.value = '';

    // Clear file inputs
    SPRITE_SHEET_SPEC.forEach(s => {
      const input = document.getElementById(`skin-action-input-${s.state}`) as HTMLInputElement | null;
      if (input) input.value = '';
    });
  };

  const getActionConfig = (state: string): ActionSliceConfig => {
    const spec = SPRITE_SHEET_SPEC.find(s => s.state === state);
    const defaultFrames = spec?.frames ?? 4;
    return (
      actionSliceConfigs[state] ?? {
        cols: 1,
        rows: 1,
        startFrame: 1,
        endFrame: defaultFrames
      }
    );
  };

  const handleActionFileChange = (state: string, file: File | null) => {
    if (!file) return;

    if (actionPreviews[state]) {
      try { URL.revokeObjectURL(actionPreviews[state]); } catch {}
    }

    const objectUrl = URL.createObjectURL(file);
    setActionFiles(prev => ({ ...prev, [state]: file }));
    setActionPreviews(prev => ({ ...prev, [state]: objectUrl }));

    const spec = SPRITE_SHEET_SPEC.find(s => s.state === state);
    const defaultFrames = spec?.frames ?? 4;

    const img = new Image();
    img.src = objectUrl;
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      setActionImageDimensions(prev => ({ ...prev, [state]: { width: w, height: h } }));

      const detected = detectGridAndContent(img);
      const isMultiCell = detected.cols > 1 || detected.rows > 1;

      if (isMultiCell) {
        const total = detected.cols * detected.rows;
        let chosenCells: number[] = [];
        if (detected.nonBlankCells.length > 0 && detected.nonBlankCells.length <= defaultFrames) {
          chosenCells = detected.nonBlankCells;
        } else if (detected.nonBlankCells.length > defaultFrames) {
          chosenCells = detected.nonBlankCells.slice(0, defaultFrames);
        } else {
          chosenCells = Array.from({ length: Math.min(total, defaultFrames) }, (_, i) => i);
        }

        setActionSliceConfigs(prev => ({
          ...prev,
          [state]: {
            cols: detected.cols,
            rows: detected.rows,
            startFrame: 1,
            endFrame: chosenCells.length,
            selectedCells: chosenCells
          }
        }));
        setActionFrameCounts(prev => ({ ...prev, [state]: chosenCells.length }));
      } else {
        setActionSliceConfigs(prev => ({
          ...prev,
          [state]: {
            cols: 1,
            rows: 1,
            startFrame: 1,
            endFrame: defaultFrames
          }
        }));
        setActionFrameCounts(prev => ({ ...prev, [state]: defaultFrames }));
      }
    };
  };

  const handleRemoveAction = (state: string) => {
    if (actionPreviews[state]) {
      try { URL.revokeObjectURL(actionPreviews[state]); } catch {}
    }
    setActionFiles(prev => {
      const next = { ...prev };
      delete next[state];
      return next;
    });
    setActionPreviews(prev => {
      const next = { ...prev };
      delete next[state];
      return next;
    });
    setActionFrameCounts(prev => {
      const next = { ...prev };
      delete next[state];
      return next;
    });
    setActionSliceConfigs(prev => {
      const next = { ...prev };
      delete next[state];
      return next;
    });
    const input = document.getElementById(`skin-action-input-${state}`) as HTMLInputElement | null;
    if (input) input.value = '';
  };

  const toggleCellSelection = (state: string, cellIdx: number) => {
    const cfg = getActionConfig(state);
    const curSelected = cfg.selectedCells && cfg.selectedCells.length > 0
      ? [...cfg.selectedCells]
      : Array.from({ length: Math.max(1, cfg.endFrame - cfg.startFrame + 1) }, (_, i) => (cfg.startFrame - 1) + i);

    let nextSelected: number[];
    if (curSelected.includes(cellIdx)) {
      if (curSelected.length === 1) return; // Keep at least 1 cell
      nextSelected = curSelected.filter(c => c !== cellIdx);
    } else {
      nextSelected = [...curSelected, cellIdx].sort((a, b) => a - b);
    }

    setActionSliceConfigs(prev => ({
      ...prev,
      [state]: {
        ...cfg,
        selectedCells: nextSelected,
        endFrame: nextSelected.length
      }
    }));
    setActionFrameCounts(prev => ({ ...prev, [state]: nextSelected.length }));
  };

  const handleSheetFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSheetFile(file);
    const objectUrl = URL.createObjectURL(file);
    setSheetPreviewUrl(objectUrl);

    const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    if (!skinName) {
      setSkinName(baseName.charAt(0).toUpperCase() + baseName.slice(1));
    }
  };

  const handleCreateSkinFromActions = async () => {
    if (!skinName.trim()) {
      alert('Vui lòng nhập tên skin.');
      return;
    }
    if (!actionFiles['IDLE']) {
      alert('Hành động IDLE (Mặc định) là bắt buộc. Vui lòng tải ít nhất file ảnh/sheet cho hành động IDLE!');
      return;
    }

    setIsGenerating(true);
    try {
      const formData = new FormData();
      formData.append('name', skinName.trim());
      formData.append('description', skinDesc.trim() || skinName.trim());
      formData.append('expPrice', String(expPrice || 150));
      formData.append('rarity', rarity);
      formData.append('removeBackground', String(removeBg));
      formData.append('frameCounts', JSON.stringify(actionFrameCounts));
      formData.append('sliceConfigs', JSON.stringify(actionSliceConfigs));

      if (isSpecificPets && selectedPetIds.length > 0) {
        formData.append('compatiblePetIds', JSON.stringify(selectedPetIds));
      }

      for (const [actionState, file] of Object.entries(actionFiles)) {
        if (file) {
          formData.append(`action_${actionState}`, file);
        }
      }

      const res = await api.createSkinFromActions(formData);
      setCreatedResult(res.data);
      alert(`Đã tạo thành công skin "${skinName.trim()}" từ các sheet hành động và mở bán trong Shop!`);
      handleResetForm();
    } catch (err: any) {
      alert(`Không thể tạo skin: ${err?.response?.data?.error || err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImportSkinSheet = async () => {
    if (!sheetFile || !skinName.trim()) {
      alert('Vui lòng chọn file sprite sheet và đặt tên cho skin.');
      return;
    }

    setIsGenerating(true);
    try {
      const formData = new FormData();
      formData.append('image', sheetFile);
      formData.append('name', skinName.trim());
      formData.append('description', skinDesc.trim() || skinName.trim());
      formData.append('expPrice', String(expPrice || 150));
      formData.append('rarity', rarity);

      if (isSpecificPets && selectedPetIds.length > 0) {
        formData.append('compatiblePetIds', JSON.stringify(selectedPetIds));
      }

      const res = await api.importSkinSpriteSheet(formData);
      setCreatedResult(res.data);
      alert(`Đã nhập thành công sprite sheet cho skin "${skinName.trim()}" và mở bán trong Shop!`);
      handleResetForm();
    } catch (err: any) {
      alert(`Không thể nhập sprite sheet skin: ${err?.response?.data?.error || err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const filteredActions = SPRITE_SHEET_SPEC.filter(s => {
    if (actionCategoryFilter === 'ALL') return true;
    if (actionCategoryFilter === 'BASIC') return s.group.includes('Nhóm 1');
    if (actionCategoryFilter === 'WORK') return s.group.includes('Nhóm 2');
    if (actionCategoryFilter === 'INTERACTION') return s.group.includes('Nhóm 3');
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border-2 border-charcoal rounded-xl shadow-pixel p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 font-pixel text-base text-charcoal">
              <Layers className="text-terracotta-500" size={22} /> TẠO SKIN / TRANG PHỤC TOÀN DIỆN
            </h2>
            <p className="text-xs text-gray-600 mt-1">
              Tạo skin trang phục 11 trạng thái cho thú cưng bằng cách tải từng hành động hoặc nhập nguyên Sprite Sheet. Skin sẽ đồng bộ động tác hoàn hảo khi thú làm việc, đi ngủ hay ăn uống!
            </p>
          </div>
          {onNavigateToShop && (
            <button
              type="button"
              onClick={onNavigateToShop}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-400 hover:bg-amber-500 text-charcoal text-xs font-bold rounded-lg border-2 border-charcoal shadow-pixel-sm transition-transform active:scale-95 shrink-0"
            >
              <ShoppingBag size={15} /> Quản lý trong Shop
            </button>
          )}
        </div>
      </div>

      {/* Submode Switcher */}
      <div className="flex bg-cream-200 p-1.5 rounded-xl border-2 border-charcoal gap-2 font-sans font-extrabold text-xs">
        <button
          type="button"
          onClick={() => setForgeMode('ACTIONS')}
          className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            forgeMode === 'ACTIONS'
              ? 'bg-amber-500 text-white shadow-pixel-sm'
              : 'bg-white text-charcoal hover:bg-cream-50'
          }`}
        >
          <Sparkles size={15} /> Thêm Theo Từng Hành Động (GIF/Ảnh/Sheet Lẻ)
        </button>
        <button
          type="button"
          onClick={() => setForgeMode('IMAGE')}
          className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            forgeMode === 'IMAGE'
              ? 'bg-terracotta-400 text-white shadow-pixel-sm'
              : 'bg-white text-charcoal hover:bg-cream-50'
          }`}
        >
          <Upload size={15} /> Nhập Nguyên Sprite Sheet (11 Trạng Thái)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Configuration & Uploads */}
        <div className="lg:col-span-7 space-y-4">
          {/* Metadata Card */}
          <div className="bg-white border-2 border-charcoal rounded-xl shadow-pixel p-5 space-y-4 font-sans">
            <div className="flex items-center justify-between border-b border-charcoal/20 pb-2">
              <span className="font-extrabold text-xs text-charcoal uppercase flex items-center gap-1.5">
                <Layers size={16} className="text-terracotta-500" /> Thông tin Skin & Cửa Hàng
              </span>
              <button
                type="button"
                onClick={handleResetForm}
                className="px-2.5 py-1 text-xs font-bold bg-cream-100 hover:bg-cream-200 text-charcoal rounded-lg border border-charcoal flex items-center gap-1 transition-colors"
                title="Làm sạch toàn bộ form"
              >
                <RefreshCw size={12} /> Làm sạch form
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Tên skin / trang phục <span className="text-terracotta-500">*</span>
                </label>
                <input
                  type="text"
                  value={skinName}
                  onChange={e => setSkinName(e.target.value)}
                  placeholder="Ví dụ: Giáp Kim Cương, Áo Mưa Vàng, Bộ Vest..."
                  className="w-full px-3 py-1.5 text-xs font-bold border-2 border-charcoal rounded-lg focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Mô tả skin</label>
                <input
                  type="text"
                  value={skinDesc}
                  onChange={e => setSkinDesc(e.target.value)}
                  placeholder="Mô tả phong cách skin..."
                  className="w-full px-3 py-1.5 text-xs border-2 border-charcoal rounded-lg focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Giá bán (EXP) <span className="text-terracotta-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={expPrice}
                    onChange={e => setExpPrice(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full pl-8 pr-3 py-1.5 text-xs font-bold border-2 border-charcoal rounded-lg focus:outline-none bg-white font-mono"
                  />
                  <Coins size={14} className="absolute left-2.5 top-2.5 text-amber-600" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Độ hiếm</label>
                <select
                  value={rarity}
                  onChange={e => setRarity(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-bold border-2 border-charcoal rounded-lg focus:outline-none bg-white"
                >
                  <option value="COMMON">Phổ biến (COMMON)</option>
                  <option value="RARE">Hiếm (RARE)</option>
                  <option value="EPIC">Sử thi (EPIC)</option>
                  <option value="LEGENDARY">Huyền thoại (LEGENDARY)</option>
                </select>
              </div>
            </div>

            {/* Pet Compatibility */}
            <div className="p-3 bg-cream-50 rounded-lg border border-charcoal/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold text-xs text-charcoal">
                  <PawPrint size={15} className="text-amber-600" /> Áp dụng cho thú cưng nào?
                </span>
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1 font-bold text-charcoal cursor-pointer">
                    <input
                      type="radio"
                      name="skinCompat"
                      checked={!isSpecificPets}
                      onChange={() => {
                        setIsSpecificPets(false);
                        setSelectedPetIds([]);
                      }}
                      className="accent-terracotta-500"
                    />
                    Tất cả thú cưng
                  </label>
                  <label className="flex items-center gap-1 font-bold text-charcoal cursor-pointer">
                    <input
                      type="radio"
                      name="skinCompat"
                      checked={isSpecificPets}
                      onChange={() => setIsSpecificPets(true)}
                      className="accent-terracotta-500"
                    />
                    Chỉ định thú cụ thể
                  </label>
                </div>
              </div>

              {isSpecificPets && (
                <div className="pt-2 border-t border-charcoal/20">
                  <p className="text-[11px] font-bold text-gray-600 mb-2">
                    Chọn các loài thú có thể mặc skin này:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {pets.map(pet => {
                      const isChecked = selectedPetIds.includes(pet.id);
                      return (
                        <label
                          key={pet.id}
                          className={`flex items-center gap-2 p-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-amber-100 border-amber-500 text-charcoal'
                              : 'bg-white border-charcoal/20 text-gray-600 hover:bg-cream-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedPetIds(prev => [...prev, pet.id]);
                              } else {
                                setSelectedPetIds(prev => prev.filter(id => id !== pet.id));
                              }
                            }}
                            className="accent-amber-500 rounded"
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
            </div>

            {forgeMode === 'ACTIONS' && (
              <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={removeBg}
                  onChange={e => setRemoveBg(e.target.checked)}
                  className="rounded border-charcoal text-amber-500 focus:ring-0"
                />
                <span>Tự động xóa nền xám/trắng thành trong suốt (Auto Remove Solid BG)</span>
              </label>
            )}
          </div>

          {/* Mode 1: ACTIONS */}
          {forgeMode === 'ACTIONS' && (
            <div className="bg-white border-2 border-charcoal rounded-xl shadow-pixel p-5 space-y-4 font-sans">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-600 font-extrabold text-sm uppercase">
                  <Sparkles size={18} /> Tải Sheet Lẻ Cho 11 Trạng Thái Của Skin
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full border border-amber-300">
                  GIF, PNG, WEBP
                </span>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed">
                Tải trang phục cho trạng thái <strong>IDLE (Bắt buộc)</strong>. Các trạng thái khác nếu chưa có file sẽ <strong>tự động kế thừa từ Idle</strong> để nhân vật luôn hiển thị đầy đủ mọi lúc!
              </p>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-1 border-b border-charcoal/20 pb-2 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setActionCategoryFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${actionCategoryFilter === 'ALL' ? 'bg-charcoal text-white' : 'bg-cream-100 hover:bg-cream-200 text-charcoal'}`}
                >
                  Tất cả 11 hành động
                </button>
                <button
                  type="button"
                  onClick={() => setActionCategoryFilter('BASIC')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${actionCategoryFilter === 'BASIC' ? 'bg-charcoal text-white' : 'bg-cream-100 hover:bg-cream-200 text-charcoal'}`}
                >
                  1. Sinh hoạt (5)
                </button>
                <button
                  type="button"
                  onClick={() => setActionCategoryFilter('WORK')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${actionCategoryFilter === 'WORK' ? 'bg-charcoal text-white' : 'bg-cream-100 hover:bg-cream-200 text-charcoal'}`}
                >
                  2. Làm việc (1)
                </button>
                <button
                  type="button"
                  onClick={() => setActionCategoryFilter('INTERACTION')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${actionCategoryFilter === 'INTERACTION' ? 'bg-charcoal text-white' : 'bg-cream-100 hover:bg-cream-200 text-charcoal'}`}
                >
                  3. Tương tác & Cảm xúc (5)
                </button>
              </div>

              {/* Actions List */}
              <div className="max-h-[520px] overflow-y-auto space-y-2 pr-1">
                {filteredActions.map(s => {
                  const file = actionFiles[s.state];
                  const preview = actionPreviews[s.state];
                  const isIdle = s.state === 'IDLE';

                  return (
                    <div
                      key={s.state}
                      className={`p-2.5 rounded-xl border-2 transition-all ${
                        preview
                          ? 'bg-amber-50/80 border-amber-500 shadow-pixel-sm'
                          : isIdle
                            ? 'bg-red-50/60 border-red-300'
                            : 'bg-cream-50/60 border-charcoal/20 hover:border-charcoal/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs text-charcoal">
                            {String(s.row).padStart(2, '0')}. {s.label}
                          </span>
                          {isIdle && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-red-100 text-red-700 rounded border border-red-300">
                              Bắt buộc
                            </span>
                          )}
                          {!isIdle && !file && (
                            <span className="text-[9px] text-gray-400 font-bold">
                              Kế thừa từ Idle
                            </span>
                          )}
                          {file && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-green-100 text-green-700 rounded border border-green-300">
                              ✓ Đã có file
                            </span>
                          )}
                        </div>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${s.loop ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {s.frames}f • {s.loop ? 'Loop' : 'One-shot'}
                        </span>
                      </div>

                      {preview ? (
                        <div className="bg-white p-3 rounded-xl border border-charcoal/30 space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="flex flex-col items-center shrink-0">
                              <ActionSlicePreview
                                imageUrl={preview}
                                config={getActionConfig(s.state)}
                                fps={6}
                              />
                              <span className="text-[9px] font-extrabold text-amber-700 mt-1">
                                Hoạt ảnh live
                              </span>
                              <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-300">
                                {(getActionConfig(s.state).selectedCells?.length ?? 1)}f ({getActionConfig(s.state).cols}×{getActionConfig(s.state).rows})
                              </span>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between text-[11px] font-bold text-charcoal mb-1">
                                <span className="truncate max-w-[190px]" title={file?.name}>
                                  {file?.name}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedSheetState(expandedSheetState === s.state ? null : s.state)}
                                    className="text-[9px] px-1.5 py-0.5 rounded bg-cream-200 hover:bg-cream-300 text-charcoal font-semibold border border-charcoal/20"
                                  >
                                    {expandedSheetState === s.state ? 'Thu nhỏ' : '🔍 Phóng to'}
                                  </button>
                                </div>
                              </div>

                              <div className={`flex items-center justify-center bg-cream-50 rounded-lg border border-charcoal/20 p-2 overflow-hidden transition-all duration-200 shadow-inner ${
                                expandedSheetState === s.state ? 'min-h-[260px] max-h-[380px]' : 'min-h-[140px] max-h-[220px]'
                              }`}>
                                <div className="relative inline-block max-h-full max-w-full">
                                  <img
                                    src={preview}
                                    alt={s.label}
                                    className={`max-w-full object-contain block mx-auto pixelated shadow-sm ${
                                      expandedSheetState === s.state ? 'max-h-[350px]' : 'max-h-[190px]'
                                    }`}
                                  />
                                  {(() => {
                                    const cfg = getActionConfig(s.state);
                                    const totalCells = cfg.cols * cfg.rows;
                                    if (totalCells <= 1) return null;
                                    const activeCells = cfg.selectedCells && cfg.selectedCells.length > 0
                                      ? cfg.selectedCells
                                      : Array.from({ length: Math.max(1, cfg.endFrame - cfg.startFrame + 1) }, (_, i) => (cfg.startFrame - 1) + i);

                                    return (
                                      <div
                                        className="absolute inset-0"
                                        style={{
                                          display: 'grid',
                                          gridTemplateColumns: `repeat(${cfg.cols}, 1fr)`,
                                          gridTemplateRows: `repeat(${cfg.rows}, 1fr)`
                                        }}
                                      >
                                        {Array.from({ length: totalCells }).map((_, cIdx) => {
                                          const isActive = activeCells.includes(cIdx);
                                          return (
                                            <div
                                              key={cIdx}
                                              onClick={() => toggleCellSelection(s.state, cIdx)}
                                              title={`Ô số ${cIdx + 1}: Click để ${isActive ? 'bỏ chọn' : 'chọn'}`}
                                              className={`border cursor-pointer transition-all duration-150 relative flex items-start justify-start p-0.5 select-none ${
                                                isActive
                                                  ? 'border-emerald-500/90 bg-emerald-500/15 hover:bg-emerald-500/30'
                                                  : 'border-charcoal/30 bg-charcoal/70 hover:bg-charcoal/50'
                                              }`}
                                            >
                                              <span
                                                className={`text-[8px] font-black px-0.5 rounded leading-none ${
                                                  isActive
                                                    ? 'text-white bg-emerald-600 shadow-xs'
                                                    : 'text-gray-300 line-through bg-black/70'
                                                }`}
                                              >
                                                {cIdx + 1}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-charcoal/10 text-xs">
                            <label className="cursor-pointer text-amber-700 hover:text-amber-800 font-bold flex items-center gap-1">
                              <span>Thay đổi file</span>
                              <input
                                id={`skin-action-input-${s.state}`}
                                type="file"
                                accept="image/gif,image/png,image/webp"
                                onChange={e => handleActionFileChange(s.state, e.target.files?.[0] || null)}
                                className="hidden"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => handleRemoveAction(s.state)}
                              className="text-terracotta-600 hover:text-terracotta-700 font-bold"
                            >
                              Xóa file
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 py-2 px-3 border-2 border-dashed border-charcoal/30 hover:border-amber-500 rounded-lg bg-white text-xs font-bold text-charcoal/70 hover:text-amber-700 transition-colors">
                            <Upload size={14} />
                            <span>Chọn file cho {s.label}</span>
                            <input
                              id={`skin-action-input-${s.state}`}
                              type="file"
                              accept="image/gif,image/png,image/webp"
                              onChange={e => handleActionFileChange(s.state, e.target.files?.[0] || null)}
                              className="hidden"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={isGenerating || !actionFiles['IDLE'] || !skinName.trim()}
                onClick={handleCreateSkinFromActions}
                className="w-full py-3 bg-terracotta-500 hover:bg-terracotta-600 disabled:opacity-50 text-white font-pixel text-xs rounded-xl border-2 border-charcoal shadow-pixel transition-transform active:scale-95 flex items-center justify-center gap-2"
              >
                <Sparkles size={16} />
                {isGenerating ? 'Đang ghép sheet và tạo skin...' : 'Tạo Skin Từ Các Hành Động & Đưa Lên Shop'}
              </button>
            </div>
          )}

          {/* Mode 2: IMAGE */}
          {forgeMode === 'IMAGE' && (
            <div className="bg-white border-2 border-charcoal rounded-xl shadow-pixel p-5 space-y-4 font-sans">
              <div className="flex items-center gap-2 text-terracotta-600 font-extrabold text-sm uppercase">
                <Upload size={18} /> Nhập Full Sprite Sheet Cho Skin
              </div>

              <p className="text-xs text-gray-600 leading-relaxed">
                Tải lên file ảnh chứa đầy đủ 11 hàng trạng thái theo chuẩn hoạt ảnh. Hệ thống sẽ tự động phân tích lưới và tạo skin cho cửa hàng!
              </p>

              <div className="border-2 border-dashed border-charcoal/30 hover:border-charcoal rounded-xl p-6 text-center bg-cream-50">
                <input
                  ref={sheetInputRef}
                  type="file"
                  accept="image/png,image/webp"
                  onChange={handleSheetFileChange}
                  className="hidden"
                  id="skin-full-sheet-upload"
                />
                <label htmlFor="skin-full-sheet-upload" className="cursor-pointer flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-cream-200 border-2 border-charcoal flex items-center justify-center text-charcoal">
                    <Upload size={22} />
                  </div>
                  <span className="text-xs font-bold text-charcoal">
                    {sheetFile ? sheetFile.name : 'Bấm vào đây để chọn Sprite Sheet (PNG, WEBP)'}
                  </span>
                  <span className="text-[10px] text-gray-500">Chuẩn 11 hàng ô vuông 64×64</span>
                </label>
              </div>

              {sheetPreviewUrl && (
                <div className="rounded-lg border-2 border-charcoal bg-cream-100 p-2 overflow-x-auto max-h-60">
                  <img
                    src={sheetPreviewUrl}
                    alt="Sprite Sheet Preview"
                    className="max-h-56 mx-auto object-contain pixelated"
                  />
                </div>
              )}

              <button
                type="button"
                disabled={isGenerating || !sheetFile || !skinName.trim()}
                onClick={handleImportSkinSheet}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-pixel text-xs rounded-xl border-2 border-charcoal shadow-pixel transition-transform active:scale-95 flex items-center justify-center gap-2"
              >
                <Upload size={16} />
                {isGenerating ? 'Đang xử lý sprite sheet...' : 'Nhập Sprite Sheet & Mở Bán Skin'}
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Live Preview & Details */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border-2 border-charcoal rounded-xl shadow-pixel p-5 space-y-4 sticky top-24 font-sans">
            <h3 className="font-extrabold text-xs text-charcoal uppercase flex items-center gap-1.5 border-b border-charcoal/20 pb-2">
              <Sparkles size={16} className="text-amber-500" /> Xem trước Skin & Thông tin
            </h3>

            {/* Live Canvas / Preview Box */}
            <div className="bg-cream-100 rounded-xl border-2 border-charcoal p-4 flex flex-col items-center justify-center min-h-[220px]">
              {actionPreviews['IDLE'] ? (
                <div className="flex flex-col items-center">
                  <ActionSlicePreview
                    imageUrl={actionPreviews['IDLE']}
                    config={getActionConfig('IDLE')}
                    fps={6}
                  />
                  <span className="text-[10px] font-bold text-gray-500 mt-2">
                    Xem trước động thái IDLE
                  </span>
                </div>
              ) : sheetPreviewUrl ? (
                <div className="flex flex-col items-center">
                  <img
                    src={sheetPreviewUrl}
                    alt=""
                    className="w-24 h-24 object-contain pixelated"
                  />
                  <span className="text-[10px] font-bold text-gray-500 mt-2">
                    Ảnh Sprite Sheet
                  </span>
                </div>
              ) : (
                <div className="text-center text-gray-400 py-8">
                  <Layers size={40} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-bold">Chưa có ảnh xem trước</p>
                  <p className="text-[10px] text-gray-500">Tải ảnh cho hành động IDLE để xem hoạt ảnh</p>
                </div>
              )}
            </div>

            {/* Summary card */}
            <div className="p-3 bg-cream-50 rounded-lg border border-charcoal/20 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-bold">Tên skin:</span>
                <span className="font-extrabold text-charcoal">{skinName || 'Chưa đặt tên'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-bold">Giá mở bán:</span>
                <span className="font-mono font-bold text-amber-700 flex items-center gap-1">
                  <Coins size={13} /> {expPrice} EXP
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-bold">Độ hiếm:</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cream-200 border border-charcoal/20">
                  {rarity}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-bold">Tương thích:</span>
                <span className="font-bold text-emerald-700 text-right">
                  {!isSpecificPets || selectedPetIds.length === 0
                    ? 'Tất cả thú cưng'
                    : `${selectedPetIds.length} loài thú`}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-bold">Số hành động đã tải:</span>
                <span className="font-bold text-charcoal">
                  {Object.keys(actionFiles).length} / 11
                </span>
              </div>
            </div>

            {createdResult && (
              <div className="p-3.5 bg-emerald-50 rounded-xl border-2 border-emerald-500 shadow-sm space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                  <CheckCircle size={16} /> Đã tạo thành công skin mới!
                </div>
                <p className="text-[11px] text-emerald-700">
                  Skin <strong>{createdResult?.item?.name}</strong> đã sẵn sàng trong cửa hàng để người dùng trang bị cho thú cưng!
                </p>
                {onNavigateToShop && (
                  <button
                    type="button"
                    onClick={onNavigateToShop}
                    className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors"
                  >
                    Đến Quản lý Cửa Hàng để kiểm tra →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
