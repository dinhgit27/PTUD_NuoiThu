import React, { useEffect, useState } from 'react';

interface PixelBootScreenProps {
  onComplete: () => void;
}

const LOGO_SRC = '/brand/officepet_cat_logo.png';

const PRELOAD_ASSETS = [
  LOGO_SRC,
  '/sprites/cat_default_spritesheet.png',
  '/sprites/cat_default_preview.png',
  '/sprites/corgi_default_spritesheet.png',
  '/sprites/corgi_default_preview.png',
  '/sprites/rabbit_default_spritesheet.png',
  '/sprites/rabbit_default_preview.png',
  '/sprites/chim_canh_cut_spritesheet.png',
  '/sprites/chim_canh_cut_preview.png',
  '/sprites/husky_spritesheet.png',
  '/sprites/husky_preview.png',
  '/backgrounds/cafe_cozy.png',
  '/backgrounds/garden_spring.png',
  '/backgrounds/office_zen.png',
  '/backgrounds/beach_sunset.png'
];

// Multi-tone "Tabby Cat & Cozy Office" Palette:
// Sky blue window + Warm Milk Cream fur + Tabby Caramel/Wood desk + Collar Blue + Golden Bell + Coral Ear Pink
const C = {
  sky: '#bfe0f9',
  skySoft: '#aacfe7',
  paper: '#f6eee3',
  steel: '#536f87',
  navy: '#23293a',
  slate: '#3d455a',
  collarBlue: '#2e6da4',
  wood: '#b88256',
  woodDark: '#8c5c38',
  furCream: '#fffcf7',
  earPink: '#f0788c',
  gold: '#fbbf24',
  goldDeep: '#e59917'
};

// ---------------------------------------------------------------------------
// Pixel city scene: 3 depth layers of buildings (windows, rooftop details),
// a tree-lined sidewalk with street lamps, and a road with a passing car.
// Everything is generated deterministically so the scene never "jumps".
// ---------------------------------------------------------------------------
const VB_W = 1440;
const VB_H = 200;
const GROUND = 26;
const BASE_Y = VB_H - GROUND;

type RoofType = 'flat' | 'step' | 'antenna' | 'tank' | 'ac';
interface Building {
  x: number;
  w: number;
  h: number;
  roof: RoofType;
  seed: number;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeLayer(seed: number, minW: number, maxW: number, minH: number, maxH: number, overlap: number): Building[] {
  const rnd = mulberry32(seed);
  const out: Building[] = [];
  let x = -24;
  while (x < VB_W + 24) {
    const w = Math.round((minW + rnd() * (maxW - minW)) / 4) * 4;
    const h = Math.round((minH + rnd() * (maxH - minH)) / 4) * 4;
    const r = rnd();
    const roof: RoofType = r < 0.2 ? 'antenna' : r < 0.38 ? 'tank' : r < 0.58 ? 'step' : r < 0.76 ? 'ac' : 'flat';
    out.push({ x, w, h, roof, seed: rnd() });
    x += w - overlap + Math.round(rnd() * 2) * 2;
  }
  return out;
}

const FAR_LAYER = makeLayer(11, 44, 76, 70, 128, 6);
const MID_LAYER = makeLayer(29, 40, 64, 52, 104, 4);
const NEAR_LAYER = makeLayer(47, 34, 56, 36, 80, 2);

interface LayerStyle {
  body: string;
  edge: string;
  roofDetail: string;
  win: string;
  lit?: boolean;
}

const SkylineLayer: React.FC<{ buildings: Building[]; s: LayerStyle }> = ({ buildings, s }) => (
  <g>
    {buildings.map((b, i) => {
      const y = BASE_Y - b.h;
      const cx = b.x + b.w / 2;
      return (
        <g key={i}>
          {/* Rooftop details */}
          {b.roof === 'antenna' && (
            <>
              <rect x={cx - 1} y={y - 22} width={2} height={22} fill={s.roofDetail} />
              <rect x={cx - 5} y={y - 14} width={10} height={2} fill={s.roofDetail} />
              <rect x={cx - 2} y={y - 26} width={4} height={4} fill="#ef6a76" className="pbs-blink" style={{ animationDelay: `${(b.seed * 2).toFixed(2)}s` }} />
            </>
          )}
          {b.roof === 'tank' && (
            <>
              <rect x={cx - 8} y={y - 6} width={2} height={6} fill={s.roofDetail} />
              <rect x={cx + 6} y={y - 6} width={2} height={6} fill={s.roofDetail} />
              <rect x={cx - 9} y={y - 16} width={18} height={10} fill={s.body} />
              <rect x={cx - 9} y={y - 16} width={18} height={2} fill={s.edge} />
              <rect x={cx - 6} y={y - 19} width={12} height={3} fill={s.edge} />
            </>
          )}
          {b.roof === 'step' && (
            <>
              <rect x={b.x + 5} y={y - 9} width={b.w - 10} height={9} fill={s.body} />
              <rect x={b.x + 5} y={y - 9} width={b.w - 10} height={2} fill={s.edge} />
            </>
          )}
          {b.roof === 'ac' && (
            <>
              <rect x={b.x + 5} y={y - 6} width={9} height={6} fill={s.roofDetail} />
              <rect x={b.x + 17} y={y - 4} width={7} height={4} fill={s.roofDetail} />
            </>
          )}

          {/* Building body + windows (nested svg => the window pattern aligns to each building) */}
          <svg x={b.x} y={y} width={b.w} height={b.h} overflow="hidden">
            <rect width={b.w} height={b.h} fill={s.body} />
            <rect width={b.w} height={3} fill={s.edge} />
            <rect width={2} height={b.h} fill={s.edge} opacity={0.55} />
            <rect x={4} y={8} width={Math.max(0, b.w - 8)} height={Math.max(0, b.h - 12)} fill={`url(#${s.win})`} />
            {s.lit && (
              <rect
                x={4}
                y={8}
                width={Math.max(0, b.w - 8)}
                height={Math.max(0, b.h - 12)}
                fill="url(#pbs-win-lit)"
                className="pbs-lit"
                style={{ animationDelay: `${(b.seed * 5).toFixed(2)}s` }}
              />
            )}
          </svg>
        </g>
      );
    })}
  </g>
);

const GROUND_PROPS = (() => {
  const rnd = mulberry32(83);
  const items: Array<{ x: number; type: 'tree' | 'lamp' | 'bush' }> = [];
  let x = 40;
  let n = 0;
  while (x < VB_W) {
    const type: 'tree' | 'lamp' | 'bush' = n % 3 === 0 ? 'tree' : n % 3 === 1 ? 'lamp' : rnd() > 0.5 ? 'tree' : 'bush';
    items.push({ x, type });
    x += 70 + Math.round(rnd() * 60);
    n++;
  }
  return items;
})();

const PixelCityScene: React.FC = () => (
  <svg
    className="absolute bottom-0 left-0 w-full pointer-events-none"
    style={{ height: 'clamp(190px, 30vh, 320px)' }}
    viewBox={`0 0 ${VB_W} ${VB_H}`}
    preserveAspectRatio="xMidYMax slice"
    shapeRendering="crispEdges"
    aria-hidden="true"
  >
    <defs>
      <pattern id="pbs-win-far" width="8" height="10" patternUnits="userSpaceOnUse">
        <rect x="1" y="2" width="4" height="5" fill="#e6f2fb" />
      </pattern>
      <pattern id="pbs-win-mid" width="8" height="10" patternUnits="userSpaceOnUse">
        <rect x="1" y="2" width="4" height="5" fill="#d5e9f7" />
      </pattern>
      <pattern id="pbs-win-near" width="8" height="10" patternUnits="userSpaceOnUse">
        <rect x="1" y="2" width="4" height="5" fill="#bfe0f9" />
      </pattern>
      <pattern id="pbs-win-lit" width="40" height="50" patternUnits="userSpaceOnUse">
        <rect x="1" y="2" width="4" height="5" fill="#f5b942" />
        <rect x="25" y="12" width="4" height="5" fill="#f9d27a" />
        <rect x="9" y="22" width="4" height="5" fill="#f5b942" />
        <rect x="33" y="32" width="4" height="5" fill="#f9d27a" />
        <rect x="17" y="42" width="4" height="5" fill="#f5b942" />
      </pattern>
      <pattern id="pbs-road-dash" width="28" height="2" patternUnits="userSpaceOnUse">
        <rect x="2" y="0" width="14" height="2" fill="#f1f6fa" />
      </pattern>
    </defs>

    {/* Soft haze behind the far layer */}
    <rect x="0" y={VB_H - 150} width={VB_W} height="150" fill="#dcecf9" opacity="0.45" />

    <SkylineLayer buildings={FAR_LAYER} s={{ body: '#bcd9ec', edge: '#cfe4f3', roofDetail: '#a9cbe2', win: 'pbs-win-far' }} />
    <SkylineLayer buildings={MID_LAYER} s={{ body: '#8db6c9', edge: '#a6c9da', roofDetail: '#7ea6ba', win: 'pbs-win-mid' }} />
    <SkylineLayer buildings={NEAR_LAYER} s={{ body: '#536f87', edge: '#6d8aa2', roofDetail: '#46607a', win: 'pbs-win-near', lit: true }} />

    {/* Warm Wood & Brick Sidewalk + Cozy Street */}
    <rect x="0" y={BASE_Y} width={VB_W} height={GROUND} fill="#2b3245" />
    <rect x="0" y={BASE_Y} width={VB_W} height="7" fill="#c9956b" />
    <rect x="0" y={BASE_Y + 7} width={VB_W} height="2" fill="#9a6842" />
    <rect x="0" y={BASE_Y + 17} width={VB_W} height="2" fill="url(#pbs-road-dash)" />

    {/* Trees, bushes & street lamps on the sidewalk */}
    {GROUND_PROPS.map((p, i) => {
      if (p.type === 'tree') {
        return (
          <g key={i}>
            <rect x={p.x - 1} y={BASE_Y - 11} width={3} height={12} fill="#8a6b5c" />
            <rect x={p.x - 7} y={BASE_Y - 27} width={15} height={6} fill="#4f9d69" />
            <rect x={p.x - 10} y={BASE_Y - 22} width={21} height={9} fill="#5aa56e" />
            <rect x={p.x - 7} y={BASE_Y - 14} width={15} height={5} fill="#4f9d69" />
            <rect x={p.x - 5} y={BASE_Y - 25} width={5} height={3} fill="#86c796" />
            <rect x={p.x + 3} y={BASE_Y - 19} width={4} height={3} fill="#86c796" />
          </g>
        );
      }
      if (p.type === 'lamp') {
        return (
          <g key={i}>
            <rect x={p.x} y={BASE_Y - 28} width={2} height={29} fill="#2f3a4f" />
            <rect x={p.x - 6} y={BASE_Y - 30} width={9} height={2} fill="#2f3a4f" />
            <rect x={p.x - 7} y={BASE_Y - 28} width={5} height={3} fill="#f5b942" />
            <rect x={p.x - 9} y={BASE_Y - 25} width={9} height={2} fill="#f5b942" opacity="0.25" />
          </g>
        );
      }
      return (
        <g key={i}>
          <rect x={p.x - 6} y={BASE_Y - 7} width={13} height={8} fill="#5aa56e" />
          <rect x={p.x - 4} y={BASE_Y - 10} width={9} height={4} fill="#4f9d69" />
          <rect x={p.x - 2} y={BASE_Y - 9} width={3} height={2} fill="#86c796" />
        </g>
      );
    })}

    {/* Cars cruising along the road */}
    <g className="pbs-car" style={{ animationDelay: '-4s' }}>
      <rect x="0" y={BASE_Y + 12} width="28" height="7" fill="#3b82f6" />
      <rect x="6" y={BASE_Y + 7} width="15" height="6" fill="#3b82f6" />
      <rect x="8" y={BASE_Y + 8} width="11" height="4" fill="#dcecfc" />
      <rect x="0" y={BASE_Y + 12} width="28" height="2" fill="#7cb4fb" />
      <rect x="3" y={BASE_Y + 18} width="6" height="5" fill="#212a3c" />
      <rect x="19" y={BASE_Y + 18} width="6" height="5" fill="#212a3c" />
      <rect x="26" y={BASE_Y + 13} width="2" height="2" fill="#f9d27a" />
    </g>
    <g className="pbs-car pbs-car-slow" style={{ animationDelay: '-13s' }}>
      <rect x="0" y={BASE_Y + 12} width="30" height="7" fill="#f1f6fa" />
      <rect x="5" y={BASE_Y + 7} width="17" height="6" fill="#f1f6fa" />
      <rect x="7" y={BASE_Y + 8} width="13" height="4" fill="#8db6c9" />
      <rect x="0" y={BASE_Y + 15} width="30" height="2" fill="#bfe0f9" />
      <rect x="3" y={BASE_Y + 18} width="6" height="5" fill="#212a3c" />
      <rect x="21" y={BASE_Y + 18} width="6" height="5" fill="#212a3c" />
      <rect x="28" y={BASE_Y + 13} width="2" height="2" fill="#f9d27a" />
    </g>
  </svg>
);

const PixelCloud: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <div className={`absolute ${className || ''}`} style={style} aria-hidden="true">
    <div style={{ marginLeft: 16, width: 32, height: 8, background: '#fff' }} />
    <div style={{ marginLeft: 8, width: 64, height: 8, background: '#fff' }} />
    <div style={{ width: 80, height: 8, background: '#fff' }} />
  </div>
);

const PixelSparkle: React.FC<{ className?: string; color: string; size?: number; delay?: string }> = ({
  className,
  color,
  size = 6,
  delay = '0s'
}) => (
  <div
    className={`absolute pbs-twinkle ${className || ''}`}
    style={{ width: size * 3, height: size * 3, animationDelay: delay }}
    aria-hidden="true"
  >
    <div style={{ position: 'absolute', left: size, top: 0, width: size, height: size * 3, background: color }} />
    <div style={{ position: 'absolute', left: 0, top: size, width: size * 3, height: size, background: color }} />
  </div>
);

export const PixelBootScreen: React.FC<PixelBootScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let finishTimer: ReturnType<typeof setTimeout> | null = null;
    let completeTimer: ReturnType<typeof setTimeout> | null = null;

    // Preload logo, core sprites & room backgrounds in parallel
    PRELOAD_ASSETS.forEach(src => {
      const img = new Image();
      img.src = src;
    });

    const durationMs = 2200;
    const startTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      if (!isMounted) return;
      const rawRatio = Math.min(1, (now - startTime) / durationMs);
      // Gentle ease-in-out so the cat feels like it accelerates then settles
      const eased = rawRatio < 0.5 ? 2 * rawRatio * rawRatio : 1 - Math.pow(-2 * rawRatio + 2, 2) / 2;
      setProgress(Math.min(100, Math.round(eased * 100)));

      if (rawRatio < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setProgress(100);
        finishTimer = setTimeout(() => {
          if (!isMounted) return;
          setIsExiting(true);
          completeTimer = setTimeout(() => {
            if (isMounted) onComplete();
          }, 420);
        }, 300);
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      isMounted = false;
      cancelAnimationFrame(rafId);
      if (finishTimer) clearTimeout(finishTimer);
      if (completeTimer) clearTimeout(completeTimer);
    };
  }, [onComplete]);

  const isDone = progress >= 100;

  return (
    <div
      role="status"
      aria-label={`Đang tải OfficePet ${progress}%`}
      className={`fixed inset-0 z-[120] flex flex-col items-center justify-center overflow-hidden select-none transition-all duration-[420ms] ease-out ${
        isExiting ? 'opacity-0 scale-[1.03] pointer-events-none' : 'opacity-100 scale-100'
      }`}
      style={{ background: `linear-gradient(180deg, ${C.sky} 0%, #dcecf9 55%, ${C.paper} 100%)` }}
    >
      <style>{`
        @keyframes pbs-run-bob {
          0%, 100% { transform: translateY(0) rotate(-2.5deg) scale(1.04, 0.96); }
          25%      { transform: translateY(-20px) rotate(0deg) scale(0.97, 1.04); }
          50%      { transform: translateY(0) rotate(2.5deg) scale(1.04, 0.96); }
          75%      { transform: translateY(-14px) rotate(0deg) scale(0.98, 1.03); }
        }
        @keyframes pbs-shadow {
          0%, 100% { transform: scaleX(1);    opacity: .30; }
          25%      { transform: scaleX(.72);  opacity: .16; }
          50%      { transform: scaleX(1);    opacity: .30; }
          75%      { transform: scaleX(.8);   opacity: .2; }
        }
        @keyframes pbs-ground {
          from { background-position: 0 0; }
          to   { background-position: -64px 0; }
        }
        @keyframes pbs-dust {
          0%   { transform: translate(0, 0) scale(1);       opacity: .0; }
          15%  { opacity: .85; }
          100% { transform: translate(-62px, -16px) scale(.3); opacity: 0; }
        }
        @keyframes pbs-speed {
          0%   { transform: translateX(14px); opacity: 0; }
          30%  { opacity: .75; }
          100% { transform: translateX(-34px); opacity: 0; }
        }
        @keyframes pbs-twinkle {
          0%, 100% { transform: scale(.4); opacity: .2; }
          50%      { transform: scale(1);  opacity: 1; }
        }
        @keyframes pbs-cloud {
          from { transform: translateX(-140px); }
          to   { transform: translateX(calc(100vw + 140px)); }
        }
        @keyframes pbs-celebrate {
          0%   { transform: translateY(0) scale(1); }
          40%  { transform: translateY(-34px) scale(.96, 1.06); }
          70%  { transform: translateY(0) scale(1.06, .94); }
          100% { transform: translateY(0) scale(1); }
        }
        @keyframes pbs-fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pbs-lit {
          0%, 100% { opacity: 1; }
          50%      { opacity: .35; }
        }
        @keyframes pbs-blink {
          0%, 100% { opacity: 1; }
          50%      { opacity: .15; }
        }
        @keyframes pbs-car {
          from { transform: translateX(-80px); }
          to   { transform: translateX(1540px); }
        }
        .pbs-lit       { animation: pbs-lit 4.2s ease-in-out infinite; }
        .pbs-blink     { animation: pbs-blink 1.4s steps(2, end) infinite; }
        .pbs-car       { animation: pbs-car 15s linear infinite; }
        .pbs-car-slow  { animation-duration: 22s; }
        .pbs-run-bob   { animation: pbs-run-bob .7s ease-in-out infinite; transform-origin: 50% 100%; }
        .pbs-celebrate { animation: pbs-celebrate .55s ease-out 1; transform-origin: 50% 100%; }
        .pbs-shadow    { animation: pbs-shadow .7s ease-in-out infinite; }
        .pbs-ground    { animation: pbs-ground .5s linear infinite; }
        .pbs-dust      { animation: pbs-dust .7s ease-out infinite; }
        .pbs-speed     { animation: pbs-speed .7s ease-out infinite; }
        .pbs-twinkle   { animation: pbs-twinkle 1.6s ease-in-out infinite; }
        .pbs-cloud     { animation: pbs-cloud 26s linear infinite; }
        .pbs-fade-up   { animation: pbs-fade-up .6s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .pbs-run-bob, .pbs-celebrate, .pbs-shadow, .pbs-ground, .pbs-dust,
          .pbs-speed, .pbs-twinkle, .pbs-cloud, .pbs-lit, .pbs-blink, .pbs-car { animation: none !important; }
        }
      `}</style>

      {/* Soft diagonal white band echoing the presentation slide */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'rgba(255,255,255,0.55)',
          clipPath: 'polygon(0 0, 34% 0, 6% 100%, 0 100%)'
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(90deg, ${C.wood}44, transparent)`,
          clipPath: 'polygon(34% 0, 37% 0, 9% 100%, 6% 100%)'
        }}
        aria-hidden="true"
      />

      {/* Drifting pixel clouds */}
      <PixelCloud className="pbs-cloud" style={{ top: '12%', left: 0, opacity: 0.85, animationDelay: '-6s' }} />
      <PixelCloud className="pbs-cloud" style={{ top: '26%', left: 0, opacity: 0.6, animationDuration: '34s', animationDelay: '-20s', transform: 'scale(0.7)' }} />

      {/* Complete pixel city scene (3 building layers, trees, lamps, road & cars) */}
      <PixelCityScene />

      {/* ============== CENTER: RUNNING CAT LOGO ============== */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative w-[240px] h-[250px] flex items-end justify-center">
          {/* Sparkles in Golden Bell, Ear Pink, and Collar Blue */}
          <PixelSparkle className="-top-1 right-2" color={C.gold} size={6} delay="0s" />
          <PixelSparkle className="top-10 -left-3" color={C.earPink} size={5} delay="0.5s" />
          <PixelSparkle className="top-2 left-6" color={C.collarBlue} size={4} delay="1s" />

          {/* Speed lines (behind the cat, cat runs to the right) */}
          <div className="absolute left-[2px] bottom-[84px] flex flex-col gap-3" aria-hidden="true">
            <div className="pbs-speed" style={{ width: 34, height: 4, background: C.wood, animationDelay: '0s' }} />
            <div className="pbs-speed" style={{ width: 22, height: 4, background: C.collarBlue, marginLeft: 12, animationDelay: '0.2s' }} />
            <div className="pbs-speed" style={{ width: 30, height: 4, background: C.goldDeep, animationDelay: '0.4s' }} />
          </div>

          {/* Cat */}
          <div className={`relative z-10 mb-[22px] ${isDone ? 'pbs-celebrate' : 'pbs-run-bob'}`}>
            <img
              src={LOGO_SRC}
              alt="OfficePet — chú mèo pixel"
              draggable={false}
              className="block w-[188px] h-auto"
              style={{ imageRendering: 'pixelated', filter: 'drop-shadow(0 6px 0 rgba(35,41,58,0.16))' }}
            />
          </div>

          {/* Ground shadow */}
          <div
            className="pbs-shadow absolute bottom-[10px] left-1/2 -ml-[58px] h-[10px] w-[116px] rounded-full"
            style={{ background: C.navy }}
            aria-hidden="true"
          />

          {/* Dust puffs kicked up by the paws */}
          <div className="absolute bottom-[16px] left-[62px]" aria-hidden="true">
            <div className="pbs-dust absolute" style={{ width: 10, height: 10, background: C.furCream, animationDelay: '0s' }} />
            <div className="pbs-dust absolute" style={{ width: 8, height: 8, background: '#f5dec4', animationDelay: '0.23s' }} />
            <div className="pbs-dust absolute" style={{ width: 12, height: 12, background: C.furCream, animationDelay: '0.46s' }} />
          </div>
        </div>

        {/* Scrolling warm wood & tabby cobblestone path */}
        <div className="relative w-[300px] h-[8px] overflow-hidden -mt-[2px]" aria-hidden="true">
          <div
            className="pbs-ground absolute inset-0"
            style={{
              backgroundImage: `repeating-linear-gradient(90deg, ${C.wood} 0 20px, transparent 20px 32px)`,
              backgroundSize: '64px 8px',
              opacity: 0.85
            }}
          />
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(90deg, ${C.paper}, transparent 22%, transparent 78%, ${C.paper})` }}
          />
        </div>

        {/* Wordmark: Charcoal + Collar Blue + Golden Bell PIXEL tag */}
        <div className="mt-5 flex items-center gap-2 pbs-fade-up">
          <h1 className="text-[28px] sm:text-[32px] font-black tracking-tight leading-none" style={{ color: C.navy }}>
            Office<span style={{ color: C.collarBlue }}>Pet</span>
          </h1>
          <span
            className="text-[10px] font-black px-2 py-[3px] rounded-[4px] tracking-wider border-2"
            style={{
              background: C.gold,
              color: C.navy,
              borderColor: C.navy,
              boxShadow: `2px 2px 0 ${C.navy}`
            }}
          >
            PIXEL
          </span>
        </div>

        {/* Slim progress bar + percent (Golden Bell + Warm Caramel stripes inside Cream frame) */}
        <div className="mt-6 w-[260px] sm:w-[300px]">
          <div
            className="relative h-[15px] rounded-full overflow-hidden"
            style={{
              background: C.furCream,
              border: `2px solid ${C.navy}`,
              boxShadow: `3px 3px 0 ${C.wood}66`
            }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: `repeating-linear-gradient(135deg, ${C.gold} 0 9px, ${C.wood} 9px 18px)`,
                transition: 'width 90ms linear'
              }}
            />
          </div>
          <div className="mt-2 flex items-center justify-center">
            <span className="font-mono text-sm font-black tabular-nums tracking-widest" style={{ color: C.navy }}>
              {progress}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
