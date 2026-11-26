import { adminTitle } from "@/lib/admin-metadata";
import { ReviewsQueue } from "@/components/admin/ReviewsQueue";

export const generateMetadata = adminTitle("Reviews");

export default function Page() {
  return <ReviewsQueue />;
}
