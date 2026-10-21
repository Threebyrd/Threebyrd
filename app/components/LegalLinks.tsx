import { withBasePath } from "../site-paths";

export default function LegalLinks() {
  return <nav className="legalLinks" aria-label="Legal information">
    <a href={withBasePath("/privacy")}>Privacy Policy</a>
    <a href={withBasePath("/terms")}>Terms &amp; Conditions</a>
    <a href="mailto:luc@threebyrd.com">Support</a>
  </nav>;
}
