import { describe, it, expect } from "vitest";
import { parseWellsFargoCSV } from "./import-parser";

describe("parseWellsFargoCSV", () => {
  it("parses the modern Wells Fargo export (with header)", () => {
    const csv = [
      `"DATE","DESCRIPTION","AMOUNT","CHECK #","STATUS"`,
      `"05/20/2026","WOODMENHMD       WHMD       260520 WHMD7194952500  MARISSA PRICE","-43.96","","Posted"`,
      `"05/19/2026","Alliance Title a 107580200  260519 6495 S Mistygle Marissa Price","130221.60","","Posted"`,
      `"05/18/2026","CITI CARD ONLINE PAYMENT    260515 422011309772104 JEREMIAH P PRICE","-178.00","","Posted"`,
    ].join("\n");

    const txs = parseWellsFargoCSV(csv);

    expect(txs).toHaveLength(3);
    expect(txs[0]).toMatchObject({
      date: "2026-05-20",
      amount: -43.96,
      description: "WOODMENHMD       WHMD       260520 WHMD7194952500  MARISSA PRICE",
      checkNumber: undefined,
    });
    expect(txs[1].amount).toBe(130221.6);
    expect(txs[2].amount).toBe(-178);
  });

  it("parses the legacy headerless Wells Fargo export", () => {
    const csv = [
      `"01/15/2026","-45.67","*","","WALMART STORE #1234"`,
      `"01/16/2026","100.00","*","","DEPOSIT"`,
    ].join("\n");

    const txs = parseWellsFargoCSV(csv);

    expect(txs).toHaveLength(2);
    expect(txs[0]).toMatchObject({
      date: "2026-01-15",
      amount: -45.67,
      description: "WALMART STORE #1234",
    });
    expect(txs[1].amount).toBe(100);
  });

  it("preserves a check number when present", () => {
    const csv = [
      `"DATE","DESCRIPTION","AMOUNT","CHECK #","STATUS"`,
      `"05/19/2026","HARLAND CLARKE CHECK","-70.00","1234","Posted"`,
    ].join("\n");

    const txs = parseWellsFargoCSV(csv);

    expect(txs[0].checkNumber).toBe("1234");
  });

  it("handles CRLF line endings", () => {
    const csv =
      `"DATE","DESCRIPTION","AMOUNT","CHECK #","STATUS"\r\n` +
      `"05/20/2026","FOO","-1.00","","Posted"\r\n`;

    const txs = parseWellsFargoCSV(csv);

    expect(txs).toHaveLength(1);
    expect(txs[0].amount).toBe(-1);
  });

  it("skips rows whose amount cannot be parsed", () => {
    const csv = [
      `"DATE","DESCRIPTION","AMOUNT","CHECK #","STATUS"`,
      `"05/20/2026","BAD","abc","","Posted"`,
      `"05/19/2026","GOOD","-1.00","","Posted"`,
    ].join("\n");

    const txs = parseWellsFargoCSV(csv);

    expect(txs).toHaveLength(1);
    expect(txs[0].description).toBe("GOOD");
  });
});
