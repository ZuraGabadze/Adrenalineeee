import crypto from 'crypto';
import { CartItem, CouponCode, StoreProduct } from '../types/store';

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [alg, N, r, p, saltHex, hashHex] = String(stored).trim().split(':');
    if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    if (expected.length === 0) return false;
    const actual = crypto.scryptSync(password, salt, expected.length, {
      N: +N,
      r: +r,
      p: +p,
      maxmem: 64 * 1024 * 1024,
    });
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
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

export function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function formatGel(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  return `${safe.toFixed(2)}₾`;
}

export function isValidMinecraftNickname(nickname: string): boolean {
  if (typeof nickname !== 'string') return false;
  const trimmed = nickname.trim();
  return /^[a-zA-Z0-9_]{3,16}$/.test(trimmed);
}

export function getKeyBundleDiscountRate(totalKeysCount: number, enabled = true): number {
  if (!enabled || totalKeysCount < 3) return 0;
  if (totalKeysCount >= 10) return 0.15;
  if (totalKeysCount >= 5) return 0.10;
  return 0.05;
}

export interface CartCalculationResult {
  subtotalGel: number;
  keysSubtotalGel: number;
  totalKeysCount: number;
  bundleDiscountRate: number;
  bundleDiscountGel: number;
  couponDiscountGel: number;
  totalGel: number;
  couponApplied: boolean;
  couponError?: string;
}

export function calculateCartTotals(
  cartItems: CartItem[],
  products: StoreProduct[],
  coupon: CouponCode | null,
  bundleDiscountsEnabled = true
): CartCalculationResult {
  let subtotalGel = 0;
  let keysSubtotalGel = 0;
  let totalKeysCount = 0;

  for (const item of cartItems) {
    if (item.quantity <= 0) continue;
    const product = products.find((p) => p.id === item.productId);
    if (!product || !product.visible) continue;
    const lineTotal = product.price * item.quantity;
    subtotalGel += lineTotal;
    if (product.type === 'key') {
      keysSubtotalGel += lineTotal;
      totalKeysCount += item.quantity;
    }
  }

  subtotalGel = Math.round(subtotalGel * 100) / 100;
  keysSubtotalGel = Math.round(keysSubtotalGel * 100) / 100;

  const bundleDiscountRate = getKeyBundleDiscountRate(totalKeysCount, bundleDiscountsEnabled);
  const bundleDiscountGel = Math.round(keysSubtotalGel * bundleDiscountRate * 100) / 100;
  const afterBundleGel = Math.max(0, Math.round((subtotalGel - bundleDiscountGel) * 100) / 100);

  let couponDiscountGel = 0;
  let couponApplied = false;
  let couponError: string | undefined;

  if (coupon) {
    if (!coupon.active) {
      couponError = 'INACTIVE_COUPON';
    } else if (coupon.usedCount >= coupon.maxUses) {
      couponError = 'MAX_USES_REACHED';
    } else if (afterBundleGel < coupon.minOrderGel) {
      couponError = 'MIN_ORDER_NOT_MET';
    } else {
      couponApplied = true;
      if (coupon.discountType === 'percent') {
        const pct = Math.min(100, Math.max(0, coupon.value));
        couponDiscountGel = Math.round(afterBundleGel * (pct / 100) * 100) / 100;
      } else {
        couponDiscountGel = Math.min(afterBundleGel, Math.round(coupon.value * 100) / 100);
      }
    }
  }

  const totalGel = Math.max(0, Math.round((afterBundleGel - couponDiscountGel) * 100) / 100);

  return {
    subtotalGel,
    keysSubtotalGel,
    totalKeysCount,
    bundleDiscountRate,
    bundleDiscountGel,
    couponDiscountGel,
    totalGel,
    couponApplied,
    couponError,
  };
}

export function interpolateDeliveryCommand(
  template: string,
  player: string,
  amount: number
): string {
  const safePlayer = player.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16);
  const safeAmount = Math.max(1, Math.floor(Number(amount) || 1));
  return template
    .replace(/\{player\}/g, safePlayer)
    .replace(/\{amount\}/g, String(safeAmount));
}

export function calculateEcgAnimationDuration(playersOnline: number): number {
  const count = Math.max(0, Number(playersOnline) || 0);
  const duration = 2.6 - Math.min(150, count) * 0.013;
  return Math.round(Math.max(0.65, Math.min(2.6, duration)) * 100) / 100;
}

export function calculateEcgBpm(playersOnline: number): number {
  const count = Math.max(0, Number(playersOnline) || 0);
  return Math.min(185, Math.round(68 + count * 0.75));
}
