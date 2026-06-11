"use client";

// General-purpose mailto link used in footer / contact (non-product
// contexts). Fires `mailto_click_general` so the dashboard counts
// site-wide email interest separately from the per-product "Message to
// Claim" CTAs in ProductDetail.

import { trackMailtoClickGeneral } from "@/lib/analytics";

export default function MailtoLink({ href, className = "", children, source, ...rest }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        rest.onClick?.(e);
        trackMailtoClickGeneral(source);
      }}
      className={className}
      {...rest}
    >
      {children}
    </a>
  );
}
