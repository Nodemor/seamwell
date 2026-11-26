import { adminTitle } from "@/lib/admin-metadata";
import { Suspense } from "react";
import { OrdersBoard } from "@/components/admin/OrdersBoard";

export const generateMetadata = adminTitle("Orders");

export default function Page() {
  return (
    <Suspense>
      <OrdersBoard />
    </Suspense>
  );
}
