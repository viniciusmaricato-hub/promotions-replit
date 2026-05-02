import { openai } from "@workspace/integrations-openai-ai-server";

export const PROMPT_VERSION = "v1";

export const EXTRACTION_PROMPT = `You are a promotions analyst for the iGaming (online casino and sports betting) industry.

Your task is to extract structured promotion data from a raw social media post. Return ONLY a valid JSON object — no explanation, no markdown, no extra text.

Extract the following fields:
- promo_type: The type of promotion. One of: "No Deposit Bonus", "Welcome Bonus", "Free Spins", "Cashback", "Reload Bonus", "Referral Bonus", "Loyalty Reward", "Tournament", "Other". Use null if unclear.
- offer_details: A concise description of the offer in plain English. Use null if the post does not describe a promotion.
- min_deposit: Minimum deposit required as a string (e.g. "$10", "€20"). Use null if not mentioned or not applicable.
- reward_value: The reward amount or value as a string (e.g. "100% up to $500", "50 Free Spins", "$10 free"). Use null if not clearly stated.
- wagering_requirement: Wagering/playthrough requirement as a string (e.g. "30x", "35x bonus"). Use null if not mentioned.
- expiry_date: Expiry date of the offer in ISO 8601 format (YYYY-MM-DD). Use null if not mentioned.
- target_audience: Who the offer targets. One of: "New Players", "Existing Players", "VIP Players", "All Players". Use null if unclear.
- requires_deposit: Boolean. true if a deposit is required to claim, false if it is a no-deposit offer. Use null if genuinely ambiguous.
- confidence_score: Your confidence that this post is a real promotion. One of: "High", "Medium", "Low". Use "Low" if the post is too short, ambiguous, or does not appear to be a promotion.

Rules:
- NEVER invent or hallucinate values. If a field cannot be confidently identified from the post text, use null.
- If the post is not a promotion (e.g. general news, memes, greetings), return all fields as null and set confidence_score to "Low".
- Return ONLY the JSON object, nothing else.

Post text:
`;

export interface ExtractedPromotion {
  promo_type: string | null;
  offer_details: string | null;
  min_deposit: string | null;
  reward_value: string | null;
  wagering_requirement: string | null;
  expiry_date: string | null;
  target_audience: string | null;
  requires_deposit: boolean | null;
  confidence_score: "High" | "Medium" | "Low";
}

const FALLBACK_LOW_CONFIDENCE: ExtractedPromotion = {
  promo_type: null,
  offer_details: null,
  min_deposit: null,
  reward_value: null,
  wagering_requirement: null,
  expiry_date: null,
  target_audience: null,
  requires_deposit: null,
  confidence_score: "Low",
};

export async function extractPromotion(rawText: string): Promise<ExtractedPromotion> {
  if (!rawText || rawText.trim().length < 20) {
    return FALLBACK_LOW_CONFIDENCE;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 512,
      messages: [
        {
          role: "user",
          content: EXTRACTION_PROMPT + rawText.slice(0, 4000),
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "";
    const trimmed = content.trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      console.warn("[llm] Failed to parse LLM response as JSON:", trimmed.slice(0, 200));
      return FALLBACK_LOW_CONFIDENCE;
    }

    if (typeof parsed !== "object" || parsed === null) {
      return FALLBACK_LOW_CONFIDENCE;
    }

    const obj = parsed as Record<string, unknown>;

    const confidenceRaw = obj["confidence_score"];
    const confidence: "High" | "Medium" | "Low" =
      confidenceRaw === "High" || confidenceRaw === "Medium" || confidenceRaw === "Low"
        ? confidenceRaw
        : "Low";

    return {
      promo_type: typeof obj["promo_type"] === "string" ? obj["promo_type"] : null,
      offer_details: typeof obj["offer_details"] === "string" ? obj["offer_details"] : null,
      min_deposit: typeof obj["min_deposit"] === "string" ? obj["min_deposit"] : null,
      reward_value: typeof obj["reward_value"] === "string" ? obj["reward_value"] : null,
      wagering_requirement: typeof obj["wagering_requirement"] === "string" ? obj["wagering_requirement"] : null,
      expiry_date: typeof obj["expiry_date"] === "string" ? obj["expiry_date"] : null,
      target_audience: typeof obj["target_audience"] === "string" ? obj["target_audience"] : null,
      requires_deposit: typeof obj["requires_deposit"] === "boolean" ? obj["requires_deposit"] : null,
      confidence_score: confidence,
    };
  } catch (err) {
    console.error("[llm] Extraction error:", err);
    return FALLBACK_LOW_CONFIDENCE;
  }
}
