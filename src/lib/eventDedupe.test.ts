import { describe, it, expect } from "vitest";
import { eventTitleKey } from "./eventDedupe";

describe("eventTitleKey", () => {
  it("treats the two Pier 290 Mike VanDyke listings as the same event", () => {
    expect(eventTitleKey("Mike VanDyke @ PIER 290")).toBe(
      eventTitleKey("Live Music: Mike VanDyke – November 19, 2026"),
    );
  });
  it("keeps different acts apart", () => {
    expect(eventTitleKey("Mike VanDyke @ PIER 290")).not.toBe(eventTitleKey("Svett Sauna Experience"));
  });
});
