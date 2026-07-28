/**
 * Unit tests for MetricsDashboard.
 *
 * Covers Req 7.1: the dashboard renders all five metric fields — Total Orders
 * Today, Revenue Generated, Digital Payment Percentage, Best Selling Product,
 * and Customer Satisfaction Score — from the polled getMetrics result.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Metrics } from "../../../types/index.js";
import * as api from "../api/client.js";
import { MetricsDashboard } from "./MetricsDashboard.js";

vi.mock("../api/client.js", async () => {
  const actual = await vi.importActual<typeof import("../api/client.js")>(
    "../api/client.js"
  );
  return { ...actual, getMetrics: vi.fn() };
});

const getMetricsMock = vi.mocked(api.getMetrics);

const sampleMetrics: Metrics = {
  totalOrdersToday: 42,
  revenueGenerated: 8750,
  digitalPaymentPercentage: 88,
  bestSellingProduct: "Paneer Tikka",
  customerSatisfactionScore: 4.6,
};

beforeEach(() => {
  getMetricsMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("MetricsDashboard renders all five metrics (Req 7.1)", () => {
  it("renders Total Orders Today, Revenue, Digital Payment %, Best Selling Product, and Satisfaction", async () => {
    getMetricsMock.mockResolvedValue(sampleMetrics);

    render(<MetricsDashboard />);

    const totalOrders = await screen.findByTestId("metric-total-orders");
    expect(totalOrders).toHaveTextContent("Total Orders Today");
    expect(totalOrders).toHaveTextContent("42");

    const revenue = screen.getByTestId("metric-revenue");
    expect(revenue).toHaveTextContent("Revenue Generated");
    expect(revenue).toHaveTextContent("₹8750.00");

    const digital = screen.getByTestId("metric-digital-payment");
    expect(digital).toHaveTextContent("Digital Payment Percentage");
    expect(digital).toHaveTextContent("88%");

    const bestSelling = screen.getByTestId("metric-best-selling");
    expect(bestSelling).toHaveTextContent("Best Selling Product");
    expect(bestSelling).toHaveTextContent("Paneer Tikka");

    const satisfaction = screen.getByTestId("metric-satisfaction");
    expect(satisfaction).toHaveTextContent("Customer Satisfaction Score");
    expect(satisfaction).toHaveTextContent("4.6 / 5");
  });
});
