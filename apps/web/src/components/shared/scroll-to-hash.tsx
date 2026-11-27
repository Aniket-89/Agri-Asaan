"use client";

import { useEffect } from "react";

// With client-side navigation a link like /dashboard/my-farm#book arrives
// before the page's streamed content exists, so the browser cannot jump to
// the anchor. Rendered at the end of that content, this scrolls to it once.
export function ScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) {
      document.getElementById(id)?.scrollIntoView();
    }
  }, []);
  return null;
}
