"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { buildModel, type WalkModel } from "@/lib/event-model";
import type { BaseData, EventConfig } from "@/lib/types";

type Ctx = {
  model: WalkModel;
  base: BaseData;
  override: Partial<EventConfig>;
  saveOverride: (next: Partial<EventConfig>) => void;
  resetOverride: () => void;
};

const EventContext = createContext<Ctx | null>(null);
const key = (id: string) => `uw:admin:${id}`;

/**
 * Admin edits are stored as a partial EventConfig on top of public/data/event.json.
 * Dev mode keeps them in this browser; export them from /admin to publish.
 */
export function EventProvider({ base, children }: { base: BaseData; children: ReactNode }) {
  const [override, setOverride] = useState<Partial<EventConfig>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key(base.event.id));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from device storage after mount so SSR markup matches
      if (raw) setOverride(JSON.parse(raw) as Partial<EventConfig>);
    } catch {
      /* no storage: use published config */
    }
  }, [base.event.id]);

  const saveOverride = useCallback(
    (next: Partial<EventConfig>) => {
      setOverride(next);
      try {
        localStorage.setItem(key(base.event.id), JSON.stringify(next));
      } catch {}
    },
    [base.event.id],
  );
  const resetOverride = useCallback(() => saveOverride({}), [saveOverride]);

  const model = useMemo(() => buildModel(base, override), [base, override]);
  const value = useMemo(() => ({ model, base, override, saveOverride, resetOverride }), [model, base, override, saveOverride, resetOverride]);
  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}

export function useEvent() {
  const ctx = useContext(EventContext);
  if (!ctx) throw new Error("useEvent must be used inside EventProvider");
  return ctx;
}
