import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Sliders, CheckCircle, Eye, Trash2, Plus, Server, Users, RefreshCw, Upload, Image as ImageIcon, FileText, ShoppingBag, ShieldCheck, Award, X } from 'lucide-react';
import { api } from '../services/api';
import { PetType, GardenBackground, AnimationState } from '../types';
import { PixelPetCanvas } from './PixelPetCanvas';
import { BackgroundThumb } from './BackgroundThumb';
import { AdminShopManagement } from './AdminShopManagement';
import { AdminAccessManagement } from './AdminAccessManagement';
import { AdminAnalytics } from './AdminAnalytics';
import { AdminQuestManagement } from './AdminQuestManagement';

export const SPRITE_SHEET_SPEC = [
  // Nhóm 1: Trạng thái cơ bản & Sinh hoạt (Chuyển động lặp lại - Loop)
  { row: 1, state: 'IDLE', label: 'Idle / Walking (Default)', frames: 6, loop: true, desc: 'Thở đều và đi lại tự nhiên', group: 'Nhóm 1: Trạng thái cơ bản & Sinh hoạt' },
  { row: 2, state: 'SLEEPING', label: 'Sleeping / Dozing off', frames: 4, loop: true, desc: 'Lồng ngực nhấp nhô nhẹ, đều đặn', group: 'Nhóm 1: Trạng thái cơ bản & Sinh hoạt' },
  { row: 3, state: 'HUNGRY', label: 'Hungry', frames: 4, loop: true, desc: 'Ôm bụng, cử động nhỏ', group: 'Nhóm 1: Trạng thái cơ bản & Sinh hoạt' },
  { row: 4, state: 'EATING', label: 'Eating / Chewing', frames: 6, loop: true, desc: 'Há miệng, nhai, nuốt', group: 'Nhóm 1: Trạng thái cơ bản & Sinh hoạt' },
  { row: 5, state: 'YAWNING', label: 'Yawning / Tired', frames: 5, loop: false, desc: 'Hành động diễn ra một lần rồi quay lại Idle', group: 'Nhóm 1: Trạng thái cơ bản & Sinh hoạt' },
  { row: 6, state: 'WAKING_UP', label: 'Waking up', frames: 6, loop: false, desc: 'Dụi mắt, vươn vai, đứng thẳng', group: 'Nhóm 1: Trạng thái cơ bản & Sinh hoạt' },

  // Nhóm 2: Đồng hành làm việc (Chuyển động lặp lại - Loop)
  { row: 7, state: 'TYPING', label: 'Typing / Focusing', frames: 4, loop: true, desc: 'Tay gõ phím, lặp lại nhanh', group: 'Nhóm 2: Đồng hành làm việc' },
  { row: 8, state: 'EXERCISING', label: 'Exercising / Stretching', frames: 8, loop: true, desc: 'Biên độ múa/nhảy/vươn vai', group: 'Nhóm 2: Đồng hành làm việc' },
  { row: 9, state: 'DRINKING', label: 'Drinking / Holding a cup', frames: 4, loop: true, desc: 'Đưa cốc lên, uống, bỏ xuống', group: 'Nhóm 2: Đồng hành làm việc' },

  // Nhóm 3: Tương tác & Giao tiếp (Chuyển động nhanh, phản hồi)
  { row: 10, state: 'PETTING', label: 'Reacting to petting', frames: 5, loop: false, desc: 'Giật mình, híp mắt, nảy người cười', group: 'Nhóm 3: Tương tác & Giao tiếp' },
  { row: 11, state: 'WAVING', label: 'Waving (Attention seeking)', frames: 4, loop: true, desc: 'Tay vung qua trái phải mượt', group: 'Nhóm 3: Tương tác & Giao tiếp' },
  { row: 12, state: 'DANCING', label: 'Dancing', frames: 8, loop: true, desc: 'Vũ đạo lặp lại 2 nhịp trái, 2 nhịp phải', group: 'Nhóm 3: Tương tác & Giao tiếp' },
  { row: 13, state: 'THANKING', label: 'Expressing Gratitude', frames: 4, loop: false, desc: 'Cúi người cảm ơn, thả tim', group: 'Nhóm 3: Tương tác & Giao tiếp' },

  // Nhóm 4: Cảm xúc & Gamification (Hoạt ảnh đặc biệt, One-shot)
  { row: 14, state: 'HAPPY', label: 'Happy / Excited', frames: 4, loop: true, desc: 'Nhảy cẫng nhẹ, lặp lại nhanh', group: 'Nhóm 4: Cảm xúc & Gamification' },
  { row: 15, state: 'SAD', label: 'Sad / Crying / Sighing', frames: 5, loop: false, desc: 'Rũ người xuống, thở dài thườn thượt', group: 'Nhóm 4: Cảm xúc & Gamification' },
  { row: 16, state: 'CELEBRATING', label: 'Celebrating', frames: 6, loop: false, desc: 'Tung hô, ăn mừng có hiệu ứng nổ nhỏ', group: 'Nhóm 4: Cảm xúc & Gamification' },
  { row: 17, state: 'EVOLVING', label: 'Evolving / Leveling up', frames: 12, loop: false, desc: 'Tỏa sáng, thay đổi hình dáng và chấn động', group: 'Nhóm 4: Cảm xúc & Gamification' },
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

export const AdminConsole: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'FORGE' | 'CONFIG' | 'BACKGROUNDS' | 'SHOP' | 'QUESTS' | 'ACCESS' | 'SYSTEM'>('SYSTEM');
  const [forgeMode, setForgeMode] = useState<'IMAGE' | 'PROMPT'>('IMAGE');

  // Text Prompt generation state
  const [prompt, setPrompt] = useState('chim bồ câu đội nón phù thủy');
  const [petName, setPetName] = useState('Bồ Câu Phù Thủy');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<any | null>(null);

  // Image Upload generation state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imagePetName, setImagePetName] = useState('Thú Cưng Tải Lên');
  const [imagePetDesc, setImagePetDesc] = useState('Thú cưng nhập từ sprite sheet 17 trạng thái');
  const [isImageGenerating, setIsImageGenerating] = useState(false);
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
  }, [imagePreviewUrl]);

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

  const handlePromptSelect = (samplePrompt: string, sampleName: string) => {
    setPrompt(samplePrompt);
    setPetName(sampleName);
  };

  const handleGenerateFromPrompt = async () => {
    if (!prompt.trim() || !petName.trim() || isGenerating) return;
    setIsGenerating(true);
    try {
      const res = await api.generateSprite({
        prompt,
        name: petName,
        naturalAspectRatio: 1.0
      });
      setGeneratedResult(res.data);
      alert('Tạo Sprite Sheet thành công từ Prompt!');
      loadPetTypes();
    } catch (err: any) {
      alert(`Lỗi tạo Sprite Forge: ${err?.response?.data?.error || err.message}`);
    } finally {
      setIsGenerating(false);
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
      formData.append('description', imagePetDesc.trim());
      formData.append('naturalAspectRatio', '1.0');

      const res = await api.importSpriteSheet(formData);
      setGeneratedResult(res.data);
      alert(
        res.data.generatedMeta?.frameConfig?.backgroundRemoved
          ? 'Đã tự động xóa nền trắng thành trong suốt và ánh xạ sprite sheet cho 17 trạng thái!'
          : 'Đã nhập và ánh xạ sprite sheet cho 17 trạng thái. Không phát hiện vùng nền trắng nối với mép ảnh.'
      );
      loadPetTypes();
    } catch (err: any) {
      alert(`Không thể nhập sprite sheet: ${err?.response?.data?.error || err.message}`);
    } finally {
      setIsImageGenerating(false);
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
    { id: 'CONFIG' as const, label: 'Loài thú & hoạt ảnh', icon: <Sliders size={17} /> },
    { id: 'BACKGROUNDS' as const, label: 'Bối cảnh khu vườn', icon: <ImageIcon size={17} /> },
    { id: 'SHOP' as const, label: 'Quản lý cửa hàng', icon: <ShoppingBag size={17} /> }
  ];

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="grid min-w-0 gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-gray-200 bg-white p-3 shadow-sm lg:sticky lg:top-24">
          <div className="mb-3 border-b border-gray-100 px-3 pb-3">
            <div className="font-pixel text-xs text-charcoal">OFFICEPET</div>
            <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">Admin Control Panel</div>
          </div>
          <nav aria-label="Điều hướng quản trị" className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-1">
            {navItems.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                aria-current={activeTab === item.id ? 'page' : undefined}
                className={`flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold transition-colors ${
                  activeTab === item.id ? 'bg-sage-100 text-sage-900 ring-1 ring-sage-300' : 'text-gray-600 hover:bg-gray-50 hover:text-charcoal'
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
          {/* Submode Switcher: Image Upload vs Prompt */}
          <div className="flex bg-cream-200 p-1.5 rounded-xl border-2 border-charcoal gap-2 font-sans font-extrabold text-xs">
            <button
              onClick={() => setForgeMode('IMAGE')}
              className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all ${
                forgeMode === 'IMAGE'
                  ? 'bg-terracotta-400 text-white shadow-pixel-sm'
                  : 'bg-white text-charcoal hover:bg-cream-50'
              }`}
            >
              <Upload size={16} /> Nhập Sprite Sheet Thú Cưng
            </button>
            <button
              onClick={() => setForgeMode('PROMPT')}
              className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all ${
                forgeMode === 'PROMPT'
                  ? 'bg-sage-400 text-white shadow-pixel-sm'
                  : 'bg-white text-charcoal hover:bg-cream-50'
              }`}
            >
              <Sparkles size={16} /> Nhập Mô Tả (Prompt Text)
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Input Form (Image or Prompt) */}
            {forgeMode === 'IMAGE' ? (
              <div className="bg-white border-2 border-charcoal rounded-xl shadow-pixel p-5 space-y-4 font-sans">
                <div className="flex items-center gap-2 text-terracotta-500 font-extrabold text-sm uppercase">
                  <Upload size={18} /> Nhập Sprite Sheet Có Sẵn
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Tải sprite sheet đã vẽ sẵn. Hệ thống tự xóa vùng nền trắng nối với mép ảnh thành trong suốt, sau đó tự động căn ô chuẩn <strong>64×64 pixel</strong> và ánh xạ frame chính xác cho từng trạng thái cho thú, skin và vật phẩm. Ảnh gồm <strong>17 hàng trạng thái</strong> theo danh sách cấu hình bên dưới (tổng cộng 95 frame).
                </p>
                <div className="rounded-lg border border-charcoal bg-cream-50 p-3 text-[10px] text-gray-700 max-h-56 overflow-y-auto space-y-2">
                  {['Nhóm 1: Trạng thái cơ bản & Sinh hoạt', 'Nhóm 2: Đồng hành làm việc', 'Nhóm 3: Tương tác & Giao tiếp', 'Nhóm 4: Cảm xúc & Gamification'].map(grp => (
                    <div key={grp} className="space-y-1">
                      <div className="font-extrabold text-terracotta-600 border-b border-charcoal/20 pb-0.5">{grp}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-0.5">
                        {SPRITE_SHEET_SPEC.filter(s => s.group === grp).map(s => (
                          <div key={s.state} className="flex items-center justify-between">
                            <span><strong className="mr-1">{String(s.row).padStart(2, '0')}.</strong>{s.label}</span>
                            <span className={`px-1.5 py-0.2 rounded font-bold text-[9px] ${s.loop ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
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
                  className="border-2 border-dashed border-charcoal hover:border-terracotta-400 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-cream-50 hover:bg-cream-100 transition-colors"
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
                        className="w-24 h-24 object-contain rounded-lg border-2 border-charcoal shadow-pixel-sm bg-white"
                      />
                      <span className="text-[11px] font-bold text-terracotta-500 underline">
                        Nhấn để chọn sheet khác ({imageFile?.name})
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center gap-2 py-3">
                      <div className="p-3 bg-terracotta-100 text-terracotta-500 rounded-full">
                        <ImageIcon size={28} />
                      </div>
                      <div className="text-xs font-bold text-charcoal">
                        Chọn sprite sheet thú cưng vào đây
                      </div>
                      <div className="text-[10px] text-gray-500">
                        17 hàng trạng thái · Mỗi ô chuẩn 64×64 px · PNG, JPG, WEBP · tối đa 15MB
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Tên thú cưng:</label>
                  <input
                    type="text"
                    value={imagePetName}
                    onChange={e => setImagePetName(e.target.value)}
                    placeholder="Ví dụ: Mèo Hoàng Thượng, Cún Poodle..."
                    className="w-full px-3 py-2 text-xs border-2 border-charcoal rounded-lg focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Mô tả / Ghi chú thú cưng:</label>
                  <input
                    type="text"
                    value={imagePetDesc}
                    onChange={e => setImagePetDesc(e.target.value)}
                    placeholder="Mô tả đặc điểm thú cưng..."
                    className="w-full px-3 py-2 text-xs border-2 border-charcoal rounded-lg focus:outline-none"
                  />
                </div>

                <button
                  onClick={handleGenerateFromImage}
                  disabled={isImageGenerating || !imageFile || !imagePetName.trim()}
                  className="w-full py-2.5 font-bold uppercase text-xs bg-terracotta-400 hover:bg-terracotta-500 disabled:opacity-50 text-white rounded-lg border-2 border-charcoal shadow-pixel flex items-center justify-center gap-2 transition-transform active:scale-95"
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
            ) : (
              <div className="bg-white border-2 border-charcoal rounded-xl shadow-pixel p-5 space-y-4 font-sans">
                <div className="flex items-center gap-2 text-sage-600 font-extrabold text-sm uppercase">
                  <Sparkles size={18} /> Sinh Thú Cưng Mới Bằng Prompt Text
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Mô tả loài, dáng người, màu sắc, họa tiết và phụ kiện để bộ vẽ pixel art tạo nhân vật theo mẫu loài tương ứng. Đây là bộ vẽ theo quy tắc, không phải mô hình sinh ảnh AI.
                </p>

                {/* Quick Presets */}
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-gray-500">Gợi ý loài & phụ kiện độc đáo:</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => handlePromptSelect('cừu đội mũ quân sự', 'Cừu Chiến Binh')}
                      className="px-2 py-1 text-[11px] bg-cream-100 hover:bg-cream-200 border border-charcoal rounded text-charcoal font-bold"
                    >
                      🐑 Cừu đội mũ quân sự
                    </button>
                    <button
                      onClick={() => handlePromptSelect('mèo đen thân thon có đốm tím đeo kính', 'Mèo Bóng Đêm')}
                      className="px-2 py-1 text-[11px] bg-cream-100 hover:bg-cream-200 border border-charcoal rounded text-charcoal"
                    >
                      🐈 Mèo thon có đốm
                    </button>
                    <button
                      onClick={() => handlePromptSelect('hamster tròn trịa màu vàng đội mũ đầu bếp', 'Hamster Bánh Bao')}
                      className="px-2 py-1 text-[11px] bg-cream-100 hover:bg-cream-200 border border-charcoal rounded text-charcoal"
                    >
                      🐹 Hamster tròn đầu bếp
                    </button>
                    <button
                      onClick={() => handlePromptSelect('chim bồ câu đội nón phù thủy', 'Bồ Câu Phù Thủy')}
                      className="px-2 py-1 text-[11px] bg-cream-100 hover:bg-cream-200 border border-charcoal rounded text-charcoal"
                    >
                      🕊️ Bồ câu phù thủy
                    </button>
                    <button
                      onClick={() => handlePromptSelect('gấu trúc ăn cành trúc', 'Panda Trúc Xanh')}
                      className="px-2 py-1 text-[11px] bg-cream-100 hover:bg-cream-200 border border-charcoal rounded text-charcoal font-bold"
                    >
                      🐼 Gấu trúc ăn trúc
                    </button>
                    <button
                      onClick={() => handlePromptSelect('rồng lửa đội vương miện', 'Rồng Lửa Hoàng Gia')}
                      className="px-2 py-1 text-[11px] bg-cream-100 hover:bg-cream-200 border border-charcoal rounded text-charcoal font-bold"
                    >
                      🐉 Rồng con vương miện
                    </button>
                    <button
                      onClick={() => handlePromptSelect('mèo mướp cam mắt xanh', 'Mèo Cam Mướp')}
                      className="px-2 py-1 text-[11px] bg-cream-100 hover:bg-cream-200 border border-charcoal rounded text-charcoal"
                    >
                      🐱 Mèo mướp cam
                    </button>
                    <button
                      onClick={() => handlePromptSelect('cún corgi bento đeo nơ xanh', 'Corgi Bento')}
                      className="px-2 py-1 text-[11px] bg-cream-100 hover:bg-cream-200 border border-charcoal rounded text-charcoal"
                    >
                      🐶 Corgi Bento
                    </button>
                    <button
                      onClick={() => handlePromptSelect('thỏ trắng ngọc gặm cà rốt', 'Thỏ Tuyết Yuki')}
                      className="px-2 py-1 text-[11px] bg-cream-100 hover:bg-cream-200 border border-charcoal rounded text-charcoal"
                    >
                      🐰 Thỏ gặm cà rốt
                    </button>
                    <button
                      onClick={() => handlePromptSelect('chim cánh cụt quàng khăn len đỏ', 'Cánh Cụt Pingu')}
                      className="px-2 py-1 text-[11px] bg-cream-100 hover:bg-cream-200 border border-charcoal rounded text-charcoal"
                    >
                      🐧 Cánh cụt khăn đỏ
                    </button>
                    <button
                      onClick={() => handlePromptSelect('cáo màu cam đuôi xù trắng', 'Cáo Lửa Kitsu')}
                      className="px-2 py-1 text-[11px] bg-cream-100 hover:bg-cream-200 border border-charcoal rounded text-charcoal font-bold"
                    >
                      🦊 Cáo đuôi xù
                    </button>
                    <button
                      onClick={() => handlePromptSelect('chuột hamster má phúng phính ăn hạt', 'Hamster Mochi')}
                      className="px-2 py-1 text-[11px] bg-cream-100 hover:bg-cream-200 border border-charcoal rounded text-charcoal font-bold"
                    >
                      🐹 Hamster má phính
                    </button>
                    <button
                      onClick={() => handlePromptSelect('vịt vàng bơi lội', 'Vịt Vàng Quack')}
                      className="px-2 py-1 text-[11px] bg-cream-100 hover:bg-cream-200 border border-charcoal rounded text-charcoal"
                    >
                      🦆 Vịt vàng
                    </button>
                    <button
                      onClick={() => handlePromptSelect('heo hồng đáng yêu', 'Heo Hồng Oink')}
                      className="px-2 py-1 text-[11px] bg-cream-100 hover:bg-cream-200 border border-charcoal rounded text-charcoal"
                    >
                      🐷 Heo hồng
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Tên loài thú cưng:</label>
                  <input
                    type="text"
                    value={petName}
                    onChange={e => setPetName(e.target.value)}
                    placeholder="Ví dụ: Bồ Câu Phù Thủy, Mèo Mướp Cam..."
                    className="w-full px-3 py-2 text-xs border-2 border-charcoal rounded-lg focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Mô tả đặc tính & màu sắc (Prompt AI):</label>
                  <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    rows={3}
                    placeholder="Ví dụ: Hiệp sĩ anime Saber tóc vàng giáp xanh, Cáo chín đuôi chibi, Mèo phù thủy cute..."
                    className="w-full px-3 py-2 text-xs border-2 border-charcoal rounded-lg focus:outline-none font-sans"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                    ✨ Tích hợp AI FLUX & Sprite Forge: Tự động vẽ nhân vật chất lượng cao, xóa nền trong suốt và tạo 17 trạng thái hoạt ảnh.
                  </p>
                </div>

                <button
                  onClick={handleGenerateFromPrompt}
                  disabled={isGenerating || !prompt.trim() || !petName.trim()}
                  className="w-full py-2.5 font-bold uppercase text-xs bg-sage-500 hover:bg-sage-600 disabled:opacity-50 text-white rounded-lg border-2 border-charcoal shadow-pixel flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                  {isGenerating ? (
                    <>
                      <span className="animate-spin">⏳</span> Đang gọi AI vẽ nhân vật & tạo Sprite Sheet (10-15s)...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} /> Sinh Hoạt Ảnh AI (17 Trạng Thái)
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Right: Generated Result Preview */}
            <div className="bg-white border-2 border-charcoal rounded-xl shadow-pixel p-5 space-y-4 font-sans">
              <div className="font-extrabold text-sm text-charcoal flex items-center justify-between">
                <span>Xem Trước Sprite Sheet & Thông Số Kỹ Thuật</span>
                {generatedResult && (
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${
                    generatedResult.generatedMeta?.frameConfig?.alignmentWarning
                      ? 'bg-amber-100 text-amber-800 border-amber-400'
                      : 'bg-green-100 text-green-800 border-green-400'
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
                  <div className={`p-2.5 border rounded-lg font-bold flex items-center gap-2 ${
                    generatedResult.generatedMeta?.frameConfig?.alignmentWarning
                      ? 'bg-amber-50 border-amber-400 text-amber-800'
                      : 'bg-green-50 border-green-400 text-green-800'
                  }`}>
                    {generatedResult.generatedMeta?.frameConfig?.alignmentWarning
                      ? <ImageIcon size={16} className="text-amber-600" />
                      : <CheckCircle size={16} className="text-green-600" />
                    }
                    {generatedResult.generatedMeta?.frameConfig?.alignmentWarning
                      || 'Sprite sheet đã được căn và ánh xạ vào 17 trạng thái (95 frame chuẩn 64×64 px).'
                    }
                    {!generatedResult.generatedMeta?.frameConfig?.alignmentWarning
                      && generatedResult.generatedMeta?.frameConfig?.backgroundRemoved
                      && ' Nền trắng nối với mép ảnh đã được chuyển thành trong suốt.'
                    }
                  </div>

                  {/* Thumbnail & Meta info */}
                  <div className="flex items-center gap-4 p-3 bg-cream-50 border border-charcoal rounded-lg">
                    <img
                      src={generatedResult.generatedMeta?.previewUrl}
                      alt="Preview Frame"
                      className="w-16 h-16 object-contain bg-white rounded border border-charcoal"
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <div className="space-y-1">
                      <div className="font-bold text-sm text-charcoal">{generatedResult.petType?.name}</div>
                      <div className="text-[11px] text-gray-600">
                        Kích thước mỗi ô: {generatedResult.generatedMeta?.frameConfig?.frameWidth || 64}×{generatedResult.generatedMeta?.frameConfig?.frameHeight || 64} px (chuẩn 64×64) · {generatedResult.generatedMeta?.frameConfig?.activeFramesCount || 95} frame hoạt ảnh
                      </div>
                      <div className="text-[11px] text-gray-600">
                        Trạng thái: <span className="font-bold text-amber-600">Bản nháp (Chưa xuất bản)</span>
                      </div>
                    </div>
                  </div>

                  {/* Live Interactive Animation Preview */}
                  {generatedResult.petType && (
                    <div className="p-2.5 bg-cream-50 border-2 border-charcoal rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-28 h-28 shrink-0 bg-cream-200 rounded-lg border border-charcoal flex items-center justify-center p-1">
                          <PixelPetCanvas
                            petType={generatedResult.petType}
                            currentState={previewState}
                            scaleSize="SMALL"
                            showTooltip={false}
                          />
                        </div>
                        <div>
                          <div className="font-extrabold text-charcoal text-xs uppercase">Xem thử hoạt ảnh:</div>
                          <div className="text-[11px] text-gray-500">
                            Trạng thái: <span className="font-bold text-terracotta-500">{previewState}</span>
                          </div>
                        </div>
                      </div>
                      <select
                        value={previewState}
                        onChange={e => setPreviewState(e.target.value as AnimationState)}
                        className="text-xs p-1.5 border border-charcoal rounded bg-white font-mono"
                      >
                        {Object.keys(generatedResult.petType.animations || {}).map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <span className="font-bold text-gray-700">Đường dẫn Sprite Sheet:</span>{' '}
                    <a
                      href={generatedResult.generatedMeta?.sheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 underline font-mono text-[11px]"
                    >
                      {generatedResult.generatedMeta?.sheetUrl}
                    </a>
                  </div>

                  {/* Sprite Sheet Scrollable Box */}
                  <div className="max-h-72 overflow-y-auto border border-charcoal rounded-lg p-2 bg-cream-100">
                    <img
                      src={generatedResult.generatedMeta?.sheetUrl}
                      alt="Sprite Sheet"
                      className="w-full"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 italic">
                    💡 Cuộn chuột xuống trong khung trên để xem toàn bộ 17 hàng trạng thái hoạt ảnh.
                  </p>

                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedPetType(generatedResult.petType);
                        setActiveTab('CONFIG');
                      }}
                      className="flex-1 py-2 bg-sage-400 hover:bg-sage-500 text-white font-bold rounded-lg border-2 border-charcoal shadow-pixel-sm transition-transform active:scale-95"
                    >
                      Chuyển Sang Cấu Hình & Xuất Bản Cho User →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-lg text-gray-400 text-xs text-center p-6 space-y-2">
                  <div className="p-3 bg-cream-100 rounded-full text-gray-400">
                    <Eye size={24} />
                  </div>
                  <div className="font-bold">Chưa có sprite sheet nào được nhập hoặc tạo.</div>
                  <div className="text-[11px] text-gray-500">
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
        <div className="bg-white border-2 border-charcoal rounded-xl shadow-pixel p-5 space-y-6 font-sans">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="font-extrabold text-sm text-charcoal flex items-center gap-2 uppercase">
                <Sliders size={18} className="text-sage-500" /> Cấu Hình Phân Cắt Khung Hình (Frame Slices) & FPS
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Xem thử chuyển động trực tiếp của từng trạng thái, tùy chỉnh tốc độ FPS và phê duyệt phát hành.
              </p>
            </div>
            <button onClick={loadPetTypes} className="text-xs text-gray-600 hover:text-charcoal flex items-center gap-1 font-bold">
              <RefreshCw size={14} /> Làm mới
            </button>
          </div>

          {/* Select Pet Type Buttons */}
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {petTypes.map(pt => (
              <button
                key={pt.id}
                onClick={() => setSelectedPetType(pt)}
                className={`px-3 py-2 text-xs font-bold rounded-lg border-2 border-charcoal flex items-center gap-2 whitespace-nowrap transition-colors ${
                  selectedPetType?.id === pt.id ? 'bg-sage-400 text-white shadow-pixel-sm' : 'bg-cream-100 hover:bg-cream-200 text-charcoal'
                }`}
              >
                <span>{pt.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold ${pt.isActive ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'}`}>
                  {pt.isActive ? 'Đã duyệt' : 'Bản nháp'}
                </span>
              </button>
            ))}
          </div>

          {selectedPetType && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              {/* Pet Info & Live Interactive Preview */}
              <div className="space-y-4">
                <div className="p-4 bg-cream-50 border-2 border-charcoal rounded-xl flex flex-col items-center">
                  <div className="text-xs font-bold text-gray-500 mb-2 uppercase">Xem thử hoạt ảnh trực tiếp:</div>
                  
                  {/* Live Canvas Render */}
                  <div className="w-32 h-32 flex items-center justify-center bg-cream-200 rounded-lg border border-charcoal shadow-inner p-2">
                    <PixelPetCanvas
                      petType={selectedPetType}
                      currentState={previewState}
                      scaleSize="MEDIUM"
                      showTooltip={false}
                    />
                  </div>

                  <div className="mt-3 w-full space-y-2">
                    <label className="text-[11px] font-bold text-charcoal block">Chọn trạng thái kiểm tra:</label>
                    <select
                      value={previewState}
                      onChange={e => setPreviewState(e.target.value as AnimationState)}
                      className="w-full text-xs p-1.5 border border-charcoal rounded bg-white font-mono"
                    >
                      {Object.keys(selectedPetType.animations || {}).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="p-3 bg-cream-100 border border-charcoal rounded-lg text-xs space-y-1">
                  <div className="font-bold text-charcoal">{selectedPetType.name}</div>
                  <div className="text-gray-500">{selectedPetType.description}</div>
                  <div className="text-[11px] text-gray-600 pt-1">
                    <div>• Khung hình: {selectedPetType.frameConfig?.frameWidth || 64}×{selectedPetType.frameConfig?.frameHeight || 64} px ({selectedPetType.frameConfig?.totalColumns || 12} cột × {selectedPetType.frameConfig?.totalRows || 17} hàng)</div>
                    <div>• Tỷ lệ tự nhiên: {selectedPetType.naturalAspectRatio || 1.0}</div>
                    {selectedPetType.frameConfig?.alignmentWarning && (
                      <div className="mt-1 font-bold text-amber-700">
                        • {selectedPetType.frameConfig.alignmentWarning}
                      </div>
                    )}
                  </div>
                </div>

                <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
                  <h3 className="text-xs font-bold text-charcoal">Thông tin loài thú</h3>
                  <label className="block text-[11px] font-bold text-gray-600">
                    Tên hiển thị
                    <input
                      value={petTypeName}
                      maxLength={80}
                      onChange={event => setPetTypeName(event.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-2 text-xs font-normal text-charcoal"
                    />
                  </label>
                  <label className="block text-[11px] font-bold text-gray-600">
                    Mô tả
                    <textarea
                      value={petTypeDescription}
                      maxLength={500}
                      rows={3}
                      onChange={event => setPetTypeDescription(event.target.value)}
                      className="mt-1 w-full resize-y rounded-md border border-gray-300 px-2.5 py-2 text-xs font-normal text-charcoal"
                    />
                  </label>
                  {(petTypeError || petTypeMessage) && (
                    <p role={petTypeError ? 'alert' : 'status'} className={`text-[11px] ${petTypeError ? 'text-red-700' : 'text-green-700'}`}>
                      {petTypeError || petTypeMessage}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={isSavingPetType || !petTypeName.trim()}
                    onClick={() => void handleSavePetTypeDetails()}
                    className="w-full rounded-md border border-sage-600 bg-sage-500 px-3 py-2 text-xs font-bold text-white hover:bg-sage-600 disabled:opacity-50"
                  >
                    {isSavingPetType ? 'Đang lưu...' : 'Lưu tên và mô tả'}
                  </button>
                </section>

                <button
                  onClick={() => handleTogglePublish(selectedPetType.id, selectedPetType.isActive)}
                  className={`w-full py-2.5 font-bold uppercase text-xs text-white rounded-lg border-2 border-charcoal shadow-pixel transition-transform active:scale-95 ${
                    selectedPetType.isActive ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {selectedPetType.isActive ? 'Thu Hồi / Tạm Ẩn Khỏi Người Dùng' : '✓ Phê Duyệt & Xuất Bản Cho Người Dùng'}
                </button>
              </div>

              {/* Animation States Mapping List (17 states) */}
              <div className="md:col-span-2 space-y-2 max-h-[460px] overflow-y-auto pr-2 text-xs">
                <div className="font-bold text-xs text-gray-700 mb-2 uppercase">
                  Danh Sách 17 Trạng Thái Hoạt Ảnh (Animation States Mapping):
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(selectedPetType.animations || {}).map(([stateKey, config]: any) => (
                    <div
                      key={stateKey}
                      onClick={() => setPreviewState(stateKey as AnimationState)}
                      className={`p-2.5 border rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                        previewState === stateKey
                          ? 'border-terracotta-400 bg-terracotta-50 shadow-sm'
                          : 'border-gray-300 bg-cream-50 hover:bg-cream-100'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-charcoal">{stateKey}</div>
                        <div className="text-[10px] text-gray-500">
                          Hàng: {config.row} | Frames: [{config.frames?.join(', ')}]
                        </div>
                      </div>
                      <div className="font-mono text-terracotta-600 font-bold text-xs">
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
          <div className="bg-white border-2 border-charcoal rounded-xl shadow-pixel p-5">
            <h3 className="font-extrabold text-sm text-charcoal mb-4 flex items-center gap-2 uppercase">
              <Plus size={18} className="text-sage-500" /> Thêm bối cảnh / sprite sheet hoạt ảnh
            </h3>
            <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs leading-relaxed text-indigo-950">
              <strong>Hỗ trợ sprite sheet dạng lưới:</strong> chọn số cột và hàng để khớp ảnh. Ví dụ sheet 1024×572 px của bạn là <strong>2 cột × 4 hàng = 8 khung</strong>, mỗi khung 512×143 px. Các khung chạy theo thứ tự trái sang phải, từ hàng trên xuống hàng dưới. Mỗi ô phải bằng nhau, không có khoảng cách/viền, tối thiểu 128×72 px; tối đa 12 khung, 1–12 FPS. Tỷ lệ khung cảnh nên gần 2:1 để lấp khu vườn mà ít bị crop; ảnh tĩnh dùng lưới 1×1 và 0 FPS.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <input
                type="text"
                value={newBgName}
                onChange={e => setNewBgName(e.target.value)}
                placeholder="Tên bối cảnh (ví dụ: Rừng Thông Pixel)"
                className="px-3 py-2 text-xs border-2 border-charcoal rounded-lg focus:outline-none"
              />
              <input
                type="text"
                value={newBgUrl}
                onChange={e => setNewBgUrl(e.target.value)}
                placeholder="Đường dẫn ảnh (hoặc tải ảnh lên bên dưới)"
                className="px-3 py-2 text-xs border-2 border-charcoal rounded-lg focus:outline-none font-mono"
              />
              <input
                type="text"
                value={newBgDesc}
                onChange={e => setNewBgDesc(e.target.value)}
                placeholder="Mô tả không gian..."
                className="px-3 py-2 text-xs border-2 border-charcoal rounded-lg focus:outline-none"
              />
            </div>
            <label className="block text-xs font-bold text-gray-700 mb-3">
              Hoặc chọn ảnh từ máy tính
              <input
                type="file"
                accept="image/png,image/webp,image/jpeg"
                onChange={event => setNewBgFile(event.target.files?.[0] || null)}
                className="block w-full mt-1 text-xs"
              />
              <span className="mt-1 block font-normal text-gray-500">Ảnh động hỗ trợ lưới nhiều hàng; cần khai báo đúng số cột và hàng bên dưới.</span>
            </label>
            <div className="mb-3 grid grid-cols-3 gap-3">
              <label className="text-xs font-bold text-gray-700">
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
                  className="mt-1 w-full rounded-lg border-2 border-charcoal px-3 py-2"
                />
              </label>
              <label className="text-xs font-bold text-gray-700">
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
                  className="mt-1 w-full rounded-lg border-2 border-charcoal px-3 py-2"
                />
              </label>
              <label className="text-xs font-bold text-gray-700">
                Tốc độ (FPS) · {newBgColumns * newBgRows} khung
                <input
                  type="number"
                  min={newBgColumns * newBgRows === 1 ? '0' : '1'}
                  max="12"
                  step="1"
                  value={newBgFps}
                  onChange={event => setNewBgFps(Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border-2 border-charcoal px-3 py-2"
                />
              </label>
            </div>
            <button
              onClick={handleAddBackground}
              disabled={!newBgName.trim() || (!newBgUrl.trim() && !newBgFile)}
              className="px-4 py-2 bg-sage-400 hover:bg-sage-500 disabled:opacity-50 text-white font-bold text-xs uppercase rounded-lg border-2 border-charcoal shadow-pixel-sm transition-transform active:scale-95"
            >
              + Thêm Vào Danh Mục
            </button>
          </div>

          {/* Backgrounds List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {backgrounds.map(bg => (
              <div key={bg.id} className="bg-white border-2 border-charcoal rounded-xl shadow-pixel p-4 space-y-2">
                <BackgroundThumb
                  {...bg}
                  className="w-full h-36 rounded-lg border border-charcoal"
                />
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-charcoal">{bg.name}</h4>
                    <p className="text-xs text-gray-500">{bg.description}</p>
                    <p className="text-[10px] font-bold text-sage-700">
                      {(bg.animationFrames || 1) > 1
                        ? `Lưới ${bg.animationColumns || bg.animationFrames}×${bg.animationRows || 1} · ${bg.animationFrames} khung · ${bg.animationFps} FPS · lặp liên tục`
                        : 'Ảnh tĩnh'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => handleOpenEditAnimation(bg)}
                      className="text-[10px] px-2 py-1 rounded border border-charcoal bg-sage-100 hover:bg-sage-200 font-bold flex items-center gap-1 transition-colors"
                      title="Cấu hình hoạt ảnh (số cột, số hàng, FPS) hoặc khôi phục hoạt ảnh"
                    >
                      <Sliders size={12} />
                      Sửa hoạt ảnh
                    </button>
                    {(bg.animationFrames || 1) > 1 && (
                      <button
                        onClick={() => handleSetBackgroundStatic(bg.id)}
                        className="text-[10px] px-2 py-1 rounded border border-charcoal bg-gray-100 hover:bg-gray-200 font-bold"
                        title="Hiển thị toàn ảnh, không tách thành các khung hoạt ảnh"
                      >
                        Chuyển ảnh tĩnh
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleRecommend(bg.id, bg.isRecommended)}
                      className={`text-xs px-2 py-1 rounded border font-bold ${
                        bg.isRecommended ? 'bg-yellow-400 text-charcoal border-charcoal' : 'bg-gray-100 text-gray-500 border-gray-300'
                      }`}
                    >
                      {bg.isRecommended ? '⭐ Đề xuất' : 'Bình thường'}
                    </button>
                    <button
                      onClick={() => handleDeleteBackground(bg.id)}
                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
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
              <div className="bg-white border-4 border-charcoal rounded-2xl shadow-pixel-lg max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b-2 border-charcoal/10 pb-3">
                  <h3 className="font-pixel text-sm text-charcoal flex items-center gap-2">
                    <Sliders size={18} className="text-sage-600" /> Cấu hình hoạt ảnh bối cảnh
                  </h3>
                  <button
                    onClick={() => setEditingBg(null)}
                    className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-charcoal"
                    title="Đóng"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-charcoal">{editingBg.name}</h4>
                  <p className="text-xs text-gray-500">{editingBg.description || 'Không có mô tả'}</p>
                </div>

                {/* Live Preview */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-bold text-charcoal">
                    <span>Xem trước hoạt ảnh:</span>
                    <span className="text-sage-700 font-mono">
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
                    className="w-full h-44 rounded-xl border-2 border-charcoal shadow-inner"
                  />
                </div>

                {/* Quick Presets */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700">Mẫu cấu hình nhanh:</label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditBgColumns(1);
                        setEditBgRows(1);
                        setEditBgFps(0);
                        setEditBgError('');
                      }}
                      className={`px-2.5 py-1 text-xs rounded border font-bold transition-colors ${
                        editBgColumns === 1 && editBgRows === 1
                          ? 'bg-charcoal text-white border-charcoal'
                          : 'bg-gray-100 hover:bg-gray-200 text-charcoal border-charcoal'
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
                      className={`px-2.5 py-1 text-xs rounded border font-bold transition-colors ${
                        editBgColumns === 2 && editBgRows === 4
                          ? 'bg-charcoal text-white border-charcoal'
                          : 'bg-gray-100 hover:bg-gray-200 text-charcoal border-charcoal'
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
                      className={`px-2.5 py-1 text-xs rounded border font-bold transition-colors ${
                        editBgColumns === 4 && editBgRows === 1
                          ? 'bg-charcoal text-white border-charcoal'
                          : 'bg-gray-100 hover:bg-gray-200 text-charcoal border-charcoal'
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
                      className={`px-2.5 py-1 text-xs rounded border font-bold transition-colors ${
                        editBgColumns === 3 && editBgRows === 2
                          ? 'bg-charcoal text-white border-charcoal'
                          : 'bg-gray-100 hover:bg-gray-200 text-charcoal border-charcoal'
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
                      className={`px-2.5 py-1 text-xs rounded border font-bold transition-colors ${
                        editBgColumns === 1 && editBgRows === 4
                          ? 'bg-charcoal text-white border-charcoal'
                          : 'bg-gray-100 hover:bg-gray-200 text-charcoal border-charcoal'
                      }`}
                    >
                      Dọc 1×4 (4 khung · 4 FPS)
                    </button>
                  </div>
                </div>

                {/* Manual Grid & FPS Input */}
                <div className="grid grid-cols-3 gap-3">
                  <label className="text-xs font-bold text-gray-700">
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
                      className="mt-1 w-full rounded-lg border-2 border-charcoal px-3 py-2 text-xs"
                    />
                  </label>
                  <label className="text-xs font-bold text-gray-700">
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
                      className="mt-1 w-full rounded-lg border-2 border-charcoal px-3 py-2 text-xs"
                    />
                  </label>
                  <label className="text-xs font-bold text-gray-700">
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
                      className="mt-1 w-full rounded-lg border-2 border-charcoal px-3 py-2 text-xs"
                    />
                  </label>
                </div>

                {editBgColumns * editBgRows > 12 && (
                  <p className="text-xs text-red-600 font-bold">
                    ⚠️ Tổng số khung hình ({editBgColumns * editBgRows}) không được vượt quá 12.
                  </p>
                )}

                {editBgError && (
                  <div className="text-xs text-red-600 font-bold bg-red-50 p-2.5 rounded-lg border border-red-200">
                    {editBgError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-charcoal/10">
                  <button
                    type="button"
                    onClick={() => setEditingBg(null)}
                    className="px-4 py-2 border-2 border-charcoal text-xs font-bold rounded-lg hover:bg-gray-100"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={isSavingBgAnimation || editBgColumns * editBgRows > 12}
                    onClick={handleSaveBackgroundAnimation}
                    className="px-4 py-2 bg-sage-500 hover:bg-sage-600 disabled:opacity-50 text-white font-bold text-xs uppercase rounded-lg border-2 border-charcoal shadow-pixel-sm transition-transform active:scale-95 flex items-center gap-1.5"
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
          {stats && <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-6 font-sans shadow-sm">
            <h3 className="font-extrabold text-sm text-charcoal flex items-center gap-2">
              <Server size={18} className="text-indigo-500" /> Giám sát hiệu suất máy chủ
            </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-cream-100 border border-charcoal rounded-lg">
              <div className="font-extrabold text-xl text-terracotta-500">{stats.counts?.totalUsers}</div>
              <div className="text-[11px] text-gray-600 mt-1 font-bold">Người Dùng</div>
            </div>
            <div className="p-3 bg-cream-100 border border-charcoal rounded-lg">
              <div className="font-extrabold text-xl text-sage-500">{stats.counts?.activePets}</div>
              <div className="text-[11px] text-gray-600 mt-1 font-bold">Thú Cưng Hoạt Động</div>
            </div>
            <div className="p-3 bg-cream-100 border border-charcoal rounded-lg">
              <div className="font-extrabold text-xl text-indigo-500">{stats.counts?.totalWorkSessions}</div>
              <div className="text-[11px] text-gray-600 mt-1 font-bold">Phiên Pomodoro</div>
            </div>
            <div className="p-3 bg-cream-100 border border-charcoal rounded-lg">
              <div className="font-extrabold text-xl text-yellow-600">{stats.system?.memoryUsagePercent}%</div>
              <div className="text-[11px] text-gray-600 mt-1 font-bold">Sử Dụng RAM Máy Chủ</div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg text-xs font-mono space-y-1 text-gray-700">
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
        </div>
      </div>
    </div>
  );
};
