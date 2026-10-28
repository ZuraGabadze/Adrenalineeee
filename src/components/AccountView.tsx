import React, { useState } from 'react';
import {
  Language,
  LinkedUser,
  SiteSettings,
  StoreOrder,
} from '../types/store';
import { formatGel } from '../utils/storeLogic';
import {
  LogIn,
  LogOut,
  ShieldCheck,
  Copy,
  Check,
  Terminal,
  ExternalLink,
  Code2,
  Clock,
  Sparkles,
} from 'lucide-react';

export const AccountView: React.FC<{
  lang: Language;
  settings: SiteSettings;
  user: LinkedUser | null;
  orders: StoreOrder[];
  discordConfigured: boolean;
  callbackUrls: { primary: string; short: string };
  sessionToken: string | null;
  onUserUpdated: (user: LinkedUser | null, token?: string | null) => void;
  onRefreshAuth: () => void;
}> = ({
  lang,
  settings,
  user,
  orders,
  discordConfigured,
  callbackUrls,
  sessionToken,
  onUserUpdated,
  onRefreshAuth,
}) => {
  const [mcInput, setMcInput] = useState(user?.mcNickname || '');
  const [demoDiscordName, setDemoDiscordName] = useState('GeoPlayer_01');
  const [linkCodeData, setLinkCodeData] = useState<{
    code: string;
    mcNickname: string;
    expiresAt: number;
    command: string;
  } | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [showPluginSpec, setShowPluginSpec] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  // Real Popup-Based Discord OAuth2 Flow
  const handleDiscordOAuth = async () => {
    setStatusMsg(null);
    try {
      const redirectUri = `${window.location.origin}/api/auth/discord/callback`;
      const res = await fetch(
        `/api/auth/discord/url?redirectUri=${encodeURIComponent(redirectUri)}`
      );
      const data = await res.json();
      if (!res.ok || !data.url) {
        setStatusMsg({
          type: 'err',
          text:
            data.message ||
            (lang === 'ka'
              ? 'DISCORD_CLIENT_ID არ არის მითითებული Secrets-ში. გამოიყენეთ სწრაფი სატესტო შესვლა ქვემოთ.'
              : 'DISCORD_CLIENT_ID not set in Secrets yet. Use Sandbox Login below to test.'),
        });
        return;
      }

      const popup = window.open(data.url, 'discord_oauth_popup', 'width=600,height=720');
      if (!popup) {
        setStatusMsg({
          type: 'err',
          text:
            lang === 'ka'
              ? 'გთხოვთ დაუშვათ Popup ფანჯრები ბრაუზერში.'
              : 'Please allow popups for this site to sign in with Discord.',
        });
      }
    } catch {
      setStatusMsg({
        type: 'err',
        text: lang === 'ka' ? 'Discord OAuth შეცდომა' : 'Failed to initiate Discord OAuth',
      });
    }
  };

  // Sandbox Discord Login for testing in preview
  const handleDemoDiscordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAction(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/auth/demo-discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discordUsername: demoDiscordName, inGuild: true }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        onUserUpdated(data.user, data.token);
      } else {
        setStatusMsg({ type: 'err', text: data.error || 'Login failed' });
      }
    } finally {
      setLoadingAction(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setLinkCodeData(null);
    onUserUpdated(null, null);
  };

  const handleRequestLinkCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    setLoadingAction(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) headers['X-Session-Token'] = sessionToken;

      const res = await fetch('/api/mc/request-code', {
        method: 'POST',
        headers,
        body: JSON.stringify({ mcNickname: mcInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg({ type: 'err', text: data.error || 'Could not generate code' });
      } else {
        setLinkCodeData(data);
        setStatusMsg({
          type: 'ok',
          text:
            lang === 'ka'
              ? `ერთჯერადი კოდი შეიქმნა (მოქმედებს 10 წუთი): /link ${data.code}`
              : `One-time verification code generated (10m expiry): /link ${data.code}`,
        });
      }
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSimulateInGameLink = async () => {
    if (!linkCodeData) return;
    setLoadingAction(true);
    try {
      const res = await fetch('/api/mc/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Preview-Simulate': 'true',
        },
        body: JSON.stringify({
          code: linkCodeData.code,
          mcNickname: linkCodeData.mcNickname,
          uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
        }),
      });
      const data = await res.json();
      if (res.ok && data.verified) {
        setLinkCodeData(null);
        setStatusMsg({
          type: 'ok',
          text:
            lang === 'ka'
              ? `ანგარიში წარმატებით დადასტურდა! Minecraft ნიკი: ${data.mcNickname}`
              : `Account VERIFIED! Linked Minecraft nickname: ${data.mcNickname}`,
        });
        onRefreshAuth();
      } else {
        setStatusMsg({
          type: 'err',
          text: data.error || 'Verification failed',
        });
      }
    } finally {
      setLoadingAction(false);
    }
  };

  const copyCommand = () => {
    if (!linkCodeData) return;
    navigator.clipboard?.writeText(linkCodeData.command).catch(() => {});
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 1600);
  };

  return (
    <div className="space-y-12 pb-12">
      {/* HEADER */}
      <div className="border-b border-white/10 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            {lang === 'ka'
              ? 'მოთამაშის ანგარიში და ვერიფიკაცია'
              : 'Player Account & Verification'}
          </h1>
          <p className="text-xs sm:text-sm text-[#C4B5FD]/80 mt-1">
            {lang === 'ka'
              ? 'დააკავშირეთ Discord და Minecraft ანგარიშები შეძენისა და ავტომატური მიწოდებისთვის'
              : 'Link your Discord and Minecraft accounts to unlock store checkout and automated delivery'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowPluginSpec((s) => !s)}
          className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-semibold text-[#C4B5FD] flex items-center gap-2 self-start sm:self-auto cursor-pointer"
        >
          <Code2 className="w-4 h-4 text-[#00F5FF]" />
          <span>
            {lang === 'ka'
              ? 'Minecraft პლაგინის API კონტრაქტი'
              : 'Minecraft Plugin API & OAuth Spec'}
          </span>
        </button>
      </div>

      {/* PLUGIN & OAUTH CONTRACT PANEL */}
      {showPluginSpec && (
        <div className="rounded-2xl bg-[#0B0714] border border-[#00F5FF]/40 p-6 space-y-4 text-xs font-mono">
          <div className="text-sm font-sans font-bold text-[#00F5FF]">
            Discord OAuth2 Redirect URLs & Minecraft Plugin HMAC-SHA256 Contract
          </div>
          <div className="space-y-1 text-white/90">
            <div className="text-[#C4B5FD]">
              1. Register these Redirect URLs in Discord Developer Portal → OAuth2 → Redirects:
            </div>
            <div className="p-2.5 rounded bg-[#05030A] border border-white/10 text-emerald-400 break-all">
              {callbackUrls.primary}
            </div>
            <div className="p-2.5 rounded bg-[#05030A] border border-white/10 text-emerald-400 break-all">
              {callbackUrls.short}
            </div>
          </div>

          <div className="space-y-1 text-white/90">
            <div className="text-[#C4B5FD]">
              2. Minecraft Plugin Verification Endpoint: POST /api/mc/verify
            </div>
            <pre className="p-3 rounded bg-[#05030A] border border-white/10 overflow-x-auto text-white/85">
{`Headers:
  Content-Type: application/json
  X-MC-Signature: <hex(HMAC_SHA256(rawJsonBody, MC_PLUGIN_SECRET))>

Request JSON Body:
{
  "code": "ABCD1234",
  "mcNickname": "CHABSKEYYY",
  "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5"
}

Response 200 JSON:
{
  "verified": true,
  "discordId": "123456789012345678",
  "discordUsername": "CHABSKEYYY",
  "mcNickname": "CHABSKEYYY",
  "discordRoleAssigned": true
}`}
            </pre>
          </div>
        </div>
      )}

      {statusMsg && (
        <div
          className={`p-4 rounded-xl border text-xs sm:text-sm ${
            statusMsg.type === 'ok'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      {/* STEP 1 & 2: DISCORD AUTH + MINECRAFT LINKING */}
      {!user ? (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="rounded-2xl bg-[#0B0714]/90 border border-[#8A00FF]/40 p-6 sm:p-8 space-y-5 shadow-[0_0_35px_rgba(138,0,255,0.2)]">
            <h2 className="text-xl font-bold text-white">
              {lang === 'ka' ? '1. ავტორიზაცია Discord-ით' : '1. Sign In with Discord'}
            </h2>
            <p className="text-xs sm:text-sm text-[#C4B5FD]/85 leading-relaxed">
              {lang === 'ka'
                ? 'შედით თქვენი Discord ანგარიშით. სისტემა გადაამოწმებს, რომ ხართ ADRENALINEE-ს Discord სერვერის წევრი (scopes: identify guilds.members.read).'
                : 'Authenticate via Discord OAuth2. We verify your membership in the official ADRENALINEE Discord guild (scopes: identify guilds.members.read).'}
            </p>
            <button
              type="button"
              onClick={handleDiscordOAuth}
              className="w-full py-3.5 px-5 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-sm flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Login with Discord (OAuth2)</span>
            </button>
          </div>

          <form
            onSubmit={handleDemoDiscordLogin}
            className="rounded-xl bg-[#0B0714]/60 border border-white/10 p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#00F5FF]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {discordConfigured
                    ? lang === 'ka'
                      ? 'სწრაფი სატესტო რეჟიმი'
                      : 'Quick Sandbox Preview'
                    : lang === 'ka'
                    ? 'სატესტო შესვლა (Preview Sandbox)'
                    : 'Preview Sandbox Login'}
                </span>
              </div>
              <p className="text-xs text-[#C4B5FD]/75">
                {lang === 'ka'
                  ? 'შეამოწმეთ /link კოდი და შეკვეთები Discord Secrets-ის გარეშე:'
                  : 'Test /link verification & checkout before adding Discord Secrets:'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="text"
                aria-label="Sandbox Discord Username"
                value={demoDiscordName}
                onChange={(e) => setDemoDiscordName(e.target.value)}
                required
                className="w-36 sm:w-44 px-3 py-2 rounded-lg bg-[#05030A] border border-white/15 text-xs text-white"
              />
              <button
                type="submit"
                disabled={loadingAction}
                className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-[#8A00FF] text-white font-semibold text-xs whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                {lang === 'ka' ? 'სატესტო შესვლა' : 'Sandbox Login'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* PROFILE CARD */}
          <div className="rounded-2xl bg-[#0B0714]/90 border border-white/10 p-6 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <img
                  src={user.discordAvatar}
                  alt={user.discordUsername}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-2xl border border-[#8A00FF]/50 object-cover"
                />
                <div>
                  <div className="text-lg font-bold text-white">{user.discordUsername}</div>
                  <div className="text-xs text-[#C4B5FD]/80 font-nums">ID: {user.id}</div>
                  <div className="mt-1 text-xs">
                    {user.verified && user.mcNickname ? (
                      <span className="text-emerald-400 font-semibold">
                        ✓ {lang === 'ka' ? 'ვერიფიცირებული' : 'VERIFIED'} · {user.mcNickname}
                      </span>
                    ) : (
                      <span className="text-amber-400 font-semibold">
                        • {lang === 'ka' ? 'საჭიროებს Minecraft მიბმას' : 'Pending Minecraft Link'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="px-3.5 py-2 rounded-lg bg-white/5 hover:bg-rose-500/20 text-xs font-semibold text-rose-300 flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{lang === 'ka' ? 'გასვლა' : 'Logout'}</span>
              </button>
            </div>

            {!user.inGuild && (
              <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 space-y-2.5 text-xs text-amber-200">
                <p>
                  {lang === 'ka'
                    ? 'თქვენ არ ხართ ADRENALINEE-ს Discord სერვერის წევრი. გთხოვთ გაწევრიანდეთ ვერიფიკაციის გასაგრძელებლად.'
                    : 'You are not a member of the ADRENALINEE Discord guild yet. Please join to proceed.'}
                </p>
                <a
                  href={settings.discordInviteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-[#05030A] font-bold"
                >
                  <span>{lang === 'ka' ? 'Discord სერვერზე შესვლა' : 'Join Discord Server'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>

          {/* MINECRAFT /LINK CODE GENERATOR */}
          <div className="rounded-2xl bg-[#0B0714]/90 border border-[#8A00FF]/40 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-[#C800FF]" />
              <h2 className="text-lg font-bold text-white">
                {lang === 'ka'
                  ? 'Minecraft ნიკის დაკავშირება (/link CODE)'
                  : 'Link Minecraft Nickname (/link CODE)'}
              </h2>
            </div>

            <form onSubmit={handleRequestLinkCode} className="space-y-3">
              <label className="block text-xs text-[#C4B5FD]">
                {lang === 'ka'
                  ? 'შეიყვანეთ თქვენი ზუსტი Minecraft ნიკნეიმი:'
                  : 'Enter your exact in-game Minecraft username:'}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={mcInput}
                  onChange={(e) => setMcInput(e.target.value)}
                  placeholder="CHABSKEYYY"
                  required
                  className="flex-1 px-3.5 py-2.5 rounded-lg bg-[#05030A] border border-white/15 text-sm text-white font-pixel"
                />
                <button
                  type="submit"
                  disabled={loadingAction}
                  className="px-4 py-2.5 rounded-lg bg-[#8A00FF] hover:bg-[#C800FF] text-white font-bold text-xs sm:text-sm whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {lang === 'ka' ? 'კოდის მიღება' : 'Generate Code'}
                </button>
              </div>
            </form>

            {linkCodeData && (
              <div className="p-4 rounded-xl bg-[#05030A] border border-[#00F5FF]/40 space-y-3">
                <div className="flex items-center justify-between text-xs text-[#C4B5FD]">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#00F5FF]" />
                    {lang === 'ka'
                      ? 'შედით სერვერზე და ჩაწერეთ ბრძანება (10 წთ):'
                      : 'Run this command in-game within 10 minutes:'}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-[#0B0714] px-4 py-2.5 rounded-lg border border-white/10">
                  <code className="font-pixel text-base text-[#00F5FF]">
                    {linkCodeData.command}
                  </code>
                  <button
                    type="button"
                    onClick={copyCommand}
                    className="text-xs text-white/80 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCmd ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSimulateInGameLink}
                  className="w-full py-2.5 px-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {lang === 'ka'
                      ? 'სიმულაცია: თამაშში /link კოდის დადასტურება'
                      : 'Simulate In-Game /link CODE Verification'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ORDER HISTORY */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">
          {lang === 'ka' ? 'თქვენი შეკვეთების ისტორია' : 'Your Order History'}
        </h2>

        {!user || orders.length === 0 ? (
          <div className="rounded-2xl bg-[#0B0714]/90 border border-white/10 p-8 text-center text-xs sm:text-sm text-[#C4B5FD]/75">
            {lang === 'ka'
              ? 'შეკვეთები ჯერ არ ფიქსირდება.'
              : 'No orders found for this account yet.'}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0B0714]/90">
            <table className="w-full text-left border-collapse text-xs sm:text-sm font-nums">
              <thead>
                <tr className="border-b border-white/10 bg-[#05030A] text-[#C4B5FD]">
                  <th className="py-3.5 px-4">ID</th>
                  <th className="py-3.5 px-4">{lang === 'ka' ? 'მოთამაშე' : 'Player'}</th>
                  <th className="py-3.5 px-4">{lang === 'ka' ? 'ნივთები' : 'Items'}</th>
                  <th className="py-3.5 px-4">{lang === 'ka' ? 'ჯამი' : 'Total'}</th>
                  <th className="py-3.5 px-4">{lang === 'ka' ? 'სტატუსი' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {orders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-white/[0.02]">
                    <td className="py-3.5 px-4 font-mono text-white font-semibold">
                      {ord.id}
                    </td>
                    <td className="py-3.5 px-4 text-[#C4B5FD]">{ord.mcNickname}</td>
                    <td className="py-3.5 px-4 text-white/90">
                      {ord.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-white">
                      {formatGel(ord.totalGel)}
                    </td>
                    <td className="py-3.5 px-4 uppercase font-semibold">
                      <span
                        className={
                          ord.status === 'delivered'
                            ? 'text-emerald-400'
                            : ord.status === 'pending'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }
                      >
                        {ord.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
