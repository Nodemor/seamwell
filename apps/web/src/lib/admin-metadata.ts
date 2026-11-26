import type { Metadata } from "next";
import { isAdminSegment } from "@seamwell/shared";

/**
 * Page title for an admin page — only at the real secret address. A guessed URL (e.g. /admin/orders) gets the
 * plain 404 title, so the browser tab doesn't hint that an "Orders" admin page exists.
 */
export function adminTitle(title: string) {
  return async ({ params }: { params: Promise<{ staff: string }> }): Promise<Metadata> =>
    isAdminSegment((await params).staff, process.env.ADMIN_PATH) ? { title } : {};
}
