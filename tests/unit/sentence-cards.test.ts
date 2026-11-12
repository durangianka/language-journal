import { expect, test } from "vitest";
import { languages, levels } from "../../src/config/domain";
import { sentenceCards } from "../../src/config/sentence-cards";
import { dictionaries } from "../../src/i18n/dictionaries";

test("every journal language and level has a complete, translated card set", () => {
  for (const language of languages) {
    for (const level of levels) {
      const cards = sentenceCards[language][level];
      expect(cards.length).toBeGreaterThan(0);
      expect(cards.length).toBeLessThanOrEqual(5);
      for (const card of cards) {
        expect(card.template.trim()).not.toBe("");
        expect(card.example.trim()).not.toBe("");
        for (const dictionary of Object.values(dictionaries)) {
          expect(dictionary[card.titleKey].trim()).not.toBe("");
        }
      }
    }
  }
});
