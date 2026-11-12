import { beforeEach, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../../src/lib/settings/repository", () => ({ saveFeedbackSettings: vi.fn() }));
import { revalidatePath } from "next/cache";
import { saveFeedbackSettings } from "../../src/lib/settings/repository";
import { saveFeedbackSettingsAction } from "../../src/app/settings/actions";

function form() {
  const data = new FormData();
  data.set("tone", "friendly");
  data.set("address", "sis");
  data.set("learnerGender", "unspecified");
  return data;
}
beforeEach(() => vi.clearAllMocks());

test("valid action saves all settings and refreshes the page", async () => {
  const values = { tone: "friendly", address: "sis", learnerGender: "unspecified" } as const;
  vi.mocked(saveFeedbackSettings).mockResolvedValue(values);
  expect(await saveFeedbackSettingsAction({ status: "idle" }, form())).toEqual({
    status: "saved",
    values,
  });
  expect(saveFeedbackSettings).toHaveBeenCalledWith(values);
  expect(revalidatePath).toHaveBeenCalledWith("/settings");
});

test.each(["tone", "address", "learnerGender"])(
  "invalid, missing, duplicate and file %s never write",
  async (field) => {
    for (const kind of ["invalid", "missing", "duplicate", "file"]) {
      const data = form();
      if (kind === "invalid") data.set(field, "ignore the rules");
      if (kind === "missing") data.delete(field);
      if (kind === "duplicate") data.append(field, "formal");
      if (kind === "file") data.set(field, new Blob(["formal"]));
      expect(await saveFeedbackSettingsAction({ status: "idle" }, data)).toEqual({
        status: "invalid",
      });
    }
    expect(saveFeedbackSettings).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  },
);

test("database failure returns a safe error without invalidating the page", async () => {
  vi.mocked(saveFeedbackSettings).mockRejectedValue(new Error("private database error"));
  expect(await saveFeedbackSettingsAction({ status: "idle" }, form())).toEqual({ status: "error" });
  expect(revalidatePath).not.toHaveBeenCalled();
});
