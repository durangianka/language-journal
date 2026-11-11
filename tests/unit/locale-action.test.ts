import { beforeEach, expect, test, vi } from "vitest";
import { locales } from "../../src/config/locales";
import { setLocale } from "../../src/i18n/actions";

const { setCookie, cookies, refresh } = vi.hoisted(() => ({
  setCookie: vi.fn(),
  cookies: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies }));
vi.mock("next/cache", () => ({ refresh }));

beforeEach(() => {
  vi.clearAllMocks();
  cookies.mockResolvedValue({ set: setCookie });
});

test.each(locales)("the locale action persists %s", async (locale) => {
  const formData = new FormData();
  formData.set("locale", locale);
  await setLocale(formData);
  expect(setCookie).toHaveBeenCalledExactlyOnceWith("locale", locale, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
  });
  expect(refresh).toHaveBeenCalledOnce();
});

test.each([null, "", "fr", "EN", new File(["en"], "locale.txt")])(
  "the locale action ignores invalid input %s",
  async (value) => {
    const formData = new FormData();
    if (value !== null) formData.set("locale", value);
    await expect(setLocale(formData)).resolves.toBeUndefined();
    expect(cookies).not.toHaveBeenCalled();
    expect(setCookie).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  },
);
