import { redirect } from "next/navigation";

/** The network switcher replaced this list; your boards live in the profile. */
export default function BoardsRedirect() {
  redirect("/?panel=profile");
}
