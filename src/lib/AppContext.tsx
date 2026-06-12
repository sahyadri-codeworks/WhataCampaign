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
        // Try to get existing session first
        const { data: session } = await supabase!.auth.getSession();
        let user = session.session?.user ?? null;

        if (!user) {
          // Try anonymous sign-in (must be enabled in Supabase dashboard)
          const { data, error } = await supabase!.auth.signInAnonymously();
          if (error) {
            // Anonymous auth not enabled — use a fallback user ID based on anon key
            // Connection still works for tables with permissive RLS
            console.warn("Anonymous auth not enabled, using fallback mode:", error.message);
            if (mounted) {
              setUserId("anon-fallback");
              setDbStatus("connected");
            }
            return;
          }
          user = data.user;
        }

        if (mounted) {
          setUserId(user?.id ?? "anon-fallback");
          setDbStatus("connected");
        }
      } catch {
        // Last resort: test if Supabase is reachable at all
        try {
          await supabase!.from("contacts").select("id").limit(1);
          if (mounted) {
            setUserId("anon-fallback");
            setDbStatus("connected");
          }
        } catch {
          if (mounted) setDbStatus("local");
        }
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
