import { redirect } from "next/navigation";

/** The join screen moved to the home page (2026-08-11). This survives so
 * presenter copy, QR material, and old bookmarks keep working. */
export default function JoinPage() {
  redirect("/");
}
