import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { JevStatusBadge } from "../../src/components/jev-status-badge";
import { dictionaries } from "../../src/i18n/dictionaries";
import type { JevNote } from "../../src/lib/jev/contract";

for (const [locale, t] of Object.entries(dictionaries)) {
  test.each([
    [true, null, t.jevChecking, "bg-muted", "loader-circle"],
    [false, "none", t.jevNoIssues, "bg-green-100", "circle-check"],
    [false, "uncertain", t.jevUncertain, "bg-blue-100", "info"],
    [false, "grammar", `${t.jevGrammar} ${t.jevDetails}`, "bg-amber-100", "triangle-alert"],
    [false, "vocabulary", `${t.jevVocabulary} ${t.jevDetails}`, "bg-amber-100", "triangle-alert"],
    [false, "spelling", `${t.jevSpelling} ${t.jevDetails}`, "bg-amber-100", "triangle-alert"],
    [false, "style", `${t.jevStyle} ${t.jevDetails}`, "bg-amber-100", "triangle-alert"],
  ] as const)("%s / %s in " + locale, (checking, issue, label, colour, icon) => {
    const judgement: JevNote | null = issue ? { issue, confidence: 0.9 } : null;
    const html = renderToStaticMarkup(createElement(JevStatusBadge, { checking, judgement, t }));
    expect(html).toContain(`<span>${label}</span>`);
    expect(html).toContain(colour);
    expect(html).toContain(`lucide-${icon}`);
    expect(html).toContain('aria-hidden="true"');
    expect(html.includes("animate-spin")).toBe(checking);
  });

  test(`no badge before a result in ${locale}`, () => {
    expect(
      renderToStaticMarkup(createElement(JevStatusBadge, { checking: false, judgement: null, t })),
    ).toBe("");
  });
}

test("checking takes precedence over a previous result", () => {
  const html = renderToStaticMarkup(
    createElement(JevStatusBadge, {
      checking: true,
      judgement: { issue: "none", confidence: 1 },
      t: dictionaries.en,
    }),
  );
  expect(html).toContain("Checking your text");
  expect(html).toContain("bg-muted");
  expect(html).not.toContain("Looks good");
});
