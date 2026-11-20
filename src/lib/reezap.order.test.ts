import { describe, expect, it } from "vitest";
import { orderMessage } from "./reezap";

describe("orderMessage", () => {
  it("asks availability with neighborhood", () => {
    expect(orderMessage("Ndolé", { price: 2000, place: "Molyko" })).toContain("Is it still available in Molyko?");
  });
  it("10% offer rounds to nearest 50 FCFA", () => {
    expect(orderMessage("Shoes", { price: 15000, offer: { percent: 10 } })).toMatch(/13[\s,.\u202f]?500/);
  });
  it("15% offer", () => {
    expect(orderMessage("Shoes", { price: 10000, offer: { percent: 15 } })).toMatch(/8[\s,.\u202f]?500/);
  });
});
