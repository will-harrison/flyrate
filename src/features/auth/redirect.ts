/**
 * safeNext — same-origin open-redirect guard for the auth callback routes.
 *
 * Both /auth/callback (OAuth) and /auth/confirm (email OTP) accept a client-
 * supplied `next` param that they redirect to after establishing a session.
 * Redirecting to a raw client value is an open-redirect: an attacker can craft
 * a link that lands a just-authenticated user on `https://evil.example/...`,
 * leaking the session or phishing them (threat T-03-01).
 *
 * Rule: only accept a same-origin *relative* path — it must start with a single
 * "/" and must not be a scheme-relative "//host" or an absolute URL. Anything
 * else falls back to "/".
 */
export function safeNext(next: string | null): string {
  if (!next) return "/";
  // Must be a relative path rooted at "/".
  if (!next.startsWith("/")) return "/";
  // Reject protocol-relative "//host" and the "/\host" backslash variant that
  // some browsers normalise to a scheme-relative URL.
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  // Defence in depth: a well-formed relative path never contains a scheme.
  // `new URL(next, base)` resolving to a different origin would be caught by the
  // checks above, but reject any embedded "://" outright.
  if (next.includes("://")) return "/";
  return next;
}
