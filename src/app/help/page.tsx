"use client";

import { useState } from "react";
import {
  HelpCircle, ChevronDown, ChevronRight, BarChart3, Megaphone, GitBranch, Database, Plug,
  BookOpen, Lightbulb, ArrowRight, MessageSquare, Shield, Zap, Users, Send,
} from "lucide-react";

type Article = { title: string; icon: typeof HelpCircle; content: string[] };

const quickStart: string[] = [
  "1. Set up Connectors — Go to Connectors and add your WhatsApp Business API provider (Meta Cloud API, 360dialog, Wati, or Interakt). Test the connection to make sure it works.",
  "2. Import Contacts — Go to Database, click Import CSV or add contacts manually. Assign opt-in categories and tier tags to organize them.",
  "3. Create Segments — In Database, create segments to group contacts (e.g. \"VIP Customers\", \"New Leads\"). These segments become your campaign audience.",
  "4. Build a Campaign — Go to Campaigns, click Create Campaign. Pick a name, choose your connector, write your message, select audience segments, and launch.",
  "5. Or Build a Journey — Go to Journey Builder for automated flows. Drag trigger → action → condition nodes. Assign a connector to each send node.",
  "6. Monitor Results — Check Analytics for delivery rates, message volume, and quality scores.",
];

const articles: Article[] = [
  {
    title: "Analytics Dashboard",
    icon: BarChart3,
    content: [
      "The Analytics page shows your messaging health at a glance.",
      "KPI Cards — Total sent, delivered, failed, and delivery rate. These update from your message_log table in Supabase.",
      "Quality Score — Shows your WhatsApp quality rating (Green/Yellow/Red). This comes from Meta's API via your connected provider.",
      "Charts — Message volume over time, delivery vs. failure trends, and error code breakdowns.",
      "Time Range — Filter by 7d, 30d, or 90d to spot trends.",
      "Tip: If your delivery rate drops below 90%, check for invalid numbers in your contact database.",
    ],
  },
  {
    title: "Campaigns",
    icon: Megaphone,
    content: [
      "Campaigns let you send bulk WhatsApp messages to a group of contacts.",
      "Step 1: Details — Name your campaign, pick a category (Marketing/Utility/Authentication), and write your template message body.",
      "Step 2: Connector — Choose which WhatsApp provider sends the messages. If you have multiple connectors, pick the one best suited for this campaign type. Fallback connectors auto-retry if the primary hits a rate limit.",
      "Step 3: AI Review — Run an AI check on your message. It scores your content and flags potential issues (spam triggers, missing opt-out text, etc.). This helps avoid Meta rejecting your template.",
      "Step 4: Audience — Select one or more segments. Each segment is a group of contacts you created in Database.",
      "Step 5: Schedule — Send immediately or pick a future date/time.",
      "Step 6: Review & Launch — Double-check everything and hit Launch.",
      "Campaign Statuses: draft (not sent), scheduled (queued for later), sending (in progress), completed (done), paused (manually stopped).",
    ],
  },
  {
    title: "Journey Builder",
    icon: GitBranch,
    content: [
      "Journeys are automated message flows that trigger based on events.",
      "How it works: Data comes in (trigger) → you categorize it (conditions) → actions fire (send messages, update fields, add tags).",
      "Node Types:",
      "• Triggers — What starts the journey: Inbound Message, Click-to-WhatsApp/QR scan, API Event, or Added to Segment.",
      "• Actions — What happens: Send Template, Send Reply (within 24h window), Add/Remove Tag, Update Field, Trigger Webhook.",
      "• Conditions — Decision points: Opt-in Gate (blocks if not opted in), Message Delivered?, User Replied?, Time Condition, Field Value check.",
      "• Wait — Pause the flow: Delay (minutes/hours/days) or Wait for Event.",
      "Connector per Node: Each Send Template or Send Reply node can use a different connector. This means you can route marketing via one provider and utility via another.",
      "Building: Click a node type in the left panel to add it to the canvas. Drag nodes to position them. Connect nodes by dragging from one handle to another.",
      "Saving: Click Save in the top-right. Use Open to load previously saved journeys.",
      "Tip: Start simple — a trigger → send template → condition → two branches is a great first journey.",
    ],
  },
  {
    title: "Contact Database",
    icon: Database,
    content: [
      "The Database page manages all your WhatsApp contacts.",
      "Adding Contacts — Click Add Contact and fill in phone number (with country code, e.g. +919876543210), name, opt-in category, and tier tag.",
      "Opt-in Categories — Controls what messages a contact can receive:",
      "• none — Cannot receive any messages",
      "• utility_only — Can receive transactional/utility messages only",
      "• marketing — Can receive marketing + utility messages",
      "• double_confirmed — Fully confirmed, all message types",
      "• opted_out — Unsubscribed, cannot be messaged",
      "Tier Tags — Organize contacts by value: bronze, silver, gold, platinum. Use these in segments.",
      "Bulk Actions — Select multiple contacts with checkboxes, then bulk-update their opt-in category.",
      "CSV Import — Upload a CSV file with columns: phone, name, optin_category, tier_tag. Duplicates (same phone) are updated, new numbers are created.",
      "Segments — Create named groups of contacts based on filters. Segments are used as campaign audiences.",
      "Tip: Keep your contact list clean. Remove bounced/invalid numbers to maintain your quality score.",
    ],
  },
  {
    title: "Connectors",
    icon: Plug,
    content: [
      "Connectors link WhataCampaign to your WhatsApp Business API provider.",
      "Supported Providers:",
      "• Meta Cloud API — Direct connection to Meta's WhatsApp Business Platform. Needs: Phone Number ID, WABA ID, Access Token.",
      "• 360dialog — BSP that simplifies Meta API access. Needs: API Key, Phone Number ID.",
      "• Wati — WhatsApp business solution. Needs: API Key, Phone Number ID, WABA URL.",
      "• Interakt — India-focused WhatsApp provider. Needs: API Key, Phone Number ID.",
      "Adding a Connector: Click Add Connector → pick provider → fill in credentials → Save. The system tests the connection and fetches your quality rating automatically.",
      "Fallback: Mark a connector as 'Fallback' so it auto-retries when the primary hits Meta's rate limit (error 130429). The ConnectorManager handles this automatically.",
      "Testing: Click the Test button anytime to verify your connector still works.",
      "Tip: Use Meta Cloud API for maximum control, or a BSP like 360dialog for easier setup.",
    ],
  },
  {
    title: "Opt-in Compliance",
    icon: Shield,
    content: [
      "WhatsApp requires explicit opt-in before sending marketing messages. WhataCampaign enforces this with an opt-in state machine.",
      "The Flow: none → utility_only → marketing → double_confirmed → opted_out",
      "• New contacts start at 'none' and cannot receive messages.",
      "• Move them to 'utility_only' to send transactional updates.",
      "• Get explicit marketing consent to move to 'marketing'.",
      "• Send a confirmation message and get a 'Yes' reply for 'double_confirmed'.",
      "• If they reply 'STOP', move to 'opted_out'.",
      "Journey Builder Integration: Use the Opt-in Gate condition node to automatically block marketing messages to contacts who haven't opted in. This prevents Meta from penalizing your account.",
      "Tip: Always include an opt-out instruction in marketing messages (e.g. 'Reply STOP to unsubscribe').",
    ],
  },
  {
    title: "Error Handling",
    icon: Zap,
    content: [
      "WhataCampaign handles common WhatsApp API errors automatically:",
      "• 131049 (Frequency Cap) — Meta limits how often you can message a user. The system respects this and skips capped contacts.",
      "• 130429 (Rate Limit) — Too many messages per second. If you have a fallback connector, it auto-retries through that provider.",
      "• 131047 (Re-engagement Expired) — The 24-hour customer service window has closed. You can only send approved templates, not free-form replies.",
      "Quality Rating: Meta assigns Green (good), Yellow (warning), Red (restricted) based on user feedback. Check this in Connectors → View Details.",
      "Tip: If you see many 131049 errors, spread your campaign sends across time windows instead of blasting all at once.",
    ],
  },
];

export default function HelpPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-purple-100 text-purple-600">
          <BookOpen size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Help Desk</h1>
          <p className="text-sm text-muted-foreground">Everything you need to know about WhataCampaign.</p>
        </div>
      </div>

      {/* Quick Start */}
      <div className="rounded-xl border bg-gradient-to-br from-purple-50 to-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb size={18} className="text-purple-600" />
          <h2 className="text-lg font-bold text-purple-800">Quick Start Guide</h2>
        </div>
        <p className="text-sm text-purple-700 mb-4">Get sending in 5 minutes. Follow these steps in order:</p>
        <div className="space-y-3">
          {quickStart.map((step, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-purple-600 text-white text-[10px] font-bold mt-0.5">{i + 1}</span>
              <p className="text-sm text-purple-900">{step.replace(/^\d+\.\s*/, "").replace(/^[^—]*—\s*/, `**${step.match(/^[^—]*/)?.[0]?.trim()}** — `)}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-2 rounded-lg bg-purple-100/50 border border-purple-200 p-3">
          <MessageSquare size={16} className="text-purple-600 shrink-0" />
          <p className="text-xs text-purple-700">
            <strong>Core flow:</strong> Data comes in → Categorize contacts → Create journey or campaign → Messages trigger via your selected connector.
          </p>
        </div>
      </div>

      {/* Articles */}
      <div className="space-y-2">
        {articles.map((article, i) => {
          const isOpen = openIdx === i;
          return (
            <div key={article.title} className="rounded-xl border bg-white shadow-sm overflow-hidden">
              <button onClick={() => setOpenIdx(isOpen ? null : i)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors">
                <div className="grid size-8 place-items-center rounded-lg bg-purple-50 text-purple-600 shrink-0">
                  <article.icon size={16} />
                </div>
                <span className="flex-1 text-sm font-semibold">{article.title}</span>
                {isOpen ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
              </button>
              {isOpen && (
                <div className="px-5 pb-5 pt-1 border-t">
                  <div className="space-y-2.5 pl-11">
                    {article.content.map((line, j) => (
                      <p key={j} className={`text-sm ${line.startsWith("•") ? "pl-3 text-foreground/80" : line.startsWith("Tip:") ? "text-purple-700 font-medium bg-purple-50 rounded-lg px-3 py-2 border border-purple-100" : "text-foreground/80"}`}>
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-center text-xs text-muted-foreground py-4">
        WhataCampaign · WhatsApp Campaign & Journey Management Platform
      </div>
    </div>
  );
}
