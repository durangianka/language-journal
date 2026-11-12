import "server-only";
import { jevQuestions } from "./contract";
import type { JevClient } from "./service";

export const jevModel = "jev-latest";
export const jevEndpoint = "https://api.typesafe.ai/v1/systemone";
export const jevClient: JevClient = {
  async judge(text, signal, questions = jevQuestions) {
    const key = process.env.JEV_API_KEY;
    if (!key) throw new Error("Jev unavailable");
    const response = await fetch(jevEndpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: jevModel, state: text, questions }),
      signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Jev request failed (${response.status})`);
    const result = await response.json();
    return result.answers;
  },
};
