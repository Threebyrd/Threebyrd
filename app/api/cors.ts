const DEFAULT_ALLOWED_ORIGINS = new Set([
  "https://threebyrd.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function allowedOrigins(): Set<string> {
  const configured = process.env.CORS_ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

  return new Set(configured?.length ? configured : DEFAULT_ALLOWED_ORIGINS);
}

export function isAllowedCheckoutOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || allowedOrigins().has(origin);
}

export function withApiCors(
  request: Request,
  methods: string,
  init: ResponseInit = {},
): ResponseInit {
  const headers = new Headers(init.headers);
  const origin = request.headers.get("origin");

  if (origin && allowedOrigins().has(origin)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-methods", methods);
    headers.set("access-control-allow-headers", "content-type");
    headers.set("vary", "Origin");
  }

  return { ...init, headers };
}

export function withCheckoutCors(request: Request, init: ResponseInit = {}): ResponseInit {
  return withApiCors(request, "POST, OPTIONS", init);
}

export function withCapacityCors(request: Request, init: ResponseInit = {}): ResponseInit {
  return withApiCors(request, "GET, OPTIONS", init);
}
