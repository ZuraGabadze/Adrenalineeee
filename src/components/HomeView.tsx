import React, { useState } from 'react';
import {
  AdBanner,
  GamemodeInfo,
  Language,
  LiveServerStatus,
  SiteSettings,
  StaffMember,
  StoreProduct,
} from '../types/store';
import { EcgHeartbeatLine, GamemodeArtSvg, StaffAvatar, AdBannerSlot } from './VoxelArtwork';
import { ProductCard } from './ProductCard';
import { Copy, Check, ArrowRight, Users, Server, MessageSquare } from 'lucide-react';

export const HomeView: React.FC<{
  lang: Language;
  settings: SiteSettings;
  liveStatus: LiveServerStatus | null;
  gamemodes: GamemodeInfo[];
  products: StoreProduct[];
  staff: StaffMember[];
  ads: AdBanner[];
  onCopyIp: () => void;
  onSelectGamemodeStore: (gm: 'smp' | 'oneblock') => void;
  onAddToCart: (productId: string, qty: number) => void;
  onNavigateInfo: () => void;
}> = ({
  lang,
  settings,
  liveStatus,
  gamemodes,
  products,
  staff,
  ads,
  onCopyIp,
  onSelectGamemodeStore,
  onAddToCart,
  onNavigateInfo,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopyIp();
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const mcOnline = liveStatus?.minecraft.playersOnline ?? 0;
  const mcMax = liveStatus?.minecraft.playersMax ?? 250;
  const isMcUp = liveStatus?.minecraft.online ?? false;
  const discordOnline = liveStatus?.discord.onlineCount ?? 0;
  const discordTotal = liveStatus?.discord.memberCount ?? 0;

  const featuredRanks = products
    .filter((p) => p.visible && p.type === 'rank' && p.featured)
    .slice(0, 3);

  const adTop = ads.find((a) => a.slot === 'home-top');
  const adMiddle = ads.find((a) => a.slot === 'home-middle');
  const adFooter = ads.find((a) => a.slot === 'footer');

  return (
    <div className="space-y-16 pb-12">
      {/* HERO BANNER SECTION */}
      <section className="relative rounded-3xl overflow-hidden border border-[#8A00FF]/35 bg-gradient-to-b from-[#0B0714] via-[#120824] to-[#05030A] px-6 py-12 sm:px-12 sm:py-16 text-center">
        {settings.media.bannerUrl && (
          <img
            src={settings.media.bannerUrl}
            alt="Server Banner"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#05030A] via-[#05030A]/60 to-transparent pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto space-y-5">
          <div className="text-xs sm:text-sm text-[#C4B5FD] tracking-widest uppercase font-nums">
            {settings.serverName} NETWORK · {settings.serverVersion}
          </div>

          <h1
            className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight"
            style={{ textWrap: 'balance' }}
          >
            {settings.heroTitle[lang] || settings.heroTitle.ka}
          </h1>

          <p className="text-sm sm:text-base text-[#C4B5FD]/90 max-w-2xl mx-auto leading-relaxed">
            {settings.heroSubtitle[lang] || settings.heroSubtitle.ka}
          </p>

          {/* Glowing Adrenaline ECG Heartbeat Line */}
          <EcgHeartbeatLine
            playersOnline={mcOnline}
            primaryColor={settings.palette.primaryPurple}
            electricColor={settings.palette.electricViolet}
            lang={lang}
          />

          {/* Server IP Copy Bar & Primary Store CTA */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={handleCopy}
              className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-[#05030A]/90 border border-[#8A00FF]/50 hover:border-[#C800FF] text-white flex items-center justify-center gap-3 transition-colors cursor-pointer"
            >
              <Server className="w-4 h-4 text-[#C800FF] shrink-0" />
              <span className="font-pixel text-sm sm:text-base tracking-wider text-white">
                {settings.serverIp}
              </span>
              <span className="text-xs text-[#C4B5FD] flex items-center gap-1 border-l border-white/15 pl-3">
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">
                      {lang === 'ka' ? 'დაკოპირდა!' : 'Copied!'}
                    </span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{lang === 'ka' ? 'IP კოპირება' : 'Copy IP'}</span>
                  </>
                )}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSelectGamemodeStore('smp')}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#8A00FF] to-[#C800FF] hover:brightness-110 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all shadow-[0_0_28px_rgba(138,0,255,0.45)] cursor-pointer"
            >
              <span>{lang === 'ka' ? 'მაღაზიაში გადასვლა' : 'Browse Server Store'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* LIVE COUNTERS STRIP */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-[#0B0714]/90 border border-white/10 p-6 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs text-[#C4B5FD]/75 uppercase tracking-wider">
              {lang === 'ka' ? 'MINECRAFT სერვერის სტატუსი' : 'MINECRAFT SERVER STATUS'} ·{' '}
              <span className={isMcUp ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                {isMcUp ? (lang === 'ka' ? 'ჩართულია' : 'ONLINE') : (lang === 'ka' ? 'მოწმდება / OFFLINE' : 'OFFLINE / STANDBY')}
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-nums">
              {mcOnline} <span className="text-base font-normal text-[#C4B5FD]/60">/ {mcMax}</span>
            </div>
            <div className="text-xs text-[#C4B5FD]/80">
              {lang === 'ka' ? 'მოთამაშე ონლაინ' : 'Players Online'} · {settings.serverIp}
            </div>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-[#8A00FF]/20 border border-[#8A00FF]/40 flex items-center justify-center shrink-0">
            <Server className="w-7 h-7 text-[#C800FF]" />
          </div>
        </div>

        <div className="rounded-2xl bg-[#0B0714]/90 border border-white/10 p-6 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs text-[#C4B5FD]/75 uppercase tracking-wider">
              {lang === 'ka' ? 'DISCORD საზოგადოება' : 'DISCORD COMMUNITY'} ·{' '}
              <span className="text-[#00F5FF] font-semibold">LIVE</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-nums">
              {discordOnline}{' '}
              <span className="text-base font-normal text-[#C4B5FD]/60">
                / {discordTotal} {lang === 'ka' ? 'წევრი' : 'members'}
              </span>
            </div>
            <div className="text-xs text-[#C4B5FD]/80">
              {liveStatus?.discord.guildName || 'ADRENALINEE Discord'}
            </div>
          </div>
          <a
            href={settings.discordInviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs sm:text-sm font-semibold text-white flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
          >
            <MessageSquare className="w-4 h-4 text-[#00F5FF]" />
            <span>{lang === 'ka' ? 'შესვლა' : 'Join Discord'}</span>
          </a>
        </div>
      </section>

      {/* AD SLOT 1: home-top */}
      <AdBannerSlot
        ad={adTop}
        lang={lang}
        onNavigateStore={() => onSelectGamemodeStore('smp')}
      />

      {/* GAMEMODES SECTION (SMP & ONEBLOCK) */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              {lang === 'ka' ? 'სათამაშო რეჟიმები' : 'Server Realms & Gamemodes'}
            </h2>
            <p className="text-xs sm:text-sm text-[#C4B5FD]/80">
              {lang === 'ka'
                ? 'აირჩიეთ თქვენი საყვარელი რეჟიმი და იხილეთ შესაბამისი რანკები და გასაღებები'
                : 'Select your preferred realm to explore tailored ranks and crate keys'}
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateInfo}
            className="text-xs sm:text-sm text-[#C4B5FD] hover:text-white underline underline-offset-4 cursor-pointer self-start sm:self-auto"
          >
            {lang === 'ka' ? 'დეტალური ინფორმაცია რეჟიმებზე →' : 'Read full realm guides →'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {gamemodes
            .filter((g) => g.visible)
            .map((gm) => (
              <div
                key={gm.id}
                className="rounded-2xl bg-[#0B0714]/90 border border-white/10 p-6 flex flex-col justify-between gap-5 hover:border-[#8A00FF]/50 transition-colors"
              >
                <div className="space-y-4">
                  <GamemodeArtSvg
                    gamemodeId={gm.id}
                    color={gm.color}
                    bannerUrl={gm.bannerUrl}
                  />
                  <div>
                    <h3
                      className="font-pixel text-xl font-bold"
                      style={{ color: gm.color }}
                    >
                      {gm.name}
                    </h3>
                    <p className="text-sm font-semibold text-white mt-1">
                      {gm.subtitle[lang] || gm.subtitle.ka}
                    </p>
                    <p className="text-xs sm:text-sm text-[#C4B5FD]/80 mt-2 leading-relaxed">
                      {gm.description[lang] || gm.description.ka}
                    </p>
                  </div>
                  <ul className="space-y-1.5 text-xs text-[#F5F3FF]/85 border-t border-white/10 pt-3">
                    {gm.features.map((f, idx) => (
                      <li key={idx}>• {f[lang] || f.ka}</li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onSelectGamemodeStore(gm.id === 'oneblock' ? 'oneblock' : 'smp')
                  }
                  className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-[#8A00FF] text-white text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>
                    {lang === 'ka'
                      ? `${gm.name} მაღაზიის ნახვა`
                      : `Explore ${gm.name} Store`}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))}
        </div>
      </section>

      {/* FEATURED RANKS SECTION */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              {lang === 'ka' ? 'პოპულარული რანკები' : 'Featured Server Ranks'}
            </h2>
            <p className="text-xs sm:text-sm text-[#C4B5FD]/80">
              {lang === 'ka'
                ? 'გამორჩეული სტატუსი, ექსკლუზიური კიტები და დამატებითი შესაძლებლობები'
                : 'Stand out in chat, unlock exclusive kits, and expand your realm capabilities'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSelectGamemodeStore('smp')}
            className="text-xs sm:text-sm text-[#C4B5FD] hover:text-white underline underline-offset-4 cursor-pointer self-start sm:self-auto"
          >
            {lang === 'ka' ? 'ყველა რანკისა და გასაღების ნახვა →' : 'View all ranks & crate keys →'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featuredRanks.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              lang={lang}
              onAddToCart={onAddToCart}
            />
          ))}
        </div>
      </section>

      {/* AD SLOT 2: home-middle */}
      <AdBannerSlot
        ad={adMiddle}
        lang={lang}
        onNavigateStore={() => onSelectGamemodeStore('smp')}
      />

      {/* STAFF PREVIEW & DISCORD CTA */}
      <section className="rounded-2xl bg-[#0B0714]/90 border border-white/10 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
              <Users className="w-5 h-5 text-[#C800FF]" />
              <span>{lang === 'ka' ? 'სერვერის დამფუძნებლები (Staff)' : 'Server Leadership & Staff'}</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#C4B5FD]/80 mt-1">
              {lang === 'ka'
                ? 'ADRENALINEE-ს გუნდი ზრუნავს სერვერის სტაბილურობასა და სამართლიან თამაშზე'
                : 'Dedicated owners ensuring 24/7 uptime, fair play, and continuous updates'}
            </p>
          </div>
          <a
            href={settings.discordInviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 rounded-xl bg-[#8A00FF] hover:bg-[#C800FF] text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            {lang === 'ka' ? 'დაგვიკავშირდით Discord-ზე' : 'Contact Staff on Discord'}
          </a>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {staff.map((member) => (
            <div
              key={member.id}
              className="p-4 rounded-xl bg-[#05030A] border border-white/10 flex flex-col items-center text-center gap-3"
            >
              <StaffAvatar name={member.name} color={member.roleColor} />
              <div>
                <div className="font-pixel text-sm font-bold text-white">
                  {member.name}
                </div>
                <div
                  className="text-xs font-semibold mt-0.5"
                  style={{ color: member.roleColor }}
                >
                  {lang === 'ka' ? member.roleKa : member.role}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* AD SLOT 3: footer */}
      <AdBannerSlot
        ad={adFooter}
        lang={lang}
        onNavigateStore={() => onSelectGamemodeStore('smp')}
      />
    </div>
  );
};
