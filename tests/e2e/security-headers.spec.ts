import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const development = process.env.PLAYWRIGHT_DEV_SERVER === "1";

for (const path of ["/", "/journals"]) {
  test(`${path} sends security headers without blocking hydration`, async ({ page }, testInfo) => {
    const violations: string[] = [];
    await page.exposeFunction("recordCspViolation", (directive: string) =>
      violations.push(directive),
    );
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (event) => {
        const report = window as unknown as { recordCspViolation: (value: string) => void };
        report.recordCspViolation(`${event.effectiveDirective}: ${event.blockedURI}`);
      });
    });

    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    const headers = await response!.allHeaders();
    const expected = {
      "content-security-policy": [
        "default-src 'self'",
        `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self'",
        "font-src 'self'",
        `connect-src 'self'${development ? " ws: wss:" : ""}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join("; "),
      "x-frame-options": "DENY",
      "referrer-policy": "strict-origin-when-cross-origin",
      "x-content-type-options": "nosniff",
      "permissions-policy": "camera=(), microphone=(), geolocation=()",
    };
    const observed = Object.fromEntries(Object.keys(expected).map((name) => [name, headers[name]]));
    console.log(`${development ? "development" : "production"} ${path}:`, observed);
    await testInfo.attach("security-headers", {
      body: JSON.stringify(observed, null, 2),
      contentType: "application/json",
    });
    expect(observed).toEqual(expected);

    // A server action and rendered update prove that the browser hydrated successfully.
    await page.getByRole("button", { name: "Spanish", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    expect(violations).toEqual([]);
  });
}

test("development overlay and HMR remain available", async ({ page }) => {
  test.skip(!development, "Development server only");
  const frames: string[] = [];
  page.on("websocket", (socket) => {
    if (new URL(socket.url()).pathname === "/_next/hmr") {
      socket.on("framereceived", ({ payload }) => frames.push(payload.toString()));
    }
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Open Next.js Dev Tools", exact: true }),
  ).toBeVisible();
  await expect.poll(() => frames.length).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Open Next.js Dev Tools", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: /Route/ })).toBeVisible();

  // Exercise an actual hot update, restoring the source even if an assertion fails.
  const component = resolve("src/components/header.tsx");
  const original = await readFile(component);
  try {
    await writeFile(
      component,
      original.toString().replace("<header", '<header data-security-headers-hmr="ready"'),
    );
    await expect(page.getByRole("banner")).toHaveAttribute("data-security-headers-hmr", "ready", {
      timeout: 15_000,
    });
  } finally {
    await writeFile(component, original);
  }
});
