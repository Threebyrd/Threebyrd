import type { NextConfig } from "next";

const githubPages = process.env.GITHUB_PAGES === "true";
const githubPagesBasePath = githubPages
  ? ""
  : process.env.GITHUB_PAGES_BASE_PATH?.replace(/\/$/, "") ?? "";

const nextConfig: NextConfig = {
  basePath: githubPagesBasePath,
  images: {
    unoptimized: githubPages,
  },
};

export default nextConfig;
