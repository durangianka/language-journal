import "server-only";
import { z } from "zod";
import { feedbackPrompt } from "./prompt";
import { model, ProviderError, type FeedbackProvider } from "./provider";
import { outputJsonSchema } from "./schema";

const responseSchema = z.object({
  status: z.string(),
  output: z.array(
    z.object({
      type: z.string(),
      content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
    }),
  ),
  usage: z
    .object({
      input_tokens: z.number().int().nonnegative(),
      output_tokens: z.number().int().nonnegative(),
    })
    .nullish(),
});

// Native fetch exposes one HTTP attempt so the database can meter every retry.
export const openAIProvider: FeedbackProvider = {
  async generate(input, signal) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new ProviderError("missing_api_key");
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        signal,
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          ...feedbackPrompt(input),
          store: false,
          text: {
            format: {
              type: "json_schema",
              name: "journal_feedback",
              strict: true,
              schema: outputJsonSchema,
            },
          },
        }),
      });
    } catch {
      if (signal.aborted) throw new ProviderError("timeout");
      throw new ProviderError("network", true);
    }
    if (!response.ok)
      throw new ProviderError(
        `http_${response.status}`,
        response.status >= 500 && response.status <= 599,
      );
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      if (signal.aborted) throw new ProviderError("timeout");
      throw new ProviderError("invalid_provider_response");
    }
    const parsed = responseSchema.safeParse(json);
    if (!parsed.success) throw new ProviderError("invalid_provider_response");
    const text = parsed.data.output
      .filter((item) => item.type === "message")
      .flatMap((item) => item.content ?? [])
      .filter((part) => part.type === "output_text")
      .map((part) => part.text ?? "")
      .join("");
    // Refusals and incomplete responses enter the single repair path too.
    return {
      text: parsed.data.status === "completed" ? text : "",
      inputTokens: parsed.data.usage?.input_tokens ?? null,
      outputTokens: parsed.data.usage?.output_tokens ?? null,
    };
  },
};
