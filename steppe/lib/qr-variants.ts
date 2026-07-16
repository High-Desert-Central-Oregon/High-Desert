export const QR_VARIANTS = [
  "quiet",
  "square",
  "poster_owned",
  "poster_built",
  "poster_common",
  "seed_card",
] as const;

export type QrVariant = (typeof QR_VARIANTS)[number];

export const QR_VARIANT_SET = new Set<string>(QR_VARIANTS);

export function isQrVariant(value: string | null): value is QrVariant {
  return value != null && QR_VARIANT_SET.has(value);
}
