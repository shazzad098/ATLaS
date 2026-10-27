import { computeFeeBase } from "./order-side-effects";

describe("computeFeeBase", () => {
  it("sums line totals net of discounts and refunds", () => {
    const base = computeFeeBase([
      { lineTotal: "1000.00", discountTotal: "0.00", quantity: 2, refundedQty: 0 },
      { lineTotal: "500.00", discountTotal: "100.00", quantity: 1, refundedQty: 0 },
    ]);
    // 1000.00 (no refund) + 400.00 = 1400.00
    expect(base).toBe("1400.00");
  });

  it("excludes fully refunded lines and prorates partial refunds", () => {
    const base = computeFeeBase([
      { lineTotal: "1000.00", discountTotal: "0.00", quantity: 4, refundedQty: 3 },
    ]);
    // keep 1 of 4 -> 250.00
    expect(base).toBe("250.00");
  });

  it("never returns a negative base", () => {
    const base = computeFeeBase([
      { lineTotal: "100.00", discountTotal: "200.00", quantity: 1, refundedQty: 0 },
    ]);
    expect(base).toBe("0.00");
  });
});
