import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Sliders, CheckCircle, Eye, Trash2, Plus, Server, Users, RefreshCw, Upload, Image as ImageIcon, FileText, ShoppingBag, ShieldCheck, Award, X, Layers, PackagePlus } from 'lucide-react';
import { api } from '../services/api';
import { PetType, GardenBackground, AnimationState } from '../types';
import { PixelPetCanvas } from './PixelPetCanvas';
import { BackgroundThumb } from './BackgroundThumb';
import { AdminShopManagement } from './AdminShopManagement';
import { AdminAccessManagement } from './AdminAccessManagement';
import { AdminAnalytics } from './AdminAnalytics';
import { AdminQuestManagement } from './AdminQuestManagement';
import { AdminSkinForge } from './AdminSkinForge';
import { AdminItemForge } from './AdminItemForge';

export const SPRITE_SHEET_SPEC = [
  // Nhóm 1: Cơ bản & Sinh hoạt (Chuyển động lặp lại - Loop)
  { row: 1, state: 'IDLE', label: 'Idle / Walking (Default)', frames: 6, loop: true, desc: 'Thở đều và đi lại tự nhiên', group: 'Nhóm 1: Cơ bản & Sinh hoạt' },
  { row: 2, state: 'SLEEPING', label: 'Sleeping / Dozing off', frames: 4, loop: true, desc: 'Lồng ngực nhấp nhô nhẹ, ngủ ngon', group: 'Nhóm 1: Cơ bản & Sinh hoạt' },
  { row: 3, state: 'HUNGRY', label: 'Hungry', frames: 4, loop: true, desc: 'Ôm bụng, cử động nhỏ khi đói', group: 'Nhóm 1: Cơ bản & Sinh hoạt' },
  { row: 4, state: 'EATING', label: 'Eating / Chewing', frames: 6, loop: true, desc: 'Há miệng, nhai, nuốt thức ăn', group: 'Nhóm 1: Cơ bản & Sinh hoạt' },
  { row: 5, state: 'DRINKING', label: 'Drinking / Holding a cup', frames: 4, loop: true, desc: 'Đưa cốc lên uống nước / cà phê', group: 'Nhóm 1: Cơ bản & Sinh hoạt' },

  // Nhóm 2: Đồng hành làm việc (Chuyển động lặp lại - Loop)
  { row: 6, state: 'TYPING', label: 'Typing / Focusing', frames: 4, loop: true, desc: 'Tay gõ phím nhanh khi bật Pomodoro', group: 'Nhóm 2: Đồng hành làm việc' },

  // Nhóm 3: Tương tác & Cảm xúc
  { row: 7, state: 'PETTING', label: 'Reacting to petting', frames: 5, loop: false, desc: 'Giật mình, híp mắt, cười khi được xoa đầu', group: 'Nhóm 3: Tương tác & Cảm xúc' },
  { row: 8, state: 'HAPPY', label: 'Happy / Celebrating', frames: 4, loop: true, desc: 'Nhảy cẫng vui vẻ, thả tim, ăn mừng', group: 'Nhóm 3: Tương tác & Cảm xúc' },
  { row: 9, state: 'SAD', label: 'Sad / Crying / Tired', frames: 5, loop: false, desc: 'Rũ người xuống, buồn bã hoặc mệt mỏi', group: 'Nhóm 3: Tương tác & Cảm xúc' },
  { row: 10, state: 'DANCING', label: 'Dancing / Exercising', frames: 8, loop: true, desc: 'Vũ đạo nhịp nhàng hoặc tập thể dục', group: 'Nhóm 3: Tương tác & Cảm xúc' },
  { row: 11, state: 'WAVING', label: 'Waving (Attention seeking)', frames: 4, loop: true, desc: 'Vẫy tay chào người dùng', group: 'Nhóm 3: Tương tác & Cảm xúc' },
];

const spriteSheetRows = SPRITE_SHEET_SPEC.map(
  s => `${s.label} (${s.frames} frames • ${s.loop ? 'Lặp lại' : 'Một lần'})`
);

function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Không thể đọc kích thước ảnh bối cảnh.'));
    };
    image.src = objectUrl;
  });
}

export interface ActionSliceConfig {
  cols: number;
  rows: number;
  startFrame: number;
  endFrame: number;
  selectedCells?: number[];
}

export function detectGridAndContent(
  img: HTMLImageElement
): { cols: number; rows: number; nonBlankCells: number[] } {
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  // 1. Evaluate possible grid dimensions
  let bestCols = 1;
  let bestRows = 1;
  let bestScore = -999;

  // Explicit overrides for classic patterns
  if (w >= 1.8 * h) {
    bestCols = Math.min(12, Math.max(2, Math.round(w / h)));
    bestRows = 1;
  } else if (w === 384 && h === 384) {
    // Classic 3x4 RPG walk sheet (3 frames per step, 4 directions)
    bestCols = 3;
    bestRows = 4;
  } else if (w === 512 && h === 512) {
    bestCols = 4;
    bestRows = 4;
  } else if (w === 888 && h === 280) {
    bestCols = 6;
    bestRows = 2;
  } else {
    for (let r = 1; r <= 8; r++) {
      const th = h / r;
      if (th < 24) continue;
      for (let c = 1; c <= 16; c++) {
        const tw = w / c;
        if (tw < 24) continue;
        const ratio = tw / th;
        if (ratio >= 0.65 && ratio <= 1.45) {
          let score = 10 - Math.abs(1.0 - ratio) * 5;
          if (w % c === 0 && h % r === 0) score += 4;
          // Prefer realistic character tile sizes (32px .. 128px)
          if (tw >= 32 && tw <= 128 && th >= 32 && th <= 128) {
            score += 5;
          } else if (tw > 150 || th > 150) {
            score -= 6;
          }
          if (c * r > 1 && score >= bestScore) {
            bestScore = score;
            bestCols = c;
            bestRows = r;
          }
        }
      }
    }
  }

  // 2. Scan image data with offscreen canvas to find cells with character content
  const nonBlankCells: number[] = [];
  try {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, w, h).data;
      const cw = w / bestCols;
      const ch = h / bestRows;

      for (let idx = 0; idx < bestCols * bestRows; idx++) {
        const r = Math.floor(idx / bestCols);
        const c = idx % bestCols;
        const x0 = Math.floor(c * cw);
        const y0 = Math.floor(r * ch);
        const x1 = Math.min(w, Math.floor((c + 1) * cw));
        const y1 = Math.min(h, Math.floor((r + 1) * ch));

        let opaqueCount = 0;
        for (let y = y0; y < y1; y += 2) {
          for (let x = x0; x < x1; x += 2) {
            const pIdx = (y * w + x) * 4;
            const a = imgData[pIdx + 3];
            if (a > 20) {
              opaqueCount++;
              if (opaqueCount > 35) break;
            }
          }
          if (opaqueCount > 35) break;
        }

        if (opaqueCount > 25) {
          nonBlankCells.push(idx);
        }
      }
    }
  } catch (err) {
    for (let i = 0; i < bestCols * bestRows; i++) nonBlankCells.push(i);
  }

  if (nonBlankCells.length === 0) {
    for (let i = 0; i < bestCols * bestRows; i++) nonBlankCells.push(i);
  }

  return { cols: bestCols, rows: bestRows, nonBlankCells };
}

export const ActionSlicePreview: React.FC<{
  imageUrl: string;
  config: ActionSliceConfig;
  fps?: number;
  className?: string;
}> = ({ imageUrl, config, fps = 6, className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const isPlayingRef = useRef(true);
  isPlayingRef.current = isPlaying;

  const [tileDimensions, setTileDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    let animId: number;
    const { cols = 1, rows = 1, startFrame = 1, endFrame = 1, selectedCells } = config;
    const activeIndices = selectedCells && selectedCells.length > 0
      ? selectedCells
      : Array.from({ length: Math.max(1, endFrame - startFrame + 1) }, (_, i) => (startFrame - 1) + i);

    const totalFrames = Math.max(1, activeIndices.length);
    let frameStep = 0;
    let lastTime = performance.now();
    const interval = 1000 / Math.max(1, fps || 6);

    const img = new Image();
    img.src = imageUrl;
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const cellW = img.width / Math.max(1, cols);
      const cellH = img.height / Math.max(1, rows);

      const nativeW = Math.max(1, Math.round(cellW));
      const nativeH = Math.max(1, Math.round(cellH));
      setTileDimensions({ width: nativeW, height: nativeH });

      // For smaller retro sprites (<=64px), upscale by an integer factor (2x, 4x) to avoid tiny blur.
      // For standard/high-res sprites (>=96px, like 128px Saber), keep 1:1 native resolution!
      let intScale = 1;
      if (nativeW <= 64 && nativeH <= 64) {
        intScale = Math.max(1, Math.floor(128 / Math.max(nativeW, nativeH)));
      }

      const dw = nativeW * intScale;
      const dh = nativeH * intScale;
      const maxDim = Math.max(dw, dh);

      if (canvas.width !== maxDim || canvas.height !== maxDim) {
        canvas.width = maxDim;
        canvas.height = maxDim;
      }

      const applyCrisp = (context: CanvasRenderingContext2D) => {
        context.imageSmoothingEnabled = false;
        (context as any).webkitImageSmoothingEnabled = false;
        (context as any).mozImageSmoothingEnabled = false;
        (context as any).msImageSmoothingEnabled = false;
        if ('imageSmoothingQuality' in context) {
          (context as any).imageSmoothingQuality = 'low';
        }
      };

      const dx = Math.round((maxDim - dw) / 2);
      const dy = Math.round(maxDim - dh); // Ground-aligned

      const render = (time: number) => {
        if (isPlayingRef.current && time - lastTime >= interval) {
          lastTime = time;
          frameStep = (frameStep + 1) % totalFrames;
        }

        applyCrisp(ctx);
        ctx.clearRect(0, 0, maxDim, maxDim);
        applyCrisp(ctx);

        const cellIdx = activeIndices[frameStep % totalFrames];
        const c = cellIdx % cols;
        const r = Math.floor(cellIdx / cols);

        const sx = c * cellW;
        const sy = r * cellH;

        ctx.drawImage(img, sx, sy, cellW, cellH, dx, dy, dw, dh);
        animId = requestAnimationFrame(render);
      };

      animId = requestAnimationFrame(render);
    };

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [imageUrl, config.cols, config.rows, config.startFrame, config.endFrame, config.selectedCells, fps]);

  return (
    <div
      className="relative group/anim inline-block select-none cursor-pointer"
      onClick={() => setIsPlaying(p => !p)}
      title={isPlaying ? 'Click để tạm dừng hoạt ảnh' : 'Click để tiếp tục phát'}
    >
      <canvas
        ref={canvasRef}
        className={className || "w-24 h-24 sm:w-28 sm:h-28 shrink-0 object-contain rounded-xl border border-slate-300 bg-[linear-gradient(45deg,#f0f0f0_25%,transparent_25%),linear-gradient(-45deg,#f0f0f0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f0f0f0_75%),linear-gradient(-45deg,transparent_75%,#f0f0f0_75%)] bg-[size:10px_10px] shadow-xs pixelated transition-transform group-hover/anim:scale-[1.03]"}
        style={{ imageRendering: 'pixelated' }}
      />
      {!isPlaying && (
        <div className="absolute inset-0 bg-slate-900/50 rounded-xl flex items-center justify-center text-white text-[10px] font-bold backdrop-blur-[0.5px]">
          ⏸ Tạm dừng
        </div>
      )}
      {tileDimensions && (
        <div className="absolute bottom-1 right-1 bg-black/70 text-[8px] text-white font-mono px-1 py-0.2 rounded pointer-events-none opacity-0 group-hover/anim:opacity-100 transition-opacity">
          {tileDimensions.width}×{tileDimensions.height}px 1:1
        </div>
      )}
    </div>
  );
};

export const AdminConsole: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'FORGE' | 'CREATE_SKIN' | 'CREATE_ITEM' | 'CONFIG' | 'BACKGROUNDS' | 'SHOP' | 'QUESTS' | 'ACCESS' | 'SYSTEM'>('SYSTEM');
  const [forgeMode, setForgeMode] = useState<'ACTIONS' | 'IMAGE'>('ACTIONS');

  // Action-by-Action Pet Creation State
  const [actionFiles, setActionFiles] = useState<Record<string, File>>({});
  const [actionPreviews, setActionPreviews] = useState<Record<string, string>>({});
  const [actionFrameCounts, setActionFrameCounts] = useState<Record<string, number>>({});
  const [actionSliceConfigs, setActionSliceConfigs] = useState<Record<string, ActionSliceConfig>>({});
  const [actionImageDimensions, setActionImageDimensions] = useState<Record<string, { width: number; height: number }>>({});
  const [actionPetName, setActionPetName] = useState('Saber Hiệp Sĩ');
  const [actionPetDesc, setActionPetDesc] = useState('Nhân vật hiệp sĩ Saber đồ họa 2D Pixel Art');
  const [actionRemoveBg, setActionRemoveBg] = useState(true);
  const [isActionGenerating, setIsActionGenerating] = useState(false);
  const [actionCategoryFilter, setActionCategoryFilter] = useState<'ALL' | 'BASIC' | 'WORK' | 'INTERACTION' | 'EMOTION'>('ALL');
  const [expandedSheetState, setExpandedSheetState] = useState<string | null>(null);
  const actionFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Image Upload generation state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imagePetName, setImagePetName] = useState('Thú Cưng Tải Lên');
  const [imagePetDesc, setImagePetDesc] = useState('Thú cưng nhập từ sprite sheet 17 trạng thái');
  const [isImageGenerating, setIsImageGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pet Types Management
  const [petTypes, setPetTypes] = useState<PetType[]>([]);
  const [selectedPetType, setSelectedPetType] = useState<PetType | null>(null);
  const [petTypeName, setPetTypeName] = useState('');
  const [petTypeDescription, setPetTypeDescription] = useState('');
  const [isSavingPetType, setIsSavingPetType] = useState(false);
  const [petTypeMessage, setPetTypeMessage] = useState('');
  const [petTypeError, setPetTypeError] = useState('');
  const [previewState, setPreviewState] = useState<AnimationState>('IDLE');

  // Backgrounds Management
  const [backgrounds, setBackgrounds] = useState<GardenBackground[]>([]);
  const [newBgName, setNewBgName] = useState('');
  const [newBgUrl, setNewBgUrl] = useState('');
  const [newBgFile, setNewBgFile] = useState<File | null>(null);
  const [newBgDesc, setNewBgDesc] = useState('');
  const [newBgColumns, setNewBgColumns] = useState(1);
  const [newBgRows, setNewBgRows] = useState(1);
  const [newBgFps, setNewBgFps] = useState(0);

  // Background Animation Edit State
  const [editingBg, setEditingBg] = useState<GardenBackground | null>(null);
  const [editBgColumns, setEditBgColumns] = useState(1);
  const [editBgRows, setEditBgRows] = useState(1);
  const [editBgFps, setEditBgFps] = useState(0);
  const [isSavingBgAnimation, setIsSavingBgAnimation] = useState(false);
  const [editBgError, setEditBgError] = useState('');

  // System Stats
  const [stats, setStats] = useState<any | null>(null);

  useEffect(() => {
    loadPetTypes();
    loadBackgrounds();
    loadStats();
  }, []);

  useEffect(() => () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    Object.values(actionPreviews).forEach(url => URL.revokeObjectURL(url));
  }, [imagePreviewUrl, actionPreviews]);

  useEffect(() => {
    setPetTypeName(selectedPetType?.name || '');
    setPetTypeDescription(selectedPetType?.description || '');
    setPetTypeMessage('');
    setPetTypeError('');
  }, [selectedPetType?.id]);

  const loadPetTypes = async () => {
    try {
      const res = await api.getAdminSprites();
      setPetTypes(res.data);
      if (res.data.length > 0 && !selectedPetType) {
        setSelectedPetType(res.data[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadBackgrounds = async () => {
    try {
      const res = await api.getAdminBackgrounds();
      setBackgrounds(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadStats = async () => {
    try {
      const res = await api.getSystemStats();
      setStats(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const objectUrl = URL.createObjectURL(file);
    setImagePreviewUrl(objectUrl);
    // Auto populate pet name if empty or default
    const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    if (!imagePetName || imagePetName === 'Thú Cưng Tải Lên') {
      setImagePetName(baseName.charAt(0).toUpperCase() + baseName.slice(1));
    }
  };

  const handleGenerateFromImage = async () => {
    if (!imageFile || !imagePetName.trim() || isImageGenerating) {
      alert('Vui lòng chọn hình ảnh và đặt tên cho thú cưng.');
      return;
    }

    setIsImageGenerating(true);
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('name', imagePetName.trim());
      formData.append('description', imagePetDesc.trim() || imagePetName.trim());
      formData.append('naturalAspectRatio', '1.0');

      const res = await api.importSpriteSheet(formData);
      setGeneratedResult(res.data);
      alert(
        res.data.generatedMeta?.frameConfig?.backgroundRemoved
          ? 'Đã tự động xóa nền trắng thành trong suốt và ánh xạ sprite sheet cho 17 trạng thái!'
          : 'Đã nhập và ánh xạ sprite sheet cho 17 trạng thái. Không phát hiện vùng nền trắng nối với mép ảnh.'
      );
      loadPetTypes();

      // Reset form states cleanly
      if (imagePreviewUrl) {
        try { URL.revokeObjectURL(imagePreviewUrl); } catch {}
      }
      setImageFile(null);
      setImagePreviewUrl(null);
      setImagePetName('');
      setImagePetDesc('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      alert(`Không thể nhập sprite sheet: ${err?.response?.data?.error || err.message}`);
    } finally {
      setIsImageGenerating(false);
    }
  };

  const handleActionFileChange = (state: string, file: File | null) => {
    if (!file) return;
    if (actionPreviews[state]) {
      URL.revokeObjectURL(actionPreviews[state]);
    }
    const objectUrl = URL.createObjectURL(file);
    setActionFiles(prev => ({ ...prev, [state]: file }));
    setActionPreviews(prev => ({ ...prev, [state]: objectUrl }));

    // Measure image dimensions and auto-detect frame & grid layout
    const img = new Image();
    img.src = objectUrl;
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      setActionImageDimensions(prev => ({
        ...prev,
        [state]: { width: w, height: h }
      }));

      // Universal smart grid detection & blank-space filtering
      const detected = detectGridAndContent(img);
      const startFrame = detected.nonBlankCells.length > 0 ? detected.nonBlankCells[0] + 1 : 1;
      const endFrame = detected.nonBlankCells.length > 0 ? detected.nonBlankCells[detected.nonBlankCells.length - 1] + 1 : detected.cols * detected.rows;

      const cfg: ActionSliceConfig = {
        cols: detected.cols,
        rows: detected.rows,
        startFrame,
        endFrame,
        selectedCells: detected.nonBlankCells
      };
      setActionSliceConfigs(prev => ({ ...prev, [state]: cfg }));
      setActionFrameCounts(prev => ({ ...prev, [state]: detected.nonBlankCells.length }));
    };

    // Auto set pet name if default and it's IDLE
    if (state === 'IDLE' && (!actionPetName || actionPetName === 'Saber Hiệp Sĩ' || actionPetName === 'Thú Cưng Tải Lên')) {
      const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setActionPetName(baseName.charAt(0).toUpperCase() + baseName.slice(1));
    }
  };

  const getActionConfig = (state: string): ActionSliceConfig => {
    if (actionSliceConfigs[state]) return actionSliceConfigs[state];
    const cnt = actionFrameCounts[state] || 1;
    const cells = Array.from({ length: cnt }, (_, i) => i);
    return { cols: cnt, rows: 1, startFrame: 1, endFrame: cnt, selectedCells: cells };
  };

  const updateActionConfig = (state: string, patch: Partial<ActionSliceConfig>) => {
    setActionSliceConfigs(prev => {
      const cur = prev[state] || getActionConfig(state);
      const nextCols = Math.max(1, Math.min(16, patch.cols !== undefined ? patch.cols : cur.cols));
      const nextRows = Math.max(1, Math.min(8, patch.rows !== undefined ? patch.rows : cur.rows));
      const totalCells = nextCols * nextRows;

      let nextSelected = patch.selectedCells;
      if (!nextSelected) {
        if (cur.selectedCells && cur.selectedCells.length > 0 && (patch.cols === undefined && patch.rows === undefined)) {
          nextSelected = cur.selectedCells.filter(idx => idx < totalCells);
        } else {
          nextSelected = Array.from({ length: totalCells }, (_, i) => i);
        }
      }

      const nextStart = nextSelected.length > 0 ? nextSelected[0] + 1 : 1;
      const nextEnd = nextSelected.length > 0 ? nextSelected[nextSelected.length - 1] + 1 : totalCells;

      const updated: ActionSliceConfig = {
        cols: nextCols,
        rows: nextRows,
        startFrame: nextStart,
        endFrame: nextEnd,
        selectedCells: nextSelected,
      };
      setActionFrameCounts(fPrev => ({ ...fPrev, [state]: nextSelected.length }));
      return { ...prev, [state]: updated };
    });
  };

  const toggleCellSelection = (state: string, cellIdx: number) => {
    setActionSliceConfigs(prev => {
      const cur = prev[state] || getActionConfig(state);
      const existing = cur.selectedCells && cur.selectedCells.length > 0
        ? cur.selectedCells
        : Array.from({ length: cur.cols * cur.rows }, (_, i) => i);

      let nextCells: number[];
      if (existing.includes(cellIdx)) {
        nextCells = existing.filter(i => i !== cellIdx);
      } else {
        nextCells = [...existing, cellIdx].sort((a, b) => a - b);
      }
      if (nextCells.length === 0) {
        nextCells = [cellIdx];
      }

      const updated: ActionSliceConfig = {
        ...cur,
        selectedCells: nextCells,
        startFrame: nextCells[0] + 1,
        endFrame: nextCells[nextCells.length - 1] + 1
      };
      setActionFrameCounts(fPrev => ({ ...fPrev, [state]: nextCells.length }));
      return { ...prev, [state]: updated };
    });
  };

  const selectRowOnly = (state: string, rowIdx: number) => {
    setActionSliceConfigs(prev => {
      const cur = prev[state] || getActionConfig(state);
      const rowCells: number[] = [];
      for (let c = 0; c < cur.cols; c++) {
        const idx = rowIdx * cur.cols + c;
        if (idx < cur.cols * cur.rows) {
          rowCells.push(idx);
        }
      }
      const updated: ActionSliceConfig = {
        ...cur,
        selectedCells: rowCells,
        startFrame: rowCells[0] + 1,
        endFrame: rowCells[rowCells.length - 1] + 1
      };
      setActionFrameCounts(fPrev => ({ ...fPrev, [state]: rowCells.length }));
      return { ...prev, [state]: updated };
    });
  };

  const selectSkipFirstRow = (state: string) => {
    setActionSliceConfigs(prev => {
      const cur = prev[state] || getActionConfig(state);
      const cells: number[] = [];
      for (let idx = cur.cols; idx < cur.cols * cur.rows; idx++) {
        cells.push(idx);
      }
      const finalCells = cells.length > 0 ? cells : [0];
      const updated: ActionSliceConfig = {
        ...cur,
        selectedCells: finalCells,
        startFrame: finalCells[0] + 1,
        endFrame: finalCells[finalCells.length - 1] + 1
      };
      setActionFrameCounts(fPrev => ({ ...fPrev, [state]: finalCells.length }));
      return { ...prev, [state]: updated };
    });
  };

  const selectAllCells = (state: string) => {
    setActionSliceConfigs(prev => {
      const cur = prev[state] || getActionConfig(state);
      const cells = Array.from({ length: cur.cols * cur.rows }, (_, i) => i);
      const updated: ActionSliceConfig = {
        ...cur,
        selectedCells: cells,
        startFrame: 1,
        endFrame: cells.length
      };
      setActionFrameCounts(fPrev => ({ ...fPrev, [state]: cells.length }));
      return { ...prev, [state]: updated };
    });
  };

  const reScanActionGrid = (state: string) => {
    const previewUrl = actionPreviews[state];
    if (!previewUrl) return;
    const img = new Image();
    img.src = previewUrl;
    img.onload = () => {
      const detected = detectGridAndContent(img);
      const cfg: ActionSliceConfig = {
        cols: detected.cols,
        rows: detected.rows,
        startFrame: detected.nonBlankCells[0] + 1,
        endFrame: detected.nonBlankCells[detected.nonBlankCells.length - 1] + 1,
        selectedCells: detected.nonBlankCells
      };
      setActionSliceConfigs(prev => ({ ...prev, [state]: cfg }));
      setActionFrameCounts(prev => ({ ...prev, [state]: detected.nonBlankCells.length }));
    };
  };

  const handleRemoveActionFile = (state: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (actionPreviews[state]) {
      URL.revokeObjectURL(actionPreviews[state]);
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
    setActionImageDimensions(prev => {
      const next = { ...prev };
      delete next[state];
      return next;
    });
  };

  const handleResetActionForm = () => {
    Object.values(actionPreviews).forEach(url => {
      try { URL.revokeObjectURL(url); } catch {}
    });
    setActionFiles({});
    setActionPreviews({});
    setActionFrameCounts({});
    setActionSliceConfigs({});
    setActionImageDimensions({});
    setActionPetName('');
    setActionPetDesc('');
    setExpandedSheetState(null);
    Object.values(actionFileInputRefs.current).forEach(input => {
      if (input) input.value = '';
    });
  };

  const handleCreateFromActions = async () => {
    if (!actionPetName.trim()) {
      alert('Vui lòng nhập tên thú cưng.');
      return;
    }
    if (!actionFiles['IDLE']) {
      alert('Hành động IDLE (Mặc định) là bắt buộc. Vui lòng tải ít nhất file ảnh/sheet cho hành động IDLE!');
      return;
    }

    const createdPetName = actionPetName.trim();
    setIsActionGenerating(true);
    try {
      const formData = new FormData();
      formData.append('name', createdPetName);
      formData.append('description', actionPetDesc.trim() || createdPetName);
      formData.append('removeBackground', String(actionRemoveBg));
      formData.append('frameCounts', JSON.stringify(actionFrameCounts));
      formData.append('sliceConfigs', JSON.stringify(actionSliceConfigs));

      for (const [actionState, file] of Object.entries(actionFiles)) {
        if (file) {
          formData.append(`action_${actionState}`, file);
        }
      }

      const res = await api.createPetFromActions(formData);
      setGeneratedResult(res.data);
      alert(`Đã tạo thành công thú cưng "${createdPetName}" từ các sheet hành động! Form đã được làm sạch để sẵn sàng tạo thú mới.`);
      loadPetTypes();
      if (res.data?.petType) {
        setSelectedPetType(res.data.petType);
      }

      // Reset action creation form cleanly
      handleResetActionForm();
    } catch (err: any) {
      alert(`Không thể tạo thú cưng: ${err?.response?.data?.error || err.message}`);
    } finally {
      setIsActionGenerating(false);
    }
  };

  const handleDeletePet = async (petId: string, petName: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn thú cưng "${petName}" không?\nThao tác này sẽ xóa thú khỏi cơ sở dữ liệu và không thể hoàn tác!`)) {
      return;
    }
    try {
      await api.deletePet(petId);
      alert(`Đã xóa vĩnh viễn thú cưng "${petName}" thành công!`);
      if (selectedPetType?.id === petId) {
        setSelectedPetType(null);
      }
      if (generatedResult?.petType?.id === petId) {
        setGeneratedResult(null);
      }
      loadPetTypes();
    } catch (err: any) {
      alert(`Lỗi khi xóa thú cưng: ${err?.response?.data?.error || err.message}`);
    }
  };

  const handleTogglePublish = async (typeId: string, currentStatus: boolean) => {
    try {
      await api.publishSprite(typeId, !currentStatus);
      loadPetTypes();
      if (selectedPetType && selectedPetType.id === typeId) {
        setSelectedPetType({ ...selectedPetType, isActive: !currentStatus });
      }
    } catch (err) {
      alert('Lỗi cập nhật trạng thái xuất bản');
    }
  };

  const handleUpdatePetShopConfig = async (typeId: string, isShopEnabled: boolean, expPrice: number) => {
    try {
      const res = await api.updateAdminShopPet(typeId, { isShopEnabled, expPrice });
      alert(res.data.message || (isShopEnabled ? 'Đã đưa thú cưng vào Cửa Hàng!' : 'Đã gỡ thú cưng khỏi Cửa Hàng!'));
      loadPetTypes();
      if (selectedPetType && selectedPetType.id === typeId) {
        setSelectedPetType({ ...selectedPetType, isShopEnabled, expPrice, isActive: isShopEnabled ? true : selectedPetType.isActive });
      }
    } catch (err: any) {
      alert(`Lỗi cập nhật Shop: ${err?.response?.data?.error || err.message}`);
    }
  };

  const handleAddBackground = async () => {
    if (!newBgName.trim() || (!newBgUrl.trim() && !newBgFile)) return;
    try {
      const frameCount = newBgColumns * newBgRows;
      if (!Number.isInteger(newBgColumns) || newBgColumns < 1 || newBgColumns > 12 ||
          !Number.isInteger(newBgRows) || newBgRows < 1 || newBgRows > 12 ||
          frameCount < 1 || frameCount > 12 ||
          !Number.isInteger(newBgFps) || newBgFps < 0 || newBgFps > 12 ||
          (frameCount > 1 && newBgFps < 1) || (frameCount === 1 && newBgFps !== 0)) {
        throw new Error('Ảnh tĩnh dùng lưới 1×1 và 0 FPS. Ảnh động dùng lưới tối đa 12 khung và 1–12 FPS.');
      }
      if (frameCount > 1 && !newBgFile) {
        throw new Error('Ảnh động cần tải sprite sheet từ máy tính lên.');
      }
      if (newBgFile) {
        const { width, height } = await readImageSize(newBgFile);
        if (width % newBgColumns !== 0 || height % newBgRows !== 0 ||
            width / newBgColumns < 128 || height / newBgRows < 72) {
          throw new Error(`Ảnh hiện tại ${width}×${height}px không chia đều được thành lưới ${newBgColumns} cột × ${newBgRows} hàng, mỗi khung tối thiểu 128×72px.`);
        }
      }
      if (newBgFile) {
        const formData = new FormData();
        formData.append('name', newBgName.trim());
        formData.append('description', newBgDesc);
        formData.append('isRecommended', 'true');
        formData.append('animationFrames', String(frameCount));
        formData.append('animationColumns', String(newBgColumns));
        formData.append('animationRows', String(newBgRows));
        formData.append('animationFps', String(newBgFps));
        formData.append('image', newBgFile);
        await api.uploadAdminBackground(formData);
      } else {
        await api.addAdminBackground({
          name: newBgName.trim(),
          imageUrl: newBgUrl.trim(),
          description: newBgDesc,
          isRecommended: true,
          animationFrames: frameCount,
          animationFps: newBgFps,
          animationColumns: newBgColumns,
          animationRows: newBgRows
        });
      }
      setNewBgName('');
      setNewBgUrl('');
      setNewBgFile(null);
      setNewBgDesc('');
      setNewBgColumns(1);
      setNewBgRows(1);
      setNewBgFps(0);
      loadBackgrounds();
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || 'Lỗi thêm bối cảnh');
    }
  };

  const handleDeleteBackground = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bối cảnh này?')) return;
    try {
      await api.deleteAdminBackground(id);
      loadBackgrounds();
    } catch (err) {
      alert('Lỗi xóa bối cảnh');
    }
  };

  const handleOpenEditAnimation = (bg: GardenBackground) => {
    setEditingBg(bg);
    const cols = bg.animationColumns || (bg.animationFrames && bg.animationFrames > 1 ? bg.animationFrames : 1);
    const rows = bg.animationRows || 1;
    const fps = bg.animationFps ?? 0;
    if ((bg.animationFrames || 1) <= 1) {
      // Default to 2x4 with 4 FPS for easily restoring grid animated backgrounds
      setEditBgColumns(2);
      setEditBgRows(4);
      setEditBgFps(4);
    } else {
      setEditBgColumns(cols);
      setEditBgRows(rows);
      setEditBgFps(fps);
    }
    setEditBgError('');
  };

  const handleSaveBackgroundAnimation = async () => {
    if (!editingBg) return;
    const totalFrames = editBgColumns * editBgRows;
    if (
      !Number.isInteger(editBgColumns) || editBgColumns < 1 || editBgColumns > 12 ||
      !Number.isInteger(editBgRows) || editBgRows < 1 || editBgRows > 12 ||
      totalFrames < 1 || totalFrames > 12 ||
      !Number.isInteger(editBgFps) || editBgFps < 0 || editBgFps > 12 ||
      (totalFrames > 1 && editBgFps < 1) ||
      (totalFrames === 1 && editBgFps !== 0)
    ) {
      setEditBgError('Cấu hình không hợp lệ. Ảnh tĩnh dùng 1×1 và 0 FPS; ảnh động dùng tối đa 12 khung và 1–12 FPS.');
      return;
    }

    try {
      setIsSavingBgAnimation(true);
      setEditBgError('');
      await api.updateAdminBackgroundAnimation(editingBg.id, {
        animationFrames: totalFrames,
        animationColumns: editBgColumns,
        animationRows: editBgRows,
        animationFps: editBgFps
      });
      await loadBackgrounds();
      setEditingBg(null);
    } catch (err: any) {
      setEditBgError(err?.response?.data?.error || err?.message || 'Không thể cập nhật cấu hình hoạt ảnh.');
    } finally {
      setIsSavingBgAnimation(false);
    }
  };

  const handleSetBackgroundStatic = async (id: string) => {
    if (!window.confirm('Chuyển bối cảnh này sang ảnh tĩnh (1 khung, 0 FPS)? Bạn có thể nhấn "Sửa hoạt ảnh" để khôi phục bất cứ lúc nào.')) {
      return;
    }
    try {
      await api.updateAdminBackgroundAnimation(id, {
        animationFrames: 1,
        animationFps: 0,
        animationColumns: 1,
        animationRows: 1
      });
      await loadBackgrounds();
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || 'Không thể chuyển bối cảnh thành ảnh tĩnh.');
    }
  };

  const handleToggleRecommend = async (id: string, currentVal: boolean) => {
    try {
      await api.recommendBackground(id, !currentVal);
      loadBackgrounds();
    } catch (err) {
      alert('Lỗi cập nhật đề xuất');
    }
  };

  const handleSavePetTypeDetails = async () => {
    if (!selectedPetType || !petTypeName.trim() || isSavingPetType) return;
    setIsSavingPetType(true);
    setPetTypeMessage('');
    setPetTypeError('');
    try {
      const response = await api.updatePetTypeDetails(selectedPetType.id, {
        name: petTypeName.trim(),
        description: petTypeDescription.trim()
      });
      setSelectedPetType(response.data.petType);
      setPetTypes(current => current.map(petType =>
        petType.id === response.data.petType.id ? response.data.petType : petType
      ));
      setPetTypeMessage(response.data.message);
    } catch (error: any) {
      setPetTypeError(error?.response?.data?.error || 'Không thể cập nhật thông tin loài thú.');
    } finally {
      setIsSavingPetType(false);
    }
  };

  const navItems = [
    { id: 'SYSTEM' as const, label: 'Tổng quan', icon: <Server size={17} /> },
    { id: 'ACCESS' as const, label: 'Người dùng & quyền', icon: <ShieldCheck size={17} /> },
    { id: 'QUESTS' as const, label: 'Thiết lập nhiệm vụ', icon: <Award size={17} /> },
    { id: 'FORGE' as const, label: 'Tạo thú cưng', icon: <Sparkles size={17} /> },
    { id: 'CREATE_SKIN' as const, label: 'Tạo skin', icon: <Layers size={17} /> },
    { id: 'CREATE_ITEM' as const, label: 'Tạo vật phẩm', icon: <PackagePlus size={17} /> },
    { id: 'CONFIG' as const, label: 'Loài thú & hoạt ảnh', icon: <Sliders size={17} /> },
    { id: 'BACKGROUNDS' as const, label: 'Bối cảnh khu vườn', icon: <ImageIcon size={17} /> },
    { id: 'SHOP' as const, label: 'Quản lý cửa hàng', icon: <ShoppingBag size={17} /> }
  ];

  const filteredActions = SPRITE_SHEET_SPEC.filter(s => {
    if (actionCategoryFilter === 'ALL') return true;
    if (actionCategoryFilter === 'BASIC') return s.group.includes('Nhóm 1');
    if (actionCategoryFilter === 'WORK') return s.group.includes('Nhóm 2');
    if (actionCategoryFilter === 'INTERACTION') return s.group.includes('Nhóm 3');
    return true;
  });

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="grid min-w-0 gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-gray-200 bg-white p-3 shadow-sm lg:sticky lg:top-24">
          <div className="mb-3 border-b border-gray-100 px-3 pb-3">
            <div className="font-pixel text-xs text-[#1b365d]">OFFICEPET</div>
            <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Admin Control Panel</div>
          </div>
          <nav aria-label="Điều hướng quản trị" className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-1">
            {navItems.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                aria-current={activeTab === item.id ? 'page' : undefined}
                className={`flex min-h-10 items-center gap-2 rounded-xl px-3.5 py-2.5 text-left text-xs font-semibold transition ${
                  activeTab === item.id ? 'bg-[#1b365d] text-white font-bold shadow-xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {item.icon}<span>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 space-y-6">

      {/* Tab 1: Agent Sprite Forge Generator */}
      {activeTab === 'FORGE' && (
        <div className="space-y-6">
          {/* Submode Switcher: Actions vs Image Upload vs Prompt */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 gap-2 font-sans font-bold text-xs">
            <button
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
            {/* Left Column: Form */}
            <div className="lg:col-span-7 space-y-4">
              {forgeMode === 'ACTIONS' ? (
                <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-5 space-y-4 font-sans">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#1b365d] font-bold text-sm uppercase">
                      <Sparkles size={18} className="text-amber-500" /> Tải File Cho Từng Hành Động (11 Trạng Thái)
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-[#1b365d] rounded-full border border-blue-200">
                      Hỗ trợ GIF, WEBP, PNG
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    Bạn có thể chọn file ảnh động (<strong>.gif, .webp</strong>), ảnh tĩnh (<strong>.png, .webp</strong>) hoặc dải frame cho từng hành động. Bắt buộc có ảnh cho <strong>IDLE (Mặc định)</strong>. Các hành động còn lại nếu chưa có file sẽ <strong>tự động kế thừa thông minh từ Idle</strong>!
                  </p>

                  {/* Character Metadata */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Tên thú cưng <span className="text-rose-500">*</span></label>
                        <input
                          type="text"
                          value={actionPetName}
                          onChange={e => setActionPetName(e.target.value)}
                          placeholder="Ví dụ: Saber Hiệp Sĩ, Naruto, Pikachu..."
                          className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/15 bg-white text-slate-900 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả nhân vật</label>
                        <input
                          type="text"
                          value={actionPetDesc}
                          onChange={e => setActionPetDesc(e.target.value)}
                          placeholder="Mô tả phong cách nhân vật..."
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/15 bg-white text-slate-900 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={actionRemoveBg}
                          onChange={e => setActionRemoveBg(e.target.checked)}
                          className="rounded border-slate-300 text-[#1b365d] focus:ring-0"
                        />
                        <span>Tự động xóa nền xám/trắng thành trong suốt (Auto Remove Solid BG)</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleResetActionForm}
                        className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 flex items-center gap-1.5 transition-colors shrink-0"
                        title="Xóa sạch toàn bộ file đã chọn và đặt lại form"
                      >
                        <RefreshCw size={12} /> Làm sạch form
                      </button>
                    </div>
                  </div>

                  {/* Category Filter Pills */}
                  <div className="flex flex-wrap gap-1.5 border-b border-slate-100 pb-2 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setActionCategoryFilter('ALL')}
                      className={`px-3 py-1.5 rounded-xl transition ${actionCategoryFilter === 'ALL' ? 'bg-[#1b365d] text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                    >
                      Tất cả 11 hành động
                    </button>
                    <button
                      type="button"
                      onClick={() => setActionCategoryFilter('BASIC')}
                      className={`px-3 py-1.5 rounded-xl transition ${actionCategoryFilter === 'BASIC' ? 'bg-[#1b365d] text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                    >
                      1. Sinh hoạt (5)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActionCategoryFilter('WORK')}
                      className={`px-3 py-1.5 rounded-xl transition ${actionCategoryFilter === 'WORK' ? 'bg-[#1b365d] text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                    >
                      2. Làm việc (1)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActionCategoryFilter('INTERACTION')}
                      className={`px-3 py-1.5 rounded-xl transition ${actionCategoryFilter === 'INTERACTION' ? 'bg-[#1b365d] text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                    >
                      3. Tương tác & Cảm xúc (5)
                    </button>
                  </div>

                  {/* Actions List */}
                  <div className="max-h-[520px] overflow-y-auto space-y-2.5 pr-1">
                    {filteredActions.map((s) => {
                      const file = actionFiles[s.state];
                      const preview = actionPreviews[s.state];
                      const isIdle = s.state === 'IDLE';

                      return (
                        <div
                          key={s.state}
                          className={`p-3 rounded-2xl border transition-all ${
                            preview
                              ? 'bg-amber-50/40 border-amber-300 shadow-xs'
                              : isIdle
                                ? 'bg-rose-50/50 border-rose-200'
                                : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
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
                                <span className="text-[9px] text-slate-400 font-semibold">
                                  Kế thừa từ Idle
                                </span>
                              )}
                              {file && (
                                <span className="text-[9px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                                  ✓ Đã có file
                                </span>
                              )}
                            </div>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${s.loop ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                              {s.frames}f • {s.loop ? 'Loop' : 'One-shot'}
                            </span>
                          </div>

                          {preview ? (
                            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-3 shadow-xs">
                              {/* Top row: Animated Live Preview + 2D Grid Preview with Slicing Overlay */}
                              <div className="flex items-start gap-3">
                                {/* Live Sliced Animation Preview */}
                                <div className="flex flex-col items-center shrink-0">
                                  <ActionSlicePreview
                                    imageUrl={preview}
                                    config={getActionConfig(s.state)}
                                    fps={6}
                                  />
                                  <span className="text-[9px] font-bold text-amber-600 mt-1">
                                    Hoạt ảnh live
                                  </span>
                                  <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-300">
                                    {(getActionConfig(s.state).selectedCells?.length ?? 1)}f ({getActionConfig(s.state).cols}×{getActionConfig(s.state).rows})
                                  </span>
                                  <span className="text-[8px] font-bold text-sky-700 bg-sky-50 px-1 rounded border border-sky-300 mt-0.5">
                                    {actionImageDimensions[s.state]
                                      ? `${Math.round(actionImageDimensions[s.state].width / getActionConfig(s.state).cols)}×${Math.round(actionImageDimensions[s.state].height / getActionConfig(s.state).rows)}px HD`
                                      : 'Sắc nét 1:1'}
                                  </span>
                                </div>

                                {/* Sheet Image with Interactive 2D Slicing Grid Overlay */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-900 mb-1">
                                    <span className="truncate max-w-[190px]" title={file?.name}>
                                      {file?.name}
                                    </span>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className="text-[10px] text-slate-500 font-mono">
                                        {actionImageDimensions[s.state]
                                          ? `${actionImageDimensions[s.state].width}×${actionImageDimensions[s.state].height} px`
                                          : `${(file ? file.size / 1024 : 0).toFixed(1)} KB`}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setExpandedSheetState(expandedSheetState === s.state ? null : s.state)}
                                        className="text-[9px] px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold border border-slate-200 transition"
                                        title="Phóng to / Thu nhỏ khung lưới"
                                      >
                                        {expandedSheetState === s.state ? 'Thu nhỏ' : '🔍 Phóng to'}
                                      </button>
                                    </div>
                                  </div>

                                  {/* The 2D Sheet container - wraps img tightly so grid overlay aligns 100% to image */}
                                  <div className={`flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200 p-2 overflow-hidden transition-all duration-200 ${
                                    expandedSheetState === s.state ? 'min-h-[300px] max-h-[460px]' : 'min-h-[160px] max-h-[250px]'
                                  }`}>
                                    <div className="relative inline-block max-h-full max-w-full">
                                      <img
                                        src={preview}
                                        alt={s.label}
                                        className={`max-w-full object-contain block mx-auto pixelated shadow-sm transition-all duration-200 ${
                                          expandedSheetState === s.state ? 'max-h-[430px]' : 'max-h-[220px]'
                                        }`}
                                      />
                                      {/* Interactive 2D Grid Clickable Overlays aligned directly on img */}
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
                                              const cellNum = cIdx + 1;
                                              const isActive = activeCells.includes(cIdx);
                                              return (
                                                <div
                                                  key={cIdx}
                                                  onClick={() => toggleCellSelection(s.state, cIdx)}
                                                  title={`Ô số ${cellNum}: Click để ${isActive ? 'bỏ chọn' : 'chọn'}`}
                                                  className={`border cursor-pointer transition-all duration-150 relative flex items-start justify-start p-0.5 select-none ${
                                                    isActive
                                                      ? 'border-emerald-500/90 bg-emerald-500/15 hover:bg-emerald-500/30'
                                                      : 'border-slate-400/30 bg-slate-800/70 hover:bg-slate-800/50'
                                                  }`}
                                                >
                                                  <span
                                                    className={`text-[8px] font-black px-0.5 rounded leading-none ${
                                                      isActive
                                                        ? 'text-white bg-emerald-600 shadow-xs'
                                                        : 'text-gray-300 line-through bg-black/70'
                                                    }`}
                                                  >
                                                    {cellNum} {isActive ? '✓' : '✕'}
                                                  </span>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>

                                  {/* Row Selector Toolbar (shown whenever there are 2 or more rows) */}
                                  {getActionConfig(s.state).rows > 1 && (
                                    <div className="flex items-center gap-1.5 flex-wrap mt-2 text-[10px]">
                                      <span className="font-bold text-slate-500">Chọn nhanh hàng:</span>
                                      <button
                                        type="button"
                                        onClick={() => selectAllCells(s.state)}
                                        className="px-2 py-0.5 font-semibold border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-slate-700 shadow-xs"
                                      >
                                        Tất cả
                                      </button>
                                      {Array.from({ length: getActionConfig(s.state).rows }).map((_, rIdx) => {
                                        const labels = ['Hàng 1 (Xuống)', 'Hàng 2 (Trái)', 'Hàng 3 (Phải)', 'Hàng 4 (Lên)'];
                                        const label = labels[rIdx] || `Hàng ${rIdx + 1}`;
                                        return (
                                          <button
                                            key={rIdx}
                                            type="button"
                                            onClick={() => selectRowOnly(s.state, rIdx)}
                                            className="px-2 py-0.5 font-semibold border border-blue-200 bg-blue-50 hover:bg-blue-100 text-[#1b365d] rounded-lg shadow-xs"
                                          >
                                            {label}
                                          </button>
                                        );
                                      })}
                                      <button
                                        type="button"
                                        onClick={() => selectSkipFirstRow(s.state)}
                                        className="px-2 py-0.5 font-semibold border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg shadow-xs"
                                        title="Bỏ qua hàng đầu (kiếm), chỉ lấy các hàng còn lại"
                                      >
                                        Bỏ Hàng 1
                                      </button>
                                    </div>
                                  )}

                                  <span className="text-[9px] text-slate-400 italic block mt-1">
                                    💡 Click trực tiếp vào từng ô trên ảnh để bật/tắt ô đó
                                  </span>
                                </div>

                                {/* Action Buttons: Re-upload or Delete */}
                                <div className="flex flex-col gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => actionFileInputRefs.current[s.state]?.click()}
                                    className="p-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg flex items-center justify-center gap-1 shadow-xs transition"
                                    title="Đổi sheet/ảnh khác"
                                  >
                                    <Upload size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleRemoveActionFile(s.state, e)}
                                    className="p-1.5 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-center shadow-xs transition"
                                    title="Xóa sheet này"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>

                              {/* Prominent Grid Configuration Controls */}
                              <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200 space-y-2 text-xs">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-4 flex-wrap">
                                    {/* Cols Stepper */}
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] font-bold text-slate-700">Số Cột:</span>
                                      <div className="flex items-center border border-slate-300 rounded-lg bg-white shadow-xs overflow-hidden">
                                        <button
                                          type="button"
                                          onClick={() => updateActionConfig(s.state, { cols: getActionConfig(s.state).cols - 1 })}
                                          className="px-2.5 py-1 font-bold text-sm hover:bg-slate-50 border-r border-slate-200 text-slate-700"
                                        >
                                          -
                                        </button>
                                        <span className="px-3 py-1 font-mono font-bold text-sm text-center min-w-[28px] text-[#1b365d]">
                                          {getActionConfig(s.state).cols}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => updateActionConfig(s.state, { cols: getActionConfig(s.state).cols + 1 })}
                                          className="px-2.5 py-1 font-bold text-sm hover:bg-slate-50 border-l border-slate-200 text-slate-700"
                                        >
                                          +
                                        </button>
                                      </div>
                                    </div>

                                    {/* Rows Stepper */}
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] font-bold text-slate-700">Số Hàng:</span>
                                      <div className="flex items-center border border-slate-300 rounded-lg bg-white shadow-xs overflow-hidden">
                                        <button
                                          type="button"
                                          onClick={() => updateActionConfig(s.state, { rows: getActionConfig(s.state).rows - 1 })}
                                          className="px-2.5 py-1 font-bold text-sm hover:bg-slate-50 border-r border-slate-200 text-slate-700"
                                        >
                                          -
                                        </button>
                                        <span className="px-3 py-1 font-mono font-bold text-sm text-center min-w-[28px] text-[#1b365d]">
                                          {getActionConfig(s.state).rows}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => updateActionConfig(s.state, { rows: getActionConfig(s.state).rows + 1 })}
                                          className="px-2.5 py-1 font-bold text-sm hover:bg-slate-50 border-l border-slate-200 text-slate-700"
                                        >
                                          +
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-[11px] font-semibold text-slate-700">
                                    Đang chọn: <span className="text-emerald-700 font-bold text-sm">{(getActionConfig(s.state).selectedCells?.length ?? 1)}</span> / {getActionConfig(s.state).cols * getActionConfig(s.state).rows} ô
                                  </div>
                                </div>

                                {/* Quick Presets */}
                                <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-amber-200/80 text-xs">
                                  <span className="text-[10px] font-bold text-slate-500 mr-1">
                                    Mẫu chuẩn:
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => updateActionConfig(s.state, { cols: 3, rows: 4 })}
                                    className="px-2 py-0.5 text-[10px] font-semibold border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-900 rounded-lg shadow-xs"
                                    title="Lưới 3 cột 4 hàng - Chuẩn đi bộ RPG Maker (Idle / Walking)"
                                  >
                                    3×4 (RPG Walk)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateActionConfig(s.state, { cols: 4, rows: 4 })}
                                    className="px-2 py-0.5 text-[10px] font-semibold border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg shadow-xs"
                                  >
                                    4×4 (16f)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateActionConfig(s.state, { cols: 4, rows: 4, selectedCells: Array.from({ length: 15 }, (_, i) => i + 1) })}
                                    className="px-2 py-0.5 text-[10px] font-semibold border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-lg shadow-xs"
                                    title="Lưới 4x4, bỏ ô 1 (kiếm), chỉ lấy 15 ô gõ phím máy tính"
                                  >
                                    4×4 (15f Gõ phím)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateActionConfig(s.state, { cols: 4, rows: 4, selectedCells: Array.from({ length: 12 }, (_, i) => i + 4) })}
                                    className="px-2 py-0.5 text-[10px] font-semibold border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-900 rounded-lg shadow-xs"
                                    title="Lưới 4x4, bỏ hàng 1 (kiếm), chỉ lấy 12 ô đứng thở làm Idle"
                                  >
                                    4×4 (12f Đứng thở)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateActionConfig(s.state, { cols: 3, rows: 3 })}
                                    className="px-2 py-0.5 text-[10px] font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg shadow-xs"
                                  >
                                    3×3 (9f)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateActionConfig(s.state, { cols: 4, rows: 1 })}
                                    className="px-2 py-0.5 text-[10px] font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg shadow-xs"
                                  >
                                    Dải 4f
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateActionConfig(s.state, { cols: 6, rows: 1 })}
                                    className="px-2 py-0.5 text-[10px] font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg shadow-xs"
                                  >
                                    Dải 6f
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateActionConfig(s.state, { cols: 6, rows: 2, selectedCells: [0, 1, 2, 3, 4, 5, 6, 7] })}
                                    className="px-2 py-0.5 text-[10px] font-semibold border border-blue-200 bg-blue-50 hover:bg-blue-100 text-[#1b365d] rounded-lg shadow-xs"
                                  >
                                    6×2 (8f Kiếm)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateActionConfig(s.state, { cols: 1, rows: 1 })}
                                    className="px-2 py-0.5 text-[10px] font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg shadow-xs"
                                  >
                                    1f tĩnh
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => actionFileInputRefs.current[s.state]?.click()}
                              className="border border-dashed border-slate-300 hover:border-[#1b365d] rounded-xl p-3 flex items-center justify-center gap-2 cursor-pointer bg-white text-slate-600 hover:text-[#1b365d] transition"
                            >
                              <Upload size={14} className="text-slate-400" />
                              <span className="text-[11px] font-semibold">
                                {isIdle ? 'Tải dải sprite strip hoặc ảnh cho Idle (bắt buộc)...' : 'Tải dải sprite strip / ảnh cho hành động này...'}
                              </span>
                            </div>
                          )}

                          <input
                            ref={el => { actionFileInputRefs.current[s.state] = el; }}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            className="hidden"
                            onChange={e => handleActionFileChange(s.state, e.target.files?.[0] || null)}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Submit Button */}
                  <button
                    type="button"
                    onClick={handleCreateFromActions}
                    disabled={isActionGenerating || !actionFiles['IDLE'] || !actionPetName.trim()}
                    className="w-full py-3 font-bold uppercase text-xs bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-slate-950 rounded-xl shadow-xs flex items-center justify-center gap-2 transition active:scale-95"
                  >
                    {isActionGenerating ? (
                      <>
                        <span className="animate-spin">⏳</span> Đang bóc tách frame & ghép 17 hành động...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} /> 🚀 Ghép Bộ Hoạt Ảnh & Tạo Thú Cưng ({Object.keys(actionFiles).length} hành động)
                      </>
                    )}
                  </button>
                </div>
              ) : (
              <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-5 space-y-4 font-sans">
                <div className="flex items-center gap-2 text-[#1b365d] font-bold text-sm uppercase">
                  <Upload size={18} className="text-amber-500" /> Nhập Sprite Sheet Có Sẵn (17 Trạng Thái)
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Tải sprite sheet đã vẽ sẵn. Hệ thống tự xóa vùng nền trắng nối với mép ảnh thành trong suốt, sau đó tự động căn ô chuẩn <strong>64×64 pixel</strong> và ánh xạ frame chính xác cho từng trạng thái cho thú, skin và vật phẩm. Ảnh gồm <strong>17 hàng trạng thái</strong> theo danh sách cấu hình bên dưới (tổng cộng 95 frame).
                </p>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[10px] text-slate-700 max-h-56 overflow-y-auto space-y-2">
                  {['Nhóm 1: Trạng thái cơ bản & Sinh hoạt', 'Nhóm 2: Đồng hành làm việc', 'Nhóm 3: Tương tác & Giao tiếp', 'Nhóm 4: Cảm xúc & Gamification'].map(grp => (
                    <div key={grp} className="space-y-1">
                      <div className="font-bold text-[#1b365d] border-b border-slate-200 pb-0.5">{grp}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-0.5">
                        {SPRITE_SHEET_SPEC.filter(s => s.group === grp).map(s => (
                          <div key={s.state} className="flex items-center justify-between">
                            <span><strong className="mr-1">{String(s.row).padStart(2, '0')}.</strong>{s.label}</span>
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${s.loop ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                              {s.frames}f • {s.loop ? 'Loop' : 'One-shot'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Dropzone file input */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-[#1b365d] rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer bg-slate-50/60 hover:bg-slate-50 transition"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  {imagePreviewUrl ? (
                    <div className="flex flex-col items-center gap-2">
                      <img
                        src={imagePreviewUrl}
                        alt="Preview"
                        className="w-24 h-24 object-contain rounded-xl border border-slate-200 shadow-xs bg-white"
                      />
                      <span className="text-[11px] font-bold text-[#1b365d] underline">
                        Nhấn để chọn sheet khác ({imageFile?.name})
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center gap-2 py-3">
                      <div className="p-3 bg-blue-50 text-[#1b365d] rounded-full border border-blue-200">
                        <ImageIcon size={26} />
                      </div>
                      <div className="text-xs font-bold text-slate-800">
                        Chọn sprite sheet thú cưng vào đây
                      </div>
                      <div className="text-[10px] text-slate-400">
                        17 hàng trạng thái · Mỗi ô chuẩn 64×64 px · PNG, JPG, WEBP · tối đa 15MB
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tên thú cưng:</label>
                  <input
                    type="text"
                    value={imagePetName}
                    onChange={e => setImagePetName(e.target.value)}
                    placeholder="Ví dụ: Mèo Hoàng Thượng, Cún Poodle..."
                    className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-xl focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/15 bg-white text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả / Ghi chú thú cưng:</label>
                  <input
                    type="text"
                    value={imagePetDesc}
                    onChange={e => setImagePetDesc(e.target.value)}
                    placeholder="Mô tả đặc điểm thú cưng..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/15 bg-white text-slate-900 focus:outline-none"
                  />
                </div>

                <button
                  onClick={handleGenerateFromImage}
                  disabled={isImageGenerating || !imageFile || !imagePetName.trim()}
                  className="w-full py-3 font-bold uppercase text-xs bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-slate-950 rounded-xl shadow-xs flex items-center justify-center gap-2 transition active:scale-95"
                >
                  {isImageGenerating ? (
                    <>
                      <span className="animate-spin">⏳</span> Đang kiểm tra và phân cắt sprite sheet...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} /> Nhập và ánh xạ 17 trạng thái
                    </>
                  )}
                </button>
              </div>
            )}
            </div>

            {/* Right: Generated Result Preview */}
            <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs p-5 space-y-4 font-sans h-fit sticky top-24">
              <div className="font-bold text-sm text-slate-900 flex items-center justify-between">
                <span>Xem Trước Sprite Sheet & Thông Số Kỹ Thuật</span>
                {generatedResult && (
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                    generatedResult.generatedMeta?.frameConfig?.alignmentWarning
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  }`}>
                    {generatedResult.generatedMeta?.frameConfig?.alignmentWarning
                      ? 'Cần kiểm tra mapping'
                      : generatedResult.generatedMeta?.frameConfig?.backgroundRemoved
                        ? 'Đã xóa nền trắng'
                        : 'Sẵn sàng'}
                  </span>
                )}
              </div>

              {generatedResult ? (
                <div className="space-y-4 text-xs">
                  <div className={`p-3 border rounded-xl font-medium flex items-center gap-2 ${
                    generatedResult.generatedMeta?.frameConfig?.alignmentWarning
                      ? 'bg-amber-50/80 border-amber-300 text-amber-900'
                      : 'bg-emerald-50/80 border-emerald-300 text-emerald-900'
                  }`}>
                    {generatedResult.generatedMeta?.frameConfig?.alignmentWarning
                      ? <ImageIcon size={16} className="text-amber-600 shrink-0" />
                      : <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                    }
                    <span>
                      {generatedResult.generatedMeta?.frameConfig?.alignmentWarning
                        || 'Sprite sheet đã được căn và ánh xạ vào 17 trạng thái (95 frame chuẩn 64×64 px).'
                      }
                      {!generatedResult.generatedMeta?.frameConfig?.alignmentWarning
                        && generatedResult.generatedMeta?.frameConfig?.backgroundRemoved
                        && ' Nền trắng nối với mép ảnh đã được chuyển thành trong suốt.'
                      }
                    </span>
                  </div>

                  {/* Thumbnail & Meta info */}
                  <div className="flex items-center gap-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <img
                      src={generatedResult.generatedMeta?.previewUrl}
                      alt="Preview Frame"
                      className="w-16 h-16 object-contain bg-white rounded-lg border border-slate-200"
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <div className="space-y-1">
                      <div className="font-bold text-sm text-slate-900">{generatedResult.petType?.name}</div>
                      <div className="text-[11px] text-slate-500">
                        Kích thước mỗi ô: {generatedResult.generatedMeta?.frameConfig?.frameWidth || 64}×{generatedResult.generatedMeta?.frameConfig?.frameHeight || 64} px (chuẩn 64×64) · {generatedResult.generatedMeta?.frameConfig?.activeFramesCount || 95} frame hoạt ảnh
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Trạng thái: <span className="font-bold text-amber-600">Bản nháp (Chưa xuất bản)</span>
                      </div>
                    </div>
                  </div>

                  {/* Live Interactive Animation Preview */}
                  {generatedResult.petType && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-28 h-28 shrink-0 bg-white rounded-xl border border-slate-200 flex items-center justify-center p-1 shadow-inner">
                          <PixelPetCanvas
                            petType={generatedResult.petType}
                            currentState={previewState}
                            scaleSize="SMALL"
                            showTooltip={false}
                          />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-xs uppercase">Xem thử hoạt ảnh:</div>
                          <div className="text-[11px] text-slate-500">
                            Trạng thái: <span className="font-bold text-[#1b365d]">{previewState}</span>
                          </div>
                        </div>
                      </div>
                      <select
                        value={previewState}
                        onChange={e => setPreviewState(e.target.value as AnimationState)}
                        className="text-xs p-2 border border-slate-300 rounded-xl bg-white font-mono text-slate-900 focus:outline-none focus:border-[#1b365d]"
                      >
                        {Object.keys(generatedResult.petType.animations || {}).map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <span className="font-semibold text-slate-700">Đường dẫn Sprite Sheet:</span>{' '}
                    <a
                      href={generatedResult.generatedMeta?.sheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#1b365d] hover:underline font-mono text-[11px]"
                    >
                      {generatedResult.generatedMeta?.sheetUrl}
                    </a>
                  </div>

                  {/* Sprite Sheet Scrollable Box */}
                  <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50">
                    <img
                      src={generatedResult.generatedMeta?.sheetUrl}
                      alt="Sprite Sheet"
                      className="w-full"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 italic">
                    💡 Cuộn chuột xuống trong khung trên để xem toàn bộ 17 hàng trạng thái hoạt ảnh.
                  </p>

                  <div className="pt-2 flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => {
                        setSelectedPetType(generatedResult.petType);
                        setActiveTab('CONFIG');
                      }}
                      className="flex-1 py-2.5 bg-[#1b365d] hover:bg-[#162b49] text-white font-bold rounded-xl shadow-xs transition active:scale-95 text-center text-xs"
                    >
                      Cấu hình & Xuất bản →
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('SHOP');
                      }}
                      className="py-2.5 px-4 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold rounded-xl shadow-xs transition active:scale-95 text-center flex items-center justify-center gap-1.5 text-xs"
                    >
                      <ShoppingBag size={15} /> Quản lý trong Shop →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs text-center p-6 space-y-2">
                  <div className="p-3 bg-blue-50 text-[#1b365d] rounded-full border border-blue-200">
                    <Eye size={24} />
                  </div>
                  <div className="font-bold text-slate-700">Chưa có sprite sheet nào được nhập hoặc tạo.</div>
                  <div className="text-[11px] text-slate-400">
                    Tải ảnh gồm 17 hàng trạng thái (mỗi ô 64×64 px); hệ thống tự chuẩn hóa và ánh xạ frame chính xác.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Configure Frame Slices & Animations */}
      {activeTab === 'CONFIG' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-5 space-y-6 font-sans">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-[#1b365d] flex items-center gap-2 uppercase">
                <Sliders size={18} className="text-amber-500" /> Cấu Hình Phân Cắt Khung Hình (Frame Slices) & FPS
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Xem thử chuyển động trực tiếp của từng trạng thái, tùy chỉnh tốc độ FPS và phê duyệt phát hành.
              </p>
            </div>
            <button onClick={loadPetTypes} className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 font-semibold">
              <RefreshCw size={14} /> Làm mới
            </button>
          </div>

          {/* Select Pet Type Buttons */}
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {petTypes.map(pt => (
              <button
                key={pt.id}
                onClick={() => setSelectedPetType(pt)}
                className={`px-3 py-2 text-xs rounded-xl border flex items-center gap-2 whitespace-nowrap transition ${
                  selectedPetType?.id === pt.id ? 'bg-[#1b365d] text-white font-bold border-[#1b365d] shadow-xs' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 font-semibold'
                }`}
              >
                <span>{pt.name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${pt.isActive ? 'bg-emerald-500 text-white' : 'bg-slate-400 text-white'}`}>
                  {pt.isActive ? 'Đã duyệt' : 'Bản nháp'}
                </span>
              </button>
            ))}
          </div>

          {selectedPetType && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              {/* Pet Info & Live Interactive Preview */}
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center">
                  <div className="text-xs font-semibold text-slate-500 mb-2 uppercase">Xem thử hoạt ảnh trực tiếp:</div>
                  
                  {/* Live Canvas Render */}
                  <div className="w-32 h-32 flex items-center justify-center bg-white rounded-xl border border-slate-200 shadow-inner p-2">
                    <PixelPetCanvas
                      petType={selectedPetType}
                      currentState={previewState}
                      scaleSize="MEDIUM"
                      showTooltip={false}
                    />
                  </div>

                  <div className="mt-3 w-full space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-700 block">Chọn trạng thái kiểm tra:</label>
                    <select
                      value={previewState}
                      onChange={e => setPreviewState(e.target.value as AnimationState)}
                      className="w-full text-xs p-2 border border-slate-300 rounded-xl bg-white font-mono text-slate-900 focus:outline-none focus:border-[#1b365d]"
                    >
                      {Object.keys(selectedPetType.animations || {}).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-slate-900">{selectedPetType.name}</div>
                  <div className="text-slate-500">{selectedPetType.description}</div>
                  <div className="text-[11px] text-slate-600 pt-1">
                    <div>• Khung hình: {selectedPetType.frameConfig?.frameWidth || 64}×{selectedPetType.frameConfig?.frameHeight || 64} px ({selectedPetType.frameConfig?.totalColumns || 12} cột × {selectedPetType.frameConfig?.totalRows || 17} hàng)</div>
                    <div>• Tỷ lệ tự nhiên: {selectedPetType.naturalAspectRatio || 1.0}</div>
                    {selectedPetType.frameConfig?.alignmentWarning && (
                      <div className="mt-1 font-semibold text-amber-700">
                        • {selectedPetType.frameConfig.alignmentWarning}
                      </div>
                    )}
                  </div>
                </div>

                <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
                  <h3 className="text-xs font-bold text-slate-900">Thông tin loài thú</h3>
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Tên hiển thị
                    <input
                      value={petTypeName}
                      maxLength={80}
                      onChange={event => setPetTypeName(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-normal text-slate-900 focus:outline-none focus:border-[#1b365d]"
                    />
                  </label>
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Mô tả
                    <textarea
                      value={petTypeDescription}
                      maxLength={500}
                      rows={3}
                      onChange={event => setPetTypeDescription(event.target.value)}
                      className="mt-1 w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-xs font-normal text-slate-900 focus:outline-none focus:border-[#1b365d]"
                    />
                  </label>
                  {(petTypeError || petTypeMessage) && (
                    <p role={petTypeError ? 'alert' : 'status'} className={`text-[11px] ${petTypeError ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {petTypeError || petTypeMessage}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={isSavingPetType || !petTypeName.trim()}
                    onClick={() => void handleSavePetTypeDetails()}
                    className="w-full rounded-xl border border-[#1b365d] bg-[#1b365d] hover:bg-[#162b49] px-3 py-2 text-xs font-bold text-white shadow-xs disabled:opacity-50 transition"
                  >
                    {isSavingPetType ? 'Đang lưu...' : 'Lưu tên và mô tả'}
                  </button>
                </section>

                <button
                  onClick={() => handleTogglePublish(selectedPetType.id, selectedPetType.isActive)}
                  className={`w-full py-2.5 font-bold uppercase text-xs rounded-xl shadow-xs transition active:scale-95 ${
                    selectedPetType.isActive ? 'bg-amber-400 hover:bg-amber-500 text-slate-950' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {selectedPetType.isActive ? 'Thu Hồi / Tạm Ẩn Khỏi Người Dùng' : '✓ Phê Duyệt & Xuất Bản Cho Người Dùng'}
                </button>

                {/* Shop Listing Controls */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <ShoppingBag size={14} className="text-amber-500" /> Bán trong Cửa Hàng (Shop)
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      selectedPetType.isShopEnabled
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {selectedPetType.isShopEnabled ? '✓ Đang mở bán' : 'Chưa mở bán'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs">
                    <label className="text-slate-600 font-semibold">Giá bán (EXP):</label>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      defaultValue={selectedPetType.expPrice || 100}
                      onBlur={e => {
                        const val = parseInt(e.target.value) || 0;
                        if (val !== selectedPetType.expPrice) {
                          void handleUpdatePetShopConfig(selectedPetType.id, selectedPetType.isShopEnabled, val);
                        }
                      }}
                      className="w-24 px-2 py-1 border border-slate-300 rounded-lg font-mono font-bold text-center bg-white text-slate-900 focus:outline-none focus:border-[#1b365d]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleUpdatePetShopConfig(selectedPetType.id, !selectedPetType.isShopEnabled, selectedPetType.expPrice || 100)}
                    className={`w-full py-2 font-bold text-xs rounded-xl shadow-xs transition active:scale-95 ${
                      selectedPetType.isShopEnabled
                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                        : 'bg-amber-400 hover:bg-amber-500 text-slate-950'
                    }`}
                  >
                    {selectedPetType.isShopEnabled ? 'Gỡ khỏi Cửa Hàng' : '🛒 Mở bán trong Cửa Hàng ngay'}
                  </button>
                </div>

                {/* Delete Pet Action */}
                <div className="pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => void handleDeletePet(selectedPetType.id, selectedPetType.name)}
                    className="w-full py-2.5 font-bold uppercase text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 flex items-center justify-center gap-1.5 transition active:scale-95"
                    title="Xóa vĩnh viễn thú cưng này khỏi cơ sở dữ liệu và hệ thống"
                  >
                    <Trash2 size={15} /> Xóa Vĩnh Viễn Thú Cưng Này
                  </button>
                </div>
              </div>

              {/* Animation States Mapping List (17 states) */}
              <div className="md:col-span-2 space-y-2 max-h-[460px] overflow-y-auto pr-2 text-xs">
                <div className="font-bold text-xs text-slate-700 mb-2 uppercase">
                  Danh Sách 17 Trạng Thái Hoạt Ảnh (Animation States Mapping):
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(selectedPetType.animations || {}).map(([stateKey, config]: any) => (
                    <div
                      key={stateKey}
                      onClick={() => setPreviewState(stateKey as AnimationState)}
                      className={`p-3 border rounded-xl flex items-center justify-between cursor-pointer transition ${
                        previewState === stateKey
                          ? 'border-[#1b365d] bg-blue-50/50 shadow-xs'
                          : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/70'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-slate-900">{stateKey}</div>
                        <div className="text-[10px] text-slate-500">
                          Hàng: {config.row} | Frames: [{config.frames?.join(', ')}]
                        </div>
                      </div>
                      <div className="font-mono text-[#1b365d] font-bold text-xs">
                        {config.fps} FPS
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Shared Garden Backgrounds Management */}
      {activeTab === 'BACKGROUNDS' && (
        <div className="space-y-6 font-sans">
          {/* Add Background Form */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-5">
            <h3 className="font-bold text-sm text-[#1b365d] mb-4 flex items-center gap-2 uppercase">
              <Plus size={18} className="text-amber-500" /> Thêm bối cảnh / sprite sheet hoạt ảnh
            </h3>
            <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 text-xs leading-relaxed text-slate-800">
              <strong>Hỗ trợ sprite sheet dạng lưới:</strong> chọn số cột và hàng để khớp ảnh. Ví dụ sheet 1024×572 px của bạn là <strong>2 cột × 4 hàng = 8 khung</strong>, mỗi khung 512×143 px. Các khung chạy theo thứ tự trái sang phải, từ hàng trên xuống hàng dưới. Mỗi ô phải bằng nhau, không có khoảng cách/viền, tối thiểu 128×72 px; tối đa 12 khung, 1–12 FPS. Tỷ lệ khung cảnh nên gần 2:1 để lấp khu vườn mà ít bị crop; ảnh tĩnh dùng lưới 1×1 và 0 FPS.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <input
                type="text"
                value={newBgName}
                onChange={e => setNewBgName(e.target.value)}
                placeholder="Tên bối cảnh (ví dụ: Rừng Thông Pixel)"
                className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/15"
              />
              <input
                type="text"
                value={newBgUrl}
                onChange={e => setNewBgUrl(e.target.value)}
                placeholder="Đường dẫn ảnh (hoặc tải ảnh lên bên dưới)"
                className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/15 font-mono"
              />
              <input
                type="text"
                value={newBgDesc}
                onChange={e => setNewBgDesc(e.target.value)}
                placeholder="Mô tả không gian..."
                className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/15"
              />
            </div>
            <label className="block text-xs font-semibold text-slate-700 mb-3">
              Hoặc chọn ảnh từ máy tính
              <input
                type="file"
                accept="image/png,image/webp,image/jpeg"
                onChange={event => setNewBgFile(event.target.files?.[0] || null)}
                className="block w-full mt-1 text-xs text-slate-600"
              />
              <span className="mt-1 block font-normal text-slate-500">Ảnh động hỗ trợ lưới nhiều hàng; cần khai báo đúng số cột và hàng bên dưới.</span>
            </label>
            <div className="mb-3 grid grid-cols-3 gap-3">
              <label className="text-xs font-semibold text-slate-700">
                Số cột (1–12)
                <input
                  type="number"
                  min="1"
                  max="12"
                  step="1"
                  value={newBgColumns}
                  onChange={event => {
                    const columns = Number(event.target.value);
                    setNewBgColumns(columns);
                    if (columns * newBgRows === 1) setNewBgFps(0);
                    else if (newBgFps === 0) setNewBgFps(4);
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white text-slate-900 focus:outline-none focus:border-[#1b365d]"
                />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Số hàng (1–12)
                <input
                  type="number"
                  min="1"
                  max="12"
                  step="1"
                  value={newBgRows}
                  onChange={event => {
                    const rows = Number(event.target.value);
                    setNewBgRows(rows);
                    if (rows * newBgColumns === 1) setNewBgFps(0);
                    else if (newBgFps === 0) setNewBgFps(4);
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white text-slate-900 focus:outline-none focus:border-[#1b365d]"
                />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Tốc độ (FPS) · {newBgColumns * newBgRows} khung
                <input
                  type="number"
                  min={newBgColumns * newBgRows === 1 ? '0' : '1'}
                  max="12"
                  step="1"
                  value={newBgFps}
                  onChange={event => setNewBgFps(Number(event.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white text-slate-900 focus:outline-none focus:border-[#1b365d]"
                />
              </label>
            </div>
            <button
              onClick={handleAddBackground}
              disabled={!newBgName.trim() || (!newBgUrl.trim() && !newBgFile)}
              className="px-4 py-2.5 bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-bold text-xs uppercase rounded-xl shadow-xs transition active:scale-95"
            >
              + Thêm Vào Danh Mục
            </button>
          </div>

          {/* Backgrounds List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {backgrounds.map(bg => (
              <div key={bg.id} className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-4 space-y-3">
                <BackgroundThumb
                  {...bg}
                  className="w-full h-36 rounded-xl border border-slate-200"
                />
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{bg.name}</h4>
                    <p className="text-xs text-slate-500">{bg.description}</p>
                    <p className="text-[10px] font-semibold text-[#1b365d]">
                      {(bg.animationFrames || 1) > 1
                        ? `Lưới ${bg.animationColumns || bg.animationFrames}×${bg.animationRows || 1} · ${bg.animationFrames} khung · ${bg.animationFps} FPS · lặp liên tục`
                        : 'Ảnh tĩnh'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => handleOpenEditAnimation(bg)}
                      className="text-[10px] px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold flex items-center gap-1 transition"
                      title="Cấu hình hoạt ảnh (số cột, số hàng, FPS) hoặc khôi phục hoạt ảnh"
                    >
                      <Sliders size={12} />
                      Sửa hoạt ảnh
                    </button>
                    {(bg.animationFrames || 1) > 1 && (
                      <button
                        onClick={() => handleSetBackgroundStatic(bg.id)}
                        className="text-[10px] px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold"
                        title="Hiển thị toàn ảnh, không tách thành các khung hoạt ảnh"
                      >
                        Chuyển ảnh tĩnh
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleRecommend(bg.id, bg.isRecommended)}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-bold transition ${
                        bg.isRecommended ? 'bg-amber-400 text-slate-950 border-amber-300' : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {bg.isRecommended ? '⭐ Đề xuất' : 'Bình thường'}
                    </button>
                    <button
                      onClick={() => handleDeleteBackground(bg.id)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Background Animation Edit Modal */}
          {editingBg && (
            <div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
            >
              <div className="bg-white border border-slate-200/90 rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Sliders size={18} className="text-[#1b365d]" /> Cấu hình hoạt ảnh bối cảnh
                  </h3>
                  <button
                    onClick={() => setEditingBg(null)}
                    className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700"
                    title="Đóng"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-slate-900">{editingBg.name}</h4>
                  <p className="text-xs text-slate-500">{editingBg.description || 'Không có mô tả'}</p>
                </div>

                {/* Live Preview */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                    <span>Xem trước hoạt ảnh:</span>
                    <span className="text-[#1b365d] font-mono">
                      {editBgColumns * editBgRows > 1 && editBgFps > 0
                        ? `Lưới ${editBgColumns}×${editBgRows} · ${editBgColumns * editBgRows} khung · ${editBgFps} FPS`
                        : 'Ảnh tĩnh (1 khung)'}
                    </span>
                  </div>
                  <BackgroundThumb
                    imageUrl={editingBg.imageUrl}
                    animationColumns={editBgColumns}
                    animationRows={editBgRows}
                    animationFrames={editBgColumns * editBgRows}
                    animationFps={editBgFps}
                    className="w-full h-44 rounded-xl border border-slate-200 shadow-inner"
                  />
                </div>

                {/* Quick Presets */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Mẫu cấu hình nhanh:</label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditBgColumns(1);
                        setEditBgRows(1);
                        setEditBgFps(0);
                        setEditBgError('');
                      }}
                      className={`px-2.5 py-1 text-xs rounded-lg border font-semibold transition ${
                        editBgColumns === 1 && editBgRows === 1
                          ? 'bg-[#1b365d] text-white border-[#1b365d]'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      Ảnh tĩnh (1×1 · 0 FPS)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditBgColumns(2);
                        setEditBgRows(4);
                        setEditBgFps(4);
                        setEditBgError('');
                      }}
                      className={`px-2.5 py-1 text-xs rounded-lg border font-semibold transition ${
                        editBgColumns === 2 && editBgRows === 4
                          ? 'bg-[#1b365d] text-white border-[#1b365d]'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      Lưới 2×4 (8 khung · 4 FPS)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditBgColumns(4);
                        setEditBgRows(1);
                        setEditBgFps(4);
                        setEditBgError('');
                      }}
                      className={`px-2.5 py-1 text-xs rounded-lg border font-semibold transition ${
                        editBgColumns === 4 && editBgRows === 1
                          ? 'bg-[#1b365d] text-white border-[#1b365d]'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      Ngang 4×1 (4 khung · 4 FPS)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditBgColumns(3);
                        setEditBgRows(2);
                        setEditBgFps(4);
                        setEditBgError('');
                      }}
                      className={`px-2.5 py-1 text-xs rounded-lg border font-semibold transition ${
                        editBgColumns === 3 && editBgRows === 2
                          ? 'bg-[#1b365d] text-white border-[#1b365d]'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      Lưới 3×2 (6 khung · 4 FPS)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditBgColumns(1);
                        setEditBgRows(4);
                        setEditBgFps(4);
                        setEditBgError('');
                      }}
                      className={`px-2.5 py-1 text-xs rounded-lg border font-semibold transition ${
                        editBgColumns === 1 && editBgRows === 4
                          ? 'bg-[#1b365d] text-white border-[#1b365d]'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      Dọc 1×4 (4 khung · 4 FPS)
                    </button>
                  </div>
                </div>

                {/* Manual Grid & FPS Input */}
                <div className="grid grid-cols-3 gap-3">
                  <label className="text-xs font-semibold text-slate-700">
                    Số cột (1–12)
                    <input
                      type="number"
                      min="1"
                      max="12"
                      step="1"
                      value={editBgColumns}
                      onChange={event => {
                        const cols = Number(event.target.value);
                        setEditBgColumns(cols);
                        if (cols * editBgRows === 1) setEditBgFps(0);
                        else if (editBgFps === 0) setEditBgFps(4);
                        setEditBgError('');
                      }}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white text-slate-900 focus:outline-none focus:border-[#1b365d]"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Số hàng (1–12)
                    <input
                      type="number"
                      min="1"
                      max="12"
                      step="1"
                      value={editBgRows}
                      onChange={event => {
                        const rows = Number(event.target.value);
                        setEditBgRows(rows);
                        if (rows * editBgColumns === 1) setEditBgFps(0);
                        else if (editBgFps === 0) setEditBgFps(4);
                        setEditBgError('');
                      }}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white text-slate-900 focus:outline-none focus:border-[#1b365d]"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Tốc độ (FPS) · {editBgColumns * editBgRows} khung
                    <input
                      type="number"
                      min={editBgColumns * editBgRows === 1 ? '0' : '1'}
                      max="12"
                      step="1"
                      value={editBgFps}
                      onChange={event => {
                        setEditBgFps(Number(event.target.value));
                        setEditBgError('');
                      }}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white text-slate-900 focus:outline-none focus:border-[#1b365d]"
                    />
                  </label>
                </div>

                {editBgColumns * editBgRows > 12 && (
                  <p className="text-xs text-rose-600 font-semibold">
                    ⚠️ Tổng số khung hình ({editBgColumns * editBgRows}) không được vượt quá 12.
                  </p>
                )}

                {editBgError && (
                  <div className="text-xs text-rose-600 font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                    {editBgError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingBg(null)}
                    className="px-4 py-2 border border-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-50 text-slate-700"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={isSavingBgAnimation || editBgColumns * editBgRows > 12}
                    onClick={handleSaveBackgroundAnimation}
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-bold text-xs uppercase rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1.5"
                  >
                    {isSavingBgAnimation ? 'Đang lưu...' : 'Lưu Cấu Hình'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: System Monitor */}
      {activeTab === 'SYSTEM' && (
        <div className="space-y-6">
          <AdminAnalytics />
          {stats && <section className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-6 font-sans shadow-xs">
            <h3 className="font-bold text-sm text-[#1b365d] flex items-center gap-2">
              <Server size={18} className="text-amber-500" /> Giám sát hiệu suất máy chủ
            </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="font-extrabold text-2xl text-[#1b365d]">{stats.counts?.totalUsers}</div>
              <div className="text-[11px] text-slate-500 mt-1 font-semibold">Người Dùng</div>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="font-extrabold text-2xl text-amber-500">{stats.counts?.activePets}</div>
              <div className="text-[11px] text-slate-500 mt-1 font-semibold">Thú Cưng Hoạt Động</div>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="font-extrabold text-2xl text-blue-600">{stats.counts?.totalWorkSessions}</div>
              <div className="text-[11px] text-slate-500 mt-1 font-semibold">Phiên Pomodoro</div>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="font-extrabold text-2xl text-emerald-600">{stats.system?.memoryUsagePercent}%</div>
              <div className="text-[11px] text-slate-500 mt-1 font-semibold">Sử Dụng RAM Máy Chủ</div>
            </div>
          </div>

          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-mono space-y-1.5 text-slate-200">
            <div>Hệ điều hành: {stats.system?.platform}</div>
            <div>CPU: {stats.system?.cpuModel} ({stats.system?.cpuCores} Cores)</div>
            <div>Bộ nhớ: {stats.system?.memoryUsedMB} MB / {stats.system?.memoryTotalMB} MB</div>
            <div>Thời gian hoạt động liên tục (Uptime): {Math.round(stats.system?.uptimeSeconds / 60)} phút</div>
          </div>
          </section>}
        </div>
      )}
      {activeTab === 'SHOP' && <AdminShopManagement />}
      {activeTab === 'QUESTS' && <AdminQuestManagement />}
      {activeTab === 'ACCESS' && <AdminAccessManagement />}
      {activeTab === 'CREATE_SKIN' && (
        <AdminSkinForge
          petTypes={petTypes}
          onNavigateToShop={() => setActiveTab('SHOP')}
        />
      )}
      {activeTab === 'CREATE_ITEM' && (
        <AdminItemForge
          petTypes={petTypes}
          onNavigateToShop={() => setActiveTab('SHOP')}
        />
      )}
        </div>
      </div>
    </div>
  );
};
