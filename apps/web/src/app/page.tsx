import { CraftStory } from "@/components/home/CraftStory";
import { CtaBand } from "@/components/home/CtaBand";
import { FittingBand } from "@/components/home/FittingBand";
import { Hero } from "@/components/home/Hero";
import { Lookbook } from "@/components/home/Lookbook";
import { Marquee } from "@/components/home/Marquee";
import { NewArrivals } from "@/components/home/NewArrivals";
import { ServiceStrip } from "@/components/home/ServiceStrip";
import { ShopByPiece } from "@/components/home/ShopByPiece";
import { Testimonials } from "@/components/home/Testimonials";
import { TryOnSteps } from "@/components/home/TryOnSteps";

export const revalidate = 60;

export default function HomePage() {
  return (
    <>
      <Hero />
      <Marquee />
      <ShopByPiece />
      <Lookbook />
      <NewArrivals />
      <TryOnSteps />
      <CraftStory />
      <Testimonials />
      <ServiceStrip />
      <FittingBand />
      <CtaBand />
    </>
  );
}
