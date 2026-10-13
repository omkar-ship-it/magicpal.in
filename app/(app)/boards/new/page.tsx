import { redirect } from "next/navigation";

/** Creating a network happens inside the profile overlay now. */
export default async function NewBoardRedirect({
  searchParams,
}: {
  searchParams: Promise<{ in?: string }>;
}) {
  await searchParams;
  redirect("/?panel=profile");
}
