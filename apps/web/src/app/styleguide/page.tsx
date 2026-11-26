import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Styleguide } from "./Styleguide";

export const metadata: Metadata = {
  title: "Styleguide",
  description: "Seamwell UI kit — colours, type and components.",
  robots: { index: false, follow: false },
};

/** Developer reference only — not served in production. */
export default function StyleguidePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Styleguide />;
}
