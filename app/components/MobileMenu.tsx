"use client";

type MobileMenuItem = { label: string; href: string };

export default function MobileMenu({ items }: { items: MobileMenuItem[] }) {
  return (
    <details className="mobileMenu">
      <summary>Menu</summary>
      <nav aria-label="Mobile navigation">
        {items.map((item) => (
          <a
            href={item.href}
            key={item.href}
            onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </details>
  );
}
