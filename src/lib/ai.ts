import type { AiScreenResult } from "./types";

const riskyTerms = [
  "free",
  "limited time",
  "guaranteed",
  "winner",
  "urgent",
  "click now",
  "cashback",
  "act fast",
  "100%",
  "offer",
  "discount",
  "buy now",
];

export function localScreenMessage(message: string): AiScreenResult {
  const normalized = message.toLowerCase();
  const flags = riskyTerms.filter((term) => normalized.includes(term));
  const linkCount = (message.match(/https?:\/\//g) ?? []).length;
  const shoutyWords = message.split(/\s+/).filter((word) => {
    const letters = word.replace(/[^A-Za-z]/g, "");
    return letters.length > 3 && letters === letters.toUpperCase();
  }).length;

  const score = Math.min(100, flags.length * 12 + linkCount * 12 + shoutyWords * 4);

  return {
    score,
    flags,
    suggestion:
      flags.length === 0
        ? message
        : message.replace(/free|urgent|click now|buy now/gi, (match) =>
            match.toLowerCase() === "free"
              ? "included"
              : match.toLowerCase() === "urgent"
                ? "time-sensitive"
                : "learn more",
          ),
    source: "local",
  };
}
