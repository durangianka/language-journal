import { Socket } from "node:net";
import { afterAll, vi } from "vitest";

vi.mock("postgres", () => ({
  default: () => {
    throw new Error("Unit tests must mock the database dependency.");
  },
}));

// Keep the defaults blocked through vi.resetAllMocks/restoreAllMocks too.
const connect = Socket.prototype.connect;
const fetch = globalThis.fetch;
Socket.prototype.connect = () => {
  throw new Error("Unit tests must mock network dependencies.");
};
globalThis.fetch = () => {
  throw new Error("Unit tests must mock fetch.");
};
afterAll(() => {
  Socket.prototype.connect = connect;
  globalThis.fetch = fetch;
});
