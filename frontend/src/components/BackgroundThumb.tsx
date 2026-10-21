import React, { useEffect, useRef } from 'react';

interface BackgroundThumbProps {
  imageUrl: string;
  thumbnailUrl?: string | null;
  name?: string;
  animationFrames?: number;
  animationFps?: number;
  animationColumns?: number;
  animationRows?: number;
  className?: string;
}

/**
 * Lightweight 2D-canvas preview of a background. For animated sprite sheets it
 * crops a single frame out of the (columns x rows) grid with "cover" scaling
 * (no distortion) and cycles through the frames at the configured FPS.
 * A 2D canvas is used instead of WebGL because lists can show many cards at
 * once and browsers cap the number of live WebGL contexts.
 */
export const BackgroundThumb: React.FC<BackgroundThumbProps> = ({
  imageUrl,
  thumbnailUrl,
  name,
  animationFrames = 1,
  animationFps = 0,
  animationColumns,
  animationRows = 1,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const columns = Math.max(1, Math.floor(animationColumns || animationFrames || 1));
    const rows = Math.max(1, Math.floor(animationRows || 1));
    const frameCount = Math.max(1, Math.min(columns * rows, Math.floor(animationFrames || columns * rows)));
    const fps = Math.max(0, Math.min(12, Math.floor(animationFps)));
    const animated = frameCount > 1 && fps > 0 &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Static backgrounds may have a dedicated thumbnail; animated ones always use the sheet.
    const src = frameCount > 1 ? imageUrl : (thumbnailUrl || imageUrl);
    const gridColumns = frameCount > 1 ? columns : 1;
    const gridRows = frameCount > 1 ? rows : 1;

    let frame = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    let disposed = false;

    const draw = () => {
      if (!image.complete || !image.naturalWidth) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const frameWidth = image.naturalWidth / gridColumns;
      const frameHeight = image.naturalHeight / gridRows;
      const sx = (frame % gridColumns) * frameWidth;
      const sy = Math.floor(frame / gridColumns) * frameHeight;

      // "cover": crop the overflowing axis of the frame, centered.
      const viewAspect = width / height;
      const frameAspect = frameWidth / frameHeight;
      let cropW = frameWidth;
      let cropH = frameHeight;
      if (frameAspect > viewAspect) cropW = frameHeight * viewAspect;
      else cropH = frameWidth / viewAspect;

      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(
        image,
        sx + (frameWidth - cropW) / 2,
        sy + (frameHeight - cropH) / 2,
        cropW,
        cropH,
        0,
        0,
        width,
        height
      );
    };

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (disposed) return;
      draw();
      if (animated) {
        timer = setInterval(() => {
          frame = (frame + 1) % frameCount;
          draw();
        }, 1000 / fps);
      }
    };
    image.src = src;

    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(draw) : null;
    resizeObserver?.observe(canvas);

    return () => {
      disposed = true;
      image.onload = null;
      if (timer) clearInterval(timer);
      resizeObserver?.disconnect();
    };
  }, [imageUrl, thumbnailUrl, animationFrames, animationFps, animationColumns, animationRows]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={name}
      className={className}
      style={{ imageRendering: 'pixelated' }}
    />
  );
};
