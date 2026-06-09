/**
 * Residency-verification domain constants, types, and pure helpers (SPEC §05,
 * A1; CLAUDE.md invariants 1 & 2). This module is import-safe from both server
 * and client code — it deliberately holds NO database or server imports, so the
 * browser upload form and the server pages can share one definition of "what a
 * method is" and "what evidence is allowed".
 *
 * The trust decision (approve/reject → verified/tenure) lives entirely in the
 * database (`decide_verification`); nothing here grants anything.
 */

export type VerificationMethod =
  | "id"
  | "utility_bill"
  | "voter_reg"
  | "property_record"
  | "postcard_code";

export type VerificationStatus = "pending" | "approved" | "rejected";

export type VerificationRow = {
  id: string;
  user_id: string;
  method: VerificationMethod;
  status: VerificationStatus;
  evidence_path: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

/** Methods that require an uploaded document. */
export const DOCUMENT_METHODS: VerificationMethod[] = [
  "id",
  "utility_bill",
  "voter_reg",
  "property_record",
];

/**
 * The mailed-postcard path takes no upload — it's the PO-box / Warm Springs /
 * unbanked accommodation, and it enters the same human-reviewed queue. It must
 * always be offered (locked decision, SPEC §01).
 */
export const POSTCARD_METHOD: VerificationMethod = "postcard_code";

/** Reading/offer order in the UI; document methods first, postcard last. */
export const ALL_METHODS: VerificationMethod[] = [
  ...DOCUMENT_METHODS,
  POSTCARD_METHOD,
];

export function isDocumentMethod(method: VerificationMethod): boolean {
  return DOCUMENT_METHODS.includes(method);
}

export function isVerificationMethod(value: unknown): value is VerificationMethod {
  return (
    typeof value === "string" && (ALL_METHODS as string[]).includes(value)
  );
}

/** The private bucket evidence lives in (and is purged from on decision). */
export const EVIDENCE_BUCKET = "verification-evidence";

/** Upload guardrails. Kept modest for low-bandwidth members on slow phones. */
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024; // 10 MB

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

export const ALLOWED_EVIDENCE_TYPES = Object.keys(EXTENSION_BY_TYPE);

export function isAllowedEvidenceType(type: string): boolean {
  return type in EXTENSION_BY_TYPE;
}

/** File extension for an allowed content type (used to name the stored object). */
export function evidenceExtension(type: string): string {
  return EXTENSION_BY_TYPE[type] ?? "bin";
}
