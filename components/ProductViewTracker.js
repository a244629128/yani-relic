"use client";

import { useEffect } from "react";
import { trackView } from "@/lib/analytics";

/**
 * Mounted inside the server-rendered /shop/[id] page. Starts the dwell
 * timer on mount, flushes on unmount / tab close / visibilitychange.
 *
 * IMPORTANT: useEffect dep is [productId], NOT [].
 * App Router client navigation may reuse the component instance when
 * routing from /shop/r-01 to /shop/r-02. The [productId] dep guarantees
 * that the dwell timer flushes for the old product and restarts for the
 * new one even if React keeps the same DOM node.
 */
export default function ProductViewTracker({ productId }) {
  useEffect(() => {
    if (!productId) return;
    const end = trackView(productId);
    return () => end();
  }, [productId]);
  return null;
}
