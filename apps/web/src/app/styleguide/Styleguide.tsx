"use client";

import { ArrowRight, PackageSearch, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import ClickSpark from "@/components/bits/ClickSpark";
import SpotlightCard from "@/components/bits/SpotlightCard";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Price } from "@/components/ui/Price";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const COLOURS = [
  ["ivory", "#FAF7F2", "Page background"],
  ["paper", "#FFFFFF", "Cards, inputs"],
  ["linen", "#F1EBE1", "Soft sections"],
  ["ink", "#1B1A18", "Main text"],
  ["stone", "#6F6A61", "Secondary text"],
  ["line", "#E5DDD0", "Borders"],
  ["midnight", "#1F2A44", "Primary"],
  ["midnight-2", "#2C3B5E", "Primary hover"],
  ["brass", "#B08D57", "Accent"],
  ["brass-soft", "#E9DCC4", "Accent tint"],
  ["brass-ink", "#7D602D", "Small brass text on light"],
  ["wine", "#7A2E3A", "Sale, errors"],
  ["sage", "#4F6B57", "Success, in stock"],
] as const;

function Block({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 border-t border-line py-12">
      <h2 id={`${id}-h`} className="text-3xl md:text-4xl">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function Styleguide() {
  const [busy, setBusy] = useState(false);

  return (
    <div className="container-sw py-12">
      <SectionHeading as="h1" eyebrow="Internal · not indexed" title="Seamwell UI kit" description="Every shared component in one place. Build new pages from these pieces." />

      <nav aria-label="Styleguide sections" className="mt-8 flex flex-wrap gap-2 text-sm">
        {["colours", "type", "buttons", "forms", "feedback", "overlays", "navigation", "content", "effects"].map((s) => (
          <Button key={s} asChild size="sm" variant="secondary" className="capitalize"><a href={`#${s}`}>{s}</a></Button>
        ))}
      </nav>

      <Block id="colours" title="Colours">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {COLOURS.map(([name, hex, use]) => (
            <li key={name} className="overflow-hidden rounded-[var(--radius)] border border-line bg-paper">
              <span className="block h-16" style={{ background: hex }} aria-hidden />
              <span className="block p-3 text-sm"><strong className="font-medium">{name}</strong><span className="block font-mono text-xs text-stone">{hex}</span><span className="block text-xs text-stone">{use}</span></span>
            </li>
          ))}
        </ul>
      </Block>

      <Block id="type" title="Type scale">
        <div className="space-y-5">
          <p className="eyebrow">Eyebrow · 0.72rem · brass · 0.22em</p>
          <p className="font-display text-[clamp(2.9rem,7vw,5.6rem)] leading-[0.95]">Hero — Tailored <em>to you</em></p>
          <p className="font-display text-[clamp(2.2rem,4.5vw,3.6rem)] leading-tight">Section title — Shop by piece</p>
          <p className="font-display text-3xl">Card title — Midnight two-piece</p>
          <p className="max-w-2xl text-[17px] leading-relaxed">Body large (17px, Inter). Every piece is cut in our Colombo atelier and finished by hand.</p>
          <p className="max-w-2xl text-[15px] leading-relaxed text-stone">Body (15px, stone). Free alterations within 14 days. Cash on delivery island-wide.</p>
          <p className="text-xs text-stone">Small print (12px) — Prices are confirmed by the shop when you order.</p>
        </div>
      </Block>

      <Block id="buttons" title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive"><Trash2 aria-hidden /> Destructive</Button>
          <Button variant="link">Link button</Button>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large <ArrowRight aria-hidden /></Button>
          <Button size="icon" variant="secondary" aria-label="Add"><Plus /></Button>
          <Button size="icon-sm" variant="ghost" aria-label="Remove"><Trash2 /></Button>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button loading={busy} onClick={() => { setBusy(true); setTimeout(() => setBusy(false), 1800); }}>{busy ? "Placing order…" : "Click to load"}</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
          <Button variant="secondary" disabled>Disabled secondary</Button>
        </div>
        <div className="mt-5 max-w-sm"><Button block size="lg">Full width</Button></div>
      </Block>

      <Block id="forms" title="Form fields">
        <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
          <FormField label="Full name" name="sg-name" placeholder="Nimal Perera" autoComplete="off" />
          <FormField label="Email" name="sg-email" type="email" hint="We send your order confirmation here." autoComplete="off" />
          <FormField label="Mobile number" name="sg-phone" defaultValue="07" error="Enter a valid Sri Lankan mobile number" autoComplete="off" />
          <FormField label="Disabled" name="sg-disabled" disabled defaultValue="Can't edit this" />
          <FormField as="textarea" label="Notes for the tailor" name="sg-notes" rows={3} wrapperClassName="sm:col-span-2" />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sg-district">District (select)</Label>
            <Select>
              <SelectTrigger id="sg-district"><SelectValue placeholder="Choose a district" /></SelectTrigger>
              <SelectContent>
                {["Colombo", "Gampaha", "Kandy", "Galle", "Jaffna"].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sg-plain">Bare input</Label>
            <Input id="sg-plain" placeholder="SW-XXXXXX" />
          </div>
        </div>
      </Block>

      <Block id="feedback" title="Badges, prices, toasts & skeletons">
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="accent">New in</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="success">In stock</Badge>
          <Badge variant="sale">Sale</Badge>
          <Badge variant="danger">Cancelled</Badge>
          <Badge variant="muted">Muted</Badge>
        </div>
        <div className="mt-6 flex flex-wrap items-end gap-8">
          <Price cents={4850000} size="lg" />
          <Price cents={3900000} compareAtCents={4850000} size="lg" />
          <Price cents={1250000} compareAtCents={1500000} />
          <Price cents={650000} size="sm" />
          <Price cents={2200000} compareAtCents={2800000} stacked />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => toast.success("Added to your bag", { description: "Midnight two-piece · size 40" })}>Success toast</Button>
          <Button variant="secondary" onClick={() => toast.error("Could not place your order", { description: "Please try again." })}>Error toast</Button>
          <Button variant="secondary" onClick={() => toast("Your try-on is ready", { action: { label: "View", onClick: () => {} } })}>Toast with action</Button>
        </div>
        <div className="mt-8 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-3" aria-label="Loading example">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-[4/5] w-full rounded-[var(--radius-xl)]" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      </Block>

      <Block id="overlays" title="Dialog & sheet">
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild><Button>Open dialog</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Remove from bag?</DialogTitle>
                <DialogDescription>The Midnight two-piece (size 40) will be removed from your bag.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild><Button variant="secondary">Keep it</Button></DialogClose>
                <DialogClose asChild><Button variant="destructive">Remove</Button></DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {(["right", "bottom", "left"] as const).map((side) => (
            <Sheet key={side}>
              <SheetTrigger asChild><Button variant="secondary" className="capitalize">Sheet · {side}</Button></SheetTrigger>
              <SheetContent side={side}>
                <SheetHeader>
                  <SheetTitle>Sheet from the {side}</SheetTitle>
                  <SheetDescription>Focus is trapped inside. Press Esc to close.</SheetDescription>
                </SheetHeader>
                <div className="p-5 text-sm text-stone">Used for the mobile bag (right) and filters (left/bottom).</div>
                <SheetFooter><Button block>Primary action</Button></SheetFooter>
              </SheetContent>
            </Sheet>
          ))}
        </div>
      </Block>

      <Block id="navigation" title="Tabs & accordion">
        <div className="grid gap-10 lg:grid-cols-2">
          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="fabric">Fabric & care</TabsTrigger>
              <TabsTrigger value="delivery">Delivery</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="text-sm text-stone">Half-canvassed, two-button, notch lapel. Cut slim through the waist.</TabsContent>
            <TabsContent value="fabric" className="text-sm text-stone">100% wool, 260 g/m². Dry clean only. Steam to refresh.</TabsContent>
            <TabsContent value="delivery" className="text-sm text-stone">Island-wide in 3–5 working days. Free over LKR 25,000.</TabsContent>
          </Tabs>
          <Accordion type="single" collapsible className="max-w-xl">
            <AccordionItem value="a"><AccordionTrigger>How do I choose my size?</AccordionTrigger><AccordionContent>Measure your chest at its widest point and compare with our size guide.</AccordionContent></AccordionItem>
            <AccordionItem value="b"><AccordionTrigger>Can I return an item?</AccordionTrigger><AccordionContent>Unworn items can be returned within 14 days. Made-to-measure pieces can be altered for free.</AccordionContent></AccordionItem>
            <AccordionItem value="c"><AccordionTrigger>Is the virtual try-on free?</AccordionTrigger><AccordionContent>Yes — it uses a free AI model and runs on your own daily quota.</AccordionContent></AccordionItem>
          </Accordion>
        </div>
      </Block>

      <Block id="content" title="Section heading & empty state">
        <SectionHeading eyebrow="New this season" title="Fresh from the atelier" description="Linen blazers and lightweight wool for the warm months." link={{ href: "/shop", label: "Shop all" }} />
        <SectionHeading className="mt-12" align="center" eyebrow="Centred" title="Tailored to you" description="Seen on you first." />
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <EmptyState icon={ShoppingBag} title="Your bag is empty" description="Find something you love — and try it on first." action={<Button>Browse the collection</Button>} />
          <EmptyState icon={PackageSearch} title="No matches" description="Try removing a filter." />
        </div>
      </Block>

      <Block id="effects" title="React Bits effects">
        <div className="grid gap-6 md:grid-cols-2">
          <SpotlightCard theme="light" spotlightColor="#B08D57" intensity={0.55} borderGlow={1} className="rounded-[var(--radius-xl)]!" style={{ "--spotlight-card-surface": "var(--sw-paper)", "--spotlight-card-border": "var(--sw-line)", "--spotlight-card-shadow": "none" } as React.CSSProperties}>
            <p className="eyebrow">SpotlightCard</p>
            <p className="mt-2 font-display text-3xl">Move your pointer here</p>
            <p className="mt-2 text-sm text-stone">Used on the &quot;Shop by piece&quot; tiles.</p>
          </SpotlightCard>
          <div className="flex flex-col justify-center rounded-[var(--radius-xl)] border border-line bg-paper p-8">
            <p className="eyebrow">ClickSpark</p>
            <ClickSpark className="mt-4 h-auto!" sparkColor={["#B08D57", "#E9DCC4"]} sparkSize={11} sparkRadius={34} sparkCount={10}>
              <Button size="lg" block><ShoppingBag aria-hidden /> Click for brass sparks</Button>
            </ClickSpark>
            <p className="mt-2 text-sm text-stone">Used on &quot;Add to bag&quot;. Off for reduced-motion users.</p>
          </div>
        </div>
      </Block>
    </div>
  );
}
