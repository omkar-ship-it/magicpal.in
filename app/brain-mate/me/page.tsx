import { redirect } from "next/navigation";

/** Your card opens over the map now. */
export default function MyBrainMate() {
  redirect("/?bm=card");
}
