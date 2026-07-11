import { printRedirect } from "@/lib/print-slugs";

// /c — printed poster slug. Destination + mechanism live in lib/print-slugs.ts;
// repoint there, never here. The route path is permanent.
export function GET(request: Request) {
  return printRedirect("c", request);
}
