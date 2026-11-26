import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAdminSegment } from "@seamwell/shared";
import { AdminShell } from "@/components/admin/AdminShell";

type Props = { children: React.ReactNode; params: Promise<{ staff: string }> };

/**
 * The admin area answers ONLY at /<ADMIN_PATH> — a long random value read from the server env on every request
 * (never NEXT_PUBLIC_, so it's in no JavaScript a visitor downloads). /admin, /ADMIN or any other guess gets the
 * normal 404 page, exactly like a missing page. In development without ADMIN_PATH it stays at /admin.
 * The admin API is protected separately: role admin + 2FA-verified session on every request (requireAdmin).
 */
export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { staff } = await params;
  if (!isAdminSegment(staff, process.env.ADMIN_PATH)) return {};
  return { title: { default: "Shop admin", template: "%s · Admin" }, robots: { index: false, follow: false } };
}

export default async function AdminLayout({ children, params }: Props) {
  const { staff } = await params;
  if (!isAdminSegment(staff, process.env.ADMIN_PATH)) notFound();
  return <AdminShell>{children}</AdminShell>;
}
