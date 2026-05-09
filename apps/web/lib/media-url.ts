/** Same-origin URL for authenticated asset bytes via the Next.js BFF proxy. */
export function assetFileUrl(assetId: string): string {
  return `/api/fms/v1/assets/${assetId}/file`;
}
