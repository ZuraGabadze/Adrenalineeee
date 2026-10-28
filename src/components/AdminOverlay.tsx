import React, { useEffect, useState } from 'react';
import {
  AdBanner,
  AuditLogEntry,
  CouponCode,
  GamemodeInfo,
  Language,
  LinkedUser,
  SiteSettings,
  StaffMember,
  StoreOrder,
  StoreProduct,
} from '../types/store';
import { formatGel } from '../utils/storeLogic';
import {
  syncSiteSettingsToFirestore,
  syncProductToFirestore,
  writeAuditLogToFirestore,
  signInFirebaseAdmin,
  auth,
} from '../firebase';
import {
  X,
  Lock,
  LayoutDashboard,
  Settings,
  Image as ImageIcon,
  Gamepad2,
  Crown,
  KeyRound,
  Users,
  Megaphone,
  ShoppingCart,
  UserCheck,
  Ticket,
  ShieldAlert,
  Database,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  RefreshCw,
  Download,
  Upload,
} from 'lucide-react';

export const AdminLoginModal: React.FC<{
  open: boolean;
  needsInitialSetup: boolean;
  onClose: () => void;
  onSuccess: (session: { username: string; csrfToken: string; token: string }) => void;
}> = ({ open, needsInitialSetup, onClose, onSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Authentication failed');
      } else {
        setPassword('');
        onSuccess({
          username: data.username,
          csrfToken: data.csrfToken,
          token: data.token,
        });
      }
    } catch {
      setError('Server connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-login-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-[#0B0714] border border-[#8A00FF]/50 p-6 sm:p-8 space-y-5 shadow-[0_0_50px_rgba(138,0,255,0.35)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-[#C800FF]" />
            <h2 id="admin-login-title" className="font-pixel text-base font-bold text-white">
              ADMIN LOGIN
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close Admin Login"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-[#C4B5FD] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {needsInitialSetup && (
          <div className="p-3 rounded-lg bg-[#8A00FF]/15 border border-[#8A00FF]/40 text-xs text-[#C4B5FD]">
            Configure <code>ADMIN_USERNAME</code> and <code>ADMIN_PASSWORD_HASH</code> (format{' '}
            <code>scrypt:N:r:p:saltHex:hashHex</code>) in Secrets to log in.
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/40 text-xs text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs text-[#C4B5FD]">Admin Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#05030A] border border-white/15 text-sm text-white focus:outline-none focus:border-[#C800FF]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs text-[#C4B5FD]">Admin Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#05030A] border border-white/15 text-sm text-white focus:outline-none focus:border-[#C800FF]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#8A00FF] to-[#C800FF] hover:brightness-110 text-white font-bold text-sm transition-all cursor-pointer"
          >
            {loading ? 'Verifying scrypt hash...' : 'Unlock Admin Control Center'}
          </button>
        </form>
      </div>
    </div>
  );
};

type AdminTab =
  | 'dashboard'
  | 'settings'
  | 'media'
  | 'gamemodes'
  | 'ranks'
  | 'keys'
  | 'staff'
  | 'ads'
  | 'orders'
  | 'users'
  | 'coupons'
  | 'security'
  | 'backup';

export const AdminOverlay: React.FC<{
  open: boolean;
  lang: Language;
  adminSession: { username: string; csrfToken: string; token: string };
  onClose: () => void;
  onLogout: () => void;
  onToast: (msg: string) => void;
}> = ({ open, adminSession, onClose, onLogout, onToast }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [gamemodes, setGamemodes] = useState<GamemodeInfo[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [ads, setAds] = useState<AdBanner[]>([]);
  const [coupons, setCoupons] = useState<CouponCode[]>([]);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [users, setUsers] = useState<LinkedUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [orderFilter, setOrderFilter] = useState<string>('all');

  // Password change state
  const [currPass, setCurrPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [backupJsonText, setBackupJsonText] = useState('');

  const adminHeaders = {
    'Content-Type': 'application/json',
    'X-CSRF-Token': adminSession.csrfToken,
    'X-Admin-Token': adminSession.token,
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/full-data', {
        credentials: 'include',
        headers: {
          'X-Admin-Token': adminSession.token,
        },
      });
      if (res.ok) {
        const d = await res.json();
        setSettings(d.settings);
        setGamemodes(d.gamemodes || []);
        setProducts(d.products || []);
        setStaff(d.staff || []);
        setAds(d.ads || []);
        setCoupons(d.coupons || []);
        setOrders(d.orders || []);
        setUsers(d.users || []);
        setAuditLogs(d.auditLogs || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchAdminData();
    }
  }, [open]);

  if (!open || !settings) return null;

  // Save Site Settings
  const handleSaveSettings = async () => {
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      credentials: 'include',
      headers: adminHeaders,
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      await syncSiteSettingsToFirestore(settings).catch(() => {});
      await writeAuditLogToFirestore('UPDATE_SETTINGS', 'Updated site settings').catch(() => {});
      onToast('Site settings saved & synced live!');
      fetchAdminData();
    } else {
      onToast('Failed to save settings');
    }
  };

  // Save Collection
  const handleSaveCollection = async (
    colName: 'gamemodes' | 'products' | 'staff' | 'ads' | 'coupons',
    items: any[]
  ) => {
    const res = await fetch(`/api/admin/collection/${colName}`, {
      method: 'PUT',
      credentials: 'include',
      headers: adminHeaders,
      body: JSON.stringify({ items }),
    });
    if (res.ok) {
      if (colName === 'products') {
        for (const p of items as StoreProduct[]) {
          await syncProductToFirestore(p).catch(() => {});
        }
      }
      await writeAuditLogToFirestore(`UPDATE_${colName.toUpperCase()}`, `Saved ${items.length} items`).catch(() => {});
      onToast(`${colName.toUpperCase()} updated live!`);
      fetchAdminData();
    } else {
      onToast(`Failed to update ${colName}`);
    }
  };

  // Upload Image Helper (Max 2MB PNG/JPG/WebP)
  const handleFileUpload = (
    file: File | undefined,
    onResult: (dataUrl: string) => void
  ) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      onToast('Only PNG, JPG, and WebP files are allowed');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      onToast('Image exceeds 2 MB maximum size');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onResult(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleMediaSlotSave = async (target: keyof SiteSettings['media'], dataUrl: string) => {
    const res = await fetch('/api/admin/upload-media', {
      method: 'POST',
      credentials: 'include',
      headers: adminHeaders,
      body: JSON.stringify({ target, dataUrl }),
    });
    if (res.ok) {
      const d = await res.json();
      setSettings((prev) => (prev ? { ...prev, media: d.media } : prev));
      onToast(`Media (${target}) updated!`);
    } else {
      const err = await res.json().catch(() => ({}));
      onToast(err.error || 'Upload failed');
    }
  };

  const handleOrderAction = async (
    orderId: string,
    action: 'mark_paid' | 'redeliver' | 'refund'
  ) => {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/action`, {
      method: 'POST',
      credentials: 'include',
      headers: adminHeaders,
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      onToast(`Order ${orderId}: ${action.toUpperCase()} completed`);
      fetchAdminData();
    }
  };

  const handleUserAction = async (userId: string, action: 'toggle_ban' | 'toggle_verify') => {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/action`, {
      method: 'POST',
      credentials: 'include',
      headers: adminHeaders,
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      onToast('User updated');
      fetchAdminData();
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/change-password', {
      method: 'POST',
      credentials: 'include',
      headers: adminHeaders,
      body: JSON.stringify({ currentPassword: currPass, newPassword: newPass }),
    });
    const d = await res.json();
    if (res.ok) {
      setCurrPass('');
      setNewPass('');
      onToast('Admin password scrypt hash updated!');
      fetchAdminData();
    } else {
      onToast(d.error || 'Password change failed');
    }
  };

  const handleExportBackup = async () => {
    const res = await fetch('/api/admin/backup/export', {
      credentials: 'include',
      headers: { 'X-Admin-Token': adminSession.token },
    });
    if (res.ok) {
      const json = await res.json();
      const str = JSON.stringify(json, null, 2);
      setBackupJsonText(str);
      onToast('Backup JSON exported below');
    }
  };

  const handleImportBackup = async () => {
    try {
      const parsed = JSON.parse(backupJsonText);
      const res = await fetch('/api/admin/backup/import', {
        method: 'POST',
        credentials: 'include',
        headers: adminHeaders,
        body: JSON.stringify(parsed),
      });
      if (res.ok) {
        onToast('Store backup imported & synced live!');
        fetchAdminData();
      } else {
        onToast('Invalid backup JSON');
      }
    } catch {
      onToast('Malformed JSON syntax');
    }
  };

  const totalRevenue = orders
    .filter((o) => o.status === 'paid' || o.status === 'delivered')
    .reduce((acc, o) => acc + o.totalGel, 0);

  const navItems: { id: AdminTab; label: string; icon: any }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'settings', label: 'Site Settings', icon: Settings },
    { id: 'media', label: 'Media Assets', icon: ImageIcon },
    { id: 'gamemodes', label: 'Gamemodes', icon: Gamepad2 },
    { id: 'ranks', label: 'Ranks', icon: Crown },
    { id: 'keys', label: 'Crate Keys', icon: KeyRound },
    { id: 'staff', label: 'Staff', icon: Users },
    { id: 'ads', label: 'Ad Slots', icon: Megaphone },
    { id: 'orders', label: 'Orders & Delivery', icon: ShoppingCart },
    { id: 'users', label: 'Users', icon: UserCheck },
    { id: 'coupons', label: 'Coupons', icon: Ticket },
    { id: 'security', label: 'Security & Audit', icon: ShieldAlert },
    { id: 'backup', label: 'Backup JSON', icon: Database },
  ];

  const renderProductEditor = (type: 'rank' | 'key') => {
    const filtered = products
      .filter((p) => p.type === type)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const handleAddProduct = () => {
      const newProd: StoreProduct = {
        id: `${type}-${Date.now()}`,
        type,
        gamemode: type === 'key' ? 'global' : 'smp',
        name: type === 'key' ? 'New Key' : 'NEW RANK',
        badgeText: 'NEW',
        color: '#8A00FF',
        price: 9.99,
        thumbnail: '',
        perks: [{ ka: 'ახალი პრივილეგია', en: 'New privilege perk' }],
        commands:
          type === 'key'
            ? ['crate key give {player} custom {amount}']
            : ['lp user {player} parent add custom'],
        visible: true,
        featured: false,
        sortOrder: products.length + 1,
      };
      setProducts([...products, newProd]);
    };

    const updateProd = (id: string, patch: Partial<StoreProduct>) => {
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    };

    const moveProd = (id: string, dir: -1 | 1) => {
      const idx = filtered.findIndex((p) => p.id === id);
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= filtered.length) return;
      const a = filtered[idx];
      const b = filtered[swapIdx];
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id === a.id) return { ...p, sortOrder: b.sortOrder };
          if (p.id === b.id) return { ...p, sortOrder: a.sortOrder };
          return p;
        })
      );
    };

    const removeProd = (id: string) => {
      setProducts((prev) => prev.filter((p) => p.id !== id));
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-white uppercase">
            Manage {type === 'rank' ? 'Server Ranks' : 'Crate Keys'} ({filtered.length})
          </h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleAddProduct}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add {type === 'rank' ? 'Rank' : 'Key'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleSaveCollection('products', products)}
              className="px-5 py-2 rounded-lg bg-[#8A00FF] hover:bg-[#C800FF] text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save All Changes</span>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="rounded-xl bg-[#05030A] border border-white/10 p-5 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
                <div>
                  <label className="block text-xs text-[#C4B5FD] mb-1">Name</label>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateProd(item.id, { name: e.target.value })}
                    className="w-full px-3 py-2 rounded bg-[#0B0714] border border-white/15 text-xs text-white font-pixel"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#C4B5FD] mb-1">Gamemode</label>
                  <select
                    value={item.gamemode}
                    onChange={(e) =>
                      updateProd(item.id, { gamemode: e.target.value as any })
                    }
                    className="w-full px-3 py-2 rounded bg-[#0B0714] border border-white/15 text-xs text-white"
                  >
                    <option value="smp">SMP</option>
                    <option value="oneblock">Oneblock</option>
                    <option value="global">Global (Keys)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#C4B5FD] mb-1">Price (₾ GEL)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={item.price}
                    onChange={(e) =>
                      updateProd(item.id, { price: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded bg-[#0B0714] border border-white/15 text-xs text-white font-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#C4B5FD] mb-1">Glow Hex Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={item.color}
                      onChange={(e) => updateProd(item.id, { color: e.target.value })}
                      className="w-9 h-9 rounded bg-transparent border border-white/20 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={item.color}
                      onChange={(e) => updateProd(item.id, { color: e.target.value })}
                      className="w-full px-2.5 py-2 rounded bg-[#0B0714] border border-white/15 text-xs font-mono text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[#C4B5FD] mb-1">PNG Thumbnail</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) =>
                      handleFileUpload(e.target.files?.[0], (dataUrl) =>
                        updateProd(item.id, { thumbnail: dataUrl })
                      )
                    }
                    className="w-full text-xs text-[#C4B5FD]"
                  />
                </div>
                <div className="flex items-center justify-end gap-1.5">
                  <label className="flex items-center gap-1.5 text-xs text-white mr-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.visible}
                      onChange={(e) =>
                        updateProd(item.id, { visible: e.target.checked })
                      }
                    />
                    Visible
                  </label>
                  <button
                    type="button"
                    onClick={() => moveProd(item.id, -1)}
                    className="p-2 rounded bg-white/5 hover:bg-white/15 text-white cursor-pointer"
                    aria-label="Move Up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveProd(item.id, 1)}
                    className="p-2 rounded bg-white/5 hover:bg-white/15 text-white cursor-pointer"
                    aria-label="Move Down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeProd(item.id)}
                    className="p-2 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 cursor-pointer"
                    aria-label="Delete Product"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Delivery Commands Editor */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-white/5">
                <div>
                  <label className="block text-xs text-[#C4B5FD] mb-1">
                    Delivery Commands (one per line, placeholders: {'{player}'}, {'{amount}'})
                  </label>
                  <textarea
                    rows={2}
                    value={item.commands.join('\n')}
                    onChange={(e) =>
                      updateProd(item.id, {
                        commands: e.target.value
                          .split('\n')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    className="w-full px-3 py-2 rounded bg-[#0B0714] border border-white/15 text-xs font-mono text-[#00F5FF]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#C4B5FD] mb-1">
                    Perks (Format per line: Georgian Text | English Text)
                  </label>
                  <textarea
                    rows={3}
                    value={item.perks.map((pk) => `${pk.ka} | ${pk.en}`).join('\n')}
                    onChange={(e) => {
                      const lines = e.target.value.split('\n').filter(Boolean);
                      const parsedPerks = lines.map((line) => {
                        const [ka, en] = line.split('|').map((s) => s.trim());
                        return { ka: ka || '', en: en || ka || '' };
                      });
                      updateProd(item.id, { perks: parsedPerks });
                    }}
                    className="w-full px-3 py-2 rounded bg-[#0B0714] border border-white/15 text-xs text-white"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#05030A] text-white flex flex-col overflow-hidden">
      {/* Top Admin Header */}
      <header className="px-6 py-4 bg-[#0B0714] border-b border-[#8A00FF]/40 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-pixel text-base sm:text-lg text-[#C800FF] font-bold">
            ADRENALINEE ADMIN
          </span>
          <span className="text-xs text-[#C4B5FD]/75 hidden sm:inline">
            · Logged in as {adminSession.username}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={async () => {
              const u = await signInFirebaseAdmin();
              if (u) onToast(`Connected Firebase Admin: ${u.email}`);
            }}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-xs text-[#C4B5FD] cursor-pointer hidden md:inline-flex items-center gap-1.5"
          >
            <span>{auth.currentUser ? `Firestore: ${auth.currentUser.email}` : 'Link Firebase Auth'}</span>
          </button>
          <button
            type="button"
            onClick={fetchAdminData}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/15 text-[#C4B5FD] cursor-pointer"
            aria-label="Refresh Admin Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="px-3.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-xs font-semibold text-rose-300 cursor-pointer"
          >
            Logout
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-[#8A00FF] hover:bg-[#C800FF] text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Close Panel</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className="w-56 bg-[#0B0714] border-r border-white/10 overflow-y-auto p-3 space-y-1 shrink-0 hidden md:block">
          {navItems.map((nav) => {
            const Icon = nav.icon;
            const active = activeTab === nav.id;
            return (
              <button
                key={nav.id}
                type="button"
                onClick={() => setActiveTab(nav.id)}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#8A00FF] text-white'
                    : 'text-[#C4B5FD]/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{nav.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          {/* Mobile Tab Selector */}
          <div className="md:hidden flex overflow-x-auto gap-2 pb-2 border-b border-white/10">
            {navItems.map((nav) => (
              <button
                key={nav.id}
                type="button"
                onClick={() => setActiveTab(nav.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 ${
                  activeTab === nav.id ? 'bg-[#8A00FF] text-white' : 'bg-white/5 text-[#C4B5FD]'
                }`}
              >
                {nav.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-sm text-[#C4B5FD]">Loading store administration data...</div>
          ) : (
            <>
              {/* 1. DASHBOARD */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold text-white">Store Overview & Live Telemetry</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-nums">
                    <div className="p-5 rounded-2xl bg-[#0B0714] border border-white/10">
                      <div className="text-xs text-[#C4B5FD]">Total Confirmed Revenue</div>
                      <div className="text-2xl font-extrabold text-[#00F5FF] mt-1">
                        {formatGel(totalRevenue)}
                      </div>
                    </div>
                    <div className="p-5 rounded-2xl bg-[#0B0714] border border-white/10">
                      <div className="text-xs text-[#C4B5FD]">Total Orders</div>
                      <div className="text-2xl font-extrabold text-white mt-1">
                        {orders.length}
                      </div>
                    </div>
                    <div className="p-5 rounded-2xl bg-[#0B0714] border border-white/10">
                      <div className="text-xs text-[#C4B5FD]">Verified Players</div>
                      <div className="text-2xl font-extrabold text-emerald-400 mt-1">
                        {users.filter((u) => u.verified).length} / {users.length}
                      </div>
                    </div>
                    <div className="p-5 rounded-2xl bg-[#0B0714] border border-white/10">
                      <div className="text-xs text-[#C4B5FD]">Catalog Products</div>
                      <div className="text-2xl font-extrabold text-[#C800FF] mt-1">
                        {products.length}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#0B0714] border border-white/10 p-5 space-y-3">
                    <h3 className="text-sm font-bold text-white">Recent Orders</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-nums">
                        <thead>
                          <tr className="border-b border-white/10 text-[#C4B5FD]">
                            <th className="py-2 px-3">Order ID</th>
                            <th className="py-2 px-3">Player</th>
                            <th className="py-2 px-3">Method</th>
                            <th className="py-2 px-3">Amount</th>
                            <th className="py-2 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {orders.slice(0, 6).map((o) => (
                            <tr key={o.id}>
                              <td className="py-2.5 px-3 font-mono">{o.id}</td>
                              <td className="py-2.5 px-3">{o.mcNickname}</td>
                              <td className="py-2.5 px-3 uppercase">{o.paymentMethod}</td>
                              <td className="py-2.5 px-3 font-bold">{formatGel(o.totalGel)}</td>
                              <td className="py-2.5 px-3 uppercase">{o.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. SITE SETTINGS */}
              {activeTab === 'settings' && (
                <div className="space-y-6 max-w-4xl">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">
                      Site Configuration, Texts & Theme Palette
                    </h2>
                    <button
                      type="button"
                      onClick={handleSaveSettings}
                      className="px-5 py-2.5 rounded-xl bg-[#8A00FF] hover:bg-[#C800FF] text-xs font-bold text-white flex items-center gap-2 cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Settings Live</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#0B0714] p-5 rounded-2xl border border-white/10">
                    <div>
                      <label className="block text-xs text-[#C4B5FD] mb-1">Server Name</label>
                      <input
                        type="text"
                        value={settings.serverName}
                        onChange={(e) =>
                          setSettings({ ...settings, serverName: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded bg-[#05030A] border border-white/15 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#C4B5FD] mb-1">
                        Minecraft Server IP (Polled Live)
                      </label>
                      <input
                        type="text"
                        value={settings.serverIp}
                        onChange={(e) =>
                          setSettings({ ...settings, serverIp: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded bg-[#05030A] border border-white/15 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#C4B5FD] mb-1">
                        Discord Invite Code
                      </label>
                      <input
                        type="text"
                        value={settings.discordInviteCode}
                        onChange={(e) =>
                          setSettings({ ...settings, discordInviteCode: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded bg-[#05030A] border border-white/15 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#C4B5FD] mb-1">
                        Discord Full Invite URL
                      </label>
                      <input
                        type="text"
                        value={settings.discordInviteUrl}
                        onChange={(e) =>
                          setSettings({ ...settings, discordInviteUrl: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded bg-[#05030A] border border-white/15 text-xs text-white"
                      />
                    </div>
                    <div className="sm:col-span-2 flex flex-wrap gap-6 pt-2">
                      <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.maintenanceMode}
                          onChange={(e) =>
                            setSettings({ ...settings, maintenanceMode: e.target.checked })
                          }
                        />
                        <span>Enable Maintenance Mode (locks public store view)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.announcementEnabled}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              announcementEnabled: e.target.checked,
                            })
                          }
                        />
                        <span>Show Top Announcement Bar</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.bundleDiscountsEnabled}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              bundleDiscountsEnabled: e.target.checked,
                            })
                          }
                        />
                        <span>Enable Automatic Key Bundle Discounts</span>
                      </label>
                    </div>
                  </div>

                  {/* Bilingual Texts */}
                  <div className="space-y-4 bg-[#0B0714] p-5 rounded-2xl border border-white/10">
                    <h3 className="text-sm font-bold text-white">Hero & Announcement Texts</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-[#C4B5FD] mb-1">
                          Announcement (Georgian)
                        </label>
                        <input
                          type="text"
                          value={settings.announcement.ka}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              announcement: { ...settings.announcement, ka: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded bg-[#05030A] border border-white/15 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#C4B5FD] mb-1">
                          Announcement (English)
                        </label>
                        <input
                          type="text"
                          value={settings.announcement.en}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              announcement: { ...settings.announcement, en: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded bg-[#05030A] border border-white/15 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#C4B5FD] mb-1">
                          Hero Headline (Georgian)
                        </label>
                        <input
                          type="text"
                          value={settings.heroTitle.ka}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              heroTitle: { ...settings.heroTitle, ka: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded bg-[#05030A] border border-white/15 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#C4B5FD] mb-1">
                          Hero Headline (English)
                        </label>
                        <input
                          type="text"
                          value={settings.heroTitle.en}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              heroTitle: { ...settings.heroTitle, en: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded bg-[#05030A] border border-white/15 text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Theme CSS Variables Editor */}
                  <div className="space-y-4 bg-[#0B0714] p-5 rounded-2xl border border-white/10">
                    <h3 className="text-sm font-bold text-white">
                      CSS Variable Color Palette (Instant Theme Sync)
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {(
                        [
                          ['bgPrimary', 'Primary Background'],
                          ['bgSecondary', 'Secondary Surface'],
                          ['primaryPurple', 'Primary Purple'],
                          ['electricViolet', 'Electric Violet'],
                          ['deepIndigo', 'Deep Indigo'],
                          ['lavenderAccent', 'Lavender Text'],
                          ['neonMagenta', 'Neon Magenta'],
                          ['cyanAccent', 'Cyan Accent'],
                        ] as const
                      ).map(([key, label]) => (
                        <div key={key} className="space-y-1">
                          <label className="block text-xs text-[#C4B5FD]">{label}</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={settings.palette[key]}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  palette: { ...settings.palette, [key]: e.target.value },
                                })
                              }
                              className="w-8 h-8 rounded border border-white/20 bg-transparent cursor-pointer"
                            />
                            <input
                              type="text"
                              value={settings.palette[key]}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  palette: { ...settings.palette, [key]: e.target.value },
                                })
                              }
                              className="w-full px-2 py-1.5 rounded bg-[#05030A] border border-white/15 text-xs font-mono text-white"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 3. MEDIA */}
              {activeTab === 'media' && (
                <div className="space-y-6 max-w-3xl">
                  <h2 className="text-xl font-bold text-white">
                    Brand Media Assets (PNG / JPG / WebP, max 2 MB)
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(
                      [
                        ['logoUrl', 'Store Header Logo'],
                        ['faviconUrl', 'Browser Favicon'],
                        ['bannerUrl', 'Home Hero Banner Backdrop'],
                        ['backgroundUrl', 'Global Page Background'],
                      ] as const
                    ).map(([slot, title]) => (
                      <div
                        key={slot}
                        className="p-5 rounded-2xl bg-[#0B0714] border border-white/10 space-y-3"
                      >
                        <div className="text-sm font-bold text-white">{title}</div>
                        {settings.media[slot] ? (
                          <img
                            src={settings.media[slot]}
                            alt={title}
                            className="w-full h-28 object-contain rounded-lg bg-[#05030A] border border-white/10 p-2"
                          />
                        ) : (
                          <div className="w-full h-28 rounded-lg bg-[#05030A] border border-white/10 flex items-center justify-center text-xs text-[#C4B5FD]/50">
                            Using default SVG artwork
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(e) =>
                              handleFileUpload(e.target.files?.[0], (url) =>
                                handleMediaSlotSave(slot, url)
                              )
                            }
                            className="text-xs text-[#C4B5FD]"
                          />
                          {settings.media[slot] && (
                            <button
                              type="button"
                              onClick={() => handleMediaSlotSave(slot, '')}
                              className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 text-xs cursor-pointer"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. GAMEMODES */}
              {activeTab === 'gamemodes' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">Gamemodes Editor</h2>
                    <button
                      type="button"
                      onClick={() => handleSaveCollection('gamemodes', gamemodes)}
                      className="px-5 py-2 rounded-lg bg-[#8A00FF] hover:bg-[#C800FF] text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Gamemodes</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {gamemodes.map((gm, idx) => (
                      <div
                        key={gm.id}
                        className="p-5 rounded-xl bg-[#0B0714] border border-white/10 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <input
                            type="text"
                            value={gm.name}
                            onChange={(e) => {
                              const next = [...gamemodes];
                              next[idx] = { ...gm, name: e.target.value };
                              setGamemodes(next);
                            }}
                            className="px-3 py-1.5 rounded bg-[#05030A] border border-white/15 font-pixel text-sm text-white"
                          />
                          <input
                            type="color"
                            value={gm.color}
                            onChange={(e) => {
                              const next = [...gamemodes];
                              next[idx] = { ...gm, color: e.target.value };
                              setGamemodes(next);
                            }}
                            className="w-8 h-8 rounded bg-transparent cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-[#C4B5FD] mb-1">
                            Description (KA)
                          </label>
                          <textarea
                            rows={2}
                            value={gm.description.ka}
                            onChange={(e) => {
                              const next = [...gamemodes];
                              next[idx] = {
                                ...gm,
                                description: { ...gm.description, ka: e.target.value },
                              };
                              setGamemodes(next);
                            }}
                            className="w-full px-3 py-2 rounded bg-[#05030A] border border-white/15 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-[#C4B5FD] mb-1">
                            Description (EN)
                          </label>
                          <textarea
                            rows={2}
                            value={gm.description.en}
                            onChange={(e) => {
                              const next = [...gamemodes];
                              next[idx] = {
                                ...gm,
                                description: { ...gm.description, en: e.target.value },
                              };
                              setGamemodes(next);
                            }}
                            className="w-full px-3 py-2 rounded bg-[#05030A] border border-white/15 text-xs text-white"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. RANKS */}
              {activeTab === 'ranks' && renderProductEditor('rank')}

              {/* 6. KEYS */}
              {activeTab === 'keys' && renderProductEditor('key')}

              {/* 7. STAFF */}
              {activeTab === 'staff' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">Staff Team Editor</h2>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setStaff([
                            ...staff,
                            {
                              id: `staff-${Date.now()}`,
                              name: 'NEW_ADMIN',
                              role: 'Admin',
                              roleKa: 'ადმინი / Admin',
                              roleColor: '#8A00FF',
                              sortOrder: staff.length + 1,
                            },
                          ])
                        }
                        className="px-4 py-2 rounded-lg bg-white/10 text-xs font-semibold text-white cursor-pointer"
                      >
                        + Add Staff
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveCollection('staff', staff)}
                        className="px-5 py-2 rounded-lg bg-[#8A00FF] text-xs font-bold text-white cursor-pointer"
                      >
                        Save Staff
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {staff.map((m, idx) => (
                      <div
                        key={m.id}
                        className="p-4 rounded-xl bg-[#0B0714] border border-white/10 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={m.name}
                            onChange={(e) => {
                              const next = [...staff];
                              next[idx] = { ...m, name: e.target.value };
                              setStaff(next);
                            }}
                            placeholder="Minecraft Nickname"
                            className="flex-1 px-3 py-1.5 rounded bg-[#05030A] border border-white/15 font-pixel text-xs text-white"
                          />
                          <input
                            type="color"
                            value={m.roleColor}
                            onChange={(e) => {
                              const next = [...staff];
                              next[idx] = { ...m, roleColor: e.target.value };
                              setStaff(next);
                            }}
                            className="w-8 h-8 rounded bg-transparent cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => setStaff(staff.filter((s) => s.id !== m.id))}
                            className="p-1.5 rounded bg-rose-500/20 text-rose-300 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={m.role}
                            onChange={(e) => {
                              const next = [...staff];
                              next[idx] = { ...m, role: e.target.value };
                              setStaff(next);
                            }}
                            placeholder="Role EN"
                            className="px-3 py-1.5 rounded bg-[#05030A] border border-white/15 text-xs text-white"
                          />
                          <input
                            type="text"
                            value={m.roleKa}
                            onChange={(e) => {
                              const next = [...staff];
                              next[idx] = { ...m, roleKa: e.target.value };
                              setStaff(next);
                            }}
                            placeholder="Role KA"
                            className="px-3 py-1.5 rounded bg-[#05030A] border border-white/15 text-xs text-white"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 8. ADS */}
              {activeTab === 'ads' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">
                      Ad Slots (home-top, home-middle, footer)
                    </h2>
                    <button
                      type="button"
                      onClick={() => handleSaveCollection('ads', ads)}
                      className="px-5 py-2 rounded-lg bg-[#8A00FF] text-xs font-bold text-white cursor-pointer"
                    >
                      Save Ad Banners
                    </button>
                  </div>

                  <div className="space-y-4">
                    {ads.map((ad, idx) => (
                      <div
                        key={ad.id}
                        className="p-5 rounded-xl bg-[#0B0714] border border-white/10 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-[#00F5FF] uppercase">
                            SLOT: {ad.slot} · Clicks: {ad.clicks}
                          </span>
                          <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
                            <input
                              type="checkbox"
                              checked={ad.enabled}
                              onChange={(e) => {
                                const next = [...ads];
                                next[idx] = { ...ad, enabled: e.target.checked };
                                setAds(next);
                              }}
                            />
                            Enabled
                          </label>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={ad.title.ka}
                            onChange={(e) => {
                              const next = [...ads];
                              next[idx] = {
                                ...ad,
                                title: { ...ad.title, ka: e.target.value },
                              };
                              setAds(next);
                            }}
                            placeholder="Title (KA)"
                            className="px-3 py-2 rounded bg-[#05030A] border border-white/15 text-xs text-white"
                          />
                          <input
                            type="text"
                            value={ad.title.en}
                            onChange={(e) => {
                              const next = [...ads];
                              next[idx] = {
                                ...ad,
                                title: { ...ad.title, en: e.target.value },
                              };
                              setAds(next);
                            }}
                            placeholder="Title (EN)"
                            className="px-3 py-2 rounded bg-[#05030A] border border-white/15 text-xs text-white"
                          />
                          <input
                            type="text"
                            value={ad.linkUrl}
                            onChange={(e) => {
                              const next = [...ads];
                              next[idx] = { ...ad, linkUrl: e.target.value };
                              setAds(next);
                            }}
                            placeholder="Link URL"
                            className="px-3 py-2 rounded bg-[#05030A] border border-white/15 text-xs text-white"
                          />
                          <div className="flex gap-2">
                            <input
                              type="date"
                              value={ad.startDate}
                              onChange={(e) => {
                                const next = [...ads];
                                next[idx] = { ...ad, startDate: e.target.value };
                                setAds(next);
                              }}
                              className="flex-1 px-2 py-1.5 rounded bg-[#05030A] border border-white/15 text-xs text-white"
                            />
                            <input
                              type="date"
                              value={ad.endDate}
                              onChange={(e) => {
                                const next = [...ads];
                                next[idx] = { ...ad, endDate: e.target.value };
                                setAds(next);
                              }}
                              className="flex-1 px-2 py-1.5 rounded bg-[#05030A] border border-white/15 text-xs text-white"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 9. ORDERS & DELIVERY */}
              {activeTab === 'orders' && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <h2 className="text-xl font-bold text-white">
                      Orders, Payment Confirmation & RCON/Queue Delivery
                    </h2>
                    <div className="flex gap-1.5">
                      {['all', 'pending', 'delivered', 'refunded'].map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setOrderFilter(st)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase cursor-pointer ${
                            orderFilter === st
                              ? 'bg-[#8A00FF] text-white'
                              : 'bg-white/5 text-[#C4B5FD]'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {orders
                      .filter((o) => orderFilter === 'all' || o.status === orderFilter)
                      .map((ord) => (
                        <div
                          key={ord.id}
                          className="p-5 rounded-xl bg-[#0B0714] border border-white/10 space-y-3 font-nums"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <span className="font-mono font-bold text-white">{ord.id}</span>
                              <span className="text-xs text-[#C4B5FD] ml-3">
                                Player: <strong className="text-white">{ord.mcNickname}</strong> ({ord.discordUsername})
                              </span>
                              <span className="text-xs text-[#00F5FF] ml-3">
                                {formatGel(ord.totalGel)} · {ord.paymentMethod.toUpperCase()}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {ord.status === 'pending' && (
                                <button
                                  type="button"
                                  onClick={() => handleOrderAction(ord.id, 'mark_paid')}
                                  className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white cursor-pointer"
                                >
                                  Mark Paid & Deliver
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOrderAction(ord.id, 'redeliver')}
                                className="px-3 py-1.5 rounded bg-[#8A00FF] hover:bg-[#C800FF] text-xs font-bold text-white cursor-pointer"
                              >
                                Redeliver
                              </button>
                              {ord.status !== 'refunded' && (
                                <button
                                  type="button"
                                  onClick={() => handleOrderAction(ord.id, 'refund')}
                                  className="px-3 py-1.5 rounded bg-rose-500/20 hover:bg-rose-500/40 text-xs font-semibold text-rose-300 cursor-pointer"
                                >
                                  Refund
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="text-xs text-[#C4B5FD]">
                            Items: {ord.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}
                          </div>
                          <div className="p-2.5 rounded bg-[#05030A] font-mono text-[11px] text-white/75 space-y-1">
                            {ord.deliveryLog.map((l, i) => (
                              <div key={i}>{l}</div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* 10. USERS */}
              {activeTab === 'users' && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-white">Linked Accounts & Moderation</h2>
                  <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#0B0714]">
                    <table className="w-full text-left text-xs font-nums">
                      <thead>
                        <tr className="border-b border-white/10 bg-[#05030A] text-[#C4B5FD]">
                          <th className="py-3 px-4">Discord</th>
                          <th className="py-3 px-4">Minecraft Nickname</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {users.map((u) => (
                          <tr key={u.id}>
                            <td className="py-3 px-4 font-semibold text-white">
                              {u.discordUsername}
                            </td>
                            <td className="py-3 px-4 font-pixel text-[#00F5FF]">
                              {u.mcNickname || '—'}
                            </td>
                            <td className="py-3 px-4">
                              {u.banned ? (
                                <span className="text-rose-400 font-bold">BANNED</span>
                              ) : u.verified ? (
                                <span className="text-emerald-400 font-bold">VERIFIED</span>
                              ) : (
                                <span className="text-amber-400">UNVERIFIED</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right space-x-2">
                              <button
                                type="button"
                                onClick={() => handleUserAction(u.id, 'toggle_verify')}
                                className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                              >
                                {u.verified ? 'Unverify' : 'Force Verify'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUserAction(u.id, 'toggle_ban')}
                                className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 cursor-pointer"
                              >
                                {u.banned ? 'Unban' : 'Ban'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 11. COUPONS */}
              {activeTab === 'coupons' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">Promo & Coupon Codes</h2>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setCoupons([
                            ...coupons,
                            {
                              id: `coupon-${Date.now()}`,
                              code: 'NEWCODE15',
                              discountType: 'percent',
                              value: 15,
                              minOrderGel: 10,
                              maxUses: 100,
                              usedCount: 0,
                              active: true,
                            },
                          ])
                        }
                        className="px-4 py-2 rounded-lg bg-white/10 text-xs font-semibold text-white cursor-pointer"
                      >
                        + Add Coupon
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveCollection('coupons', coupons)}
                        className="px-5 py-2 rounded-lg bg-[#8A00FF] text-xs font-bold text-white cursor-pointer"
                      >
                        Save Coupons
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {coupons.map((c, idx) => (
                      <div
                        key={c.id}
                        className="p-4 rounded-xl bg-[#0B0714] border border-white/10 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={c.code}
                            onChange={(e) => {
                              const next = [...coupons];
                              next[idx] = { ...c, code: e.target.value.toUpperCase() };
                              setCoupons(next);
                            }}
                            className="px-3 py-1.5 rounded bg-[#05030A] border border-white/15 font-mono text-xs text-[#00F5FF] font-bold"
                          />
                          <label className="flex items-center gap-1.5 text-xs text-white">
                            <input
                              type="checkbox"
                              checked={c.active}
                              onChange={(e) => {
                                const next = [...coupons];
                                next[idx] = { ...c, active: e.target.checked };
                                setCoupons(next);
                              }}
                            />
                            Active
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setCoupons(coupons.filter((item) => item.id !== c.id))
                            }
                            className="p-1.5 rounded bg-rose-500/20 text-rose-300 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <label className="block text-[11px] text-[#C4B5FD]">Type</label>
                            <select
                              value={c.discountType}
                              onChange={(e) => {
                                const next = [...coupons];
                                next[idx] = {
                                  ...c,
                                  discountType: e.target.value as 'percent' | 'fixed',
                                };
                                setCoupons(next);
                              }}
                              className="w-full px-2 py-1.5 rounded bg-[#05030A] border border-white/15 text-white"
                            >
                              <option value="percent">Percent (%)</option>
                              <option value="fixed">Fixed (₾)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] text-[#C4B5FD]">Value</label>
                            <input
                              type="number"
                              value={c.value}
                              onChange={(e) => {
                                const next = [...coupons];
                                next[idx] = { ...c, value: parseFloat(e.target.value) || 0 };
                                setCoupons(next);
                              }}
                              className="w-full px-2 py-1.5 rounded bg-[#05030A] border border-white/15 text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-[#C4B5FD]">Min GEL</label>
                            <input
                              type="number"
                              value={c.minOrderGel}
                              onChange={(e) => {
                                const next = [...coupons];
                                next[idx] = {
                                  ...c,
                                  minOrderGel: parseFloat(e.target.value) || 0,
                                };
                                setCoupons(next);
                              }}
                              className="w-full px-2 py-1.5 rounded bg-[#05030A] border border-white/15 text-white"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 12. SECURITY & AUDIT LOG */}
              {activeTab === 'security' && (
                <div className="space-y-8 max-w-4xl">
                  <form
                    onSubmit={handleChangePassword}
                    className="p-6 rounded-2xl bg-[#0B0714] border border-white/10 space-y-4 max-w-md"
                  >
                    <h3 className="text-base font-bold text-white">
                      Change Admin Password (scrypt:16384:8:1)
                    </h3>
                    <div>
                      <label className="block text-xs text-[#C4B5FD] mb-1">
                        Current Password
                      </label>
                      <input
                        type="password"
                        value={currPass}
                        onChange={(e) => setCurrPass(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded bg-[#05030A] border border-white/15 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#C4B5FD] mb-1">
                        New Password (min 8 chars)
                      </label>
                      <input
                        type="password"
                        value={newPass}
                        onChange={(e) => setNewPass(e.target.value)}
                        required
                        minLength={8}
                        className="w-full px-3 py-2 rounded bg-[#05030A] border border-white/15 text-xs text-white"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-lg bg-[#8A00FF] hover:bg-[#C800FF] text-xs font-bold text-white cursor-pointer"
                    >
                      Update scrypt Password Hash
                    </button>
                  </form>

                  <div className="space-y-3">
                    <h3 className="text-base font-bold text-white">Security Audit Log</h3>
                    <div className="rounded-xl bg-[#0B0714] border border-white/10 p-4 max-h-80 overflow-y-auto space-y-2 font-mono text-xs">
                      {auditLogs.map((log) => (
                        <div
                          key={log.id}
                          className="p-2.5 rounded bg-[#05030A] border border-white/5 flex flex-wrap justify-between gap-2"
                        >
                          <span>
                            <strong className="text-[#C800FF]">[{log.action}]</strong>{' '}
                            <span className="text-white/90">{log.details}</span>
                          </span>
                          <span className="text-[#C4B5FD]/60">
                            {log.actor} · {new Date(log.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 13. BACKUP EXPORT / IMPORT */}
              {activeTab === 'backup' && (
                <div className="space-y-4 max-w-3xl">
                  <h2 className="text-xl font-bold text-white">
                    Full Store JSON Backup (Export / Import)
                  </h2>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleExportBackup}
                      className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export Current Store JSON</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleImportBackup}
                      className="px-4 py-2 rounded-lg bg-[#8A00FF] hover:bg-[#C800FF] text-xs font-bold text-white flex items-center gap-2 cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Import & Overwrite Store</span>
                    </button>
                  </div>
                  <textarea
                    rows={16}
                    value={backupJsonText}
                    onChange={(e) => setBackupJsonText(e.target.value)}
                    placeholder="Click 'Export Current Store JSON' or paste a backup JSON payload here..."
                    className="w-full p-4 rounded-xl bg-[#0B0714] border border-white/15 font-mono text-xs text-[#00F5FF]"
                  />
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};
