import { describe, expect, it } from "vitest";
import { ApiError } from "./api/client";

describe("ApiError", () => {
  it("stores HTTP status code and message", () => {
    const err = new ApiError("Not found", 404);
    expect(err.message).toBe("Not found");
    expect(err.status).toBe(404);
    expect(err.name).toBe("ApiError");
  });
});
