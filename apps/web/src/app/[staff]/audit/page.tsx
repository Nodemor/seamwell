import { adminTitle } from "@/lib/admin-metadata";
import { AuditLog } from "@/components/admin/AuditLog";

export const generateMetadata = adminTitle("Audit log");

export default function Page() {
  return <AuditLog />;
}
