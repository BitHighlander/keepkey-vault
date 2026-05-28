"use client";

import { useEffect, useState } from "react";
import DeprecatedNotice from "./DeprecatedNotice";

const BYPASS_KEY = "keepkey-vault:bypass-deprecation";

export default function DeprecationGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [bypassed, setBypassed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setBypassed(localStorage.getItem(BYPASS_KEY) === "1");
    } catch {
      // localStorage unavailable (private mode, etc.) — keep notice up
    }
    setHydrated(true);
  }, []);

  if (hydrated && bypassed) {
    return <>{children}</>;
  }

  return (
    <DeprecatedNotice
      onDismiss={() => {
        try {
          localStorage.setItem(BYPASS_KEY, "1");
        } catch {
          // ignore — bypass will be session-only
        }
        setBypassed(true);
        setHydrated(true);
      }}
    />
  );
}
