import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { AddToBag } from "@/components/product/AddToBag";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductGallery } from "@/components/product/ProductGallery";
import { Reviews } from "@/components/product/Reviews";
import { JsonLd, siteUrl } from "@/components/seo/JsonLd";
import { TryOnButton } from "@/components/tryon/TryOnButton";
import { Price } from "@/components/ui/Price";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { api, ApiError } from "@/lib/api";
import type { ProductCard as Card, ProductDetail } from "@/lib/catalog";
import { formatLKR } from "@/lib/utils";

const SLUG = /^[a-z0-9-]{1,120}$/;

/** One request per render (shared by generateMetadata and the page). */
const getProduct = cache(async (slug: string) => {
  if (!SLUG.test(slug)) return null;
  try {
    return (await api<{ product: ProductDetail }>(`/products/${slug}`, { next: { revalidate: 60 } } as RequestInit)).product;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
});

async function getRelated(slug: string): Promise<Card[]> {
  try {
    return (await api<{ items: Card[] }>(`/products/${slug}/related`, { next: { revalidate: 300 } } as RequestInit)).items;
  } catch {
    return [];
  }
}

const genderLabel = (g: string) => (g === "women" ? "Women" : g === "men" ? "Men" : "Everyone");

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await getProduct((await params).slug).catch(() => null);
  if (!p) return { title: "Product" };
  const description = p.description.slice(0, 155);
  const image = p.images[0] ? { url: siteUrl(p.images[0].url), alt: p.images[0].alt || p.name } : { url: siteUrl("/og-default.jpg"), width: 1200, height: 630, alt: "Seamwell Tailoring" };
  return {
    title: p.name,
    description,
    alternates: { canonical: `/product/${p.slug}` },
    openGraph: { type: "website", title: p.name, description, url: `/product/${p.slug}`, images: [image] },
    twitter: { card: "summary_large_image", title: p.name, description, images: [image.url] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, related] = await Promise.all([getProduct(slug), getRelated(slug)]);
  if (!product) notFound();

  const url = siteUrl(`/product/${product.slug}`);
  const anyInStock = product.variants.some((v) => v.inStock);
  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.slug,
    url,
    image: product.images.length ? product.images.map((i) => siteUrl(i.url)) : [siteUrl("/og-default.jpg")],
    brand: { "@type": "Brand", name: "Seamwell Tailoring" },
    category: product.categoryName,
    ...(product.color && { color: product.color }),
    ...(product.fabric && { material: product.fabric }),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "LKR",
      price: (product.priceCents / 100).toFixed(2),
      availability: anyInStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: "Seamwell Tailoring" },
    },
    ...(product.ratingCount > 0 && {
      aggregateRating: { "@type": "AggregateRating", ratingValue: (product.ratingAvgX100 / 100).toFixed(1), reviewCount: product.ratingCount, bestRating: 5, worstRating: 1 },
    }),
  };

  return (
    <div className="container-sw pb-16 pt-6 md:pt-8">
      <JsonLd data={productLd} />
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: genderLabel(product.gender), href: product.gender === "unisex" ? "/shop" : `/shop?gender=${product.gender}` },
          { label: product.categoryName, href: `/shop?${product.gender === "unisex" ? "" : `gender=${product.gender}&`}category=${product.categorySlug}` },
          { label: product.name },
        ]}
      />

      <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div data-reveal="fade" className="lg:sticky lg:top-24 lg:self-start">
          <ProductGallery images={product.images} name={product.name} />
        </div>

        <div className="lg:py-4">
          <p className="eyebrow">{product.categoryName}</p>
          <h1 className="mt-3 text-[clamp(2.2rem,4vw,3.4rem)] leading-tight">{product.name}</h1>
          <Price cents={product.priceCents} compareAtCents={product.compareAtCents} size="lg" className="mt-4" />
          {product.rent && (
            <p className="mt-2 text-sm text-brass-ink">
              Or rent it for your event — {formatLKR(product.rent.priceCents)} + {formatLKR(product.rent.depositCents)} refundable deposit
            </p>
          )}
          <p className="mt-6 leading-relaxed text-stone">{product.description}</p>
          <dl className="mt-6 grid grid-cols-3 gap-4 border-y border-line py-5 text-sm">
            <div><dt className="text-stone">Fabric</dt><dd className="mt-1 font-medium">{product.fabric ?? "—"}</dd></div>
            <div><dt className="text-stone">Fit</dt><dd className="mt-1 font-medium">{product.fit ?? "—"}</dd></div>
            <div><dt className="text-stone">Colour</dt><dd className="mt-1 font-medium">{product.color ?? "—"}</dd></div>
          </dl>

          <AddToBag product={product} />

          {product.tryonEnabled && (
            <div className="mt-6 rounded-2xl border border-line bg-paper p-5">
              <p className="text-sm text-stone">Not sure how it looks? See it on yourself first.</p>
              <div className="mt-3">
                <TryOnButton label="Try this on me" href={`/try-on?product=${product.slug}`} />
              </div>
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="complete-look" className="mt-24">
          <SectionHeading
            eyebrow="Pairs well with"
            title={<span id="complete-look">Complete the look</span>}
            description="Mix and match — then try the whole outfit on yourself."
            link={{ href: `/shop?gender=${product.gender === "unisex" ? "" : product.gender}`, label: "Shop all" }}
            reveal
          />
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-6 lg:grid-cols-4">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      <div className="mt-24">
        <Reviews productId={product.id} ratingAvgX100={product.ratingAvgX100} ratingCount={product.ratingCount} />
      </div>
    </div>
  );
}
