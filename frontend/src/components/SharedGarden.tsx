import React, { useState, useEffect } from 'react';
import { PixelPetCanvas } from './PixelPetCanvas';
import { PixelArtBackground } from './PixelArtBackground';
import { SharedGardenData, GardenBackground, UserPet } from '../types';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import { TreePine, Gift, Image as ImageIcon, Sparkles, Trophy, Users, RefreshCw } from 'lucide-react';

interface SharedGardenProps {
  currentUserPet?: UserPet;
  onRefreshPet?: () => void;
  canChangeBackground?: boolean;
}

export const SharedGarden: React.FC<SharedGardenProps> = ({
  currentUserPet,
  onRefreshPet,
  canChangeBackground = false
}) => {
  const [gardenData, setGardenData] = useState<SharedGardenData | null>(null);
  const [backgrounds, setBackgrounds] = useState<GardenBackground[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPetToGift, setSelectedPetToGift] = useState<any | null>(null);
  const [giftMessage, setGiftMessage] = useState('Cố lên nhé đồng nghiệp ơi!');
  const [showBgSelector, setShowBgSelector] = useState(false);

  const fetchGarden = async () => {
    try {
      setIsLoading(true);
      const res = await api.getGarden();
      setGardenData(res.data);
    } catch (err) {
      console.error('Failed to load garden:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBackgrounds = async () => {
    try {
      const res = await api.getGardenBackgrounds();
      setBackgrounds(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchGarden();
    fetchBackgrounds();

    // Listen to real-time garden events
    const socket = getSocket();
    if (gardenData?.departmentId) {
      socket.emit('join_garden', gardenData.departmentId);
    }

    socket.on('pet_updated', (data: any) => {
      setGardenData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          pets: prev.pets.map(p => (p.id === data.petId ? { ...p, currentState: data.state } : p))
        };
      });
    });

    socket.on('garden_leveled_up', () => {
      fetchGarden();
    });

    return () => {
      socket.off('pet_updated');
      socket.off('garden_leveled_up');
    };
  }, []);

  const handleChangeBackground = async (bgId: string) => {
    try {
      await api.setGardenBackground(bgId);
      setShowBgSelector(false);
      fetchGarden();
    } catch (err) {
      alert('Lỗi thay đổi bối cảnh');
    }
  };

  const handleSendGift = async () => {
    if (!selectedPetToGift) return;
    try {
      await api.sendGift({
        receiverId: selectedPetToGift.ownerId,
        itemId: 'item_fish_01',
        message: giftMessage
      });
      alert(`Đã gửi quà tặng bé cưng của ${selectedPetToGift.ownerName}! (+20 EXP cho Khu Vườn)`);
      setSelectedPetToGift(null);
      fetchGarden();
      if (onRefreshPet) onRefreshPet();
    } catch (err) {
      alert('Lỗi gửi quà');
    }
  };

  if (isLoading || !gardenData) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-charcoal">
        <div className="animate-spin text-3xl mb-2 font-pixel">🌸</div>
        <div className="font-pixel text-xs">Đang tải Khu Vườn Ảo Phòng Ban...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Top Header Card: Level, Synergy Buff & Stats */}
      <div className="bg-white border-2 border-charcoal rounded-xl shadow-pixel p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sage-100 border-2 border-charcoal rounded-xl text-sage-600">
            <TreePine size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-pixel text-sm text-charcoal">{gardenData.departmentName}</h2>
              <span className="font-pixel text-[10px] px-2 py-0.5 bg-terracotta-400 text-white rounded-full">
                Cấp {gardenData.gardenLevel}
              </span>
            </div>
            <div className="text-xs text-gray-500 font-sans mt-0.5">
              Khu vườn chung nơi thú cưng phòng ban cùng sinh hoạt & tích lũy EXP
            </div>
          </div>
        </div>

        {/* Buff & Controls */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-yellow-50 border-2 border-yellow-500 rounded-lg text-xs font-bold text-yellow-800 flex items-center gap-1.5">
            <Sparkles size={14} className="text-yellow-600" />
            Buff Tập Thể: <span className="font-pixel text-terracotta-500 text-sm">x{gardenData.buffMultiplier}</span> EXP
          </div>

          {canChangeBackground ? (
            <button
              onClick={() => setShowBgSelector(true)}
              className="px-3 py-1.5 bg-sage-400 hover:bg-sage-500 text-white text-xs font-pixel rounded-lg border-2 border-charcoal shadow-pixel-sm flex items-center gap-1.5 transition-transform active:scale-95"
              title="Đổi bối cảnh pixel"
            >
              <ImageIcon size={14} /> Bối cảnh
            </button>
          ) : (
            <span className="text-[10px] text-gray-500" title="Thành viên phòng ban có thể chọn bối cảnh chung">
              Thành viên có thể đổi bối cảnh
            </span>
          )}
          <button
            onClick={fetchGarden}
            className="p-1.5 bg-gray-100 hover:bg-gray-200 text-charcoal rounded-lg border border-charcoal"
            title="Làm mới"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* EXP Progress Bar toward next Garden Level */}
      <div className="bg-white border-2 border-charcoal rounded-lg p-2.5 shadow-pixel-sm flex items-center gap-3 text-xs">
        <span className="font-pixel text-[10px] text-gray-600 whitespace-nowrap">
          Tiến trình Khu Vườn:
        </span>
        <div className="flex-1 bg-gray-200 h-3.5 border border-charcoal rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-sage-400 to-terracotta-400 h-full transition-all duration-500"
            style={{ width: `${gardenData.expProgress}%` }}
          />
        </div>
        <span className="font-pixel text-[10px] text-terracotta-600 whitespace-nowrap">
          {gardenData.gardenExp} / {gardenData.expNeededForNextLevel} EXP ({gardenData.expProgress}%)
        </span>
      </div>

      {/* Main Pixel Art Shared Garden Stage */}
      <div
        className="relative w-full h-[460px] border-4 border-charcoal rounded-2xl shadow-pixel-lg overflow-hidden bg-cover bg-center select-none"
        style={{
          backgroundImage: `url(${gardenData.background?.imageUrl || '/backgrounds/garden_spring.png'})`,
          imageRendering: 'pixelated'
        }}
      >
        <PixelArtBackground
          imageUrl={gardenData.background?.imageUrl || '/backgrounds/garden_spring.png'}
        />
        {/* Background Name Badge */}
        <div className="absolute top-3 left-3 bg-pixelDark/80 backdrop-blur-sm text-white px-3 py-1 rounded-md text-[11px] font-pixel border border-white/20">
          📍 {gardenData.background?.name || 'Khu Vườn Mùa Xuân'}
        </div>

        {/* Roaming Pets in the Garden */}
        {gardenData.pets.map((p, idx) => {
          // Calculate varied positions across garden stage
          const defaultLefts = [20, 50, 78, 35, 65];
          const leftPercent = p.positionX || defaultLefts[idx % defaultLefts.length];
          const topPercent = p.positionY || 62 + (idx % 3) * 6;

          return (
            <div
              key={p.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all hover:scale-105"
              style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
              onClick={() => !p.isCurrentUsersPet && setSelectedPetToGift(p)}
            >
              {/* Pet Info Tag above pet */}
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white/90 border border-charcoal rounded px-1.5 py-0.5 text-[9px] font-bold text-charcoal whitespace-nowrap shadow-sm flex items-center gap-1">
                <span>{p.name}</span>
                <span className="text-terracotta-500 text-[8px] font-pixel">Lv.{p.level}</span>
                {p.isCurrentUsersPet && <span className="text-[7px] text-green-600 font-bold">(Bạn)</span>}
              </div>

              {/* Pixel Pet Renderer */}
              <PixelPetCanvas
                petType={p.petType}
                currentState={p.currentState}
                scaleSize="MEDIUM"
                petName={p.name}
                petLevel={p.level}
                showTooltip={false}
              />

              {/* Owner Avatar Pill */}
              <div className="mt-1 text-center text-[10px] text-white font-bold bg-charcoal/70 px-1.5 rounded-full backdrop-blur-sm truncate max-w-[90px] mx-auto">
                {p.ownerName}
              </div>
            </div>
          );
        })}
      </div>

      {/* Select Background Modal */}
      {canChangeBackground && showBgSelector && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-4 border-charcoal rounded-xl shadow-pixel-lg max-w-lg w-full p-6 animate-in zoom-in-95">
            <h3 className="font-pixel text-sm text-charcoal mb-4 flex items-center gap-2">
              <ImageIcon size={18} className="text-sage-500" /> Chọn bối cảnh chung cho phòng ban
            </h3>
            <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto p-1">
              {backgrounds.map(bg => (
                <div
                  key={bg.id}
                  onClick={() => handleChangeBackground(bg.id)}
                  className={`border-2 rounded-lg p-2 cursor-pointer transition-all hover:border-terracotta-400 ${
                    gardenData.background?.id === bg.id
                      ? 'border-terracotta-500 ring-2 ring-terracotta-300'
                      : 'border-charcoal'
                  }`}
                >
                  <img
                    src={bg.imageUrl}
                    alt={bg.name}
                    className="w-full h-24 object-cover rounded border border-charcoal mb-1.5"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <div className="font-bold text-xs text-charcoal truncate">{bg.name}</div>
                  {bg.isRecommended && (
                    <span className="text-[9px] font-pixel text-yellow-600">⭐ Đề xuất</span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowBgSelector(false)}
                className="px-4 py-1.5 text-xs font-pixel bg-gray-200 border-2 border-charcoal rounded-lg"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gift Colleague's Pet Modal (US-U12) */}
      {selectedPetToGift && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-4 border-charcoal rounded-xl shadow-pixel-lg max-w-sm w-full p-6 animate-in zoom-in-95">
            <h3 className="font-pixel text-xs text-charcoal mb-2 flex items-center gap-2">
              <Gift size={16} className="text-terracotta-400" /> Tặng Quà Cho Bé {selectedPetToGift.name}
            </h3>
            <p className="text-xs text-gray-600 mb-3">
              Chủ nhân: <strong className="text-charcoal">{selectedPetToGift.ownerName}</strong>
            </p>
            <div className="mb-3">
              <label className="text-[11px] font-bold text-gray-700 block mb-1">Lời nhắn khích lệ:</label>
              <input
                type="text"
                value={giftMessage}
                onChange={e => setGiftMessage(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border-2 border-charcoal rounded-lg focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSelectedPetToGift(null)}
                className="px-3 py-1.5 text-xs bg-gray-200 border-2 border-charcoal rounded-lg"
              >
                Hủy
              </button>
              <button
                onClick={handleSendGift}
                className="px-3 py-1.5 text-xs font-pixel bg-terracotta-400 hover:bg-terracotta-500 text-white border-2 border-charcoal rounded-lg shadow-pixel-sm"
              >
                Gửi Quà (+20 EXP Vườn)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
