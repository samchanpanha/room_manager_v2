"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const THEME_COOKIE = "; path=/; max-age=31536000; samesite=lax";

/// Persists to the rm-theme cookie (not localStorage) because the root layout
/// renders the <html> class from that cookie server-side — so a reload paints
/// the chosen theme immediately instead of flashing dark→light on hydration.
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    document.cookie = `rm-theme=${next ? "dark" : "light"}${THEME_COOKIE}`;
  };

  return (
    <Button variant="ghost" size="icon" onClick={toggle} title="Toggle theme" aria-label="Toggle theme">
      {dark ? "☀️" : "🌙"}
    </Button>
  );
}
