/**
 * Sample catalogue for development:  npm run db:seed
 * Safe to run again — it creates missing products, back-fills photos, and retires the old placeholder samples.
 * Photos live in apps/web/public/catalog (product photos, transparent WebP) and apps/web/public/tryon
 * (white-background garment photos sent to the virtual try-on model).
 * Replace with the shop's real products through the admin dashboard (phase 5).
 */
import { and, eq, inArray } from "drizzle-orm";
import { db, pool } from "./client.js";
import { categories, productImages, products, productVariants } from "./schema.js";

type Slot = "kit" | "blazer" | "shirt" | "trousers";
const CATS: { slug: string; name: string; slot: Slot; only?: "men" | "women" }[] = [
  { slug: "suits", name: "Suits", slot: "kit" },
  { slug: "blazers", name: "Blazers", slot: "blazer" },
  { slug: "shirts", name: "Shirts", slot: "shirt" },
  { slug: "trousers", name: "Trousers", slot: "trousers" },
  // Traditional wedding & festive wear — each is one full kit (one try-on pass)
  { slug: "nilame", name: "Nilame kits", slot: "kit" },
  { slug: "kurtas", name: "Kurtas", slot: "kit" },
  // Ladies' party & wedding wear (full outfits → one try-on pass)
  { slug: "frocks", name: "Frocks", slot: "kit", only: "women" },
  { slug: "sarees", name: "Sarees", slot: "kit", only: "women" },
  { slug: "salwar", name: "Salwar kits", slot: "kit", only: "women" },
];

type Sample = {
  name: string;
  gender: "men" | "women";
  cat: string;
  price: number;
  compareAt?: number;
  fabric: string;
  fit: string;
  color: string;
  hex: string;
  description: string;
  /** Product photos (served by the web app from /public). */
  images: { url: string; alt: string }[];
  /** White-background garment photo for the virtual try-on. */
  tryonImage: string;
  /** Try-on slot when it differs from the category (jacket-only suit photos are tried on as a top). */
  slot?: Slot;
};

const photo = (file: string, alt: string) => [{ url: `/catalog/${file}.webp`, alt }];
const tryon = (file: string) => `/tryon/${file}.jpg`;

const SAMPLE: Sample[] = [
  // Suits
  {
    name: "Black Tuxedo Three-Piece", gender: "men", cat: "suits", price: 7850000, fabric: "Wool barathea", fit: "Tailored", color: "Black", hex: "#16161A",
    description: "Peak-lapel dinner jacket with satin facings and a matching waistcoat. Cut close for black-tie evenings, weddings and galas. Bow tie styling shown.",
    images: photo("black-tuxedo-three-piece", "Black tuxedo jacket with satin lapels, waistcoat and bow tie on a mannequin"), tryonImage: tryon("black-tuxedo-three-piece"), slot: "blazer",
  },
  {
    name: "Chocolate Three-Piece Suit", gender: "men", cat: "suits", price: 7250000, fabric: "Wool-silk blend", fit: "Classic", color: "Brown", hex: "#4A3324",
    description: "Rich chocolate-brown three-piece with a textured waistcoat and pocket square. Warm, confident and right for daytime weddings.",
    images: photo("chocolate-three-piece-suit", "Chocolate-brown suit jacket with waistcoat, shirt and tie"), tryonImage: tryon("chocolate-three-piece-suit"), slot: "blazer",
  },
  {
    name: "Ivory Dinner Suit", gender: "men", cat: "suits", price: 6900000, compareAt: 7500000, fabric: "Wool crepe", fit: "Slim", color: "Ivory", hex: "#ECE9E2",
    description: "A clean ivory jacket with a narrow notch lapel — made for poruwa ceremonies, receptions and summer evenings.",
    images: photo("ivory-dinner-suit", "Ivory suit jacket with a white shirt and navy tie"), tryonImage: tryon("ivory-dinner-suit"), slot: "blazer",
  },
  {
    name: "Midnight Navy Two-Piece Suit", gender: "men", cat: "suits", price: 6450000, compareAt: 7200000, fabric: "Super 120s wool", fit: "Tailored", color: "Navy", hex: "#1F2A44",
    description: "A modern two-piece in fine Italian-milled wool. Half-canvassed jacket, natural shoulder, flat-front trousers. Free alterations included.",
    images: photo("midnight-navy-two-piece-suit", "Navy two-button suit jacket worn with a dark shirt and tie"), tryonImage: tryon("midnight-navy-two-piece-suit"), slot: "blazer",
  },
  // Blazers
  {
    name: "Midnight Navy Blazer", gender: "men", cat: "blazers", price: 3650000, fabric: "Super 120s wool", fit: "Tailored", color: "Navy", hex: "#22304F",
    description: "Our signature two-button blazer in fine navy twill. Notch lapels, horn-effect buttons, flap pockets and a half-canvassed chest that moulds to you. Wear it with the suit trousers or chinos.",
    images: [
      { url: "/catalog/midnight-navy-blazer-1.webp", alt: "Midnight Navy Blazer on a tailor's mannequin, front view" },
      { url: "/catalog/midnight-navy-blazer-2.webp", alt: "Close-up of the notch lapel, white shirt collar and dotted navy tie" },
      { url: "/catalog/midnight-navy-blazer-3.webp", alt: "Close-up of the horn-effect buttons and flap pocket" },
    ],
    tryonImage: tryon("midnight-navy-blazer"),
  },
  {
    name: "Grey Tweed Blazer", gender: "men", cat: "blazers", price: 3850000, fabric: "Wool tweed", fit: "Classic", color: "Grey", hex: "#7D7B78",
    description: "Soft heathered tweed with patch-style texture and contrast buttons. Smart over an Oxford shirt, relaxed with a knit.",
    images: photo("grey-tweed-blazer", "Grey herringbone tweed blazer with brown buttons"), tryonImage: tryon("grey-tweed-blazer"),
  },
  {
    name: "White Summer Blazer", gender: "men", cat: "blazers", price: 3250000, fabric: "Linen-cotton", fit: "Slim", color: "White", hex: "#F5F5F2",
    description: "A crisp white single-breasted blazer for beach weddings and long summer evenings — breathable and light.",
    images: photo("white-summer-blazer", "White single-breasted summer blazer"), tryonImage: tryon("white-summer-blazer"),
  },
  // Shirts
  {
    name: "Crisp White Oxford Shirt", gender: "men", cat: "shirts", price: 690000, fabric: "Egyptian cotton", fit: "Slim", color: "White", hex: "#F4F1EA",
    description: "Long-sleeve shirt with a semi-spread collar and single-button cuffs. The foundation of every suit.",
    images: photo("crisp-white-oxford-shirt", "White long-sleeve dress shirt, front view"), tryonImage: tryon("crisp-white-oxford-shirt"),
  },
  {
    name: "Cream Oxford Shirt", gender: "men", cat: "shirts", price: 720000, fabric: "Oxford cotton", fit: "Regular", color: "Cream", hex: "#EFE6D2",
    description: "A softer alternative to white — button-down collar and a gently textured Oxford weave.",
    images: photo("cream-oxford-shirt", "Cream button-down Oxford shirt, front view"), tryonImage: tryon("cream-oxford-shirt"),
  },
  {
    name: "Sky Blue Poplin Shirt", gender: "men", cat: "shirts", price: 650000, fabric: "Cotton poplin", fit: "Regular", color: "Sky blue", hex: "#A9C3DE",
    description: "Smooth poplin in soft sky blue — sharp under navy and grey suits.",
    images: photo("sky-blue-poplin-shirt", "Light blue long-sleeve poplin shirt, front view"), tryonImage: tryon("sky-blue-poplin-shirt"),
  },
  {
    name: "Black Dress Shirt", gender: "men", cat: "shirts", price: 690000, fabric: "Cotton sateen", fit: "Slim", color: "Black", hex: "#1B1A18",
    description: "A deep black shirt with a subtle sheen — modern with a charcoal suit or on its own for evenings out.",
    images: photo("black-dress-shirt", "Black long-sleeve dress shirt, front view"), tryonImage: tryon("black-dress-shirt"),
  },
  {
    name: "Silver Grey Shirt", gender: "men", cat: "shirts", price: 690000, fabric: "Cotton twill", fit: "Slim", color: "Silver grey", hex: "#B9BCC1",
    description: "Cool silver-grey twill that pairs with navy, black and charcoal tailoring.",
    images: photo("silver-grey-shirt", "Silver-grey long-sleeve shirt, front view"), tryonImage: tryon("silver-grey-shirt"),
  },
  // Trousers
  {
    name: "Black Tailored Trousers", gender: "men", cat: "trousers", price: 1450000, fabric: "Wool blend", fit: "Tapered", color: "Black", hex: "#1B1A18",
    description: "Flat-front trousers with a clean taper. Hemmed to your length for free.",
    images: photo("black-tailored-trousers", "Black tailored trousers with a leather belt"), tryonImage: tryon("black-tailored-trousers"),
  },
  {
    name: "Ash Pinstripe Trousers", gender: "men", cat: "trousers", price: 1590000, fabric: "Wool flannel", fit: "Straight", color: "Ash grey", hex: "#6E7073",
    description: "Ash-grey pinstripe with turn-ups and a pressed crease — a little old-school, very sharp.",
    images: photo("ash-pinstripe-trousers", "Ash-grey pinstripe trousers with turn-ups"), tryonImage: tryon("ash-pinstripe-trousers"),
  },
  {
    name: "Navy Suit Trousers", gender: "men", cat: "trousers", price: 1450000, fabric: "Super 120s wool", fit: "Slim", color: "Navy", hex: "#1F2A44",
    description: "Slim navy trousers that match the Midnight Navy Blazer — wear them together as a suit.",
    images: photo("navy-suit-trousers", "Slim navy suit trousers"), tryonImage: tryon("navy-suit-trousers"),
  },
  {
    name: "Stone Chinos", gender: "men", cat: "trousers", price: 990000, fabric: "Cotton twill", fit: "Slim", color: "Stone", hex: "#D8CDB0",
    description: "Everyday stone chinos with a touch of stretch for comfort — dress them up with a blazer or down with a polo.",
    images: photo("stone-chinos", "Stone-coloured cotton chinos"), tryonImage: tryon("stone-chinos"),
  },
  {
    name: "Tan Check Trousers", gender: "men", cat: "trousers", price: 1690000, fabric: "Wool blend", fit: "Straight", color: "Tan check", hex: "#A89B88",
    description: "A soft tan Prince-of-Wales check with turn-ups and a pressed crease. Pairs with navy blazers and white shirts.",
    images: [
      { url: "/catalog/tan-check-trousers-1.webp", alt: "Tan check trousers with a brown belt, front view" },
      { url: "/catalog/tan-check-trousers-2.webp", alt: "Tan check trousers, back view with jetted pockets" },
    ],
    tryonImage: tryon("tan-check-trousers"),
  },
  // Nilame kits (Sri Lankan Kandyan wedding wear)
  {
    name: "Royal Red Nilame Kit", gender: "men", cat: "nilame", price: 16500000, fabric: "Velvet & brocade", fit: "Made to measure", color: "Red", hex: "#7A1C24",
    description: "The full Kandyan groom's attire: red velvet jacket with puffed shoulders and gold zari embroidery, frilled white shirt, pleated white pada-kada wrap with gold border, gold sash and the four-cornered toppi hat. Fitted to your measurements in the atelier.",
    images: photo("royal-red-nilame-kit", "Red velvet Nilame jacket with gold embroidery, toppi hat, frilled shirt and pleated white wrap on a mannequin"), tryonImage: tryon("royal-red-nilame-kit"),
  },
  {
    name: "Royal Blue Nilame Kit", gender: "men", cat: "nilame", price: 16500000, fabric: "Velvet & brocade", fit: "Made to measure", color: "Royal blue", hex: "#1F2C6B",
    description: "Kandyan groom's attire in royal-blue velvet with gold zari embroidery: puffed-shoulder jacket, frilled shirt, gold-bordered pleated wrap, sash and toppi hat. Fitted to your measurements in the atelier.",
    images: photo("royal-blue-nilame-kit", "Royal-blue velvet Nilame jacket with gold embroidery, toppi hat, frilled shirt and pleated white wrap on a mannequin"), tryonImage: tryon("royal-blue-nilame-kit"),
  },
  {
    name: "Midnight Blue Nilame Kit", gender: "men", cat: "nilame", price: 17500000, fabric: "Velvet & brocade", fit: "Made to measure", color: "Midnight blue", hex: "#141A3A",
    description: "Our deepest blue velvet with dense gold zari work — puffed-shoulder Nilame jacket, frilled shirt, gold-bordered pleated wrap, sash and toppi hat. Fitted to your measurements in the atelier.",
    images: photo("midnight-blue-nilame-kit", "Midnight-blue velvet Nilame jacket with heavy gold embroidery, toppi hat and pleated white wrap on a mannequin"), tryonImage: tryon("midnight-blue-nilame-kit"),
  },
  // Kurtas (Indian wedding & party wear)
  {
    name: "Navy Embroidered Kurta Set", gender: "men", cat: "kurtas", price: 2450000, fabric: "Art silk", fit: "Regular", color: "Navy", hex: "#22305A",
    description: "Knee-length navy kurta with gold paisley embroidery on the placket, collar and cuffs, worn with an ivory churidar, matching stole and embroidered juttis. Made for weddings, Deepavali and evening parties.",
    images: photo("navy-embroidered-kurta-set", "Navy kurta with gold embroidery, ivory churidar, stole and juttis on a mannequin"), tryonImage: tryon("navy-embroidered-kurta-set"),
  },
  {
    name: "Ivory Festive Kurta Set", gender: "men", cat: "kurtas", price: 2650000, fabric: "Raw silk", fit: "Regular", color: "Ivory", hex: "#E9DFC8",
    description: "Ivory raw-silk kurta with tone-on-tone gold embroidery and a draped stole, worn with an ivory churidar and gold juttis. Light enough for a day wedding, rich enough for the reception.",
    images: photo("ivory-festive-kurta-set", "Ivory silk kurta with gold embroidery, stole, churidar and juttis on a mannequin"), tryonImage: tryon("ivory-festive-kurta-set"),
  },
  {
    name: "Magenta Silk Kurta Set", gender: "women", cat: "kurtas", price: 2250000, fabric: "Silk brocade", fit: "Regular", color: "Magenta", hex: "#9C1F6E",
    description: "Magenta silk-brocade kurta with gold embroidery and an ivory embroidered jacket panel, worn with matching churidar and gold juttis. Made for weddings, mehendi nights and festive parties.",
    images: photo("magenta-silk-kurta-set", "Magenta silk kurta with ivory embroidered panel, churidar and gold juttis on a mannequin"), tryonImage: tryon("magenta-silk-kurta-set"),
  },
  // Ladies — party frocks
  {
    name: "Black Velvet Party Frock", gender: "women", cat: "frocks", price: 1250000, fabric: "Stretch velvet", fit: "Bodycon", color: "Black", hex: "#141416",
    description: "Sleeveless black velvet frock with a wrap V-neck edged in hand-set sequins and tonal panel seams that shape the waist. Knee length — made for cocktail evenings, receptions and parties.",
    images: photo("black-velvet-party-frock", "Black sleeveless velvet party frock with a sequinned V-neck"), tryonImage: tryon("black-velvet-party-frock"),
  },
  {
    name: "Emerald Velvet Party Frock", gender: "women", cat: "frocks", price: 1250000, fabric: "Stretch velvet", fit: "Bodycon", color: "Emerald", hex: "#0E4A3A",
    description: "Deep emerald velvet frock with a sequin-edged wrap V-neck and shaping panel seams. Knee length, fully lined — rich colour for Christmas parties, receptions and evening events.",
    images: photo("emerald-velvet-party-frock", "Emerald green sleeveless velvet party frock with a sequinned V-neck"), tryonImage: tryon("emerald-velvet-party-frock"),
  },
  // Ladies — sarees
  {
    name: "Ivory & Gold Kandyan Osariya", gender: "women", cat: "sarees", price: 4500000, fabric: "Silk brocade", fit: "Made to measure", color: "Ivory gold", hex: "#E8D9B5",
    description: "The Kandyan bride's osariya in ivory silk brocade woven with gold motifs: frilled waist pleat, pallu over the shoulder and a blouse made to your measurements. Styled with traditional gold jewellery for the Poruwa ceremony.",
    images: photo("ivory-gold-kandyan-osariya-saree", "Ivory and gold Kandyan osariya saree with frilled waist pleat and gold jewellery on a mannequin"), tryonImage: tryon("ivory-gold-kandyan-osariya-saree"),
  },
  {
    name: "Purple Banarasi Silk Saree", gender: "women", cat: "sarees", price: 3850000, fabric: "Banarasi silk", fit: "Made to measure", color: "Purple", hex: "#3B2A6B",
    description: "Deep purple Banarasi silk saree with an all-over gold zari jaal and a tasselled pallu, paired with a matching blouse tailored to fit. For weddings, homecomings and Deepavali.",
    images: photo("purple-banarasi-silk-saree", "Purple Banarasi silk saree with gold zari work and tasselled pallu on a mannequin"), tryonImage: tryon("purple-banarasi-silk-saree"),
  },
  // Ladies — salwar kits
  {
    name: "Royal Blue Patiala Salwar Kit", gender: "women", cat: "salwar", price: 1850000, fabric: "Silk & net", fit: "Regular", color: "Royal blue", hex: "#1D3A8A",
    description: "Royal-blue silk kameez with gold zari embroidery, full Patiala salwar and a sheer net dupatta with tassels. A festive set for weddings, mehendi nights and Deepavali.",
    images: photo("royal-blue-patiala-salwar-kit", "Royal blue embroidered kameez, Patiala salwar and net dupatta on a mannequin"), tryonImage: tryon("royal-blue-patiala-salwar-kit"),
  },
  {
    name: "Ivory & Gold Patiala Salwar Kit", gender: "women", cat: "salwar", price: 1950000, fabric: "Silk & net", fit: "Regular", color: "Ivory gold", hex: "#EADFC6",
    description: "Ivory silk kameez with rich gold embroidery, Patiala salwar and a gold-bordered net dupatta. Soft and elegant for day weddings and engagement ceremonies.",
    images: photo("ivory-gold-patiala-salwar-kit", "Ivory and gold embroidered kameez, Patiala salwar and net dupatta on a mannequin"), tryonImage: tryon("ivory-gold-patiala-salwar-kit"),
  },
  {
    name: "Emerald Patiala Salwar Kit", gender: "women", cat: "salwar", price: 1850000, fabric: "Silk & net", fit: "Regular", color: "Emerald", hex: "#0F5A43",
    description: "Emerald silk kameez with gold zari embroidery, matching Patiala salwar and a sheer net dupatta with tassels. Made for mehendi, sangeet and festive parties.",
    images: photo("emerald-patiala-salwar-kit", "Emerald green embroidered kameez, Patiala salwar and net dupatta on a mannequin"), tryonImage: tryon("emerald-patiala-salwar-kit"),
  },
];

/** Earlier placeholder samples (illustrations only, no photos) — retired, not deleted, so past orders keep their history. */
const RETIRED = [
  "men-charcoal-pinstripe-suit",
  "men-classic-black-blazer",
  "men-sand-linen-blazer",
  "women-ivory-tailored-pantsuit",
  "women-wine-double-breasted-blazer",
  "women-silk-touch-blouse",
  "women-wide-leg-navy-trousers",
];

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function main() {
  const catId = new Map<string, string>();
  for (const gender of ["men", "women"] as const) {
    for (const [i, c] of CATS.entries()) {
      if (c.only && c.only !== gender) continue;
      const [row] = await db
        .insert(categories)
        .values({ slug: c.slug, name: c.name, gender, sortOrder: i })
        .onConflictDoUpdate({ target: [categories.slug, categories.gender], set: { name: c.name } })
        .returning({ id: categories.id });
      catId.set(`${gender}:${c.slug}`, row!.id);
    }
  }

  for (const p of SAMPLE) {
    const slug = slugify(`${p.gender}-${p.name}`);
    const slot = p.slot ?? CATS.find((c) => c.slug === p.cat)!.slot;
    const exists = await db.query.products.findFirst({ where: eq(products.slug, slug), columns: { id: true } });
    if (exists) {
      // Existing sample: make sure it's active and has its photos (idempotent).
      await db.update(products).set({ isActive: true, tryonImageUrl: p.tryonImage, tryonSlot: slot }).where(eq(products.id, exists.id));
      const has = await db.query.productImages.findFirst({ where: eq(productImages.productId, exists.id), columns: { id: true } });
      if (!has) await db.insert(productImages).values(p.images.map((im, i) => ({ productId: exists.id, url: im.url, alt: im.alt, sortOrder: i })));
      console.log(`  ✓ ${p.name}`);
      continue;
    }
    const [prod] = await db
      .insert(products)
      .values({
        slug,
        name: p.name,
        description: p.description,
        categoryId: catId.get(`${p.gender}:${p.cat}`)!,
        gender: p.gender,
        priceCents: p.price,
        compareAtCents: p.compareAt,
        fabric: p.fabric,
        fit: p.fit,
        color: p.color,
        colorHex: p.hex,
        tryonSlot: slot,
        tryonImageUrl: p.tryonImage,
      })
      .returning({ id: products.id });
    const sizes = p.cat === "trousers" ? ["28", "30", "32", "34", "36"] : p.cat === "suits" || p.cat === "blazers" || p.cat === "nilame" ? ["38", "40", "42", "44", "46"] : ["S", "M", "L", "XL"];
    await db.insert(productVariants).values(
      sizes.map((size, i) => ({ productId: prod!.id, sku: `${slug.slice(0, 40)}-${size}`.toUpperCase(), size, stock: i === 0 ? 2 : 8 })),
    );
    await db.insert(productImages).values(p.images.map((im, i) => ({ productId: prod!.id, url: im.url, alt: im.alt, sortOrder: i })));
    console.log(`  + ${p.name}`);
  }

  // Sample rentals: the Nilame kits and the Kandyan osariya can be rented (2 pieces per size). Only filled in when not set yet, so admin
  // changes are never overwritten by re-seeding.
  for (const slug of ["men-royal-red-nilame-kit", "men-royal-blue-nilame-kit", "men-midnight-blue-nilame-kit", "women-ivory-gold-kandyan-osariya"]) {
    const p = await db.query.products.findFirst({ where: eq(products.slug, slug), columns: { id: true, rentEnabled: true, rentPriceCents: true } });
    if (!p || p.rentEnabled || p.rentPriceCents != null) continue;
    await db.update(products).set({ rentEnabled: true, ...(slug.startsWith("women-") ? { rentPriceCents: 1500000, rentDepositCents: 1500000 } : { rentPriceCents: 2500000, rentDepositCents: 2000000 }), rentDays: 5 }).where(eq(products.id, p.id));
    await db.update(productVariants).set({ rentStock: 2 }).where(and(eq(productVariants.productId, p.id), eq(productVariants.rentStock, 0)));
    console.log(`  ⟳ rentable: ${slug}`);
  }
  // Sample sale: 30 days on the grey tweed blazer (only if it has no sale yet)
  const tweed = await db.query.products.findFirst({ where: eq(products.slug, "men-grey-tweed-blazer"), columns: { id: true, salePriceCents: true } });
  if (tweed && tweed.salePriceCents == null) {
    const now = Date.now();
    await db.update(products).set({ salePriceCents: 3250000, saleStartsAt: new Date(now - 86_400_000), saleEndsAt: new Date(now + 30 * 86_400_000) }).where(eq(products.id, tweed.id));
    console.log("  % sale: men-grey-tweed-blazer");
  }

  const retired = await db.update(products).set({ isActive: false }).where(inArray(products.slug, RETIRED)).returning({ name: products.name });
  if (retired.length) console.log(`  – retired ${retired.length} placeholder samples: ${retired.map((r) => r.name).join(", ")}`);
  console.log("✅ Seed complete");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
