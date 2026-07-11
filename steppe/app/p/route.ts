import { printRedirect } from "@/lib/print-slugs";

// /p — printed QR slug (business card, "square"). Destination + mechanism live in
// lib/print-slugs.ts; repoint there, never here. The route path is permanent.
export function GET(request: Request) {
  return printRedirect("p", request);
}
