"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";

type AppContextType = {
  userId: string | null;
  isReady: boolean;
  dbStatus: "connected" | "local" | "connecting";
};

const AppContext = createContext<AppContextType>({
  userId: null,
  isReady: false,
  dbStatus: "connecting",
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [dbStatus, setDbStatus] = useState<"connected" | "local" | "connecting">(
    isSupabaseConfigured ? "connecting" : "local",
  );

  useEffect(() => {
    if (!supabase) {
      setDbStatus("local");
      setIsReady(true);
      return;
    }

    let mounted = true;

    async function init() {
      try {
        const { data: session } = await supabase!.auth.getSession();
        let user = session.session?.user ?? null;

        if (!user) {
          const { data } = await supabase!.auth.signInAnonymously();
          user = data.user;
        }

        if (mounted && user) {
          setUserId(user.id);
          setDbStatus("connected");
        }
      } catch {
        if (mounted) setDbStatus("local");
      } finally {
        if (mounted) setIsReady(true);
      }
    }

    init();
    return () => { mounted = false; };
  }, []);

  return (
    <AppContext.Provider value={{ userId, isReady, dbStatus }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
