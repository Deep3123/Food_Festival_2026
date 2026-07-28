/**
 * Unit tests for InvestorSection.
 *
 * Covers Req 12.1-12.4: the investor pitch renders all four sections — the
 * vision statement, the revenue model, the growth strategy, and the market
 * traction metrics (total customers served, total revenue, repeat customer
 * percentage).
 */

import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { InvestorSection } from "./InvestorSection.js";

afterEach(() => {
  cleanup();
});

describe("InvestorSection renders all four pitch sections (Req 12.1-12.4)", () => {
  it("renders the vision statement (Req 12.1)", () => {
    render(<InvestorSection />);
    expect(screen.getByTestId("investor-vision")).toBeInTheDocument();
  });

  it("renders the revenue model with product sales, upselling, and combo offers (Req 12.2)", () => {
    render(<InvestorSection />);
    const revenue = screen.getByTestId("investor-revenue-model");
    expect(revenue).toHaveTextContent(/product sales/i);
    expect(revenue).toHaveTextContent(/upselling/i);
    expect(revenue).toHaveTextContent(/combo offers/i);
  });

  it("renders the growth strategy with referral rewards, social media, and flash sales (Req 12.3)", () => {
    render(<InvestorSection />);
    const growth = screen.getByTestId("investor-growth-strategy");
    expect(growth).toHaveTextContent(/referral rewards/i);
    expect(growth).toHaveTextContent(/social media/i);
    expect(growth).toHaveTextContent(/flash sales/i);
  });

  it("renders market traction with customers served, revenue, and repeat percentage (Req 12.4)", () => {
    render(<InvestorSection />);
    const traction = screen.getByTestId("investor-traction");
    expect(traction).toBeInTheDocument();
    expect(screen.getByTestId("traction-customers")).toBeInTheDocument();
    expect(screen.getByTestId("traction-revenue")).toBeInTheDocument();
    expect(screen.getByTestId("traction-repeat")).toBeInTheDocument();
  });
});
