import React, { useEffect, useRef, useState } from 'react';
import { AnimationState, PetType, UserItem } from '../types';

interface PixelPetCanvasProps {
  petType?: PetType;
  currentState?: AnimationState;
  scaleSize?: 'SMALL' | 'MEDIUM' | 'LARGE';
  speechBubble?: string | null;
  onPetClick?: () => void;
  showTooltip?: boolean;
  petName?: string;
  petLevel?: number;
  hunger?: number;
  happiness?: number;
  facingDirection?: 'left' | 'right';
  equippedItems?: UserItem[];
}

export const PixelPetCanvas: React.FC<PixelPetCanvasProps> = ({
  petType,
  currentState = 'IDLE',
  scaleSize = 'MEDIUM',
  speechBubble,
  onPetClick,
  showTooltip = true,
  petName = 'Pixel Pet',
  petLevel = 1,
  hunger = 80,
  happiness = 100,
  facingDirection = 'right',
  equippedItems = []
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hearts, setHearts] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [wanderOffset, setWanderOffset] = useState({ x: 0, y: 0 });
  const spriteImageRef = useRef<HTMLImageElement | null>(null);

  // Determine dynamic render dimensions in range 100px to 150px based on aspect ratio & scaleSize
  const naturalAspectRatio = petType?.naturalAspectRatio || 1.0;
  let baseSize = 120;
  if (scaleSize === 'SMALL') baseSize = 100;
  if (scaleSize === 'LARGE') baseSize = 150;

  let renderWidth = baseSize;
  let renderHeight = Math.round(baseSize / naturalAspectRatio);

  // Clamp within [100px, 150px]
  renderWidth = Math.max(100, Math.min(150, renderWidth));
  renderHeight = Math.max(100, Math.min(150, renderHeight));

  const frameWidth = petType?.frameConfig?.frameWidth || 64;
  const frameHeight = petType?.frameConfig?.frameHeight || 64;
  const totalColumns = petType?.frameConfig?.totalColumns || 4;

  // Load sprite sheet image
  useEffect(() => {
    if (!petType?.spriteSheetUrl) return;

    const img = new Image();
    img.src = petType.spriteSheetUrl;
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      spriteImageRef.current = img;
      setImgLoaded(true);
    };
    img.onerror = () => {
      console.warn('Failed to load sprite sheet:', petType.spriteSheetUrl);
    };
  }, [petType?.spriteSheetUrl]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    let mounted = true;
    const wander = () => {
      timeout = setTimeout(() => {
        if (!mounted) return;
        setWanderOffset({
          x: Math.round((Math.random() - 0.5) * 22),
          y: Math.round((Math.random() - 0.5) * 12)
        });
        wander();
      }, 5000 + Math.random() * 7000);
    };
    wander();
    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, []);

  // Animation Loop
  useEffect(() => {
    if (!imgLoaded || !spriteImageRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Crisp pixel art settings
    ctx.imageSmoothingEnabled = false;

    const animConfig = petType?.animations?.[currentState] || (
      currentState === 'WALKING' && petType?.animations?.['EXERCISING']
        ? { ...petType.animations['EXERCISING'], fps: 8 }
        : currentState === 'WALKING' && petType?.animations?.['DANCING']
        ? { ...petType.animations['DANCING'], fps: 8 }
        : {
            row: 0,
            frames: [0, 1, 2, 3],
            fps: 6,
            loop: true
          }
    );

    const frames = animConfig.frames || [0, 1, 2, 3];
    const fps = animConfig.fps || 6;
    const frameInterval = 1000 / fps;

    let currentFrameIndex = 0;
    let lastTime = performance.now();
    let animationFrameId: number;

    const render = (time: number) => {
      const delta = time - lastTime;
      if (delta >= frameInterval) {
        lastTime = time - (delta % frameInterval);

        currentFrameIndex = (currentFrameIndex + 1) % frames.length;
        if (!animConfig.loop && currentFrameIndex === frames.length - 1) {
          // Keep on last frame for one-shots
          currentFrameIndex = frames.length - 1;
        }
      }

      const globalFrameIdx = frames[currentFrameIndex];
      const col = globalFrameIdx % totalColumns;
      const row = Math.floor(globalFrameIdx / totalColumns);

      const sx = col * frameWidth;
      const sy = row * frameHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (spriteImageRef.current) {
        ctx.drawImage(
          spriteImageRef.current,
          sx,
          sy,
          frameWidth,
          frameHeight,
          0,
          0,
          renderWidth,
          renderHeight
        );
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [imgLoaded, currentState, petType, renderWidth, renderHeight, frameWidth, frameHeight, totalColumns]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const newHeart = { id: Date.now() + Math.random(), x: clickX, y: clickY };
      setHearts(prev => [...prev, newHeart]);
      setTimeout(() => {
        setHearts(prev => prev.filter(h => h.id !== newHeart.id));
      }, 1000);
    }
    if (onPetClick) onPetClick();
  };

  const getEquippedItemStyle = (slot: UserItem['item']['equipSlot'], itemType: string): React.CSSProperties => {
    const resolvedSlot = slot === 'AUTO'
      ? itemType === 'SKIN' ? 'BODY' : itemType === 'HAT' ? 'HEAD' : 'AURA'
      : slot || (itemType === 'SKIN' ? 'BODY' : itemType === 'HAT' ? 'HEAD' : 'AURA');
    const positions: Record<string, React.CSSProperties> = {
      BODY: { inset: 0, width: '100%', height: '100%' },
      HEAD: { top: '1%', left: '25%', width: '50%', height: '42%' },
      HAND: { top: '38%', right: '-12%', width: '38%', height: '38%' },
      FEET: { bottom: '-3%', left: '30%', width: '40%', height: '30%' },
      AURA: { inset: '-8%', width: '116%', height: '116%' }
    };
    return {
      position: 'absolute',
      objectFit: 'contain',
      imageRendering: 'pixelated',
      pointerEvents: 'none',
      ...(positions[resolvedSlot] || positions.AURA),
      transform: facingDirection === 'left' ? 'scaleX(-1)' : undefined
    };
  };

  return (
    <div
      className="relative inline-flex flex-col items-center select-none cursor-pointer group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: renderWidth,
        height: renderHeight,
        transform: `translate(${wanderOffset.x}px, ${wanderOffset.y}px)`,
        transition: 'transform 900ms ease-in-out'
      }}
    >
      {/* Interactive Speech Bubble */}
      {speechBubble && (
        <div className="absolute -top-14 left-1/2 z-20 w-max max-w-[260px] -translate-x-1/2 whitespace-normal break-words rounded-lg border-2 border-charcoal bg-white px-3 py-1.5 text-center text-xs font-bold text-charcoal shadow-pixel-sm font-sans">
          {speechBubble}
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-r-2 border-b-2 border-charcoal rotate-45" />
        </div>
      )}

      {/* Floating Hearts on Petting */}
      {hearts.map(h => (
        <span
          key={h.id}
          className="absolute z-30 pointer-events-none text-red-500 font-bold text-sm animate-ping font-pixel"
          style={{ left: h.x, top: h.y }}
        >
          ❤️
        </span>
      ))}

      {/* Pixel Canvas */}
      <canvas
        ref={canvasRef}
        width={renderWidth}
        height={renderHeight}
        onClick={handleCanvasClick}
        style={{
          imageRendering: 'pixelated',
          width: `${renderWidth}px`,
          height: `${renderHeight}px`,
          transform: facingDirection === 'left' ? 'scaleX(-1)' : 'none',
        }}
        className="transition-transform duration-100 active:scale-95 filter drop-shadow-[0_4px_4px_rgba(0,0,0,0.15)]"
      />

      {equippedItems.filter(({ item }) => item.itemType !== 'FOOD').map(({ id, item }) => (
        <img
          key={id}
          src={item.imageUrl}
          alt={item.name}
          title={item.name}
          className={`pet-equipment-layer pet-equipment-${item.effect || 'NONE'}`}
          style={getEquippedItemStyle(item.equipSlot, item.itemType)}
        />
      ))}

      {/* Hover Tooltip (US-U02: AC4) */}
      {showTooltip && isHovered && (
        <div className="absolute -bottom-20 z-30 w-44 p-2 bg-pixelDark text-white border-2 border-sage-400 rounded-md shadow-pixel text-[10px] pointer-events-none font-sans">
          <div className="font-pixel text-[9px] text-terracotta-400 truncate mb-1">
            {petName} (Lv.{petLevel})
          </div>
          <div className="flex justify-between text-gray-300">
            <span>Đói:</span>
            <span className={hunger < 30 ? 'text-red-400 font-bold' : 'text-green-400'}>
              {hunger}%
            </span>
          </div>
          <div className="flex justify-between text-gray-300">
            <span>Hạnh phúc:</span>
            <span className="text-yellow-400">{happiness}%</span>
          </div>
          <div className="mt-1 pt-1 border-t border-gray-700 text-gray-400 truncate">
            Trạng thái: <span className="text-sage-300 font-bold">{currentState}</span>
          </div>
        </div>
      )}
    </div>
  );
};
