import { describe, expect, it } from "vitest";

import { fieldTone } from "./field-map.rules";

describe("fieldTone (region map colours)", () => {
  it("marks fields with any open booking as open", () => {
    expect(fieldTone(["verified", "assigned"])).toBe("open");
    expect(fieldTone(["requested"])).toBe("open");
  });

  it("marks recently sprayed fields as done", () => {
    expect(fieldTone(["completed"])).toBe("done");
    expect(fieldTone(["verified", "verified"])).toBe("done");
  });

  it("leaves other fields neutral", () => {
    expect(fieldTone([])).toBe("neutral");
    expect(fieldTone(["cancelled", "rejected"])).toBe("neutral");
  });
});
