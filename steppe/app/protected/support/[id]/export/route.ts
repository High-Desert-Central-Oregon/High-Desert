import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupportOperator } from "@/lib/bug-reports/server";
import { sanitizeDiagnostics, UUID } from "@/lib/bug-reports/shared";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isSupportOperator()))
    return new NextResponse(null, { status: 403 });
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse(null, { status: 404 });
  const db = await createClient();
  // Explicit fields: no submission secret, identity, email, or delivery claims
  // in the reproduction bundle. Free-text reports can still be sensitive.
  const { data, error } = await db
    .from("bug_reports")
    .select(
      "id,description,expected,page,locale,release,diagnostics,status,created_at,expires_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) return new NextResponse(null, { status: 503 });
  if (!data) return new NextResponse(null, { status: 404 });
  return new NextResponse(
    JSON.stringify(
      { ...data, diagnostics: sanitizeDiagnostics(data.diagnostics) },
      null,
      2,
    ),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="steppe-bug-${id}.json"`,
        "Cache-Control": "no-store",
      },
    },
  );
}
