import React, { useEffect, useRef, useState } from 'react';
import { AnimationConfig, AnimationState, PetType, ShopItem, UserItem } from '../types';

export const STATE_FALLBACK: Record<string, string> = {
  YAWNING: 'SLEEPING',
  WAKING_UP: 'IDLE',
  EXERCISING: 'DANCING',
  THANKING: 'HAPPY',
  CELEBRATING: 'HAPPY',
  EVOLVING: 'HAPPY',
};

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
  const [showInfo, setShowInfo] = useState(false);
  const [hearts, setHearts] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [wanderOffset, setWanderOffset] = useState({ x: 0, y: 0 });
  const spriteImageRef = useRef<HTMLImageElement | null>(null);

  // Fit the frame into the selected size without distorting rectangular sprite cells.
  const configuredAspectRatio = petType?.naturalAspectRatio;
  const naturalAspectRatio = configuredAspectRatio && Number.isFinite(configuredAspectRatio) && configuredAspectRatio > 0
    ? configuredAspectRatio
    : 1;
  let baseSize = 128;
  if (scaleSize === 'SMALL') baseSize = 96;
  if (scaleSize === 'LARGE') baseSize = 192;

  const renderWidth = Math.max(1, Math.round(naturalAspectRatio >= 1 ? baseSize : baseSize * naturalAspectRatio));
  const renderHeight = Math.max(1, Math.round(naturalAspectRatio >= 1 ? baseSize / naturalAspectRatio : baseSize));

  // Check if a full skin is equipped (either pet-specific or generic)
  const equippedSkinItem = equippedItems.find(({ item }) => item.itemType === 'SKIN')?.item;
  const petSheetForSkin = (petType?.id && equippedSkinItem?.petSheets) ? equippedSkinItem.petSheets[petType.id] : null;
  const effectiveSkinSheetUrl = petSheetForSkin?.spriteSheetUrl || equippedSkinItem?.spriteSheetUrl;
  const effectiveSkinFrameConfig = petSheetForSkin?.frameConfig || equippedSkinItem?.frameConfig;
  const effectiveSkinAnimations = petSheetForSkin?.animations || equippedSkinItem?.animations;

  const effectiveSpriteSheetUrl = effectiveSkinSheetUrl || petType?.spriteSheetUrl;
  const effectiveFrameConfig = (effectiveSkinSheetUrl ? effectiveSkinFrameConfig : petType?.frameConfig) || petType?.frameConfig;
  const effectiveAnimations = (effectiveSkinSheetUrl ? effectiveSkinAnimations : petType?.animations) || petType?.animations;

  const frameWidth = effectiveFrameConfig?.frameWidth || 64;
  const frameHeight = effectiveFrameConfig?.frameHeight || 64;
  const totalColumns = effectiveFrameConfig?.totalColumns || 12;

  // Load sprite sheet image
  useEffect(() => {
    if (!effectiveSpriteSheetUrl) return;

    const img = new Image();
    img.src = effectiveSpriteSheetUrl;
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      spriteImageRef.current = img;
      setImgLoaded(true);
    };
    img.onerror = () => {
      console.warn('Failed to load sprite sheet:', effectiveSpriteSheetUrl);
    };
  }, [effectiveSpriteSheetUrl]);

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

    // 1:1 Native pixel buffer to ensure true nearest-neighbor upscaling without downsampling blur
    const nativeWidth = frameWidth || 64;
    const nativeHeight = frameHeight || 64;
    if (canvas.width !== nativeWidth || canvas.height !== nativeHeight) {
      canvas.width = nativeWidth;
      canvas.height = nativeHeight;
    }
    ctx.imageSmoothingEnabled = false;
    (ctx as any).mozImageSmoothingEnabled = false;
    (ctx as any).webkitImageSmoothingEnabled = false;
    (ctx as any).msImageSmoothingEnabled = false;

    const rawState = currentState === 'WALKING' ? 'IDLE' : currentState;
    const fallbackState = STATE_FALLBACK[rawState] || 'IDLE';
    const animConfig = effectiveAnimations?.[rawState] || effectiveAnimations?.[fallbackState] || effectiveAnimations?.['IDLE'] || {
      row: 0,
      frames: [0, 1, 2, 3, 4, 5],
      fps: 6,
      loop: true
    };

    const frames = animConfig.frames || [0, 1, 2, 3, 4, 5];
    const fps = animConfig.fps || 6;
    const frameInterval = 1000 / fps;

    let currentFrameIndex = 0;
    let lastTime = performance.now();
    let animationFrameId: number;

    const render = (time: number) => {
      const delta = time - lastTime;
      if (delta >= frameInterval) {
        lastTime = time - (delta % frameInterval);

        currentFrameIndex = animConfig.loop
          ? (currentFrameIndex + 1) % frames.length
          : Math.min(currentFrameIndex + 1, frames.length - 1);
      }

      const globalFrameIdx = frames[currentFrameIndex];
      const col = globalFrameIdx % totalColumns;
      const row = Math.floor(globalFrameIdx / totalColumns);

      const sx = col * frameWidth;
      const sy = row * frameHeight;

      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, nativeWidth, nativeHeight);

      if (spriteImageRef.current) {
        ctx.drawImage(
          spriteImageRef.current,
          sx,
          sy,
          frameWidth,
          frameHeight,
          0,
          0,
          nativeWidth,
          nativeHeight
        );
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [imgLoaded, currentState, petType, renderWidth, renderHeight, frameWidth, frameHeight, totalColumns]);

  useEffect(() => {
    if (!showInfo) return;
    const timer = setTimeout(() => {
      setShowInfo(false);
    }, 6000);
    return () => clearTimeout(timer);
  }, [showInfo]);

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
    setShowInfo(prev => !prev);
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
        transform: `translate3d(${Math.round(wanderOffset.x)}px, ${Math.round(wanderOffset.y)}px, 0)`,
        transition: 'transform 900ms ease-in-out',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
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

      {/* Pixel Ground Shadow */}
      <div className="absolute bottom-1 w-20 h-3 bg-charcoal/20 rounded-full pointer-events-none -z-10" />

      {/* Pixel Canvas */}
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{
          imageRendering: 'pixelated',
          width: `${renderWidth}px`,
          height: `${renderHeight}px`,
          transform: facingDirection === 'left' ? 'scaleX(-1)' : 'none',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
        className="pixel-canvas transition-transform duration-100 active:scale-95"
      />

      {equippedItems
        .filter(({ item }) => item.itemType !== 'FOOD' && (!effectiveSkinSheetUrl || item.itemType !== 'SKIN'))
        .map(({ id, item }) => {
          const style = getEquippedItemStyle(item.equipSlot, item.itemType);
          const petSheet = (petType?.id && item.petSheets) ? item.petSheets[petType.id] : null;
          const sheetUrl = petSheet?.spriteSheetUrl || item.spriteSheetUrl;
          const sheetConfig = petSheet?.frameConfig || item.frameConfig;
          const sheetAnims = petSheet?.animations || item.animations;

          if (sheetUrl && sheetConfig && sheetAnims) {
            return (
              <AnimatedEquipmentLayer
                key={id}
                item={{
                  ...item,
                  spriteSheetUrl: sheetUrl,
                  frameConfig: sheetConfig,
                  animations: sheetAnims
                }}
                currentState={currentState}
                width={renderWidth}
                height={renderHeight}
                style={style}
              />
            );
          }
          return (
            <img
              key={id}
              src={item.imageUrl}
              alt={item.name}
              title={item.name}
              className={`pixel-art pet-equipment-layer pet-equipment-${item.effect || 'NONE'}`}
              style={{
                imageRendering: 'pixelated',
                willChange: 'transform',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                ...style
              }}
            />
          );
        })}

      {/* Click-to-show Info Box (US-U02: AC4) */}
      {showTooltip && showInfo && (
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

interface AnimatedEquipmentLayerProps {
  item: ShopItem;
  currentState: AnimationState;
  width: number;
  height: number;
  style: React.CSSProperties;
}

const AnimatedEquipmentLayer: React.FC<AnimatedEquipmentLayerProps> = ({
  item,
  currentState,
  width,
  height,
  style
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const frameConfig = item.frameConfig;
  const animations = item.animations;

  useEffect(() => {
    if (!item.spriteSheetUrl) return;
    const image = new Image();
    image.src = item.spriteSheetUrl;
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      imageRef.current = image;
      setImageLoaded(true);
    };
    image.onerror = () => console.warn('Failed to load equipment sprite sheet:', item.spriteSheetUrl);
    return () => {
      image.onload = null;
      image.onerror = null;
      imageRef.current = null;
      setImageLoaded(false);
    };
  }, [item.spriteSheetUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    const rawState = currentState === 'WALKING' ? 'IDLE' : currentState;
    const fallbackState = STATE_FALLBACK[rawState] || 'IDLE';
    const animation: AnimationConfig | undefined = animations?.[rawState] || animations?.[fallbackState] || animations?.IDLE;
    if (!imageLoaded || !canvas || !image || !frameConfig || !animation || animation.frames.length === 0) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const fWidth = frameConfig.frameWidth || 64;
    const fHeight = frameConfig.frameHeight || 64;
    if (canvas.width !== fWidth || canvas.height !== fHeight) {
      canvas.width = fWidth;
      canvas.height = fHeight;
    }
    context.imageSmoothingEnabled = false;
    (context as any).mozImageSmoothingEnabled = false;
    (context as any).webkitImageSmoothingEnabled = false;
    (context as any).msImageSmoothingEnabled = false;

    const frameDuration = 1000 / Math.max(1, animation.fps || 6);
    let frameIndex = 0;
    let lastTime = performance.now();
    let animationFrameId = 0;

    const render = (time: number) => {
      if (time - lastTime >= frameDuration) {
        lastTime = time - ((time - lastTime) % frameDuration);
        frameIndex = animation.loop
          ? (frameIndex + 1) % animation.frames.length
          : Math.min(frameIndex + 1, animation.frames.length - 1);
      }
      const globalFrame = animation.frames[frameIndex] ?? 0;
      const totalCols = frameConfig.totalColumns || 12;
      const sourceX = (globalFrame % totalCols) * fWidth;
      const sourceY = Math.floor(globalFrame / totalCols) * fHeight;
      context.clearRect(0, 0, fWidth, fHeight);
      context.drawImage(
        image,
        sourceX,
        sourceY,
        fWidth,
        fHeight,
        0,
        0,
        fWidth,
        fHeight
      );
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [imageLoaded, currentState, animations, frameConfig]);

  return (
    <canvas
      ref={canvasRef}
      width={frameConfig?.frameWidth || 64}
      height={frameConfig?.frameHeight || 64}
      title={item.name}
      aria-label={item.name}
      className={`pixel-canvas pet-equipment-layer pet-equipment-${item.effect || 'NONE'}`}
      style={{
        imageRendering: 'pixelated',
        pointerEvents: 'none',
        width: '100%',
        height: '100%',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        ...style
      }}
    />
  );
};
