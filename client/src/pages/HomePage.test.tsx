/**
 * Unit tests for HomePage content and navigation routing.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HomePage } from "./HomePage.js";
import { ROUTES } from "../routes.js";

/**
 * Render HomePage inside a MemoryRouter whose sibling routes render
 * identifiable content, so a button click can be verified by asserting the
 * destination content appears.
 */
function renderHome(): void {
  render(
    <MemoryRouter initialEntries={[ROUTES.home]}>
      <Routes>
        <Route path={ROUTES.home} element={<HomePage />} />
        <Route
          path={ROUTES.marketplace}
          element={<div>MARKETPLACE PAGE</div>}
        />
        <Route path={ROUTES.trending} element={<div>TRENDING PAGE</div>} />
        <Route path={ROUTES.investor} element={<div>INVESTOR PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("HomePage content", () => {
  it("renders the hero heading (Req 1.1)", () => {
    renderHome();
    expect(
      screen.getByRole("heading", { name: "Welcome to Invest-a-Bite" })
    ).toBeInTheDocument();
  });

  it("renders the hero subheading (Req 1.1)", () => {
    renderHome();
    expect(
      screen.getByText("Where food meets fintech innovation.")
    ).toBeInTheDocument();
  });

  it("renders the tagline (Req 1.6)", () => {
    renderHome();
    expect(
      screen.getByText("Invest in Taste. Earn in Happiness.")
    ).toBeInTheDocument();
  });

  it("renders the three navigation buttons (Req 1.2)", () => {
    renderHome();
    expect(
      screen.getByRole("button", { name: "Order Now" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Trending Foods" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Investor Dashboard" })
    ).toBeInTheDocument();
  });
});

describe("HomePage navigation", () => {
  it("navigates to the Marketplace when Order Now is clicked (Req 1.3)", () => {
    renderHome();
    fireEvent.click(screen.getByRole("button", { name: "Order Now" }));
    expect(screen.getByText("MARKETPLACE PAGE")).toBeInTheDocument();
  });

  it("navigates to the Trending Board when Trending Foods is clicked (Req 1.4)", () => {
    renderHome();
    fireEvent.click(screen.getByRole("button", { name: "Trending Foods" }));
    expect(screen.getByText("TRENDING PAGE")).toBeInTheDocument();
  });

  it("navigates to the Investor Section when Investor Dashboard is clicked (Req 1.5)", () => {
    renderHome();
    fireEvent.click(
      screen.getByRole("button", { name: "Investor Dashboard" })
    );
    expect(screen.getByText("INVESTOR PAGE")).toBeInTheDocument();
  });
});
