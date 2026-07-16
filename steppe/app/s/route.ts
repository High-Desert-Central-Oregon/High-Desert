import { printRedirect } from "@/lib/print-slugs";

// /s — printed QR slug (compass seed card). Destination + mechanism live in
// lib/print-slugs.ts; repoint there, never here. The route path is permanent.
export function GET(request: Request) {
  return printRedirect("s", request);
}
