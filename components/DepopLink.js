"use client";

// A general-purpose Depop outbound link used in headers/footers/hero
// (non-product contexts). Fires a `depop_click_general` event so the
// admin dashboard can count site-wide Depop interest separately from
// the per-product Shop on Depop CTAs that live inside ProductDetail.

import { links } from "@/data/products";
import { trackDepopClickGeneral } from "@/lib/analytics";

export default function DepopLink({
  href = links.depop,
  className = "",
  children,
  source,
  ...rest
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        // Let other onClick handlers (e.g. stopPropagation) compose
        rest.onClick?.(e);
        trackDepopClickGeneral(source);
      }}
      className={className}
      {...rest}
    >
      {children}
    </a>
  );
}
