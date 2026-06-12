import { localScreenMessage } from "@/lib/ai";

export async function POST(req: Request) {
  const { template_body, template_category } = (await req.json()) as {
    template_body?: string;
    template_category?: string;
  };

  if (!template_body?.trim()) {
    return Response.json({ error: "template_body is required" }, { status: 400 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    const local = localScreenMessage(template_body);
    return Response.json({
      score: local.score,
      issues: local.flags,
      suggestions: local.suggestion ? [local.suggestion] : [],
      estimated_delivery_boost: "Enable Claude API for detailed analysis",
    });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: `Analyze this WhatsApp template message for delivery quality. Category: ${template_category || "unknown"}.

Template: ${template_body}

Return JSON only, no markdown:
{
  "score": <0-100, where 0 is perfect and 100 is certain to be flagged/blocked>,
  "issues": [<list of specific problems found>],
  "suggestions": [<list of actionable improvements>],
  "estimated_delivery_boost": "<estimated % improvement if suggestions applied>"
}

Check for: spam trigger words, missing personalization, missing opt-out, category mismatch, body over 1024 chars, aggressive CTAs, excessive caps/emojis, banned WhatsApp patterns.`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const local = localScreenMessage(template_body);
      return Response.json({
        score: local.score,
        issues: local.flags,
        suggestions: [local.suggestion],
        estimated_delivery_boost: "Claude API returned an error; used local fallback",
      });
    }

    const data = await res.json() as {
      content: { type: string; text: string }[];
    };
    const text = data.content.find((c) => c.type === "text")?.text ?? "";

    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error("No JSON in response");
    }

    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

    return Response.json({
      score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
      issues: Array.isArray(parsed.issues) ? parsed.issues.map(String) : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String) : [],
      estimated_delivery_boost: String(parsed.estimated_delivery_boost || "Unknown"),
    });
  } catch {
    const local = localScreenMessage(template_body);
    return Response.json({
      score: local.score,
      issues: local.flags,
      suggestions: [local.suggestion],
      estimated_delivery_boost: "Fallback analysis used",
    });
  }
}
