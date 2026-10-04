const PUBLIC_SHARE_HEADERS: Readonly<Record<string, string>> = {
  "Cache-Control": "no-store, private",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie",
};

export function applyPublicShareResponsePolicy(response: Response): Response {
  for (const [name, value] of Object.entries(PUBLIC_SHARE_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}
