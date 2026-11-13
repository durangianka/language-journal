export class JevHttpError extends Error {
  constructor(public readonly status: number) {
    super("Jev request failed");
  }
}
