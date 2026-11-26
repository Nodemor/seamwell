import { ScanFace, Star } from "lucide-react";
import Link from "next/link";
import { ProductPhoto } from "@/components/product/ProductPhoto";
import { Badge } from "@/components/ui/badge";
import { Price } from "@/components/ui/Price";
import type { ProductCard as Product } from "@/lib/catalog";
import { cn, formatLKR } from "@/lib/utils";

export function ProductCard({ product, className, priority = false }: { product: Product; className?: string; priority?: boolean }) {
  const href = product.slug ? `/product/${product.slug}` : "/shop";
  const img = product.images[0];
  const onSale = product.compareAtCents != null && product.compareAtCents > product.priceCents;

  return (
    <Link href={href} className={cn("group block", className)} data-reveal>
      <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-xl)] bg-linen transition-shadow duration-500 group-hover:shadow-[0_30px_60px_-30px_rgb(27_26_24/.45)]">
        <div className="absolute inset-0 transition-transform duration-700 ease-[var(--ease-tailor)] group-hover:scale-[1.04]">
          <ProductPhoto src={img?.url} alt={img?.alt || product.name} priority={priority} sizes="(min-width: 1280px) 340px, (min-width: 1024px) 30vw, 50vw" className="p-5 sm:p-6" />
        </div>
        <span className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {onSale && <Badge variant="sale">Sale</Badge>}
          {product.rent && <Badge variant="accent">For rent</Badge>}
        </span>
        {product.tryonEnabled && (
          <span className="absolute bottom-3 left-3 inline-flex translate-y-2 items-center gap-1.5 rounded-full bg-paper/95 px-3 py-1.5 text-xs font-medium text-ink opacity-0 shadow-sm transition-[opacity,translate] duration-500 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
            <ScanFace className="h-3.5 w-3.5 text-brass" aria-hidden /> Try it on
          </span>
        )}
      </div>
      <div className="mt-4 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.16em] text-stone">{product.categoryName}</p>
          <h3 className="mt-1 font-sans text-[0.98rem] font-medium text-ink">{product.name}</h3>
          {product.rent && <p className="mt-1 text-xs text-brass-ink">or rent {formatLKR(product.rent.priceCents)}</p>}
          {product.ratingCount > 0 && (
            <p className="mt-1 flex items-center gap-1 text-xs text-stone">
              <Star className="h-3 w-3 fill-brass text-brass" aria-hidden /> {(product.ratingAvgX100 / 100).toFixed(1)} ({product.ratingCount})
            </p>
          )}
        </div>
        <Price cents={product.priceCents} compareAtCents={product.compareAtCents} className="shrink-0 text-[0.95rem] sm:flex-col sm:items-end sm:gap-0 sm:text-right" />
      </div>
    </Link>
  );
}
