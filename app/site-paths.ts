const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBasePath(path: `/${string}`): string {
  if (!basePath || path === basePath || path.startsWith(`${basePath}/`)) {
    return path;
  }

  return `${basePath}${path}`;
}

export function siteUrl(path: `/${string}`): string {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://threebyrd.com").replace(
    /\/$/,
    "",
  );
  return `${origin}${path}`;
}
