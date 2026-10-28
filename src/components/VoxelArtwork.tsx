import React, { useState } from 'react';
import { AdBanner, Language } from '../types/store';
import { calculateEcgAnimationDuration, calculateEcgBpm } from '../utils/storeLogic';
import { ExternalLink } from 'lucide-react';

export const EcgHeartbeatLine: React.FC<{
  playersOnline: number;
  primaryColor: string;
  electricColor: string;
  lang: Language;
}> = ({ playersOnline, primaryColor, electricColor, lang }) => {
  const duration = calculateEcgAnimationDuration(playersOnline);
  const bpm = calculateEcgBpm(playersOnline);

  return (
    <div
      className="w-full max-w-3xl mx-auto my-5 relative select-none"
      style={{ ['--ecg-duration' as any]: `${duration}s` }}
    >
      <div className="flex items-center justify-between text-xs text-[#C4B5FD]/80 mb-1.5 px-1 font-nums">
        <span>
          {lang === 'ka' ? 'სერვერის პულსი' : 'SERVER ADRENALINE PULSE'} · {bpm} BPM
        </span>
        <span>
          {lang === 'ka' ? `სიჩქარე: ${(2.8 / duration).toFixed(1)}x` : `SPEED: ${(2.8 / duration).toFixed(1)}x`}
        </span>
      </div>
      <div className="relative h-14 w-full overflow-hidden rounded-lg bg-[#0B0714]/80 border border-[#8A00FF]/25 px-2 flex items-center">
        <svg
          viewBox="0 0 1200 100"
          className="w-full h-12 overflow-visible"
          preserveAspectRatio="none"
          aria-label="Adrenaline ECG Heartbeat Wave"
        >
          <defs>
            <linearGradient id="ecgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={primaryColor} stopOpacity="0.15" />
              <stop offset="50%" stopColor={electricColor} stopOpacity="1" />
              <stop offset="85%" stopColor="#00F5FF" stopOpacity="0.95" />
              <stop offset="100%" stopColor={primaryColor} stopOpacity="0.2" />
            </linearGradient>
            <filter id="ecgGlow" x="-20%" y="-40%" width="140%" height="180%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Baseline Grid */}
          <path
            d="M 0 50 L 180 50 L 210 38 L 230 50 L 265 50 L 285 75 L 310 10 L 335 90 L 360 32 L 385 50 L 580 50 L 610 38 L 630 50 L 665 50 L 685 75 L 710 8 L 735 92 L 760 30 L 785 50 L 980 50 L 1010 38 L 1030 50 L 1055 75 L 1080 12 L 1105 88 L 1130 35 L 1155 50 L 1200 50"
            fill="none"
            stroke={primaryColor}
            strokeOpacity="0.22"
            strokeWidth="2"
          />

          {/* Live Traveling Adrenaline Pulse */}
          <path
            d="M 0 50 L 180 50 L 210 38 L 230 50 L 265 50 L 285 75 L 310 10 L 335 90 L 360 32 L 385 50 L 580 50 L 610 38 L 630 50 L 665 50 L 685 75 L 710 8 L 735 92 L 760 30 L 785 50 L 980 50 L 1010 38 L 1030 50 L 1055 75 L 1080 12 L 1105 88 L 1130 35 L 1155 50 L 1200 50"
            fill="none"
            stroke="url(#ecgGrad)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#ecgGlow)"
            className="ecg-line-animated"
          />
        </svg>
      </div>
    </div>
  );
};

export const RankEmblemSvg: React.FC<{ color: string; name: string; thumbnail?: string }> = ({
  color,
  name,
  thumbnail,
}) => {
  const [imgErr, setImgErr] = useState(false);

  if (thumbnail && !imgErr) {
    return (
      <img
        src={thumbnail}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setImgErr(true)}
        className="w-24 h-24 object-contain mx-auto drop-shadow-[0_0_18px_rgba(200,0,255,0.45)] transition-transform duration-200 group-hover:scale-110"
      />
    );
  }

  const isTopTier = name.includes('SPONSOR') || name.includes('MVP+') || name.includes('EMERALD');

  return (
    <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
      <div
        className="absolute inset-2 rounded-full blur-xl opacity-40 transition-opacity duration-200 group-hover:opacity-75"
        style={{ backgroundColor: color }}
      />
      <svg
        viewBox="0 0 100 100"
        className="w-22 h-22 relative z-10 transition-transform duration-200 group-hover:scale-110"
      >
        {/* Outer Voxel Shield / Hexagon */}
        <polygon
          points="50,6 88,26 88,70 50,94 12,70 12,26"
          fill="#0B0714"
          stroke={color}
          strokeWidth="3"
        />
        <polygon
          points="50,14 80,30 80,66 50,86 20,66 20,30"
          fill={color}
          fillOpacity="0.16"
          stroke={color}
          strokeWidth="1.5"
          strokeDasharray="4 2"
        />
        {/* Inner Voxel Crown / Crystal */}
        {isTopTier ? (
          <g>
            <polygon
              points="24,62 30,34 43,46 50,24 57,46 70,34 76,62"
              fill={color}
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
            <rect x="26" y="65" width="48" height="7" rx="2" fill={color} />
            <circle cx="50" cy="20" r="3.5" fill="#FFFFFF" />
            <circle cx="29" cy="30" r="2.5" fill="#FFFFFF" />
            <circle cx="71" cy="30" r="2.5" fill="#FFFFFF" />
          </g>
        ) : (
          <g>
            <polygon
              points="50,22 72,46 50,76 28,46"
              fill={color}
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
            <polygon points="50,22 72,46 50,52" fill="#FFFFFF" fillOpacity="0.35" />
            <polygon points="50,22 28,46 50,52" fill="#FFFFFF" fillOpacity="0.15" />
          </g>
        )}
      </svg>
    </div>
  );
};

export const CrateKeyArtSvg: React.FC<{ color: string; name: string; thumbnail?: string }> = ({
  color,
  name,
  thumbnail,
}) => {
  const [imgErr, setImgErr] = useState(false);

  // Deterministic particle burst angles
  const particles = [
    { x: -34, y: -28, size: 5 },
    { x: 36, y: -24, size: 6 },
    { x: -38, y: 14, size: 4 },
    { x: 38, y: 18, size: 5 },
    { x: 0, y: -42, size: 6 },
    { x: -20, y: 34, size: 5 },
    { x: 24, y: 32, size: 4 },
  ];

  return (
    <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
      {/* Glow Aura */}
      <div
        className="absolute inset-2 rounded-full blur-xl opacity-35 transition-opacity duration-200 group-hover:opacity-80"
        style={{ backgroundColor: color }}
      />

      {/* Bursting Pixel Particles on Hover */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        {particles.map((pt, i) => (
          <span
            key={i}
            style={{
              width: `${pt.size}px`,
              height: `${pt.size}px`,
              backgroundColor: color,
              boxShadow: `0 0 8px ${color}`,
              transform: `translate(${pt.x}px, ${pt.y}px)`,
            }}
            className="opacity-25 group-hover:opacity-100 group-hover:scale-125 transition-all duration-200 rounded-[1px]"
          />
        ))}
      </div>

      {thumbnail && !imgErr ? (
        <img
          src={thumbnail}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setImgErr(true)}
          className="w-24 h-24 object-contain relative z-10 animate-float-cube"
        />
      ) : (
        <svg
          viewBox="0 0 100 100"
          className="w-24 h-24 relative z-10 animate-float-cube"
        >
          {/* Isometric Floating Crate Base */}
          <polygon points="50,36 82,52 50,68 18,52" fill="#170F2B" stroke={color} strokeWidth="2" />
          <polygon points="18,52 50,68 50,92 18,76" fill="#0E081C" stroke={color} strokeWidth="2" />
          <polygon points="82,52 50,68 50,92 82,76" fill="#130B24" stroke={color} strokeWidth="2" />
          {/* Glowing Keyhole & Core */}
          <rect x="46" y="64" width="8" height="12" rx="1" fill={color} />
          {/* Floating Voxel Key Above Crate */}
          <circle
            cx="50"
            cy="22"
            r="11"
            fill="#0B0714"
            stroke={color}
            strokeWidth="3.5"
          />
          <circle cx="50" cy="22" r="4" fill={color} />
          <rect x="48" y="33" width="4" height="22" fill={color} />
          <rect x="52" y="42" width="7" height="3.5" fill={color} />
          <rect x="52" y="49" width="5" height="3.5" fill={color} />
        </svg>
      )}
    </div>
  );
};

export const GamemodeArtSvg: React.FC<{
  gamemodeId: string;
  color: string;
  bannerUrl?: string;
}> = ({ gamemodeId, color, bannerUrl }) => {
  const [imgErr, setImgErr] = useState(false);

  if (bannerUrl && !imgErr) {
    return (
      <img
        src={bannerUrl}
        alt={gamemodeId}
        referrerPolicy="no-referrer"
        onError={() => setImgErr(true)}
        className="w-full h-44 object-cover rounded-lg border border-white/10"
      />
    );
  }

  const isOneblock = gamemodeId.toLowerCase().includes('oneblock');

  return (
    <div className="w-full h-44 rounded-lg bg-gradient-to-br from-[#0B0714] via-[#150A2A] to-[#05030A] border border-white/10 relative overflow-hidden flex items-center justify-center">
      <div
        className="absolute w-36 h-36 rounded-full blur-2xl opacity-30"
        style={{ backgroundColor: color }}
      />
      <svg viewBox="0 0 240 120" className="w-56 h-36 relative z-10">
        {isOneblock ? (
          <g>
            {/* Floating Oneblock Sky Island */}
            <polygon points="120,38 164,58 120,78 76,58" fill={color} fillOpacity="0.35" stroke={color} strokeWidth="2.5" />
            <polygon points="76,58 120,78 120,106 76,84" fill="#180D30" stroke={color} strokeWidth="2" />
            <polygon points="164,58 120,78 120,106 164,84" fill="#100821" stroke={color} strokeWidth="2" />
            {/* Floating Mini Cubes */}
            <rect x="46" y="28" width="12" height="12" fill={color} opacity="0.8" />
            <rect x="180" y="34" width="10" height="10" fill="#00F5FF" opacity="0.8" />
            <rect x="114" y="16" width="12" height="12" fill="#FFFFFF" stroke={color} strokeWidth="2" />
          </g>
        ) : (
          <g>
            {/* SMP Fortress Citadel & Beacon */}
            <rect x="116" y="6" width="8" height="80" fill={color} opacity="0.45" />
            <rect x="65" y="48" width="24" height="48" fill="#160C2E" stroke={color} strokeWidth="2" />
            <rect x="151" y="48" width="24" height="48" fill="#160C2E" stroke={color} strokeWidth="2" />
            <rect x="89" y="34" width="62" height="62" fill="#1D103B" stroke={color} strokeWidth="2.5" />
            <polygon points="120,18 138,34 102,34" fill={color} />
            <rect x="112" y="68" width="16" height="28" fill={color} fillOpacity="0.8" />
          </g>
        )}
      </svg>
    </div>
  );
};

export const StaffAvatar: React.FC<{ name: string; color: string }> = ({ name, color }) => {
  const [imgErr, setImgErr] = useState(false);
  const avatarUrl = `https://mc-heads.net/avatar/${encodeURIComponent(name)}/128`;

  return (
    <div
      className="w-20 h-20 rounded-xl p-1 relative flex items-center justify-center bg-[#05030A] border"
      style={{ borderColor: `${color}66`, boxShadow: `0 0 20px ${color}30` }}
    >
      {!imgErr ? (
        <img
          src={avatarUrl}
          alt={`${name} Minecraft head`}
          referrerPolicy="no-referrer"
          onError={() => setImgErr(true)}
          className="w-full h-full object-contain rounded-lg"
        />
      ) : (
        <div
          className="w-full h-full rounded-lg flex items-center justify-center font-pixel text-lg font-bold"
          style={{ backgroundColor: `${color}22`, color }}
        >
          {name.slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  );
};

export const AdBannerSlot: React.FC<{
  ad?: AdBanner;
  lang: Language;
  onNavigateStore: () => void;
}> = ({ ad, lang, onNavigateStore }) => {
  if (!ad || !ad.enabled) return null;

  const now = new Date().toISOString().slice(0, 10);
  if (ad.startDate && now < ad.startDate) return null;
  if (ad.endDate && now > ad.endDate) return null;

  const handleClick = () => {
    fetch(`/api/ads/${encodeURIComponent(ad.id)}/click`, { method: 'POST' }).catch(() => {});
    if (ad.linkUrl.startsWith('#store')) {
      onNavigateStore();
    } else if (ad.linkUrl.startsWith('http')) {
      window.open(ad.linkUrl, '_blank', 'noopener,noreferrer');
    } else {
      onNavigateStore();
    }
  };

  return (
    <div className="w-full my-6">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#0B0714] via-[#1B0B36] to-[#0B0714] border border-[#8A00FF]/35 p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {ad.imageUrl && (
          <img
            src={ad.imageUrl}
            alt={ad.title[lang]}
            referrerPolicy="no-referrer"
            className="w-16 h-16 object-cover rounded-lg shrink-0 border border-white/10"
          />
        )}
        <div className="space-y-1 flex-1">
          <div className="text-xs text-[#C4B5FD] tracking-wider uppercase">
            {lang === 'ka' ? 'სპეციალური შეთავაზება · ADRENALINEE' : 'FEATURED PROMOTION · ADRENALINEE'}
          </div>
          <h3 className="text-base sm:text-lg font-bold text-white">
            {ad.title[lang] || ad.title.ka}
          </h3>
          <p className="text-xs sm:text-sm text-[#C4B5FD]/85">
            {ad.subtitle[lang] || ad.subtitle.ka}
          </p>
        </div>
        <button
          type="button"
          onClick={handleClick}
          className="px-4 py-2.5 rounded-lg bg-[#8A00FF] hover:bg-[#C800FF] text-white text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span>{ad.ctaText[lang] || ad.ctaText.ka}</span>
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
