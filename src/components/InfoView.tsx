import React, { useState } from 'react';
import {
  FaqItem,
  GamemodeInfo,
  Language,
  SiteSettings,
  StaffMember,
} from '../types/store';
import { GamemodeArtSvg, StaffAvatar } from './VoxelArtwork';
import { ChevronDown, BookOpen, ShieldAlert, Truck, HelpCircle, Users, Terminal } from 'lucide-react';

export const InfoView: React.FC<{
  lang: Language;
  settings: SiteSettings;
  gamemodes: GamemodeInfo[];
  faqs: FaqItem[];
  staff: StaffMember[];
}> = ({ lang, settings, gamemodes, faqs, staff }) => {
  const [openFaqId, setOpenFaqId] = useState<string | null>(faqs[0]?.id || null);

  return (
    <div className="space-y-14 pb-12">
      {/* PAGE HEADER */}
      <div className="border-b border-white/10 pb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
          {lang === 'ka'
            ? 'სერვერის გზამკვლევი და ინფორმაცია'
            : 'Server Guide, Rules & Staff'}
        </h1>
        <p className="text-xs sm:text-sm text-[#C4B5FD]/80 mt-1">
          {lang === 'ka'
            ? 'ყველაფერი რაც უნდა იცოდეთ ADRENALINEE-ს რეჟიმების, წესებისა და ავტომატური მაღაზიის შესახებ'
            : 'Everything you need to know about ADRENALINEE gamemodes, rules, automated delivery, and leadership'}
        </p>
      </div>

      {/* GAMEMODES DETAILED DESCRIPTION */}
      <section className="space-y-6">
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-5 h-5 text-[#C800FF]" />
          <h2 className="text-xl font-bold text-white">
            {lang === 'ka' ? 'სათამაშო რეჟიმების აღწერა (SMP & Oneblock)' : 'Gamemode Breakdown (SMP & Oneblock)'}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {gamemodes.map((gm) => (
            <div
              key={gm.id}
              className="rounded-2xl bg-[#0B0714]/90 border border-white/10 p-6 space-y-4"
            >
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
                <p className="text-xs sm:text-sm text-[#C4B5FD]/85 mt-2 leading-relaxed">
                  {gm.description[lang] || gm.description.ka}
                </p>
              </div>
              <ul className="space-y-2 text-xs sm:text-sm text-white/90 border-t border-white/10 pt-3">
                {gm.features.map((feat, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span style={{ color: gm.color }} className="font-bold">
                      •
                    </span>
                    <span>{feat[lang] || feat.ka}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* HOW TO JOIN + HOW BUYING/DELIVERY WORKS */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-[#0B0714]/90 border border-white/10 p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-5 h-5 text-[#00F5FF]" />
            <h2 className="text-lg sm:text-xl font-bold text-white">
              {lang === 'ka' ? 'როგორ შემოვიდეთ სერვერზე' : 'How to Join ADRENALINEE'}
            </h2>
          </div>
          <div className="space-y-3 text-xs sm:text-sm text-[#F5F3FF]/90">
            {settings.howToJoinSteps.map((step, i) => (
              <div
                key={i}
                className="p-3.5 rounded-xl bg-[#05030A] border border-white/10 leading-relaxed"
              >
                {step[lang] || step.ka}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-[#0B0714]/90 border border-white/10 p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <Truck className="w-5 h-5 text-[#C800FF]" />
            <h2 className="text-lg sm:text-xl font-bold text-white">
              {lang === 'ka'
                ? 'როგორ მუშაობს ყიდვა და მიწოდება'
                : 'How Buying & Instant Delivery Works'}
            </h2>
          </div>
          <div className="space-y-3 text-xs sm:text-sm text-[#F5F3FF]/90">
            {settings.buyingDeliveryInfo.map((info, i) => (
              <div
                key={i}
                className="p-3.5 rounded-xl bg-[#05030A] border border-white/10 leading-relaxed"
              >
                {info[lang] || info.ka}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SERVER RULES */}
      <section className="rounded-2xl bg-[#0B0714]/90 border border-white/10 p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 text-[#FF2BD6]" />
          <h2 className="text-xl font-bold text-white">
            {lang === 'ka' ? 'სერვერის წესები' : 'Official Server Rules'}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {settings.rules.map((rule, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-[#05030A] border border-white/10 flex items-start gap-3 text-xs sm:text-sm text-white/90"
            >
              <span className="font-pixel text-xs text-[#C800FF] shrink-0 mt-0.5">
                0{idx + 1}.
              </span>
              <span className="leading-relaxed">{rule[lang] || rule.ka}</span>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ ACCORDION */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5">
          <HelpCircle className="w-5 h-5 text-[#C800FF]" />
          <h2 className="text-xl font-bold text-white">
            {lang === 'ka' ? 'ხშირად დასმული კითხვები (FAQ)' : 'Frequently Asked Questions'}
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq) => {
            const isOpen = openFaqId === faq.id;
            return (
              <div
                key={faq.id}
                className="rounded-xl bg-[#0B0714]/90 border border-white/10 overflow-hidden"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                  className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 hover:bg-white/[0.03] transition-colors cursor-pointer"
                >
                  <span className="text-sm sm:text-base font-semibold text-white">
                    {faq.question[lang] || faq.question.ka}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#C4B5FD] shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 text-xs sm:text-sm text-[#C4B5FD]/90 leading-relaxed border-t border-white/5 pt-3">
                    {faq.answer[lang] || faq.answer.ka}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* STAFF DIRECTORY */}
      <section className="space-y-5">
        <div className="flex items-center gap-2.5">
          <Users className="w-5 h-5 text-[#00F5FF]" />
          <h2 className="text-xl font-bold text-white">
            {lang === 'ka' ? 'ადმინისტრაცია და მფლობელები (STAFF)' : 'ADRENALINEE Staff Directory'}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {staff.map((member) => (
            <div
              key={member.id}
              className="rounded-2xl bg-[#0B0714]/90 border border-white/10 p-6 flex flex-col items-center text-center gap-3 hover:border-[#8A00FF]/50 transition-colors"
            >
              <StaffAvatar name={member.name} color={member.roleColor} />
              <div className="space-y-1">
                <h3 className="font-pixel text-base font-bold text-white">
                  {member.name}
                </h3>
                <div
                  className="text-xs font-semibold"
                  style={{ color: member.roleColor }}
                >
                  {lang === 'ka' ? member.roleKa : member.role}
                </div>
                <div className="text-xs text-[#C4B5FD]/60 font-mono">
                  mc-heads.net/avatar/{member.name}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
