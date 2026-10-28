import React from 'react';
import { Language, SiteSettings, StoreProduct } from '../types/store';
import { ProductCard } from './ProductCard';
import { formatGel } from '../utils/storeLogic';
import { Sparkles, KeyRound, Shield } from 'lucide-react';

export const StoreView: React.FC<{
  lang: Language;
  selectedGamemode: 'smp' | 'oneblock';
  onChangeGamemode: (gm: 'smp' | 'oneblock') => void;
  products: StoreProduct[];
  settings: SiteSettings;
  onAddToCart: (productId: string, qty: number) => void;
}> = ({
  lang,
  selectedGamemode,
  onChangeGamemode,
  products,
  settings,
  onAddToCart,
}) => {
  const ranks = products
    .filter((p) => p.visible && p.type === 'rank' && p.gamemode === selectedGamemode)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const keys = products
    .filter(
      (p) =>
        p.visible &&
        p.type === 'key' &&
        (p.gamemode === 'global' || p.gamemode === selectedGamemode)
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Comparison matrix rows
  const smpComparisonRows = [
    {
      label: { ka: 'ჩატის პრეფიქსი', en: 'Chat & Tab Prefix' },
      values: ['[VIP]', '[VIP+]', '[MVP]', '[MVP+]', '[SPONSOR]'],
    },
    {
      label: { ka: 'სახლების რაოდენობა (/sethome)', en: 'Max Homes (/sethome)' },
      values: ['3', '5', '8', '12', '20'],
    },
    {
      label: { ka: '/hat და /workbench', en: '/hat & /workbench' },
      values: ['✓', '✓', '✓', '✓', '✓'],
    },
    {
      label: { ka: '/ec, /feed (30წთ) და /nick', en: '/ec, /feed (30m) & /nick' },
      values: ['—', '✓', '✓', '✓', '✓'],
    },
    {
      label: { ka: '/heal (1სთ), /repair (24სთ), ფერადი ჩატი', en: '/heal (1h), /repair (24h), Colored Chat' },
      values: ['—', '—', '✓', '✓', '✓'],
    },
    {
      label: { ka: '/disposal, /sit, /lay, /near, Particles & Pets', en: '/disposal, /sit, /lay, /near, Particles & Pets' },
      values: ['—', '—', '—', '✓', '✓'],
    },
    {
      label: { ka: 'ფრენა Claim-ში (/fly) + თვიური Void Key', en: 'Claim Flight (/fly) + Monthly Void Key' },
      values: ['—', '—', '—', '—', '✓'],
    },
  ];

  const oneblockComparisonRows = [
    {
      label: { ka: 'ჩატის პრეფიქსი', en: 'Chat & Tab Prefix' },
      values: ['[IRON]', '[GOLD]', '[DIAMOND]', '[EMERALD]', '[SPONSOR]'],
    },
    {
      label: { ka: 'კუნძულის ზომის ბონუსი', en: 'Island Size Bonus' },
      values: ['+25', '+50', '+100', '+150', 'MAX'],
    },
    {
      label: { ka: 'კუნძულის წევრების ბონუსი', en: 'Island Team Members' },
      values: ['+2', '+4', '+4', '+8', 'MAX'],
    },
    {
      label: { ka: 'კუნძულზე ფრენა (/fly) და /feed', en: 'Island Flight (/fly) & /feed' },
      values: ['—', '✓', '✓', '✓', '✓'],
    },
    {
      label: { ka: '/ec, /heal და /repair (24სთ)', en: '/ec, /heal & /repair (24h)' },
      values: ['—', '—', '✓', '✓', '✓'],
    },
    {
      label: { ka: '/nick, კოსმეტიკური ნაწილაკები და Pets', en: '/nick, Particles & Pets' },
      values: ['—', '—', '—', '✓', '✓'],
    },
    {
      label: { ka: 'კუნძულის კოსმეტიკა + თვიური Abyssal Key', en: 'Island Cosmetics + Monthly Abyssal Key' },
      values: ['—', '—', '—', '—', '✓'],
    },
  ];

  const comparisonRows =
    selectedGamemode === 'smp' ? smpComparisonRows : oneblockComparisonRows;

  return (
    <div className="space-y-14 pb-12">
      {/* STORE HEADER & GAMEMODE TABS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            {lang === 'ka' ? 'სერვერის მაღაზია' : 'Official Server Store'}
          </h1>
          <p className="text-xs sm:text-sm text-[#C4B5FD]/80 mt-1">
            {lang === 'ka'
              ? 'აირჩიეთ რეჟიმი (SMP ან Oneblock) — ყველა რანკი და გასაღები იგზავნება ავტომატურად'
              : 'Switch between SMP and Oneblock — all ranks and crate keys deliver automatically'}
          </p>
        </div>

        {/* Interactive Filter Tabs (SMP | Oneblock) */}
        <div
          role="tablist"
          aria-label="Select Store Gamemode"
          className="inline-flex items-center gap-1.5 p-1.5 rounded-xl bg-[#0B0714] border border-[#8A00FF]/40 self-start"
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedGamemode === 'smp'}
            onClick={() => onChangeGamemode('smp')}
            className={`px-5 py-2.5 rounded-lg text-xs sm:text-sm font-pixel transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              selectedGamemode === 'smp'
                ? 'bg-[#8A00FF] text-white shadow-[0_0_16px_rgba(138,0,255,0.5)]'
                : 'text-[#C4B5FD] hover:text-white'
            }`}
          >
            SMP REALM
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={selectedGamemode === 'oneblock'}
            onClick={() => onChangeGamemode('oneblock')}
            className={`px-5 py-2.5 rounded-lg text-xs sm:text-sm font-pixel transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              selectedGamemode === 'oneblock'
                ? 'bg-[#C800FF] text-white shadow-[0_0_16px_rgba(200,0,255,0.5)]'
                : 'text-[#C4B5FD] hover:text-white'
            }`}
          >
            ONEBLOCK
          </button>
        </div>
      </div>

      {/* SECTION 1: RANKS GRID */}
      <section className="space-y-6">
        <div className="flex items-center gap-2.5">
          <Shield className="w-5 h-5 text-[#C800FF]" />
          <h2 className="text-xl font-bold text-white">
            {selectedGamemode === 'smp'
              ? lang === 'ka'
                ? 'SMP რანკები (VIP — SPONSOR)'
                : 'SMP Ranks (VIP — SPONSOR)'
              : lang === 'ka'
              ? 'Oneblock რანკები (IRON — SPONSOR)'
              : 'Oneblock Ranks (IRON — SPONSOR)'}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ranks.map((rank) => (
            <ProductCard
              key={rank.id}
              product={rank}
              lang={lang}
              onAddToCart={onAddToCart}
            />
          ))}
        </div>
      </section>

      {/* SECTION 2: CRATE KEYS SECTION */}
      <section id="store-keys" className="space-y-6 pt-6 border-t border-white/10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
              <KeyRound className="w-5 h-5 text-[#00F5FF]" />
              <span>
                {lang === 'ka' ? 'სკივრის გასაღებები (Crate Keys)' : 'Mystic Crate Keys'}
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-[#C4B5FD]/80">
              {lang === 'ka'
                ? 'გახსენით უნიკალური სკივრები სპაუნზე და მოიგეთ იშვიათი აღჭურვილობა, რესურსები და რანკები'
                : 'Open mystical crates at spawn to win legendary gear, spawners, and permanent ranks'}
            </p>
          </div>

          {settings.bundleDiscountsEnabled && (
            <div className="px-4 py-2.5 rounded-xl bg-[#0B0714] border border-[#00F5FF]/35 text-xs text-[#C4B5FD] flex items-center gap-2 font-nums">
              <Sparkles className="w-4 h-4 text-[#00F5FF] shrink-0" />
              <span>
                {lang === 'ka'
                  ? 'Bundle ფასდაკლება: 3+ გასაღები = -5% · 5+ = -10% · 10+ = -15%'
                  : 'Bundle Discounts: 3+ Keys = -5% · 5+ = -10% · 10+ = -15%'}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {keys.map((keyItem) => (
            <ProductCard
              key={keyItem.id}
              product={keyItem}
              lang={lang}
              onAddToCart={onAddToCart}
            />
          ))}
        </div>
      </section>

      {/* SECTION 3: PERK COMPARISON TABLE */}
      {ranks.length > 0 && (
        <section className="space-y-4 pt-6 border-t border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white">
              {lang === 'ka'
                ? `${selectedGamemode.toUpperCase()} რანკების შედარების ცხრილი`
                : `${selectedGamemode.toUpperCase()} Rank Perk Comparison`}
            </h2>
            <p className="text-xs text-[#C4B5FD]/75">
              {lang === 'ka'
                ? 'თითოეული მაღალი რანკი ავტომატურად მოიცავს წინა რანკის ყველა პრივილეგიას'
                : 'Perks are cumulative — each higher tier includes all privileges from previous tiers'}
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0B0714]/90">
            <table className="w-full text-left border-collapse text-xs sm:text-sm font-nums">
              <thead>
                <tr className="border-b border-white/10 bg-[#05030A]">
                  <th className="py-3.5 px-4 text-[#C4B5FD] font-semibold">
                    {lang === 'ka' ? 'პრივილეგია / ფუნქცია' : 'Privilege / Feature'}
                  </th>
                  {ranks.slice(0, 5).map((r) => (
                    <th
                      key={r.id}
                      className="py-3.5 px-4 text-center font-pixel"
                      style={{ color: r.color }}
                    >
                      <div>{r.name}</div>
                      <div className="text-xs font-sans text-white/80 mt-0.5">
                        {formatGel(r.price)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {comparisonRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02]">
                    <td className="py-3 px-4 text-white/90 font-medium">
                      {row.label[lang]}
                    </td>
                    {row.values.map((val, vIdx) => (
                      <td
                        key={vIdx}
                        className={`py-3 px-4 text-center font-semibold ${
                          val === '—' ? 'text-white/25' : 'text-[#C4B5FD]'
                        }`}
                      >
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
