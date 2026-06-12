import { localScreenMessage } from "@/lib/ai";

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("No JSON object found in Gemini response.");
  }

  return JSON.parse(candidate.slice(start, end + 1));
}

export async function POST(req: Request) {
  const { message } = (await req.json()) as { message?: string };

  if (!message?.trim()) {
    return Response.json(
      { error: "Message content is required." },
      { status: 400 },
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return Response.json(localScreenMessage(message));
  }

  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Analyze this WhatsApp marketing message for spam risk. Return ONLY valid JSON with this exact shape: { "score": number, "flags": string[], "suggestion": string }. score 0=clean and 100=definite spam. flags are specific spammy words or risky patterns found. suggestion is a safer rewritten message.\n\nMessage: ${message}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 400,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    return Response.json({
      ...localScreenMessage(message),
      warning: "Gemini request failed; used local fallback.",
    });
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? "")
    .join("");

  try {
    const parsed = extractJson(text);
    return Response.json({
      score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
      flags: Array.isArray(parsed.flags) ? parsed.flags.map(String) : [],
      suggestion: String(parsed.suggestion || message),
      source: "gemini",
    });
  } catch {
    return Response.json({
      ...localScreenMessage(message),
      warning: "Gemini returned an unreadable response; used local fallback.",
    });
  }
}
