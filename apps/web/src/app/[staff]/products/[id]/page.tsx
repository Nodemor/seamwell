import { adminTitle } from "@/lib/admin-metadata";
import { ProductEditor } from "@/components/admin/ProductEditor";

export const generateMetadata = adminTitle("Edit product");

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductEditor id={/^[0-9a-f-]{36}$/i.test(id) ? id : "invalid"} />;
}
