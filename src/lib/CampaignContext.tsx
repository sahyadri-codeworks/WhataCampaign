"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { campaignDurationDays } from "@/lib/scheduler";
import type {
  AiScreenResult,
  CampaignConfig,
  Contact,
  ScheduleResult,
} from "@/lib/types";

export type SavedCampaign = {
  id: string;
  name: string;
  createdAt: string;
  contactCount: number;
  scheduledCount: number;
  batchCount: number;
  riskScore: number | null;
};

const today = new Date().toISOString().slice(0, 10);
const savedCampaignsKey = "whatacampaign.savedCampaigns";

type CampaignContextType = {
  config: CampaignConfig;
  setConfig: React.Dispatch<React.SetStateAction<CampaignConfig>>;
  updateConfig: <K extends keyof CampaignConfig>(key: K, value: CampaignConfig[K]) => void;
  contacts: Contact[];
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  message: string;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  screenResult: AiScreenResult | null;
  setScreenResult: React.Dispatch<React.SetStateAction<AiScreenResult | null>>;
  isScreening: boolean;
  setIsScreening: React.Dispatch<React.SetStateAction<boolean>>;
  schedule: ScheduleResult;
  setSchedule: React.Dispatch<React.SetStateAction<ScheduleResult>>;
  savedCampaigns: SavedCampaign[];
  setSavedCampaigns: React.Dispatch<React.SetStateAction<SavedCampaign[]>>;
  cloudUserId: string | null;
  cloudStatus: "checking" | "connected" | "local";
  duration: number;
  totalScheduled: number;
  blockedByRisk: boolean;
  canGenerate: boolean;
  canSave: boolean;
};

const CampaignContext = createContext<CampaignContextType | null>(null);

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<CampaignConfig>({
    name: "June retention campaign",
    startDate: today,
    endDate: today,
    dailyLimit: 100,
    cooldownDays: 7,
  });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [message, setMessage] = useState(
    "Hi {{name}}, we have a new offer this week. Reply YES and our team will share details.",
  );
  const [screenResult, setScreenResult] = useState<AiScreenResult | null>(null);
  const [isScreening, setIsScreening] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleResult>({
    batches: [],
    skippedContacts: [],
    errors: [],
  });
  const [savedCampaigns, setSavedCampaigns] = useState<SavedCampaign[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const saved = window.localStorage.getItem(savedCampaignsKey);
      return saved ? (JSON.parse(saved) as SavedCampaign[]) : [];
    } catch (error) {
      console.error("Error loading saved campaigns:", error);
      return [];
    }
  });
  const [cloudUserId, setCloudUserId] = useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = useState<"checking" | "connected" | "local">(
    isSupabaseConfigured ? "checking" : "local"
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(savedCampaignsKey, JSON.stringify(savedCampaigns));
      } catch (error) {
        console.error("Error saving campaigns:", error);
      }
    }
  }, [savedCampaigns]);

  useEffect(() => {
    let isMounted = true;

    async function connectCloud() {
      if (!supabase) {
        setCloudStatus("local");
        return;
      }

      try {
        const sessionResult = await supabase.auth.getSession();
        let user = sessionResult.data.session?.user ?? null;

        if (!user) {
          const signInResult = await supabase.auth.signInAnonymously();
          user = signInResult.data.user;

          if (signInResult.error || !user) {
            if (isMounted) {
              setCloudStatus("local");
            }
            return;
          }
        }

        if (isMounted) {
          setCloudUserId(user.id);
          setCloudStatus("connected");
        }
      } catch (error) {
        console.error("Failed to connect to Supabase:", error);
        if (isMounted) {
          setCloudStatus("local");
        }
      }
    }

    connectCloud();

    return () => {
      isMounted = false;
    };
  }, []);

  function updateConfig<K extends keyof CampaignConfig>(key: K, value: CampaignConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  const duration = useMemo(
    () => campaignDurationDays(config.startDate, config.endDate),
    [config.startDate, config.endDate]
  );

  const totalScheduled = schedule.batches.reduce(
    (sum, batch) => sum + batch.contacts.length,
    0
  );
  const blockedByRisk = Boolean(screenResult && screenResult.score > 80);
  const canGenerate = contacts.length > 0 && !blockedByRisk;
  const canSave = schedule.batches.length > 0 && schedule.errors.length === 0;

  return (
    <CampaignContext.Provider
      value={{
        config,
        setConfig,
        updateConfig,
        contacts,
        setContacts,
        message,
        setMessage,
        screenResult,
        setScreenResult,
        isScreening,
        setIsScreening,
        schedule,
        setSchedule,
        savedCampaigns,
        setSavedCampaigns,
        cloudUserId,
        cloudStatus,
        duration,
        totalScheduled,
        blockedByRisk,
        canGenerate,
        canSave,
      }}
    >
      {children}
    </CampaignContext.Provider>
  );
}

export function useCampaign() {
  const context = useContext(CampaignContext);
  if (!context) {
    throw new Error("useCampaign must be used within a CampaignProvider");
  }
  return context;
}
