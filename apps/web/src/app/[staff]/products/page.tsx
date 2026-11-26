import { adminTitle } from "@/lib/admin-metadata";
import { ProductsTable } from "@/components/admin/ProductsTable";

export const generateMetadata = adminTitle("Products");

export default function Page() {
  return <ProductsTable />;
}
