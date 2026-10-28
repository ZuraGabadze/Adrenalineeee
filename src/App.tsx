import React, { useEffect, useState, useCallback } from 'react';
import {
  AdBanner,
  CartItem,
  CouponCode,
  FaqItem,
  GamemodeInfo,
  Language,
  LinkedUser,
  LiveServerStatus,
  SiteSettings,
  StaffMember,
  StoreOrder,
  StoreProduct,
} from './types/store';
import { INITIAL_STORE_DB } from './data/seedData';
import { subscribeFirestoreRealtime } from './firebase';
import { HomeView } from './components/HomeView';
import { StoreView } from './components/StoreView';
import { InfoView } from './components/InfoView';
import { AccountView } from './components/AccountView';
import { CartDrawer } from './components/CartDrawer';
import { AdminLoginModal, AdminOverlay } from './components/AdminOverlay';
import { ShoppingBag, Globe, Wrench, ShieldAlert, X } from 'lucide-react';

type ActivePage = 'home' | 'store' | 'info' | 'account' | '404';

export default function App() {
  const [lang, setLang] = useState<Language>('ka');
  const [page, setPage] = useState<ActivePage>('home');
  const [selectedGamemode, setSelectedGamemode] = useState<'smp' | 'oneblock'>('smp');

  // Store state (hydrated from server & synced live via SSE + Firestore)
  const [settings, setSettings] = useState<SiteSettings>(INITIAL_STORE_DB.settings);
  const [gamemodes, setGamemodes] = useState<GamemodeInfo[]>(INITIAL_STORE_DB.gamemodes);
  const [products, setProducts] = useState<StoreProduct[]>(INITIAL_STORE_DB.products);
  const [staff, setStaff] = useState<StaffMember[]>(INITIAL_STORE_DB.staff);
  const [ads, setAds] = useState<AdBanner[]>(INITIAL_STORE_DB.ads);
  const [faqs, setFaqs] = useState<FaqItem[]>(INITIAL_STORE_DB.faqs);
  const [coupons, setCoupons] = useState<CouponCode[]>(INITIAL_STORE_DB.coupons);
  const [liveStatus, setLiveStatus] = useState<LiveServerStatus | null>(null);

  // User Auth & Cart
  const [user, setUser] = useState<LinkedUser | null>(null);
  const [userOrders, setUserOrders] = useState<StoreOrder[]>([]);
  const [discordConfigured, setDiscordConfigured] = useState(false);
  const [callbackUrls, setCallbackUrls] = useState({
    primary: `${window.location.origin}/api/auth/discord/callback`,
    short: `${window.location.origin}/auth/callback`,
  });
  const [sessionToken, setSessionToken] = useState<string | null>(() =>
    localStorage.getItem('adrenalinee_session_token')
  );
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  // Hidden Admin State
  const [adminLoginOpen, setAdminLoginOpen] = useState(false);
  const [needsInitialAdminSetup, setNeedsInitialAdminSetup] = useState(false);
  const [adminSession, setAdminSession] = useState<{
    username: string;
    csrfToken: string;
    token: string;
  } | null>(() => {
    try {
      const saved = sessionStorage.getItem('adrenalinee_admin_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [adminOverlayOpen, setAdminOverlayOpen] = useState(false);

  // UI Effects & Anti-Inspect Warning
  const [toast, setToast] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: -500, y: -500 });
  const [inspectWarning, setInspectWarning] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  // Apply dynamic CSS palette variables from Admin Settings
  useEffect(() => {
    const root = document.documentElement;
    const p = settings.palette;
    if (!p) return;
    root.style.setProperty('--bg-primary', p.bgPrimary);
    root.style.setProperty('--bg-secondary', p.bgSecondary);
    root.style.setProperty('--color-primary', p.primaryPurple);
    root.style.setProperty('--color-electric', p.electricViolet);
    root.style.setProperty('--color-indigo', p.deepIndigo);
    root.style.setProperty('--color-lavender', p.lavenderAccent);
    root.style.setProperty('--color-magenta', p.neonMagenta);
    root.style.setProperty('--color-cyan', p.cyanAccent);
  }, [settings.palette]);

  // Fetch initial state & connect SSE real-time stream + Firestore listener
  useEffect(() => {
    fetch('/api/state')
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) setSettings(d.settings);
        if (d.gamemodes) setGamemodes(d.gamemodes);
        if (d.products) setProducts(d.products);
        if (d.staff) setStaff(d.staff);
        if (d.ads) setAds(d.ads);
        if (d.faqs) setFaqs(d.faqs);
        if (d.coupons) setCoupons(d.coupons);
      })
      .catch(() => {});

    const es = new EventSource('/api/events');
    es.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data);
        if (parsed.type === 'STORE_SYNC' && parsed.payload) {
          const d = parsed.payload;
          if (d.settings) setSettings(d.settings);
          if (d.gamemodes) setGamemodes(d.gamemodes);
          if (d.products) setProducts(d.products);
          if (d.staff) setStaff(d.staff);
          if (d.ads) setAds(d.ads);
          if (d.faqs) setFaqs(d.faqs);
          if (d.coupons) setCoupons(d.coupons);
        }
      } catch {
        // ignore
      }
    };

    const unsubFirestore = subscribeFirestoreRealtime((partialSettings) => {
      setSettings((prev) => ({ ...prev, ...partialSettings }));
    });

    return () => {
      es.close();
      unsubFirestore();
    };
  }, []);

  // Poll Live Server Status every 30s
  useEffect(() => {
    const loadLive = () => {
      fetch('/api/live-status')
        .then((r) => r.json())
        .then((data: LiveServerStatus) => setLiveStatus(data))
        .catch(() => {});
    };
    loadLive();
    const interval = setInterval(loadLive, 30_000);
    return () => clearInterval(interval);
  }, [settings.serverIp, settings.discordInviteCode]);

  // Fetch current user session
  const fetchAuthMe = useCallback(
    (overrideToken?: string | null) => {
      const tok = overrideToken !== undefined ? overrideToken : sessionToken;
      const headers: Record<string, string> = {};
      if (tok) headers['X-Session-Token'] = tok;
      fetch('/api/auth/me', { headers })
        .then((r) => r.json())
        .then((d) => {
          setUser(d.user || null);
          setUserOrders(d.orders || []);
          setDiscordConfigured(Boolean(d.discordConfigured));
          if (d.callbackUrls) setCallbackUrls(d.callbackUrls);
        })
        .catch(() => {});
    },
    [sessionToken]
  );

  useEffect(() => {
    fetchAuthMe();
  }, [fetchAuthMe]);

  // Listen for Discord OAuth popup postMessage
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const tok = event.data.token || null;
        if (tok) {
          localStorage.setItem('adrenalinee_session_token', tok);
          setSessionToken(tok);
        }
        fetchAuthMe(tok);
        showToast(
          lang === 'ka'
            ? 'Discord ავტორიზაცია წარმატებით დასრულდა!'
            : 'Discord login successful!'
        );
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchAuthMe, lang, showToast]);

  // Anti-Inspect Deterrents (context menu, F12, Ctrl+Shift+I/J/C, Ctrl+U/S)
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (typeof e.key !== 'string') return;
      const key = e.key.toUpperCase();
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(key)) ||
        (e.ctrlKey && ['U', 'S'].includes(key))
      ) {
        e.preventDefault();
        setInspectWarning(true);
      }
    };
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // Hidden Triple-Click Admin Panel Trigger (event.detail === 3 && event.button === 0)
  const handleGlobalClick = async (e: React.MouseEvent) => {
    if (e.detail === 3 && e.button === 0) {
      if (adminSession) {
        setAdminOverlayOpen(true);
        return;
      }
      try {
        const res = await fetch('/api/admin/session', { credentials: 'include' });
        const data = await res.json();
        setNeedsInitialAdminSetup(Boolean(data.needsInitialPasswordSetup));
        if (data.authenticated && data.username && data.csrfToken) {
          const restored = {
            username: data.username,
            csrfToken: data.csrfToken,
            token: data.token || '',
          };
          sessionStorage.setItem('adrenalinee_admin_session', JSON.stringify(restored));
          setAdminSession(restored);
          setAdminOverlayOpen(true);
          return;
        }
      } catch {
        // ignore
      }
      setAdminLoginOpen(true);
    }
  };

  // Cart Handlers
  const handleAddToCart = (productId: string, quantity: number) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === productId
            ? { ...i, quantity: Math.min(99, i.quantity + quantity) }
            : i
        );
      }
      return [...prev, { productId, quantity }];
    });
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      showToast(
        lang === 'ka'
          ? `${prod.name} დაემატა კალათაში!`
          : `${prod.name} added to cart!`
      );
    }
  };

  const handleUpdateCartQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.productId === productId ? { ...i, quantity: i.quantity + delta } : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const handleRemoveCartItem = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  };

  const totalCartItems = cart.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <div
      onClick={handleGlobalClick}
      onMouseMove={(e) => setCursorPos({ x: e.clientX, y: e.clientY })}
      className="min-h-screen bg-noise-pattern relative flex flex-col justify-between selection:bg-[#8A00FF] selection:text-white"
    >
      {/* Subtle Interactive Cursor Glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0 hidden lg:block transition-opacity duration-300"
        style={{
          background: `radial-gradient(500px circle at ${cursorPos.x}px ${cursorPos.y}px, rgba(138, 0, 255, 0.09), transparent 70%)`,
        }}
      />

      {/* Anti-Inspect Deterrent Blur Overlay */}
      {inspectWarning && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-6 text-center">
          <div className="max-w-md rounded-2xl bg-[#0B0714] border border-rose-500/50 p-6 space-y-4">
            <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto" />
            <h2 className="text-lg font-bold text-white">
              {lang === 'ka'
                ? 'უსაფრთხოების დაცვა გააქტიურებულია'
                : 'Security Protection Active'}
            </h2>
            <p className="text-xs text-[#C4B5FD]">
              {lang === 'ka'
                ? 'დეველოპერის ხელსაწყოები (DevTools / Inspect) შეზღუდულია ADRENALINEE-ს მაღაზიაში.'
                : 'Developer inspection shortcuts are restricted on the ADRENALINEE Store.'}
            </p>
            <button
              type="button"
              onClick={() => setInspectWarning(false)}
              className="px-5 py-2 rounded-lg bg-[#8A00FF] text-white text-xs font-bold cursor-pointer"
            >
              {lang === 'ka' ? 'დაბრუნება საიტზე' : 'Return to Store'}
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-[#0B0714] border border-[#C800FF] text-white text-xs sm:text-sm font-semibold shadow-[0_0_24px_rgba(200,0,255,0.45)] flex items-center gap-2.5">
          <span>{toast}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-[#C4B5FD] hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div>
        {/* Slim Dismissible Top Announcement Bar */}
        {settings.announcementEnabled && (
          <div className="bg-gradient-to-r from-[#4C1D95] via-[#8A00FF] to-[#4C1D95] text-white text-xs py-2 px-4 text-center font-medium">
            {settings.announcement[lang] || settings.announcement.ka}
          </div>
        )}

        {/* TOP BAR CONTRACT: Strictly 3 Zones separated by gap-8 */}
        <header className="sticky top-0 z-30 bg-[#05030A]/85 backdrop-blur-md border-b border-white/10">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3.5 flex flex-wrap md:flex-nowrap items-center justify-between gap-3 md:gap-8">
            {/* Zone 1: Single Text Element Wordmark */}
            <a
              href="#home"
              onClick={(e) => {
                e.preventDefault();
                setPage('home');
              }}
              className="font-pixel text-base sm:text-xl font-bold tracking-wider text-white logo-glitch whitespace-nowrap shrink-0"
            >
              {settings.serverName}
            </a>

            {/* Zone 2: 4 Concise Single-Line Navigation Links */}
            <nav
              aria-label="Primary Navigation"
              className="order-3 md:order-2 w-full md:w-auto flex items-center justify-center gap-5 sm:gap-7 text-xs sm:text-sm font-medium text-[#C4B5FD] pt-2 md:pt-0 border-t md:border-t-0 border-white/5"
            >
              <a
                href="#home"
                onClick={(e) => {
                  e.preventDefault();
                  setPage('home');
                }}
                className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                  page === 'home' ? 'text-white underline underline-offset-8 decoration-[#C800FF]' : ''
                }`}
              >
                {lang === 'ka' ? 'მთავარი' : 'Home'}
              </a>
              <a
                href="#store"
                onClick={(e) => {
                  e.preventDefault();
                  setPage('store');
                }}
                className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                  page === 'store' ? 'text-white underline underline-offset-8 decoration-[#C800FF]' : ''
                }`}
              >
                {lang === 'ka' ? 'მაღაზია' : 'Store'}
              </a>
              <a
                href="#info"
                onClick={(e) => {
                  e.preventDefault();
                  setPage('info');
                }}
                className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                  page === 'info' ? 'text-white underline underline-offset-8 decoration-[#C800FF]' : ''
                }`}
              >
                {lang === 'ka' ? 'ინფორმაცია' : 'Info'}
              </a>
              <a
                href="#account"
                onClick={(e) => {
                  e.preventDefault();
                  setPage('account');
                }}
                className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                  page === 'account' ? 'text-white underline underline-offset-8 decoration-[#C800FF]' : ''
                }`}
              >
                {lang === 'ka' ? 'ანგარიში' : 'Account'}
              </a>
            </nav>

            {/* Zone 3: 1 Primary Action (Cart Drawer Trigger) */}
            <div className="order-2 md:order-3 flex items-center shrink-0">
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="px-3.5 sm:px-4 py-2 rounded-lg bg-[#8A00FF] hover:bg-[#C800FF] text-white text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer font-nums"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>
                  {lang === 'ka' ? 'კალათა' : 'Cart'} ({totalCartItems})
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* Sub-Toolbar for Language Toggle & User Status */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 flex items-center justify-between text-xs text-[#C4B5FD]">
          <div className="flex items-center gap-2">
            <span>
              {user
                ? `${user.discordUsername}${user.mcNickname ? ` · ${user.mcNickname}` : ''}`
                : lang === 'ka'
                ? 'სტუმრის რეჟიმი'
                : 'Browsing as Guest'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-[#C800FF]" />
            <button
              type="button"
              onClick={() => setLang(lang === 'ka' ? 'en' : 'ka')}
              className="px-2.5 py-1 rounded bg-[#0B0714] border border-white/15 hover:border-[#C800FF] text-white font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              {lang === 'ka' ? 'KA · გადართე EN-ზე' : 'EN · Switch to KA'}
            </button>
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          {settings.maintenanceMode ? (
            <div className="my-16 p-12 rounded-3xl bg-[#0B0714] border border-[#8A00FF]/40 text-center max-w-xl mx-auto space-y-4">
              <Wrench className="w-12 h-12 text-[#C800FF] mx-auto" />
              <h1 className="text-2xl font-bold text-white">
                {lang === 'ka'
                  ? 'საიტზე მიმდინარეობს ტექნიკური სამუშაოები'
                  : 'Store Under Scheduled Maintenance'}
              </h1>
              <p className="text-xs sm:text-sm text-[#C4B5FD]/85">
                {lang === 'ka'
                  ? 'ADRENALINEE-ს მაღაზია დროებით განახლების რეჟიმშია. მალე დავბრუნდებით!'
                  : 'ADRENALINEE Store is currently undergoing upgrades. Check back shortly!'}
              </p>
            </div>
          ) : page === 'home' ? (
            <HomeView
              lang={lang}
              settings={settings}
              liveStatus={liveStatus}
              gamemodes={gamemodes}
              products={products}
              staff={staff}
              ads={ads}
              onCopyIp={() => {
                navigator.clipboard?.writeText(settings.serverIp).catch(() => {});
                showToast(
                  lang === 'ka'
                    ? `სერვერის IP დაკოპირდა: ${settings.serverIp}`
                    : `Copied server IP: ${settings.serverIp}`
                );
              }}
              onSelectGamemodeStore={(gm) => {
                setSelectedGamemode(gm);
                setPage('store');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onAddToCart={handleAddToCart}
              onNavigateInfo={() => {
                setPage('info');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          ) : page === 'store' ? (
            <StoreView
              lang={lang}
              selectedGamemode={selectedGamemode}
              onChangeGamemode={setSelectedGamemode}
              products={products}
              settings={settings}
              onAddToCart={handleAddToCart}
            />
          ) : page === 'info' ? (
            <InfoView
              lang={lang}
              settings={settings}
              gamemodes={gamemodes}
              faqs={faqs}
              staff={staff}
            />
          ) : page === 'account' ? (
            <AccountView
              lang={lang}
              settings={settings}
              user={user}
              orders={userOrders}
              discordConfigured={discordConfigured}
              callbackUrls={callbackUrls}
              sessionToken={sessionToken}
              onUserUpdated={(nextUser, tok) => {
                setUser(nextUser);
                if (tok) {
                  localStorage.setItem('adrenalinee_session_token', tok);
                  setSessionToken(tok);
                } else if (tok === null) {
                  localStorage.removeItem('adrenalinee_session_token');
                  setSessionToken(null);
                }
                fetchAuthMe(tok);
              }}
              onRefreshAuth={() => fetchAuthMe()}
            />
          ) : (
            <div className="my-16 p-12 rounded-3xl bg-[#0B0714] border border-white/10 text-center max-w-lg mx-auto space-y-4">
              <div className="font-pixel text-4xl text-[#C800FF]">404</div>
              <h1 className="text-xl font-bold text-white">
                {lang === 'ka' ? 'გვერდი ვერ მოიძებნა' : 'Page Not Found'}
              </h1>
              <button
                type="button"
                onClick={() => setPage('home')}
                className="px-5 py-2.5 rounded-xl bg-[#8A00FF] text-white text-xs font-bold cursor-pointer"
              >
                {lang === 'ka' ? 'მთავარ გვერდზე დაბრუნება' : 'Return Home'}
              </button>
            </div>
          )}
        </main>
      </div>

      {/* CLEAN FOOTER */}
      <footer className="relative z-10 border-t border-white/10 bg-[#0B0714]/80 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#C4B5FD]/75">
          <div>
            © {new Date().getFullYear()} {settings.serverName} Network ({settings.serverIp}).{' '}
            {lang === 'ka'
              ? 'არ არის დაკავშირებული Mojang AB-სთან.'
              : 'Not affiliated with Mojang AB.'}
          </div>
          <div className="flex items-center gap-6">
            <a
              href={settings.discordInviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Discord
            </a>
            <button
              type="button"
              onClick={() => setPage('info')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              {lang === 'ka' ? 'წესები და FAQ' : 'Rules & FAQ'}
            </button>
            <button
              type="button"
              onClick={() => setPage('store')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              {lang === 'ka' ? 'მაღაზია' : 'Store'}
            </button>
          </div>
        </div>
      </footer>

      {/* SLIDE-OVER CART DRAWER */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        lang={lang}
        cart={cart}
        products={products}
        coupons={coupons}
        settings={settings}
        user={user}
        sessionToken={sessionToken}
        onUpdateQty={handleUpdateCartQty}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={() => setCart([])}
        onGoToAccount={() => setPage('account')}
        onOrderCreated={() => {
          fetchAuthMe();
          showToast(
            lang === 'ka' ? 'შეკვეთა წარმატებით შეიქმნა!' : 'Order created successfully!'
          );
        }}
      />

      {/* HIDDEN ADMIN LOGIN MODAL (Opened via Triple Left Click) */}
      <AdminLoginModal
        open={adminLoginOpen}
        needsInitialSetup={needsInitialAdminSetup}
        onClose={() => setAdminLoginOpen(false)}
        onSuccess={(sess) => {
          sessionStorage.setItem('adrenalinee_admin_session', JSON.stringify(sess));
          setAdminSession(sess);
          setAdminLoginOpen(false);
          setAdminOverlayOpen(true);
        }}
      />

      {/* FULL-SCREEN ADMIN OVERLAY */}
      {adminSession && (
        <AdminOverlay
          open={adminOverlayOpen}
          lang={lang}
          adminSession={adminSession}
          onClose={() => setAdminOverlayOpen(false)}
          onLogout={async () => {
            await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
            sessionStorage.removeItem('adrenalinee_admin_session');
            setAdminSession(null);
            setAdminOverlayOpen(false);
            showToast('Logged out of Admin Panel');
          }}
          onToast={showToast}
        />
      )}
    </div>
  );
}
