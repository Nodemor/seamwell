import { adminTitle } from "@/lib/admin-metadata";
import { ProductEditor } from "@/components/admin/ProductEditor";

export const generateMetadata = adminTitle("New product");

export default function Page() {
  return <ProductEditor />;
}
