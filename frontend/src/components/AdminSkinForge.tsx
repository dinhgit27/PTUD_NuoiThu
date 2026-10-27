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
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Layers className="text-[#1b365d]" size={22} /> TẠO SKIN / TRANG PHỤC TOÀN DIỆN
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Tạo skin trang phục 11 trạng thái cho thú cưng bằng cách tải từng hành động hoặc nhập nguyên Sprite Sheet. Skin sẽ đồng bộ động tác hoàn hảo khi thú làm việc, đi ngủ hay ăn uống!
            </p>
          </div>
          {onNavigateToShop && (
            <button
              type="button"
              onClick={onNavigateToShop}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold rounded-xl shadow-xs transition active:scale-95 shrink-0"
            >
              <ShoppingBag size={15} /> Quản lý trong Shop
            </button>
          )}
        </div>
      </div>

      {/* Submode Switcher */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 gap-2 font-sans font-bold text-xs">
        <button
          type="button"
          onClick={() => setForgeMode('ACTIONS')}
          className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition ${
            forgeMode === 'ACTIONS'
              ? 'bg-[#1b365d] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Sparkles size={15} /> Thêm Theo Từng Hành Động (GIF/Ảnh/Sheet Lẻ)
        </button>
        <button
          type="button"
          onClick={() => setForgeMode('IMAGE')}
          className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition ${
            forgeMode === 'IMAGE'
              ? 'bg-amber-400 text-slate-950 shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Upload size={15} /> Nhập Nguyên Sprite Sheet (11 Trạng Thái)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Configuration & Uploads */}
        <div className="lg:col-span-7 space-y-4">
          {/* Metadata Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5 space-y-4 font-sans">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-xs text-slate-900 uppercase flex items-center gap-1.5">
                <Layers size={16} className="text-[#1b365d]" /> Thông tin Skin & Cửa Hàng
              </span>
              <button
                type="button"
                onClick={handleResetForm}
                className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 flex items-center gap-1 transition-colors"
                title="Làm sạch toàn bộ form"
              >
                <RefreshCw size={12} /> Làm sạch form
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên skin / trang phục <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={skinName}
                  onChange={e => setSkinName(e.target.value)}
                  placeholder="Ví dụ: Giáp Kim Cương, Áo Mưa Vàng, Bộ Vest..."
                  className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-xl focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/15 bg-white text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả skin</label>
                <input
                  type="text"
                  value={skinDesc}
                  onChange={e => setSkinDesc(e.target.value)}
                  placeholder="Mô tả phong cách skin..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/15 bg-white text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Giá bán (EXP) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={expPrice}
                    onChange={e => setExpPrice(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full pl-8 pr-3 py-2 text-xs font-bold border border-slate-300 rounded-xl focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/15 bg-white text-slate-900 font-mono focus:outline-none"
                  />
                  <Coins size={14} className="absolute left-2.5 top-2.5 text-amber-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Độ hiếm</label>
                <select
                  value={rarity}
                  onChange={e => setRarity(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/15 bg-white text-slate-900 focus:outline-none"
                >
                  <option value="COMMON">Phổ biến (COMMON)</option>
                  <option value="RARE">Hiếm (RARE)</option>
                  <option value="EPIC">Sử thi (EPIC)</option>
                  <option value="LEGENDARY">Huyền thoại (LEGENDARY)</option>
                </select>
              </div>
            </div>

            {/* Pet Compatibility */}
            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-semibold text-xs text-slate-800">
                  <PawPrint size={15} className="text-amber-500" /> Áp dụng cho thú cưng nào?
                </span>
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 font-medium text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="skinCompat"
                      checked={!isSpecificPets}
                      onChange={() => {
                        setIsSpecificPets(false);
                        setSelectedPetIds([]);
                      }}
                      className="accent-[#1b365d]"
                    />
                    Tất cả thú cưng
                  </label>
                  <label className="flex items-center gap-1.5 font-medium text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="skinCompat"
                      checked={isSpecificPets}
                      onChange={() => setIsSpecificPets(true)}
                      className="accent-[#1b365d]"
                    />
                    Chỉ định thú cụ thể
                  </label>
                </div>
              </div>

              {isSpecificPets && (
                <div className="pt-2 border-t border-slate-200">
                  <p className="text-[11px] font-semibold text-slate-600 mb-2">
                    Chọn các loài thú có thể mặc skin này:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {pets.map(pet => {
                      const isChecked = selectedPetIds.includes(pet.id);
                      return (
                        <label
                          key={pet.id}
                          className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                            isChecked
                              ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-xs'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
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
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={removeBg}
                  onChange={e => setRemoveBg(e.target.checked)}
                  className="rounded border-slate-300 text-amber-500 focus:ring-0"
                />
                <span>Tự động xóa nền xám/trắng thành trong suốt (Auto Remove Solid BG)</span>
              </label>
            )}
          </div>

          {/* Mode 1: ACTIONS */}
          {forgeMode === 'ACTIONS' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5 space-y-4 font-sans">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#1b365d] font-bold text-sm uppercase">
                  <Sparkles size={18} className="text-amber-500" /> Tải Sheet Lẻ Cho 11 Trạng Thái Của Skin
                </div>
                <span className="text-[10px] font-semibold px-2.5 py-0.5 bg-amber-50 text-amber-800 rounded-full border border-amber-200">
                  GIF, PNG, WEBP
                </span>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Tải trang phục cho trạng thái <strong>IDLE (Bắt buộc)</strong>. Các trạng thái khác nếu chưa có file sẽ <strong>tự động kế thừa từ Idle</strong> để nhân vật luôn hiển thị đầy đủ mọi lúc!
              </p>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-1 border-b border-slate-100 pb-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActionCategoryFilter('ALL')}
                  className={`px-3 py-1 rounded-lg transition ${actionCategoryFilter === 'ALL' ? 'bg-[#1b365d] text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                >
                  Tất cả 11 hành động
                </button>
                <button
                  type="button"
                  onClick={() => setActionCategoryFilter('BASIC')}
                  className={`px-3 py-1 rounded-lg transition ${actionCategoryFilter === 'BASIC' ? 'bg-[#1b365d] text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                >
                  1. Sinh hoạt (5)
                </button>
                <button
                  type="button"
                  onClick={() => setActionCategoryFilter('WORK')}
                  className={`px-3 py-1 rounded-lg transition ${actionCategoryFilter === 'WORK' ? 'bg-[#1b365d] text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                >
                  2. Làm việc (1)
                </button>
                <button
                  type="button"
                  onClick={() => setActionCategoryFilter('INTERACTION')}
                  className={`px-3 py-1 rounded-lg transition ${actionCategoryFilter === 'INTERACTION' ? 'bg-[#1b365d] text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
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
                      className={`p-3 rounded-2xl border transition-all ${
                        preview
                          ? 'bg-amber-50/70 border-amber-300 shadow-xs'
                          : isIdle
                            ? 'bg-rose-50/60 border-rose-200'
                            : 'bg-slate-50/60 border-slate-200/80 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">
                            {String(s.row).padStart(2, '0')}. {s.label}
                          </span>
                          {isIdle && (
                            <span className="text-[9px] font-bold px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full border border-rose-200">
                              Bắt buộc
                            </span>
                          )}
                          {!isIdle && !file && (
                            <span className="text-[9px] text-slate-400 font-medium">
                              Kế thừa từ Idle
                            </span>
                          )}
                          {file && (
                            <span className="text-[9px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200">
                              ✓ Đã có file
                            </span>
                          )}
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${s.loop ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                          {s.frames}f • {s.loop ? 'Loop' : 'One-shot'}
                        </span>
                      </div>

                      {preview ? (
                        <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3 shadow-xs">
                          <div className="flex items-start gap-3">
                            <div className="flex flex-col items-center shrink-0">
                              <ActionSlicePreview
                                imageUrl={preview}
                                config={getActionConfig(s.state)}
                                fps={6}
                              />
                              <span className="text-[9px] font-bold text-amber-700 mt-1">
                                Hoạt ảnh live
                              </span>
                              <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-200">
                                {(getActionConfig(s.state).selectedCells?.length ?? 1)}f ({getActionConfig(s.state).cols}×{getActionConfig(s.state).rows})
                              </span>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between text-xs font-semibold text-slate-800 mb-1">
                                <span className="truncate max-w-[190px]" title={file?.name}>
                                  {file?.name}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedSheetState(expandedSheetState === s.state ? null : s.state)}
                                    className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold border border-slate-200"
                                  >
                                    {expandedSheetState === s.state ? 'Thu nhỏ' : '🔍 Phóng to'}
                                  </button>
                                </div>
                              </div>

                              <div className={`flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200 p-2 overflow-hidden transition-all duration-200 ${
                                expandedSheetState === s.state ? 'min-h-[260px] max-h-[380px]' : 'min-h-[140px] max-h-[220px]'
                              }`}>
                                <div className="relative inline-block max-h-full max-w-full">
                                  <img
                                    src={preview}
                                    alt={s.label}
                                    className={`max-w-full object-contain block mx-auto pixelated ${
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
                                                  : 'border-slate-400/30 bg-slate-900/60 hover:bg-slate-900/40'
                                              }`}
                                            >
                                              <span
                                                className={`text-[8px] font-black px-0.5 rounded leading-none ${
                                                  isActive
                                                    ? 'text-white bg-emerald-600 shadow-xs'
                                                    : 'text-slate-300 line-through bg-black/70'
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

                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                            <label className="cursor-pointer text-[#1b365d] hover:underline font-semibold flex items-center gap-1">
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
                              className="text-rose-600 hover:underline font-semibold"
                            >
                              Xóa file
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 py-2.5 px-3 border border-dashed border-slate-300 hover:border-amber-500 rounded-xl bg-white text-xs font-semibold text-slate-600 hover:text-amber-700 transition">
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
                className="w-full py-3 bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition active:scale-98 flex items-center justify-center gap-2 uppercase tracking-wider"
              >
                <Sparkles size={16} />
                {isGenerating ? 'Đang ghép sheet và tạo skin...' : 'Tạo Skin Từ Các Hành Động & Đưa Lên Shop'}
              </button>
            </div>
          )}

          {/* Mode 2: IMAGE */}
          {forgeMode === 'IMAGE' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5 space-y-4 font-sans">
              <div className="flex items-center gap-2 text-[#1b365d] font-bold text-sm uppercase">
                <Upload size={18} className="text-amber-500" /> Nhập Full Sprite Sheet Cho Skin
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Tải lên file ảnh chứa đầy đủ 11 hàng trạng thái theo chuẩn hoạt ảnh. Hệ thống sẽ tự động phân tích lưới và tạo skin cho cửa hàng!
              </p>

              <div className="border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-2xl p-6 text-center bg-slate-50">
                <input
                  ref={sheetInputRef}
                  type="file"
                  accept="image/png,image/webp"
                  onChange={handleSheetFileChange}
                  className="hidden"
                  id="skin-full-sheet-upload"
                />
                <label htmlFor="skin-full-sheet-upload" className="cursor-pointer flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-800 shadow-xs">
                    <Upload size={22} />
                  </div>
                  <span className="text-xs font-bold text-slate-800">
                    {sheetFile ? sheetFile.name : 'Bấm vào đây để chọn Sprite Sheet (PNG, WEBP)'}
                  </span>
                  <span className="text-[10px] text-slate-400">Chuẩn 11 hàng ô vuông 64×64</span>
                </label>
              </div>

              {sheetPreviewUrl && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 overflow-x-auto max-h-60">
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
                className="w-full py-3 bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition active:scale-98 flex items-center justify-center gap-2 uppercase tracking-wider"
              >
                <Upload size={16} />
                {isGenerating ? 'Đang xử lý sprite sheet...' : 'Nhập Sprite Sheet & Mở Bán Skin'}
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Live Preview & Details */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-5 space-y-4 sticky top-24 font-sans">
            <h3 className="font-bold text-xs text-slate-900 uppercase flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Sparkles size={16} className="text-amber-500" /> Xem trước Skin & Thông tin
            </h3>

            {/* Live Canvas / Preview Box */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 flex flex-col items-center justify-center min-h-[220px]">
              {actionPreviews['IDLE'] ? (
                <div className="flex flex-col items-center">
                  <ActionSlicePreview
                    imageUrl={actionPreviews['IDLE']}
                    config={getActionConfig('IDLE')}
                    fps={6}
                  />
                  <span className="text-[10px] font-semibold text-slate-500 mt-2">
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
                  <span className="text-[10px] font-semibold text-slate-500 mt-2">
                    Ảnh Sprite Sheet
                  </span>
                </div>
              ) : (
                <div className="text-center text-slate-400 py-8">
                  <Layers size={40} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-semibold text-slate-600">Chưa có ảnh xem trước</p>
                  <p className="text-[10px] text-slate-400">Tải ảnh cho hành động IDLE để xem hoạt ảnh</p>
                </div>
              )}
            </div>

            {/* Summary card */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Tên skin:</span>
                <span className="font-bold text-slate-900">{skinName || 'Chưa đặt tên'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Giá mở bán:</span>
                <span className="font-mono font-bold text-amber-700 flex items-center gap-1">
                  <Coins size={13} /> {expPrice} EXP
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Độ hiếm:</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white border border-slate-200 text-slate-700">
                  {rarity}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Tương thích:</span>
                <span className="font-semibold text-emerald-700 text-right">
                  {!isSpecificPets || selectedPetIds.length === 0
                    ? 'Tất cả thú cưng'
                    : `${selectedPetIds.length} loài thú`}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Số hành động đã tải:</span>
                <span className="font-bold text-slate-900">
                  {Object.keys(actionFiles).length} / 11
                </span>
              </div>
            </div>

            {createdResult && (
              <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 shadow-xs space-y-2 animate-in fade-in">
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
                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
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
