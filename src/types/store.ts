export type Language = 'ka' | 'en';

export interface BilingualText {
  ka: string;
  en: string;
}

export interface ThemePalette {
  bgPrimary: string;     // #05030A
  bgSecondary: string;   // #0B0714
  primaryPurple: string; // #8A00FF
  electricViolet: string;// #C800FF
  deepIndigo: string;    // #4C1D95
  lavenderAccent: string;// #C4B5FD
  neonMagenta: string;   // #FF2BD6
  cyanAccent: string;    // #00F5FF
}

export interface SiteSettings {
  serverName: string;
  serverIp: string;
  serverVersion: string;
  discordInviteCode: string;
  discordInviteUrl: string;
  tiktokUrl: string;
  youtubeUrl: string;
  instagramUrl: string;
  maintenanceMode: boolean;
  announcementEnabled: boolean;
  announcement: BilingualText;
  heroTitle: BilingualText;
  heroSubtitle: BilingualText;
  howToJoinSteps: BilingualText[];
  rules: BilingualText[];
  buyingDeliveryInfo: BilingualText[];
  manualBankDetails: {
    bankName: string;
    iban: string;
    recipient: string;
    noteInstruction: BilingualText;
  };
  palette: ThemePalette;
  media: {
    logoUrl: string;
    faviconUrl: string;
    bannerUrl: string;
    backgroundUrl: string;
  };
  bundleDiscountsEnabled: boolean;
  updatedAt: string;
}

export interface GamemodeInfo {
  id: 'smp' | 'oneblock' | string;
  name: string;
  subtitle: BilingualText;
  description: BilingualText;
  features: BilingualText[];
  color: string;
  bannerUrl: string;
  sortOrder: number;
  visible: boolean;
}

export type ProductType = 'rank' | 'key';

export interface StoreProduct {
  id: string;
  type: ProductType;
  gamemode: 'smp' | 'oneblock' | 'global';
  name: string;
  badgeText?: string;
  color: string;
  price: number; // GEL (₾)
  thumbnail: string; // uploaded data/url or empty for SVG art
  perks: BilingualText[];
  commands: string[]; // e.g. ["lp user {player} parent add vip"]
  visible: boolean;
  featured?: boolean;
  sortOrder: number;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  roleKa: string;
  roleColor: string;
  discordTag?: string;
  sortOrder: number;
}

export type AdSlotId = 'home-top' | 'home-middle' | 'footer';

export interface AdBanner {
  id: string;
  slot: AdSlotId;
  title: BilingualText;
  subtitle: BilingualText;
  ctaText: BilingualText;
  imageUrl: string;
  linkUrl: string;
  startDate: string;
  endDate: string;
  enabled: boolean;
  clicks: number;
}

export interface FaqItem {
  id: string;
  question: BilingualText;
  answer: BilingualText;
  sortOrder: number;
}

export interface CouponCode {
  id: string;
  code: string;
  discountType: 'percent' | 'fixed';
  value: number;
  minOrderGel: number;
  maxUses: number;
  usedCount: number;
  active: boolean;
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export type OrderStatus = 'pending' | 'paid' | 'delivering' | 'delivered' | 'failed' | 'refunded';
export type PaymentMethodId = 'manual' | 'bog_ipay' | 'tbc' | 'flitt' | 'payze';

export interface OrderItemSnapshot {
  productId: string;
  name: string;
  type: ProductType;
  gamemode: string;
  color: string;
  unitPrice: number;
  quantity: number;
  commands: string[];
}

export interface StoreOrder {
  id: string;
  userId: string;
  discordUsername: string;
  mcNickname: string;
  items: OrderItemSnapshot[];
  subtotalGel: number;
  bundleDiscountGel: number;
  couponCode?: string;
  couponDiscountGel: number;
  totalGel: number;
  paymentMethod: PaymentMethodId;
  paymentReference?: string;
  transferSenderNote?: string;
  status: OrderStatus;
  deliveryAttempts: number;
  deliveryMethod?: 'rcon' | 'plugin_queue';
  deliveryLog: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LinkedUser {
  id: string; // Discord user ID
  discordUsername: string;
  discordAvatar: string;
  inGuild: boolean;
  mcNickname: string | null;
  verified: boolean;
  banned: boolean;
  pendingLinkCode?: string;
  pendingLinkNickname?: string;
  pendingLinkExpiresAt?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  details: string;
  ip?: string;
  createdAt: string;
}

export interface DeliveryQueueTask {
  id: string;
  orderId: string;
  mcNickname: string;
  commands: string[];
  status: 'queued' | 'processing' | 'completed' | 'failed';
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LiveServerStatus {
  minecraft: {
    online: boolean;
    ip: string;
    playersOnline: number;
    playersMax: number;
    version: string;
    motd: string;
    updatedAt: string;
  };
  discord: {
    onlineCount: number;
    memberCount: number;
    inviteCode: string;
    guildName: string;
    updatedAt: string;
  };
}

export interface FullStoreDatabase {
  settings: SiteSettings;
  gamemodes: GamemodeInfo[];
  products: StoreProduct[];
  staff: StaffMember[];
  ads: AdBanner[];
  faqs: FaqItem[];
  coupons: CouponCode[];
  orders: StoreOrder[];
  users: LinkedUser[];
  auditLogs: AuditLogEntry[];
  deliveryQueue: DeliveryQueueTask[];
  adminPasswordHashOverride?: string;
  processedWebhooks: string[];
}
