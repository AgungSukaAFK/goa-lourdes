/** Domain email sintetis untuk akun tanpa email (login pakai NRP). */
export const SYNTHETIC_EMAIL_DOMAIN = "demo.com";
/** Password awal akun yang dibuat / di-reset admin. */
export const DEFAULT_PASSWORD = "demo1234";

export function syntheticEmail(nrp: string) {
  return `${nrp.trim().toLowerCase()}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

export function isSyntheticEmail(email?: string | null) {
  return !!email && email.toLowerCase().endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`);
}

export function looksLikeEmail(v: string) {
  return v.includes("@");
}

/** NRP: angka/huruf/strip, 3-30 karakter. */
export const NRP_PATTERN = /^[A-Za-z0-9._-]{3,30}$/;
