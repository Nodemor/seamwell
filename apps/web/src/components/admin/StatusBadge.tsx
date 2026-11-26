import { ORDER_STATUS_LABEL, type OrderStatus } from "@seamwell/shared";
import { Badge } from "@/components/ui/badge";

const VARIANT: Record<OrderStatus, "default" | "accent" | "outline" | "success" | "danger" | "muted"> = {
  pending_confirmation: "accent",
  awaiting_payment: "accent",
  confirmed: "outline",
  processing: "outline",
  ready_to_ship: "default",
  shipped: "default",
  delivered: "success",
  returned: "muted",
  cancelled: "danger",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={VARIANT[status]}>{ORDER_STATUS_LABEL[status]}</Badge>;
}
