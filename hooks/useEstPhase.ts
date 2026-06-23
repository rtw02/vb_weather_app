"use client";

import { useEffect, useState } from "react";
import { getEstHour, getPhase, type Phase } from "@/lib/daytime";

// Returns the current sky Phase (fixed EST). Updates every minute.
// Supports a `?h=<0-23>` URL override for previewing any phase.
export function useEstPhase(): Phase {
  // Default to "day" on first render so server and client markup match;
  // the real phase is set in the effect below right after mount.
  const [phase, setPhase] = useState<Phase>(() => getPhase(12));

  useEffect(() => {
    function compute() {
      const params = new URLSearchParams(window.location.search);
      const override = params.get("h");
      const hour =
        override !== null && !Number.isNaN(Number(override))
          ? Number(override)
          : getEstHour();
      setPhase(getPhase(hour));
    }
    compute();
    const id = setInterval(compute, 60_000);
    return () => clearInterval(id);
  }, []);

  return phase;
}
