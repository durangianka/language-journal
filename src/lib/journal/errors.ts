export class JournalFullError extends Error {
  constructor() {
    super("This journal has 10 entries. Start a new journal to keep writing.");
  }
}
