import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import net from 'net';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';
import { INITIAL_STORE_DB } from './src/data/seedData';
import {
  FullStoreDatabase,
  LiveServerStatus,
  LinkedUser,
  StoreOrder,
  OrderItemSnapshot,
  DeliveryQueueTask,
} from './src/types/store';
import {
  calculateCartTotals,
  interpolateDeliveryCommand,
  isValidMinecraftNickname,
} from './src/utils/storeLogic';

dotenv.config();

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'adrenalinee-db.json');

// Ensure data directory exists and load persistent store state
function loadDatabase(): FullStoreDatabase {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as FullStoreDatabase;
      // Ignore any legacy "$"-formatted password hash override
      if (
        parsed.adminPasswordHashOverride &&
        parsed.adminPasswordHashOverride.trim().split(':').length !== 6
      ) {
        delete parsed.adminPasswordHashOverride;
      }
      return {
        ...INITIAL_STORE_DB,
        ...parsed,
        settings: {
          ...INITIAL_STORE_DB.settings,
          ...(parsed.settings || {}),
          palette: {
            ...INITIAL_STORE_DB.settings.palette,
            ...(parsed.settings?.palette || {}),
          },
          media: {
            ...INITIAL_STORE_DB.settings.media,
            ...(parsed.settings?.media || {}),
          },
        },
      };
    }
  } catch (err) {
    console.error('Failed to read local store DB, falling back to seed data:', err);
  }
  return structuredClone(INITIAL_STORE_DB);
}

let storeDb: FullStoreDatabase = loadDatabase();

function saveDatabase() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(storeDb, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist store DB:', err);
  }
}

// Real-time SSE clients for instant public site updates
const sseClients = new Set<Response>();

function broadcastStoreUpdate() {
  const publicPayload = JSON.stringify({
    type: 'STORE_SYNC',
    payload: getPublicState(),
  });
  for (const client of sseClients) {
    try {
      client.write(`data: ${publicPayload}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

function getPublicState() {
  return {
    settings: storeDb.settings,
    gamemodes: [...storeDb.gamemodes].sort((a, b) => a.sortOrder - b.sortOrder),
    products: [...storeDb.products].sort((a, b) => a.sortOrder - b.sortOrder),
    staff: [...storeDb.staff].sort((a, b) => a.sortOrder - b.sortOrder),
    ads: storeDb.ads,
    faqs: [...storeDb.faqs].sort((a, b) => a.sortOrder - b.sortOrder),
    coupons: storeDb.coupons
      .filter((c) => c.active && c.usedCount < c.maxUses)
      .map((c) => ({
        id: c.id,
        code: c.code,
        discountType: c.discountType,
        value: c.value,
        minOrderGel: c.minOrderGel,
        maxUses: c.maxUses,
        usedCount: c.usedCount,
        active: c.active,
      })),
  };
}

function addAuditLog(actor: string, action: string, details: string, ip?: string) {
  const entry = {
    id: `log-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    actor,
    action,
    details,
    ip,
    createdAt: new Date().toISOString(),
  };
  storeDb.auditLogs.unshift(entry);
  if (storeDb.auditLogs.length > 300) {
    storeDb.auditLogs = storeDb.auditLogs.slice(0, 300);
  }
  saveDatabase();
}

// ==================== CRYPTO & SCRYPT HELPERS ====================
const SESSION_SECRET =
  (process.env.SESSION_SECRET ?? '').trim() ||
  crypto.createHash('sha256').update(`adrenalinee-fallback-${process.cwd()}`).digest('hex');

// Dummy colon-separated hex scrypt hash used when stored hash is missing/invalid so timing stays equal
const DUMMY_SCRYPT_HASH =
  'scrypt:16384:8:1:00000000000000000000000000000000:' + '00'.repeat(64);

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [alg, N, r, p, saltHex, hashHex] = String(stored).trim().split(':');
    if (alg !== 'scrypt') return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(password, salt, expected.length, {
      N: +N,
      r: +r,
      p: +p,
      maxmem: 64 * 1024 * 1024,
    });
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function hashPassword(password: string): string {
  const N = 16384;
  const r = 8;
  const p = 1;
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.scryptSync(password, salt, 64, {
    N,
    r,
    p,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt:${N}:${r}:${p}:${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

export function verifyUsernameTimingSafe(input: string, expected: string): boolean {
  const a = Buffer.from(String(input), 'utf-8');
  const b = Buffer.from(String(expected), 'utf-8');
  if (b.length === 0) {
    crypto.timingSafeEqual(Buffer.alloc(1), Buffer.alloc(1));
    return false;
  }
  if (a.length !== b.length) {
    crypto.timingSafeEqual(b, b);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

interface SignedSessionPayload {
  sub: string;
  role: 'user' | 'admin';
  csrf: string;
  exp: number;
}

function signSessionToken(payload: SignedSessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifySessionToken(token?: string): SignedSessionPayload | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8')) as SignedSessionPayload;
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function getActiveAdminPasswordHash(): string {
  const override = (storeDb.adminPasswordHashOverride ?? '').trim();
  if (override && override.startsWith('scrypt:') && override.split(':').length === 6) {
    return override;
  }
  return (process.env.ADMIN_PASSWORD_HASH ?? '').trim();
}

// ==================== RCON TCP CLIENT ====================
function executeRconCommands(
  host: string,
  port: number,
  password: string,
  commands: string[]
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const logs: string[] = [];
    const socket = new net.Socket();
    socket.setTimeout(5000);

    function createPacket(id: number, type: number, body: string): Buffer {
      const bodyBuf = Buffer.from(body, 'utf-8');
      const length = 4 + 4 + bodyBuf.length + 2;
      const buf = Buffer.alloc(4 + length);
      buf.writeInt32LE(length, 0);
      buf.writeInt32LE(id, 4);
      buf.writeInt32LE(type, 8);
      bodyBuf.copy(buf, 12);
      buf.writeInt16LE(0, 12 + bodyBuf.length);
      return buf;
    }

    let step = 0;
    socket.connect(port, host, () => {
      // Type 3 = SERVERDATA_AUTH
      socket.write(createPacket(1, 3, password));
    });

    socket.on('data', (data) => {
      if (data.length < 12) return;
      const reqId = data.readInt32LE(4);
      if (reqId === -1) {
        socket.destroy();
        return reject(new Error('RCON Authentication failed'));
      }
      if (step < commands.length) {
        const cmd = commands[step];
        step++;
        logs.push(`RCON Executed: ${cmd}`);
        // Type 2 = SERVERDATA_EXECCOMMAND
        socket.write(createPacket(step + 1, 2, cmd));
      } else {
        socket.end();
        resolve(logs);
      }
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('RCON connection timed out'));
    });

    socket.on('error', (err) => {
      socket.destroy();
      reject(err);
    });
  });
}

// ==================== ORDER DELIVERY ENGINE ====================
async function processOrderDelivery(order: StoreOrder): Promise<void> {
  order.status = 'delivering';
  order.deliveryAttempts += 1;
  order.updatedAt = new Date().toISOString();

  const resolvedCommands: string[] = [];
  for (const item of order.items) {
    for (const cmdTemplate of item.commands) {
      resolvedCommands.push(
        interpolateDeliveryCommand(cmdTemplate, order.mcNickname, item.quantity)
      );
    }
  }

  const rconHost = process.env.RCON_HOST;
  const rconPort = parseInt(process.env.RCON_PORT || '25575', 10);
  const rconPassword = process.env.RCON_PASSWORD;

  if (rconHost && rconPassword) {
    try {
      const rconLogs = await executeRconCommands(rconHost, rconPort, rconPassword, resolvedCommands);
      order.deliveryMethod = 'rcon';
      order.status = 'delivered';
      order.deliveryLog.push(
        `${new Date().toISOString()} — Delivered via RCON (${rconLogs.length} commands)`
      );
      saveDatabase();
      broadcastStoreUpdate();
      return;
    } catch (err) {
      order.deliveryLog.push(
        `${new Date().toISOString()} — RCON error (${err instanceof Error ? err.message : 'failed'}), falling back to Plugin Queue`
      );
    }
  }

  // Enqueue in Plugin Polling Queue
  order.deliveryMethod = 'plugin_queue';
  const task: DeliveryQueueTask = {
    id: `TASK-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    orderId: order.id,
    mcNickname: order.mcNickname,
    commands: resolvedCommands,
    status: 'queued',
    attempts: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  storeDb.deliveryQueue.push(task);
  order.status = 'delivered';
  order.deliveryLog.push(
    `${new Date().toISOString()} — Queued & dispatched ${resolvedCommands.length} commands for ${order.mcNickname}: ${resolvedCommands.join(' | ')}`
  );
  saveDatabase();
  broadcastStoreUpdate();
}

// ==================== PAYMENT PROVIDER ABSTRACTION ====================
interface PaymentProviderResult {
  provider: string;
  mode: 'manual' | 'gateway';
  reference: string;
  redirectUrl?: string;
  instructions?: {
    bankName: string;
    iban: string;
    recipient: string;
    amountGel: number;
    note: string;
  };
}

function initiatePayment(order: StoreOrder): PaymentProviderResult {
  if (order.paymentMethod === 'manual') {
    const details = storeDb.settings.manualBankDetails;
    return {
      provider: 'manual',
      mode: 'manual',
      reference: `MANUAL-${order.id}`,
      instructions: {
        bankName: details.bankName,
        iban: details.iban,
        recipient: details.recipient,
        amountGel: order.totalGel,
        note: `${order.id} ${order.mcNickname}`,
      },
    };
  }

  // Georgian Gateway Stub (BOG iPay / TBC / Flitt / Payze)
  const ref = `${order.paymentMethod.toUpperCase()}-${Date.now()}`;
  return {
    provider: order.paymentMethod,
    mode: 'gateway',
    reference: ref,
    redirectUrl: `/#checkout-gateway?orderId=${encodeURIComponent(order.id)}&provider=${encodeURIComponent(order.paymentMethod)}&ref=${encodeURIComponent(ref)}`,
  };
}

// ==================== LIVE STATUS CACHE (30s) ====================
let cachedLiveStatus: { data: LiveServerStatus; expiresAt: number } | null = null;

async function fetchLiveServerStatus(): Promise<LiveServerStatus> {
  if (cachedLiveStatus && Date.now() < cachedLiveStatus.expiresAt) {
    return cachedLiveStatus.data;
  }

  const mcIp = storeDb.settings.serverIp || 'adrenalinee.run';
  const inviteCode = (storeDb.settings.discordInviteCode || 'adrenalinee')
    .replace(/^https?:\/\/(www\.)?discord\.(gg|com\/invite)\//i, '')
    .trim();

  let mcStatus = {
    online: false,
    ip: mcIp,
    playersOnline: 0,
    playersMax: 250,
    version: storeDb.settings.serverVersion || '1.20.4 - 1.21.x',
    motd: 'ADRENALINEE — Georgian Minecraft Network (Oneblock & SMP)',
    updatedAt: new Date().toISOString(),
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://api.mcstatus.io/v2/status/java/${encodeURIComponent(mcIp)}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (res.ok) {
      const json = (await res.json()) as any;
      mcStatus = {
        online: Boolean(json.online),
        ip: mcIp,
        playersOnline: json.online ? Number(json.players?.online ?? 0) : 0,
        playersMax: Number(json.players?.max ?? 250) || 250,
        version: json.version?.name_clean || storeDb.settings.serverVersion || '1.20.x',
        motd:
          json.motd?.clean ||
          'ADRENALINEE — Georgian Minecraft Network (Oneblock & SMP)',
        updatedAt: new Date().toISOString(),
      };
    }
  } catch {
    // Graceful OFFLINE fallback
  }

  let discordStatus = {
    onlineCount: 0,
    memberCount: 0,
    inviteCode,
    guildName: 'ADRENALINEE Discord',
    updatedAt: new Date().toISOString(),
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://discord.com/api/v10/invites/${encodeURIComponent(inviteCode)}?with_counts=true`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (res.ok) {
      const json = (await res.json()) as any;
      discordStatus = {
        onlineCount: Number(json.approximate_presence_count ?? 0),
        memberCount: Number(json.approximate_member_count ?? 0),
        inviteCode,
        guildName: json.guild?.name || 'ADRENALINEE Discord',
        updatedAt: new Date().toISOString(),
      };
    }
  } catch {
    // Graceful Discord fallback
  }

  const combined: LiveServerStatus = {
    minecraft: mcStatus,
    discord: discordStatus,
  };

  cachedLiveStatus = {
    data: combined,
    expiresAt: Date.now() + 30_000,
  };
  return combined;
}

// ==================== SERVER INITIALIZATION ====================
async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      frameguard: false, // Required for AI Studio preview iframe
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: '3mb' }));

  // Cookie options for AI Studio cross-origin iframe
  const cookieOpts = {
    httpOnly: true,
    secure: true,
    sameSite: 'none' as const,
    path: '/',
  };

  // Extract User Session (from cookie or X-Session-Token fallback header)
  function getUserSession(req: Request): LinkedUser | null {
    const token =
      req.cookies?.adrenalinee_user ||
      (req.headers['x-session-token'] as string | undefined);
    const verified = verifySessionToken(token);
    if (!verified || verified.role !== 'user') return null;
    const found = storeDb.users.find((u) => u.id === verified.sub);
    return found || null;
  }

  // Extract Admin Session (from cookie or X-Admin-Token fallback header)
  function getAdminSession(req: Request): SignedSessionPayload | null {
    const token =
      req.cookies?.adrenalinee_admin ||
      (req.headers['x-admin-token'] as string | undefined);
    const verified = verifySessionToken(token);
    if (!verified || verified.role !== 'admin') return null;
    return verified;
  }

  function requireAdmin(req: Request, res: Response, next: NextFunction) {
    const session = getAdminSession(req);
    if (!session) {
      res.status(401).json({ error: 'Unauthorized admin session' });
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const csrfHeader = req.headers['x-csrf-token'];
      if (!csrfHeader || csrfHeader !== session.csrf) {
        res.status(403).json({ error: 'Invalid CSRF token' });
        return;
      }
    }
    (req as any).adminSession = session;
    next();
  }

  // ==================== PUBLIC & SSE ROUTES ====================
  app.get('/api/state', (_req, res) => {
    res.json(getPublicState());
  });

  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const initial = JSON.stringify({ type: 'STORE_SYNC', payload: getPublicState() });
    res.write(`data: ${initial}\n\n`);
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  app.get('/api/live-status', async (_req, res) => {
    const status = await fetchLiveServerStatus();
    res.json(status);
  });

  app.post('/api/ads/:adId/click', (req, res) => {
    const ad = storeDb.ads.find((a) => a.id === req.params.adId);
    if (ad) {
      ad.clicks = (ad.clicks || 0) + 1;
      saveDatabase();
    }
    res.json({ ok: true });
  });

  // ==================== DISCORD OAUTH2 + ACCOUNT ROUTES ====================
  function getAppBaseUrl(req: Request): string {
    if (process.env.APP_URL && process.env.APP_URL.startsWith('http')) {
      return process.env.APP_URL.replace(/\/+$/, '');
    }
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
    return `${proto}://${host}`;
  }

  app.get('/api/auth/me', (req, res) => {
    const user = getUserSession(req);
    const userOrders = user
      ? storeDb.orders.filter((o) => o.userId === user.id)
      : [];
    res.json({
      user,
      orders: userOrders,
      discordConfigured: Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET),
      callbackUrls: {
        primary: `${getAppBaseUrl(req)}/api/auth/discord/callback`,
        short: `${getAppBaseUrl(req)}/auth/callback`,
      },
    });
  });

  app.get('/api/auth/discord/url', (req, res) => {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const redirectUri =
      (req.query.redirectUri as string) || `${getAppBaseUrl(req)}/api/auth/discord/callback`;

    if (!clientId) {
      res.status(400).json({
        error: 'DISCORD_NOT_CONFIGURED',
        message: 'DISCORD_CLIENT_ID is not set in Secrets yet. Use Sandbox Login to test in preview.',
      });
      return;
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify guilds.members.read',
      prompt: 'consent',
    });

    res.json({
      url: `https://discord.com/api/oauth2/authorize?${params.toString()}`,
    });
  });

  const handleDiscordCallback = async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const guildId = process.env.DISCORD_GUILD_ID;
    const redirectUri = `${getAppBaseUrl(req)}${req.path.startsWith('/auth/callback') ? '/auth/callback' : '/api/auth/discord/callback'}`;

    if (!code || !clientId || !clientSecret) {
      res.status(400).send('Missing Discord OAuth code or server credentials.');
      return;
    }

    try {
      const tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenRes.ok) {
        throw new Error('Failed to exchange Discord authorization code');
      }
      const tokenData = (await tokenRes.json()) as any;
      const accessToken = tokenData.access_token;

      const userRes = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userRes.ok) {
        throw new Error('Failed to fetch Discord user profile');
      }
      const discordUser = (await userRes.json()) as any;

      let inGuild = true;
      if (guildId) {
        const memberRes = await fetch(
          `https://discord.com/api/v10/users/@me/guilds/${encodeURIComponent(guildId)}/member`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        inGuild = memberRes.ok;
      }

      const avatarUrl = discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : 'https://mc-heads.net/avatar/Steve/64';

      let user = storeDb.users.find((u) => u.id === discordUser.id);
      if (!user) {
        user = {
          id: String(discordUser.id),
          discordUsername: discordUser.global_name || discordUser.username || 'Player',
          discordAvatar: avatarUrl,
          inGuild,
          mcNickname: null,
          verified: false,
          banned: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        storeDb.users.push(user);
      } else {
        user.discordUsername = discordUser.global_name || discordUser.username || user.discordUsername;
        user.discordAvatar = avatarUrl;
        user.inGuild = inGuild;
        user.updatedAt = new Date().toISOString();
      }
      saveDatabase();

      const sessionToken = signSessionToken({
        sub: user.id,
        role: 'user',
        csrf: crypto.randomBytes(16).toString('hex'),
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });

      res.cookie('adrenalinee_user', sessionToken, {
        ...cookieOpts,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.send(`
        <!doctype html>
        <html>
          <body style="background:#05030A;color:#F5F3FF;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', token: ${JSON.stringify(sessionToken)} }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Discord authentication successful. Closing window...</p>
          </body>
        </html>
      `);
    } catch (err) {
      res.status(500).send(`Discord OAuth Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  app.get(['/api/auth/discord/callback', '/api/auth/discord/callback/'], handleDiscordCallback);
  app.get(['/auth/callback', '/auth/callback/'], handleDiscordCallback);

  // Preview Sandbox Login (for testing when DISCORD_CLIENT_ID is not yet added in Secrets)
  const demoLoginSchema = z.object({
    discordUsername: z.string().min(2).max(32),
    inGuild: z.boolean().optional().default(true),
  });

  app.post('/api/auth/demo-discord', (req, res) => {
    const parsed = demoLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid Discord username' });
      return;
    }

    const { discordUsername, inGuild } = parsed.data;
    const id = `discord-${discordUsername.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    let user = storeDb.users.find((u) => u.id === id);
    if (!user) {
      user = {
        id,
        discordUsername,
        discordAvatar: `https://mc-heads.net/avatar/${encodeURIComponent(discordUsername)}/64`,
        inGuild,
        mcNickname: null,
        verified: false,
        banned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      storeDb.users.push(user);
    } else {
      user.inGuild = inGuild;
      user.updatedAt = new Date().toISOString();
    }
    saveDatabase();

    const sessionToken = signSessionToken({
      sub: user.id,
      role: 'user',
      csrf: crypto.randomBytes(16).toString('hex'),
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie('adrenalinee_user', sessionToken, {
      ...cookieOpts,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ user, token: sessionToken });
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie('adrenalinee_user', cookieOpts);
    res.json({ ok: true });
  });

  // ==================== MINECRAFT ACCOUNT LINKING & PLUGIN ENDPOINTS ====================
  const requestCodeSchema = z.object({
    mcNickname: z.string().trim().min(3).max(16),
  });

  app.post('/api/mc/request-code', (req, res) => {
    const user = getUserSession(req);
    if (!user) {
      res.status(401).json({ error: 'Please log in with Discord first' });
      return;
    }
    if (user.banned) {
      res.status(403).json({ error: 'Your account is suspended' });
      return;
    }
    if (!user.inGuild) {
      res.status(403).json({ error: 'You must join the ADRENALINEE Discord server first' });
      return;
    }

    const parsed = requestCodeSchema.safeParse(req.body);
    if (!parsed.success || !isValidMinecraftNickname(parsed.data.mcNickname)) {
      res.status(400).json({ error: 'Invalid Minecraft nickname (3-16 characters, letters/numbers/_)' });
      return;
    }

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    const randomBytes = crypto.randomBytes(8);
    for (let i = 0; i < 8; i++) {
      code += chars[randomBytes[i] % chars.length];
    }

    user.pendingLinkCode = code;
    user.pendingLinkNickname = parsed.data.mcNickname;
    user.pendingLinkExpiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    user.updatedAt = new Date().toISOString();
    saveDatabase();

    res.json({
      code,
      mcNickname: user.pendingLinkNickname,
      expiresAt: user.pendingLinkExpiresAt,
      command: `/link ${code}`,
    });
  });

  // HMAC verification helper for Minecraft plugin endpoints
  function verifyMcPluginHmac(req: Request): boolean {
    const secret = process.env.MC_PLUGIN_SECRET;
    if (!secret) return false;
    const signature = req.headers['x-mc-signature'] as string | undefined;
    if (!signature) return false;
    const rawBody = JSON.stringify(req.body || {});
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
  }

  const mcVerifyBodySchema = z.object({
    code: z.string().length(8),
    mcNickname: z.string().min(3).max(16),
    uuid: z.string().optional(),
  });

  // Official Minecraft Plugin Endpoint: POST /api/mc/verify
  app.post('/api/mc/verify', async (req, res) => {
    const isPreviewSimulation =
      req.headers['x-preview-simulate'] === 'true' && !process.env.MC_PLUGIN_SECRET;

    if (!isPreviewSimulation && !verifyMcPluginHmac(req)) {
      res.status(401).json({ error: 'Invalid X-MC-Signature HMAC' });
      return;
    }

    const parsed = mcVerifyBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload format' });
      return;
    }

    const { code, mcNickname } = parsed.data;
    const user = storeDb.users.find(
      (u) =>
        u.pendingLinkCode &&
        u.pendingLinkCode.toUpperCase() === code.toUpperCase()
    );

    if (!user || !user.pendingLinkExpiresAt || Date.now() > user.pendingLinkExpiresAt) {
      res.status(404).json({ error: 'Link code invalid or expired' });
      return;
    }

    if (
      user.pendingLinkNickname &&
      user.pendingLinkNickname.toLowerCase() !== mcNickname.toLowerCase()
    ) {
      res.status(400).json({
        error: `Code was requested for ${user.pendingLinkNickname}, not ${mcNickname}`,
      });
    }

    user.mcNickname = mcNickname;
    user.verified = true;
    delete user.pendingLinkCode;
    delete user.pendingLinkNickname;
    delete user.pendingLinkExpiresAt;
    user.updatedAt = new Date().toISOString();
    saveDatabase();

    // Assign Verified Discord Role if Bot Token is configured
    let roleAssigned = false;
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const guildId = process.env.DISCORD_GUILD_ID;
    const roleId = process.env.DISCORD_VERIFIED_ROLE_ID;

    if (botToken && guildId && roleId && !user.id.startsWith('discord-')) {
      try {
        const roleRes = await fetch(
          `https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(user.id)}/roles/${encodeURIComponent(roleId)}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bot ${botToken}`,
            },
          }
        );
        roleAssigned = roleRes.ok;
      } catch {
        // Non-fatal if bot lacks permissions
      }
    }

    addAuditLog(
      'MC_PLUGIN',
      'VERIFY_PLAYER',
      `Verified Minecraft nickname ${mcNickname} for Discord user ${user.discordUsername}`,
      req.ip
    );

    res.json({
      verified: true,
      discordId: user.id,
      discordUsername: user.discordUsername,
      mcNickname: user.mcNickname,
      discordRoleAssigned: roleAssigned,
    });
  });

  // Plugin Delivery Queue Polling Endpoint: GET /api/mc/queue
  app.get('/api/mc/queue', (req, res) => {
    const secret = process.env.MC_PLUGIN_SECRET;
    const sig = req.headers['x-mc-signature'] as string | undefined;
    const ts = (req.headers['x-mc-timestamp'] as string) || '';

    if (secret) {
      const expected = crypto.createHmac('sha256', secret).update(ts).digest('hex');
      if (!sig || sig !== expected) {
        res.status(401).json({ error: 'Invalid X-MC-Signature HMAC' });
        return;
      }
    }

    const pendingTasks = storeDb.deliveryQueue.filter((t) => t.status === 'queued');
    res.json({ tasks: pendingTasks });
  });

  // Plugin Delivery Queue Acknowledge Endpoint: POST /api/mc/queue/ack
  app.post('/api/mc/queue/ack', (req, res) => {
    if (process.env.MC_PLUGIN_SECRET && !verifyMcPluginHmac(req)) {
      res.status(401).json({ error: 'Invalid X-MC-Signature HMAC' });
      return;
    }
    const taskId = req.body?.taskId as string | undefined;
    const task = storeDb.deliveryQueue.find((t) => t.id === taskId);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    task.status = 'completed';
    task.updatedAt = new Date().toISOString();
    saveDatabase();
    res.json({ ok: true });
  });

  // ==================== STORE, CART & CHECKOUT ROUTES ====================
  const checkoutSchema = z.object({
    items: z
      .array(
        z.object({
          productId: z.string().min(1).max(128),
          quantity: z.number().int().min(1).max(100),
        })
      )
      .min(1),
    couponCode: z.string().max(64).optional(),
    paymentMethod: z.enum(['manual', 'bog_ipay', 'tbc', 'flitt', 'payze']),
    transferSenderNote: z.string().max(200).optional(),
  });

  app.post('/api/orders/checkout', async (req, res) => {
    const user = getUserSession(req);
    if (!user) {
      res.status(401).json({ error: 'გთხოვთ გაიაროთ ავტორიზაცია Discord-ით / Please log in with Discord' });
      return;
    }
    if (user.banned) {
      res.status(403).json({ error: 'თქვენი ანგარიში დაბლოკილია / Your account is banned' });
      return;
    }
    if (!user.inGuild) {
      res.status(403).json({ error: 'შეძენამდე აუცილებელია ჩვენს Discord სერვერზე გაწევრიანება / Join our Discord server first' });
      return;
    }
    if (!user.verified || !user.mcNickname) {
      res.status(403).json({ error: 'შეძენა შეუძლიათ მხოლოდ ვერიფიცირებულ მოთამაშეებს (/link კოდით) / Only verified Minecraft accounts can purchase' });
      return;
    }

    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid checkout payload' });
      return;
    }

    const { items, couponCode, paymentMethod, transferSenderNote } = parsed.data;
    const foundCoupon = couponCode
      ? storeDb.coupons.find(
          (c) => c.code.toUpperCase() === couponCode.trim().toUpperCase()
        ) || null
      : null;

    const calc = calculateCartTotals(
      items,
      storeDb.products,
      foundCoupon,
      storeDb.settings.bundleDiscountsEnabled
    );

    if (calc.subtotalGel <= 0) {
      res.status(400).json({ error: 'Cart contains no valid visible products' });
      return;
    }

    const itemSnapshots: OrderItemSnapshot[] = [];
    for (const ci of items) {
      const prod = storeDb.products.find((p) => p.id === ci.productId && p.visible);
      if (!prod) continue;
      itemSnapshots.push({
        productId: prod.id,
        name: prod.name,
        type: prod.type,
        gamemode: prod.gamemode,
        color: prod.color,
        unitPrice: prod.price,
        quantity: ci.quantity,
        commands: prod.commands,
      });
    }

    if (foundCoupon && calc.couponApplied) {
      foundCoupon.usedCount += 1;
    }

    const orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();
    const newOrder: StoreOrder = {
      id: orderId,
      userId: user.id,
      discordUsername: user.discordUsername,
      mcNickname: user.mcNickname,
      items: itemSnapshots,
      subtotalGel: calc.subtotalGel,
      bundleDiscountGel: calc.bundleDiscountGel,
      couponCode: calc.couponApplied && foundCoupon ? foundCoupon.code : undefined,
      couponDiscountGel: calc.couponDiscountGel,
      totalGel: calc.totalGel,
      paymentMethod,
      transferSenderNote: transferSenderNote?.trim(),
      status: 'pending',
      deliveryAttempts: 0,
      deliveryLog: [`${now} — Order created (${paymentMethod.toUpperCase()})`],
      createdAt: now,
      updatedAt: now,
    };

    const paymentResult = initiatePayment(newOrder);
    newOrder.paymentReference = paymentResult.reference;

    storeDb.orders.unshift(newOrder);
    saveDatabase();
    broadcastStoreUpdate();

    res.json({
      order: newOrder,
      payment: paymentResult,
    });
  });

  // Payment Gateway Webhook with HMAC signature verification & idempotency
  app.post('/api/payments/webhook/:provider', async (req, res) => {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    const signature = req.headers['x-payment-signature'] as string | undefined;
    const isSimulatedGateway = req.headers['x-simulate-gateway'] === 'true' && !secret;

    if (!isSimulatedGateway) {
      if (!secret || !signature) {
        res.status(401).json({ error: 'Missing webhook signature' });
        return;
      }
      const raw = JSON.stringify(req.body || {});
      const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        res.status(401).json({ error: 'Invalid webhook HMAC signature' });
        return;
      }
    }

    const eventId = String(req.body?.eventId || req.body?.transactionId || '');
    const orderId = String(req.body?.orderId || '');
    const status = String(req.body?.status || '');

    if (!eventId || !orderId) {
      res.status(400).json({ error: 'Missing eventId or orderId' });
      return;
    }

    // Idempotency guard
    if (storeDb.processedWebhooks.includes(eventId)) {
      res.json({ ok: true, idempotentReplay: true });
      return;
    }

    const order = storeDb.orders.find((o) => o.id === orderId);
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    storeDb.processedWebhooks.push(eventId);

    if (status === 'SUCCESS' || status === 'PAID') {
      order.status = 'paid';
      order.paymentReference = eventId;
      order.deliveryLog.push(
        `${new Date().toISOString()} — Payment confirmed via ${req.params.provider} webhook (${eventId})`
      );
      await processOrderDelivery(order);
    } else if (status === 'FAILED') {
      order.status = 'failed';
      order.updatedAt = new Date().toISOString();
      saveDatabase();
    }

    res.json({ ok: true, orderStatus: order.status });
  });

  // ==================== ADMIN AUTHENTICATION & MANAGEMENT ROUTES ====================
  const adminLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15, // Rate limit failed attempts per IP
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  });

  app.get('/api/admin/session', (req, res) => {
    const session = getAdminSession(req);
    const hasConfiguredHash = Boolean(getActiveAdminPasswordHash());
    if (!session) {
      res.json({
        authenticated: false,
        needsInitialPasswordSetup: !hasConfiguredHash,
      });
      return;
    }
    const rawToken =
      req.cookies?.adrenalinee_admin ||
      (req.headers['x-admin-token'] as string | undefined) ||
      '';
    res.json({
      authenticated: true,
      username: session.sub,
      csrfToken: session.csrf,
      token: rawToken,
      needsInitialPasswordSetup: !hasConfiguredHash,
    });
  });

  app.post('/api/admin/login', adminLoginLimiter, (req, res) => {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    const envUsername = (process.env.ADMIN_USERNAME ?? '').trim();
    const envPasswordHash = (process.env.ADMIN_PASSWORD_HASH ?? '').trim();
    const activeHash = getActiveAdminPasswordHash();

    const bothEnvVarsDefined = Boolean(envUsername && envPasswordHash);
    const hashPartsCount = activeHash ? String(activeHash).trim().split(':').length : 0;

    // 1. Compare username with timingSafeEqual
    const usernameMatched = Boolean(envUsername) && verifyUsernameTimingSafe(username, envUsername);

    // 2. Always run verifyPassword even if usernameMatched is false so timing is equal
    const verifyPasswordReturnedTrue = activeHash
      ? verifyPassword(password, activeHash)
      : (() => {
          verifyPassword(password, DUMMY_SCRYPT_HASH);
          return false;
        })();

    // TEMPORARY diagnostic log (never logs password or hash itself)
    console.log('[ADMIN_LOGIN_DEBUG]', {
      bothEnvVarsDefined,
      hashPartsCount,
      usernameMatched,
      verifyPasswordReturnedTrue,
    });

    if (!usernameMatched || !verifyPasswordReturnedTrue) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const csrfToken = crypto.randomBytes(24).toString('hex');
    const token = signSessionToken({
      sub: envUsername,
      role: 'admin',
      csrf: csrfToken,
      exp: Date.now() + 2 * 60 * 60 * 1000, // 2h session
    });

    // Set cookie as httpOnly; Secure; SameSite=None so login sticks inside preview iframe
    res.cookie('adrenalinee_admin', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 2 * 60 * 60 * 1000,
    });

    addAuditLog(envUsername, 'ADMIN_LOGIN', 'Admin logged in successfully', req.ip);

    res.json({
      authenticated: true,
      username: envUsername,
      csrfToken,
      token,
    });
  });

  app.post('/api/admin/logout', (_req, res) => {
    res.clearCookie('adrenalinee_admin', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
    });
    res.json({ ok: true });
  });

  // Protected Admin Routes
  app.get('/api/admin/full-data', requireAdmin, (_req, res) => {
    const { adminPasswordHashOverride, ...safeData } = storeDb;
    res.json({
      ...safeData,
      hasCustomPasswordHash: Boolean(adminPasswordHashOverride),
    });
  });

  const changePasswordSchema = z.object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(8).max(128),
  });

  app.post('/api/admin/change-password', requireAdmin, (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'New password must be at least 8 characters' });
      return;
    }

    const activeHash = getActiveAdminPasswordHash();
    if (activeHash) {
      const valid = verifyPassword(parsed.data.currentPassword, activeHash);
      if (!valid) {
        res.status(401).json({ error: 'Current password is incorrect' });
        return;
      }
    }

    storeDb.adminPasswordHashOverride = hashPassword(parsed.data.newPassword);
    saveDatabase();
    addAuditLog(
      (req as any).adminSession.sub,
      'CHANGE_ADMIN_PASSWORD',
      'Updated scrypt admin password hash override',
      req.ip
    );

    res.json({ ok: true });
  });

  // Update Site Settings / Catalog / Staff / Ads / Coupons / FAQs
  app.put('/api/admin/settings', requireAdmin, (req, res) => {
    storeDb.settings = {
      ...storeDb.settings,
      ...req.body,
      updatedAt: new Date().toISOString(),
    };
    cachedLiveStatus = null; // Invalidate live status cache if IP/Discord changed
    addAuditLog((req as any).adminSession.sub, 'UPDATE_SETTINGS', 'Updated site settings & theme palette', req.ip);
    saveDatabase();
    broadcastStoreUpdate();
    res.json({ settings: storeDb.settings });
  });

  // Media Upload Validation (PNG/JPG/WebP, max 2 MB)
  const mediaUploadSchema = z.object({
    target: z.string().min(1).max(64),
    dataUrl: z.string().max(2_800_000), // ~2MB base64 ceiling
  });

  app.post('/api/admin/upload-media', requireAdmin, (req, res) => {
    const parsed = mediaUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'File exceeds 2 MB limit or invalid payload' });
      return;
    }
    const { target, dataUrl } = parsed.data;
    if (
      dataUrl !== '' &&
      !dataUrl.startsWith('data:image/png;base64,') &&
      !dataUrl.startsWith('data:image/jpeg;base64,') &&
      !dataUrl.startsWith('data:image/webp;base64,') &&
      !dataUrl.startsWith('https://')
    ) {
      res.status(400).json({ error: 'Only PNG, JPG, or WebP images are allowed' });
      return;
    }

    if (target in storeDb.settings.media) {
      (storeDb.settings.media as any)[target] = dataUrl;
      storeDb.settings.updatedAt = new Date().toISOString();
    }
    addAuditLog((req as any).adminSession.sub, 'UPLOAD_MEDIA', `Updated media slot: ${target}`, req.ip);
    saveDatabase();
    broadcastStoreUpdate();
    res.json({ media: storeDb.settings.media });
  });

  app.put('/api/admin/collection/:collectionName', requireAdmin, (req, res) => {
    const col = req.params.collectionName;
    const allowed = ['gamemodes', 'products', 'staff', 'ads', 'faqs', 'coupons'] as const;
    if (!allowed.includes(col as any) || !Array.isArray(req.body.items)) {
      res.status(400).json({ error: 'Invalid collection or items array' });
      return;
    }
    (storeDb as any)[col] = req.body.items;
    addAuditLog(
      (req as any).adminSession.sub,
      `UPDATE_${col.toUpperCase()}`,
      `Updated ${col} collection (${req.body.items.length} items)`,
      req.ip
    );
    saveDatabase();
    broadcastStoreUpdate();
    res.json({ items: (storeDb as any)[col] });
  });

  // Order Management (Mark Paid, Deliver/Redeliver, Refund)
  app.post('/api/admin/orders/:orderId/action', requireAdmin, async (req, res) => {
    const order = storeDb.orders.find((o) => o.id === req.params.orderId);
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const action = req.body?.action as string;
    const actor = (req as any).adminSession.sub;

    if (action === 'mark_paid') {
      order.status = 'paid';
      order.deliveryLog.push(`${new Date().toISOString()} — Marked PAID by Admin (${actor})`);
      await processOrderDelivery(order);
      addAuditLog(actor, 'ORDER_MARK_PAID', `Confirmed payment & triggered delivery for ${order.id}`, req.ip);
    } else if (action === 'redeliver') {
      order.deliveryLog.push(`${new Date().toISOString()} — Manual REDELIVER triggered by Admin (${actor})`);
      await processOrderDelivery(order);
      addAuditLog(actor, 'ORDER_REDELIVER', `Triggered redelivery for ${order.id}`, req.ip);
    } else if (action === 'refund') {
      order.status = 'refunded';
      order.updatedAt = new Date().toISOString();
      order.deliveryLog.push(`${new Date().toISOString()} — Marked REFUNDED by Admin (${actor})`);
      saveDatabase();
      addAuditLog(actor, 'ORDER_REFUND', `Refunded order ${order.id}`, req.ip);
    } else {
      res.status(400).json({ error: 'Unknown order action' });
      return;
    }

    res.json({ order });
  });

  // User Management (Ban/Unban, Toggle Verify)
  app.post('/api/admin/users/:userId/action', requireAdmin, (req, res) => {
    const user = storeDb.users.find((u) => u.id === req.params.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const action = req.body?.action as string;
    const actor = (req as any).adminSession.sub;

    if (action === 'toggle_ban') {
      user.banned = !user.banned;
      addAuditLog(actor, 'USER_BAN_TOGGLE', `${user.banned ? 'Banned' : 'Unbanned'} user ${user.discordUsername}`, req.ip);
    } else if (action === 'toggle_verify') {
      user.verified = !user.verified;
      if (user.verified && !user.mcNickname) {
        user.mcNickname = user.discordUsername.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16) || 'Player';
      }
      addAuditLog(actor, 'USER_VERIFY_TOGGLE', `Set verified=${user.verified} for ${user.discordUsername}`, req.ip);
    }
    user.updatedAt = new Date().toISOString();
    saveDatabase();
    res.json({ user });
  });

  // Backup Export & Import JSON
  app.get('/api/admin/backup/export', requireAdmin, (req, res) => {
    addAuditLog((req as any).adminSession.sub, 'EXPORT_BACKUP', 'Exported store JSON backup', req.ip);
    const { adminPasswordHashOverride, ...exportable } = storeDb;
    res.json(exportable);
  });

  app.post('/api/admin/backup/import', requireAdmin, (req, res) => {
    const data = req.body;
    if (!data || typeof data !== 'object' || !data.settings || !Array.isArray(data.products)) {
      res.status(400).json({ error: 'Invalid backup JSON structure' });
      return;
    }
    const existingHash = storeDb.adminPasswordHashOverride;
    storeDb = {
      ...INITIAL_STORE_DB,
      ...data,
      adminPasswordHashOverride: existingHash,
    };
    saveDatabase();
    broadcastStoreUpdate();
    addAuditLog((req as any).adminSession.sub, 'IMPORT_BACKUP', 'Imported full store JSON backup', req.ip);
    res.json({ ok: true });
  });

  // ==================== VITE DEV / STATIC MIDDLEWARE ====================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ADRENALINEE Store Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
