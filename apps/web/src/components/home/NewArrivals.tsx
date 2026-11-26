import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ProductCard } from "@/components/product/ProductCard";
import { getFeaturedProducts } from "@/lib/catalog";

export async function NewArrivals() {
  const { items, live } = await getFeaturedProducts();
  return (
    <section className="bg-linen/60 py-24">
      <div className="container-sw">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div data-reveal>
            <p className="eyebrow">Just in</p>
            <h2 className="mt-3 text-[clamp(2.2rem,4.5vw,3.6rem)] leading-tight">New arrivals</h2>
          </div>
          <Link data-reveal href="/shop" className="group inline-flex items-center gap-2 text-sm font-medium text-ink">
            View all <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
          </Link>
        </div>
        {!live && (
          <p className="mt-4 text-xs text-stone">Showing sample products — start the API and run <code>npm run db:seed</code> to load the catalogue.</p>
        )}
        <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-6 lg:grid-cols-3">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
