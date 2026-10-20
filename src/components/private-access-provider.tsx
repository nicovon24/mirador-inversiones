"use client";

import { createContext, useContext } from "react";

const PrivateAccessContext = createContext(false);

export function PrivateAccessProvider({ allowed, children }: { allowed: boolean; children: React.ReactNode }) {
  return <PrivateAccessContext.Provider value={allowed}>{children}</PrivateAccessContext.Provider>;
}

export function usePrivateAccess() {
  return useContext(PrivateAccessContext);
}
