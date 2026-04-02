"use client";

import { useEffect } from "react";

/**
 * Popup close page. After Auth0 Connected Accounts flow completes,
 * the popup redirects here and closes itself. The parent window's
 * polling interval detects the closed popup and calls resume().
 */
export default function ClosePage() {
  useEffect(() => {
    window.close();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">
        Account connected. This window will close automatically.
      </p>
    </div>
  );
}
