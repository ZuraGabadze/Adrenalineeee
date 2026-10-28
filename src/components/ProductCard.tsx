import React, { useState } from 'react';
import { Language, StoreProduct } from '../types/store';
import { formatGel } from '../utils/storeLogic';
import { RankEmblemSvg, CrateKeyArtSvg } from './VoxelArtwork';
import { ShoppingBag, Check, Plus, Minus } from 'lucide-react';

export const ProductCard: React.FC<{
  product: StoreProduct;
  lang: Language;
  onAddToCart: (productId: string, quantity: number) => void;
}> = ({ product, lang, onAddToCart }) => {
  const [qty, setQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rx: Math.round(-y * 8 * 10) / 10,
      ry: Math.round(x * 8 * 10) / 10,
    });
  };

  const handleMouseLeave = () => {
    setTilt({ rx: 0, ry: 0 });
  };

  const handleAdd = () => {
    onAddToCart(product.id, product.type === 'key' ? qty : 1);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
        borderColor: `${product.color}55`,
        boxShadow: `0 10px 32px -12px ${product.color}40`,
      }}
      className="group relative rounded-2xl bg-[#0B0714]/90 backdrop-blur-md border p-6 flex flex-col justify-between overflow-hidden transition-transform duration-150 ease-out"
    >
      {/* Data-Driven Color Top Glow Bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: product.color, boxShadow: `0 0 16px ${product.color}` }}
      />

      {/* Shimmer Sweep on Hover */}
      <div
        className="shimmer-sweep pointer-events-none absolute -inset-y-12 w-1/3 opacity-0 group-hover:opacity-20 transition-opacity duration-200"
        style={{
          background: `linear-gradient(90deg, transparent, ${product.color}, #ffffff, transparent)`,
        }}
      />

      <div>
        {/* Subtle Kicker Text (No Pill Sandwich) */}
        <div className="flex items-center justify-between text-xs text-[#C4B5FD]/75 mb-3 font-nums">
          <span className="uppercase tracking-wider">
            {product.gamemode === 'global'
              ? lang === 'ka'
                ? 'სკივრის გასაღები'
                : 'CRATE KEY'
              : `${product.gamemode.toUpperCase()} · ${product.badgeText || 'RANK'}`}
          </span>
          <span style={{ color: product.color }} className="font-semibold">
            {product.type === 'key' ? 'CRATE' : 'RANK'}
          </span>
        </div>

        {/* Artwork */}
        <div className="my-3">
          {product.type === 'key' ? (
            <CrateKeyArtSvg
              color={product.color}
              name={product.name}
              thumbnail={product.thumbnail}
            />
          ) : (
            <RankEmblemSvg
              color={product.color}
              name={product.name}
              thumbnail={product.thumbnail}
            />
          )}
        </div>

        {/* Title & Price */}
        <div className="text-center mt-2 mb-4">
          <h3
            className="font-pixel text-xl tracking-wide font-bold"
            style={{ color: product.color, textShadow: `0 0 14px ${product.color}55` }}
          >
            {product.name}
          </h3>
          <div className="mt-1.5 text-2xl font-bold text-white font-nums">
            {formatGel(product.price * (product.type === 'key' ? qty : 1))}
            {product.type === 'key' && qty > 1 && (
              <span className="block text-xs text-[#C4B5FD]/75 font-normal">
                {formatGel(product.price)} × {qty}
              </span>
            )}
          </div>
        </div>

        {/* Perks List */}
        <ul className="space-y-2 text-xs sm:text-sm text-[#F5F3FF]/90 border-t border-white/10 pt-4 mb-5">
          {product.perks.map((perk, idx) => (
            <li key={idx} className="flex items-start gap-2 leading-relaxed">
              <span
                className="font-bold shrink-0 mt-0.5"
                style={{ color: product.color }}
                aria-hidden="true"
              >
                +
              </span>
              <span>{perk[lang] || perk.ka}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Quantity Selector (for Keys) + Add to Cart CTA */}
      <div className="space-y-3 pt-2 border-t border-white/10">
        {product.type === 'key' && (
          <div className="flex items-center justify-between bg-[#05030A] rounded-lg px-3 py-1.5 border border-white/10">
            <span className="text-xs text-[#C4B5FD]">
              {lang === 'ka' ? 'რაოდენობა:' : 'Quantity:'}
            </span>
            <div className="flex items-center gap-2 font-nums">
              <button
                type="button"
                aria-label={`Decrease quantity for ${product.name}`}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-7 h-7 rounded bg-white/5 hover:bg-white/15 flex items-center justify-center text-white cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-7 text-center text-sm font-bold text-white">{qty}</span>
              <button
                type="button"
                aria-label={`Increase quantity for ${product.name}`}
                onClick={() => setQty((q) => Math.min(50, q + 1))}
                className="w-7 h-7 rounded bg-white/5 hover:bg-white/15 flex items-center justify-center text-white cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          aria-label={
            lang === 'ka'
              ? `კალათაში დამატება ${product.name}`
              : `Add ${product.name} to Cart`
          }
          onClick={handleAdd}
          style={{
            backgroundColor: justAdded ? '#12BC00' : product.color,
            boxShadow: `0 0 20px ${justAdded ? '#12BC0066' : `${product.color}55`}`,
          }}
          className="w-full py-2.5 px-4 rounded-lg text-sm font-bold text-[#05030A] hover:brightness-110 transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
        >
          {justAdded ? (
            <>
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{lang === 'ka' ? 'დამატებულია!' : 'Added to Cart!'}</span>
            </>
          ) : (
            <>
              <ShoppingBag className="w-4 h-4 stroke-[2.2]" />
              <span>{lang === 'ka' ? 'კალათაში დამატება' : 'Add to Cart'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
