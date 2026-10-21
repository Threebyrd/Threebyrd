import type { ReactNode } from "react";
import { withBasePath } from "../site-paths";

export default function PolicyPage({ title, children }: { title: string; children: ReactNode }) {
  return <main className="policyPage">
    <a className="policyBrand" href={withBasePath("/")}>ThreeByrd Meal Prep</a>
    <article><h1>{title}</h1><p className="policyDate">Effective October 21, 2026</p>{children}</article>
    <a href={withBasePath("/#order")}>← Back to ordering</a>
  </main>;
}
