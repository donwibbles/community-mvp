import { headers } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import CheckinClient from "./CheckinClient";

// Force dynamic — don't prerender or cache
export const dynamic = "force-dynamic";

export default function CheckinPage() {
  noStore();            // opt out of caching
  headers();            // marks this render as dynamic
  return <CheckinClient />;
}
