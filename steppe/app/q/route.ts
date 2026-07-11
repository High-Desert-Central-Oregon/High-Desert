import { printRedirect } from "@/lib/print-slugs";

// /q — printed QR slug (business card, "quiet"). Destination + mechanism live in
// lib/print-slugs.ts; repoint there, never here. The route path is permanent.
export function GET(request: Request) {
  return printRedirect("q", request);
}
