import { adminTitle } from "@/lib/admin-metadata";
import { RentalsBoard } from "@/components/admin/RentalsBoard";

export const generateMetadata = adminTitle("Rentals");

export default function Page() {
  return <RentalsBoard />;
}
