import React, { useState } from 'react';
import {
  CartItem,
  CouponCode,
  Language,
  LinkedUser,
  PaymentMethodId,
  SiteSettings,
  StoreOrder,
  StoreProduct,
} from '../types/store';
import { calculateCartTotals, formatGel } from '../utils/storeLogic';
import { X, Trash2, Plus, Minus, ShieldCheck, AlertCircle, CheckCircle2, CreditCard, Building2 } from 'lucide-react';

export const CartDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
  lang: Language;
  cart: CartItem[];
  products: StoreProduct[];
  coupons: CouponCode[];
  settings: SiteSettings;
  user: LinkedUser | null;
  sessionToken: string | null;
  onUpdateQty: (productId: string, delta: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onGoToAccount: () => void;
  onOrderCreated: (order: StoreOrder) => void;
}> = ({
  open,
  onClose,
  lang,
  cart,
  products,
  coupons,
  settings,
  user,
  sessionToken,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onGoToAccount,
  onOrderCreated,
}) => {
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponCode | null>(null);
  const [couponMsg, setCouponMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>('bog_ipay');
  const [transferNote, setTransferNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [completedResult, setCompletedResult] = useState<{
    order: StoreOrder;
    payment: any;
  } | null>(null);
  const [simulatingWebhook, setSimulatingWebhook] = useState(false);

  if (!open) return null;

  const calc = calculateCartTotals(
    cart,
    products,
    appliedCoupon,
    settings.bundleDiscountsEnabled
  );

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    const match = coupons.find((c) => c.code.toUpperCase() === code && c.active);
    if (!match) {
      setAppliedCoupon(null);
      setCouponMsg({
        type: 'err',
        text: lang === 'ka' ? 'კუპონი ვერ მოიძებნა ან ვადაგასულია' : 'Invalid or expired coupon code',
      });
      return;
    }
    const testCalc = calculateCartTotals(cart, products, match, settings.bundleDiscountsEnabled);
    if (!testCalc.couponApplied) {
      setAppliedCoupon(null);
      setCouponMsg({
        type: 'err',
        text:
          lang === 'ka'
            ? `მინიმალური შეკვეთა ამ კუპონისთვის: ${formatGel(match.minOrderGel)}`
            : `Minimum order for this coupon is ${formatGel(match.minOrderGel)}`,
      });
      return;
    }
    setAppliedCoupon(match);
    setCouponMsg({
      type: 'ok',
      text:
        lang === 'ka'
          ? `კუპონი ${match.code} გააქტიურდა!`
          : `Coupon ${match.code} applied!`,
    });
  };

  const handleCheckout = async () => {
    setCheckoutError(null);
    setSubmitting(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) headers['X-Session-Token'] = sessionToken;

      const res = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          items: cart,
          couponCode: appliedCoupon?.code,
          paymentMethod,
          transferSenderNote: transferNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCheckoutError(data.error || 'Checkout failed');
      } else {
        setCompletedResult(data);
        onOrderCreated(data.order);
        onClearCart();
      }
    } catch {
      setCheckoutError(lang === 'ka' ? 'კავშირის შეცდომა' : 'Network error during checkout');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSimulateGatewayPayment = async () => {
    if (!completedResult) return;
    setSimulatingWebhook(true);
    try {
      const res = await fetch(
        `/api/payments/webhook/${encodeURIComponent(completedResult.order.paymentMethod)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Simulate-Gateway': 'true',
          },
          body: JSON.stringify({
            eventId: `SIM-TX-${Date.now()}`,
            orderId: completedResult.order.id,
            status: 'SUCCESS',
          }),
        }
      );
      if (res.ok) {
        setCompletedResult((prev) =>
          prev
            ? {
                ...prev,
                order: { ...prev.order, status: 'delivered' },
              }
            : null
        );
      }
    } finally {
      setSimulatingWebhook(false);
    }
  };

  const isUserVerified = Boolean(user && user.inGuild && user.verified && user.mcNickname && !user.banned);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0B0714] border-l border-[#8A00FF]/35 h-full flex flex-col justify-between overflow-y-auto p-6">
        <div>
          {/* Drawer Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <h2 className="text-lg font-bold text-white">
              {lang === 'ka' ? 'თქვენი კალათა' : 'Shopping Cart'}
            </h2>
            <button
              type="button"
              aria-label="Close Cart"
              onClick={() => {
                setCompletedResult(null);
                onClose();
              }}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/15 text-[#C4B5FD] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {completedResult ? (
            <div className="py-6 space-y-5">
              <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-base">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>
                    {lang === 'ka'
                      ? `შეკვეთა #${completedResult.order.id} შეიქმნა!`
                      : `Order #${completedResult.order.id} Created!`}
                  </span>
                </div>
                <p className="text-xs text-emerald-200/80">
                  {lang === 'ka'
                    ? `მოთამაშე: ${completedResult.order.mcNickname} · ჯამი: ${formatGel(completedResult.order.totalGel)}`
                    : `Player: ${completedResult.order.mcNickname} · Total: ${formatGel(completedResult.order.totalGel)}`}
                </p>
              </div>

              {completedResult.payment.mode === 'manual' && completedResult.payment.instructions ? (
                <div className="p-4 rounded-xl bg-[#05030A] border border-[#8A00FF]/40 space-y-3 text-xs sm:text-sm">
                  <h3 className="font-bold text-[#C4B5FD]">
                    {lang === 'ka'
                      ? 'საბანკო გადარიცხვის ინსტრუქცია (Manual)'
                      : 'Bank Transfer Instructions (Manual)'}
                  </h3>
                  <div className="space-y-1.5 font-nums text-white/90">
                    <div>
                      <span className="text-[#C4B5FD]/70">{lang === 'ka' ? 'ბანკი: ' : 'Bank: '}</span>
                      {completedResult.payment.instructions.bankName}
                    </div>
                    <div>
                      <span className="text-[#C4B5FD]/70">IBAN: </span>
                      <span className="font-mono text-[#00F5FF]">
                        {completedResult.payment.instructions.iban}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#C4B5FD]/70">{lang === 'ka' ? 'მიმღები: ' : 'Recipient: '}</span>
                      {completedResult.payment.instructions.recipient}
                    </div>
                    <div>
                      <span className="text-[#C4B5FD]/70">{lang === 'ka' ? 'თანხა: ' : 'Amount: '}</span>
                      <span className="font-bold text-white">
                        {formatGel(completedResult.payment.instructions.amountGel)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#C4B5FD]/70">{lang === 'ka' ? 'დანიშნულება: ' : 'Transfer Note: '}</span>
                      <span className="font-mono bg-[#8A00FF]/25 px-2 py-0.5 rounded text-white">
                        {completedResult.payment.instructions.note}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-[#C4B5FD]/80">
                    {settings.manualBankDetails.noteInstruction[lang]}
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[#05030A] border border-[#8A00FF]/40 space-y-3 text-xs sm:text-sm">
                  <h3 className="font-bold text-white">
                    {lang === 'ka'
                      ? `ონლაინ გადახდის კარიბჭე (${completedResult.order.paymentMethod.toUpperCase()})`
                      : `Online Payment Gateway (${completedResult.order.paymentMethod.toUpperCase()})`}
                  </h3>
                  <p className="text-xs text-[#C4B5FD]/80">
                    {completedResult.order.status === 'delivered'
                      ? lang === 'ka'
                        ? 'გადახდა დადასტურდა! ნივთები გაიგზავნა სერვერზე (RCON / Plugin Queue).'
                        : 'Payment verified! Items have been dispatched to your character.'
                      : lang === 'ka'
                      ? 'დააჭირეთ ქვემოთ გადახდის Webhook-ის სიმულაციისთვის და ნივთის მყისიერი მიწოდებისთვის.'
                      : 'Click below to complete the gateway payment webhook and trigger instant delivery.'}
                  </p>
                  {completedResult.order.status !== 'delivered' && (
                    <button
                      type="button"
                      disabled={simulatingWebhook}
                      onClick={handleSimulateGatewayPayment}
                      className="w-full py-2.5 px-4 rounded-lg bg-[#8A00FF] hover:bg-[#C800FF] text-white font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
                    >
                      {simulatingWebhook
                        ? lang === 'ka'
                          ? 'მოწმდება...'
                          : 'Confirming...'
                        : lang === 'ka'
                        ? 'გადახდის დასრულება და მიწოდება'
                        : 'Complete Gateway Payment & Deliver'}
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : cart.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <p className="text-sm text-[#C4B5FD]/80">
                {lang === 'ka' ? 'თქვენი კალათა ცარიელია.' : 'Your cart is currently empty.'}
              </p>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              {/* Itemized List */}
              <div className="space-y-3">
                {cart.map((ci) => {
                  const prod = products.find((p) => p.id === ci.productId);
                  if (!prod) return null;
                  return (
                    <div
                      key={ci.productId}
                      className="p-3.5 rounded-xl bg-[#05030A] border border-white/10 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="font-pixel text-sm font-bold"
                            style={{ color: prod.color }}
                          >
                            {prod.name}
                          </span>
                          <span className="text-xs text-[#C4B5FD]/60 uppercase">
                            · {prod.gamemode}
                          </span>
                        </div>
                        <div className="text-xs text-white/80 font-nums mt-0.5">
                          {formatGel(prod.price)} × {ci.quantity} ={' '}
                          <span className="font-bold text-white">
                            {formatGel(prod.price * ci.quantity)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 font-nums">
                        <button
                          type="button"
                          aria-label={`Decrease ${prod.name}`}
                          onClick={() => onUpdateQty(ci.productId, -1)}
                          className="w-7 h-7 rounded bg-white/5 hover:bg-white/15 flex items-center justify-center text-white cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold">{ci.quantity}</span>
                        <button
                          type="button"
                          aria-label={`Increase ${prod.name}`}
                          onClick={() => onUpdateQty(ci.productId, 1)}
                          className="w-7 h-7 rounded bg-white/5 hover:bg-white/15 flex items-center justify-center text-white cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${prod.name}`}
                          onClick={() => onRemoveItem(ci.productId)}
                          className="w-7 h-7 rounded bg-red-500/15 hover:bg-red-500/30 flex items-center justify-center text-red-400 ml-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Coupon Form */}
              <form onSubmit={handleApplyCoupon} className="pt-2 space-y-2">
                <label className="block text-xs text-[#C4B5FD]">
                  {lang === 'ka' ? 'ფასდაკლების კუპონი' : 'Promo / Coupon Code'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="ADRENALINE10"
                    className="flex-1 px-3 py-2 rounded-lg bg-[#05030A] border border-white/15 text-sm text-white focus:outline-none focus:border-[#8A00FF]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {lang === 'ka' ? 'გამოყენება' : 'Apply'}
                  </button>
                </div>
                {couponMsg && (
                  <p
                    className={`text-xs ${
                      couponMsg.type === 'ok' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {couponMsg.text}
                  </p>
                )}
              </form>

              {/* Payment Provider Selector */}
              <div className="pt-2 space-y-2">
                <label className="block text-xs text-[#C4B5FD]">
                  {lang === 'ka' ? 'გადახდის მეთოდი' : 'Payment Method'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'bog_ipay', label: 'BOG iPay', icon: CreditCard },
                      { id: 'tbc', label: 'TBC Pay', icon: CreditCard },
                      { id: 'flitt', label: 'Flitt / Payze', icon: CreditCard },
                      {
                        id: 'manual',
                        label: lang === 'ka' ? 'გადარიცხვა (IBAN)' : 'Manual Transfer',
                        icon: Building2,
                      },
                    ] as const
                  ).map((pm) => {
                    const Icon = pm.icon;
                    const active = paymentMethod === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setPaymentMethod(pm.id)}
                        className={`p-2.5 rounded-lg border text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#8A00FF]/25 border-[#C800FF] text-white'
                            : 'bg-[#05030A] border-white/10 text-[#C4B5FD]/80 hover:border-white/25'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0 text-[#C800FF]" />
                        <span className="truncate">{pm.label}</span>
                      </button>
                    );
                  })}
                </div>

                {paymentMethod === 'manual' && (
                  <div className="pt-2">
                    <input
                      type="text"
                      value={transferNote}
                      onChange={(e) => setTransferNote(e.target.value)}
                      placeholder={
                        lang === 'ka'
                          ? 'გამომგზავნის სახელი / შენიშვნა (არასავალდებულო)'
                          : 'Sender name or transfer note (optional)'
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[#05030A] border border-white/15 text-xs text-white"
                    />
                  </div>
                )}
              </div>

              {/* Verification Status Gate */}
              <div className="pt-2">
                {isUserVerified ? (
                  <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-300">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>
                      {lang === 'ka'
                        ? `ვერიფიცირებული მოთამაშე: ${user?.mcNickname} (${user?.discordUsername})`
                        : `Verified Player: ${user?.mcNickname} (${user?.discordUsername})`}
                    </span>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-lg bg-amber-950/40 border border-amber-500/40 space-y-2 text-xs text-amber-200">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>
                        {lang === 'ka'
                          ? 'შეძენისთვის საჭიროა ვერიფიცირებული ანგარიში'
                          : 'Account Verification Required to Buy'}
                      </span>
                    </div>
                    <p className="text-amber-200/80">
                      {lang === 'ka'
                        ? 'შედით Discord-ით და დააკავშირეთ თქვენი Minecraft ნიკი /link კოდით.'
                        : 'Log in with Discord and link your Minecraft nickname via /link CODE.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onGoToAccount();
                      }}
                      className="w-full py-2 px-3 rounded bg-amber-500 hover:bg-amber-400 text-[#05030A] font-bold text-xs transition-colors cursor-pointer"
                    >
                      {lang === 'ka' ? 'ანგარიშის ვერიფიკაცია →' : 'Verify Account Now →'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Totals & Checkout Footer */}
        {cart.length > 0 && !completedResult && (
          <div className="pt-4 border-t border-white/10 space-y-3 font-nums">
            <div className="space-y-1.5 text-xs sm:text-sm">
              <div className="flex justify-between text-[#C4B5FD]">
                <span>{lang === 'ka' ? 'ქვეჯამი:' : 'Subtotal:'}</span>
                <span>{formatGel(calc.subtotalGel)}</span>
              </div>
              {calc.bundleDiscountGel > 0 && (
                <div className="flex justify-between text-[#00F5FF]">
                  <span>
                    {lang === 'ka'
                      ? `გასაღებების Bundle ფასდაკლება (-${Math.round(calc.bundleDiscountRate * 100)}%):`
                      : `Key Bundle Discount (-${Math.round(calc.bundleDiscountRate * 100)}%):`}
                  </span>
                  <span>-{formatGel(calc.bundleDiscountGel)}</span>
                </div>
              )}
              {calc.couponDiscountGel > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>
                    {lang === 'ka'
                      ? `კუპონი (${appliedCoupon?.code}):`
                      : `Coupon (${appliedCoupon?.code}):`}
                  </span>
                  <span>-{formatGel(calc.couponDiscountGel)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-white/10">
                <span>{lang === 'ka' ? 'სულ გადასახდელი:' : 'Total Due:'}</span>
                <span className="text-[#C800FF]">{formatGel(calc.totalGel)}</span>
              </div>
            </div>

            {checkoutError && (
              <p className="text-xs text-rose-400 bg-rose-950/40 border border-rose-500/30 p-2.5 rounded-lg">
                {checkoutError}
              </p>
            )}

            <button
              type="button"
              disabled={!isUserVerified || submitting}
              onClick={handleCheckout}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#8A00FF] to-[#C800FF] hover:brightness-110 disabled:opacity-40 text-white font-bold text-sm transition-all cursor-pointer"
            >
              {submitting
                ? lang === 'ka'
                  ? 'მუშავდება...'
                  : 'Processing...'
                : lang === 'ka'
                ? `შეკვეთის გაფორმება · ${formatGel(calc.totalGel)}`
                : `Complete Purchase · ${formatGel(calc.totalGel)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
