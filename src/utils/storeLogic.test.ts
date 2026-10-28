import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatGel,
  isValidMinecraftNickname,
  getKeyBundleDiscountRate,
  calculateCartTotals,
  interpolateDeliveryCommand,
  calculateEcgAnimationDuration,
  calculateEcgBpm,
  verifyPassword,
  hashPassword,
  timingSafeEqualStrings,
} from './storeLogic';
import { INITIAL_STORE_DB } from '../data/seedData';

test('verifyPassword verifies colon-separated hex scrypt hash scrypt:N:r:p:saltHex:hashHex', () => {
  const generated = hashPassword('MySuperSecret123!');
  const parts = generated.split(':');
  assert.equal(parts.length, 6);
  assert.equal(parts[0], 'scrypt');
  assert.equal(verifyPassword('MySuperSecret123!', `  ${generated}\n `), true);
  assert.equal(verifyPassword('WrongPassword', generated), false);
  assert.equal(verifyPassword('MySuperSecret123!', 'invalid:format'), false);
});

test('timingSafeEqualStrings compares strings in constant time', () => {
  assert.equal(timingSafeEqualStrings('admin', 'admin'), true);
  assert.equal(timingSafeEqualStrings('admin', 'admin2'), false);
  assert.equal(timingSafeEqualStrings('admin', 'usera'), false);
});

test('formatGel formats GEL currency to 2 decimal places', () => {
  assert.equal(formatGel(9.99), '9.99₾');
  assert.equal(formatGel(0.5), '0.50₾');
  assert.equal(formatGel(-5), '0.00₾');
});

test('isValidMinecraftNickname validates 3-16 alphanumeric/underscore characters', () => {
  assert.equal(isValidMinecraftNickname('CHABSKEYYY'), true);
  assert.equal(isValidMinecraftNickname('JAJO_1121'), true);
  assert.equal(isValidMinecraftNickname('ab'), false);
  assert.equal(isValidMinecraftNickname('bad-name!'), false);
});

test('getKeyBundleDiscountRate returns progressive tier discounts', () => {
  assert.equal(getKeyBundleDiscountRate(2, true), 0);
  assert.equal(getKeyBundleDiscountRate(3, true), 0.05);
  assert.equal(getKeyBundleDiscountRate(5, true), 0.10);
  assert.equal(getKeyBundleDiscountRate(10, true), 0.15);
  assert.equal(getKeyBundleDiscountRate(10, false), 0);
});

test('calculateCartTotals computes rank + key bundle discount + coupon accurately', () => {
  const cart = [
    { productId: 'smp-mvp', quantity: 1 },
    { productId: 'key-void', quantity: 5 },
  ];
  const coupon = INITIAL_STORE_DB.coupons[0];
  const result = calculateCartTotals(cart, INITIAL_STORE_DB.products, coupon, true);

  assert.equal(result.subtotalGel, 44.99);
  assert.equal(result.totalKeysCount, 5);
  assert.equal(result.bundleDiscountGel, 2.00);
  assert.equal(result.couponApplied, true);
  assert.equal(result.couponDiscountGel, 4.30);
  assert.equal(result.totalGel, 38.69);
});

test('interpolateDeliveryCommand sanitizes player name and replaces placeholders', () => {
  const cmd = interpolateDeliveryCommand(
    'crate key give {player} abyssal {amount}',
    'SAITO;op me',
    5
  );
  assert.equal(cmd, 'crate key give SAITOopme abyssal 5');
});

test('calculateEcgAnimationDuration speeds up as online player count rises', () => {
  const durZero = calculateEcgAnimationDuration(0);
  const durFifty = calculateEcgAnimationDuration(50);
  const durMax = calculateEcgAnimationDuration(200);
  assert.equal(durZero > durFifty, true);
  assert.equal(durFifty > durMax, true);
  assert.equal(durMax, 0.65);
  assert.equal(calculateEcgBpm(40) > calculateEcgBpm(0), true);
});
