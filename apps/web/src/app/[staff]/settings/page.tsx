import { adminTitle } from "@/lib/admin-metadata";
import { AdminSettings } from "@/components/admin/AdminSettings";

export const generateMetadata = adminTitle("Settings");

export default function Page() {
  return <AdminSettings />;
}
