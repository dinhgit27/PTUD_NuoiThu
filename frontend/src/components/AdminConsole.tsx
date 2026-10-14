import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Sliders, CheckCircle, Eye, Trash2, Plus, Server, Users, RefreshCw, Upload, Image as ImageIcon, FileText, ShoppingBag, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import { PetType, GardenBackground, AnimationState } from '../types';
import { PixelPetCanvas } from './PixelPetCanvas';
import { AdminShopManagement } from './AdminShopManagement';
import { AdminAccessManagement } from './AdminAccessManagement';

export const AdminConsole: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'FORGE' | 'CONFIG' | 'BACKGROUNDS' | 'SHOP' | 'ACCESS' | 'SYSTEM'>('SYSTEM');
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
  const [imagePetDesc, setImagePetDesc] = useState('Thú cưng pixel art sinh từ hình ảnh tham chiếu');
  const [isImageGenerating, setIsImageGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pet Types Management
  const [petTypes, setPetTypes] = useState<PetType[]>([]);
  const [selectedPetType, setSelectedPetType] = useState<PetType | null>(null);
  const [previewState, setPreviewState] = useState<AnimationState>('IDLE');

  // Backgrounds Management
  const [backgrounds, setBackgrounds] = useState<GardenBackground[]>([]);
  const [newBgName, setNewBgName] = useState('');
  const [newBgUrl, setNewBgUrl] = useState('');
  const [newBgFile, setNewBgFile] = useState<File | null>(null);
  const [newBgDesc, setNewBgDesc] = useState('');

  // System Stats
  const [stats, setStats] = useState<any | null>(null);

  useEffect(() => {
    loadPetTypes();
    loadBackgrounds();
    loadStats();
  }, []);

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

      const res = await api.generateSpriteFromImage(formData);
      setGeneratedResult(res.data);
      alert('Sinh Thú Cưng 2D Pixel Art từ hình ảnh thành công!');
      loadPetTypes();
    } catch (err: any) {
      alert(`Lỗi sinh Sprite từ ảnh: ${err?.response?.data?.error || err.message}`);
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
      if (newBgFile) {
        const formData = new FormData();
        formData.append('name', newBgName.trim());
        formData.append('description', newBgDesc);
        formData.append('isRecommended', 'true');
        formData.append('image', newBgFile);
        await api.uploadAdminBackground(formData);
      } else {
        await api.addAdminBackground({
          name: newBgName.trim(),
          imageUrl: newBgUrl.trim(),
          description: newBgDesc,
          isRecommended: true
        });
      }
      setNewBgName('');
      setNewBgUrl('');
      setNewBgFile(null);
      setNewBgDesc('');
      loadBackgrounds();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Lỗi thêm bối cảnh');
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

  const handleToggleRecommend = async (id: string, currentVal: boolean) => {
    try {
      await api.recommendBackground(id, !currentVal);
      loadBackgrounds();
    } catch (err) {
      alert('Lỗi cập nhật đề xuất');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Admin Navigation Tabs */}
      <div className="flex flex-wrap border-2 border-charcoal rounded-xl bg-white p-1 shadow-pixel font-sans font-bold text-xs uppercase tracking-wide">
        <button
          onClick={() => setActiveTab('FORGE')}
          className={`flex-1 py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
            activeTab === 'FORGE' ? 'bg-terracotta-400 text-white shadow-pixel-sm' : 'hover:bg-cream-100 text-charcoal'
          }`}
        >
          <Sparkles size={16} /> Agent Sprite Forge
        </button>
        <button
          onClick={() => setActiveTab('CONFIG')}
          className={`flex-1 py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
            activeTab === 'CONFIG' ? 'bg-sage-400 text-white shadow-pixel-sm' : 'hover:bg-cream-100 text-charcoal'
          }`}
        >
          <Sliders size={16} /> Quản Lý & Phân Cắt Khung Hình
        </button>
        <button
          onClick={() => setActiveTab('BACKGROUNDS')}
          className={`flex-1 py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
            activeTab === 'BACKGROUNDS' ? 'bg-sage-400 text-white shadow-pixel-sm' : 'hover:bg-cream-100 text-charcoal'
          }`}
        >
          🖼️ Bối Cảnh Khu Vườn
        </button>
        <button
          onClick={() => setActiveTab('SYSTEM')}
          className={`flex-1 py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
            activeTab === 'SYSTEM' ? 'bg-indigo-500 text-white shadow-pixel-sm' : 'hover:bg-cream-100 text-charcoal'
          }`}
        >
          <Server size={16} /> Dashboard quản lý
        </button>
        <button
          onClick={() => setActiveTab('SHOP')}
          className={`flex-1 min-w-36 py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
            activeTab === 'SHOP' ? 'bg-terracotta-400 text-white shadow-pixel-sm' : 'hover:bg-cream-100 text-charcoal'
          }`}
        >
          <ShoppingBag size={16} /> Quản lý Shop
        </button>
        <button
          onClick={() => setActiveTab('ACCESS')}
          className={`flex-1 min-w-36 py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
            activeTab === 'ACCESS' ? 'bg-indigo-500 text-white shadow-pixel-sm' : 'hover:bg-cream-100 text-charcoal'
          }`}
        >
          <ShieldCheck size={16} /> Quản lý quyền
        </button>
      </div>

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
              <Upload size={16} /> Tải Ảnh Lên Để Sinh Thú Cưng Pixel Art
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
                  <Upload size={18} /> Sinh Thú Cưng Từ Hình Ảnh Tham Chiếu
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Tải ảnh tham chiếu để tách nền, lượng hóa thành pixel art và tạo các frame chuyển động từ hình nhân vật đó. Ảnh đơn không thể tự tạo tư thế giải phẫu mới; ảnh rõ, chủ thể lớn và nền tương phản sẽ cho kết quả tốt hơn.
                </p>

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
                        Nhấn để chọn ảnh khác ({imageFile?.name})
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center gap-2 py-3">
                      <div className="p-3 bg-terracotta-100 text-terracotta-500 rounded-full">
                        <ImageIcon size={28} />
                      </div>
                      <div className="text-xs font-bold text-charcoal">
                        Nhấn hoặc kéo thả ảnh thú cưng vào đây
                      </div>
                      <div className="text-[10px] text-gray-500">
                        Hỗ trợ định dạng PNG, JPG, JPEG, WEBP (tối đa 15MB)
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
                      <span className="animate-spin">⏳</span> Đang chuyển ảnh thành sprite...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} /> Tạo Sprite Từ Ảnh Tham Chiếu
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
                  <label className="block text-xs font-bold text-gray-700 mb-1">Mô tả đặc tính & màu sắc (Prompt):</label>
                  <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    rows={3}
                    placeholder="Nhập mô tả hình dáng, phụ kiện, màu sắc..."
                    className="w-full px-3 py-2 text-xs border-2 border-charcoal rounded-lg focus:outline-none font-sans"
                  />
                </div>

                <button
                  onClick={handleGenerateFromPrompt}
                  disabled={isGenerating || !prompt.trim() || !petName.trim()}
                  className="w-full py-2.5 font-bold uppercase text-xs bg-sage-500 hover:bg-sage-600 disabled:opacity-50 text-white rounded-lg border-2 border-charcoal shadow-pixel flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                  {isGenerating ? (
                    <>
                      <span className="animate-spin">⏳</span> Đang chạy Agent Sprite Forge...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} /> Sinh Hoạt Ảnh 17 Trạng Thái
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
                  <span className="px-2 py-0.5 bg-green-100 text-green-800 text-[10px] font-bold rounded border border-green-400">
                    Sẵn sàng
                  </span>
                )}
              </div>

              {generatedResult ? (
                <div className="space-y-4 text-xs">
                  <div className="p-2.5 bg-green-50 border border-green-400 rounded-lg text-green-800 font-bold flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-600" />
                    Đã tạo thành công Sprite Sheet 68 Frames cho 17 trạng thái!
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
                        Loài: <span className="font-bold uppercase text-sage-600">{generatedResult.generatedMeta?.animalType || 'Sinh vật'}</span> | Kích thước: 64x64 px (4 cột x 17 hàng)
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
                        <div className="w-16 h-16 bg-cream-200 rounded-lg border border-charcoal flex items-center justify-center p-1">
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
                  <div className="max-h-56 overflow-y-auto border border-charcoal rounded-lg p-2 bg-cream-100">
                    <img
                      src={generatedResult.generatedMeta?.sheetUrl}
                      alt="Sprite Sheet"
                      className="w-full"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </div>

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
                  <div className="font-bold">Chưa có kết quả sinh hoạt ảnh nào.</div>
                  <div className="text-[11px] text-gray-500">
                    Hãy tải ảnh lên hoặc nhập mô tả ở cột bên trái để bắt đầu tạo thú cưng mới.
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
                    <div>• Khung hình: 64x64 px (4 cột x 17 hàng)</div>
                    <div>• Tỷ lệ tự nhiên: {selectedPetType.naturalAspectRatio || 1.0}</div>
                  </div>
                </div>

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
              <Plus size={18} className="text-sage-500" /> Thêm Bối Cảnh Pixel Art Mới Cho Khu Vườn Chung
            </h3>
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
                accept="image/png,image/jpeg,image/webp"
                onChange={event => setNewBgFile(event.target.files?.[0] || null)}
                className="block w-full mt-1 text-xs"
              />
            </label>
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
                <img
                  src={bg.imageUrl}
                  alt={bg.name}
                  className="w-full h-36 object-cover rounded-lg border border-charcoal"
                  style={{ imageRendering: 'pixelated' }}
                />
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-charcoal">{bg.name}</h4>
                    <p className="text-xs text-gray-500">{bg.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
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
        </div>
      )}

      {/* Tab 4: System Monitor */}
      {activeTab === 'SYSTEM' && stats && (
        <div className="bg-white border-2 border-charcoal rounded-xl shadow-pixel p-5 space-y-6 font-sans">
          <h3 className="font-extrabold text-sm text-charcoal flex items-center gap-2 uppercase">
            <Server size={18} className="text-indigo-500" /> Giám Sát Hiệu Suất Hệ Thống (US-A07)
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
        </div>
      )}
      {activeTab === 'SHOP' && <AdminShopManagement />}
      {activeTab === 'ACCESS' && <AdminAccessManagement />}
    </div>
  );
};
