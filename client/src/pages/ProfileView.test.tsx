/**
 * Unit tests for the customer registration form (CustomerForm / ProfileView).
 *
 * Covers:
 *  - Success: submitting a valid mobile + name calls POST /api/customers and
 *    stores the returned customer as the active identity (persisted to
 *    localStorage via CustomerContext).
 *  - INVALID_MOBILE: the server error is surfaced inline next to the field and
 *    no identity is stored.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiClientError } from "../api/client.js";
import * as api from "../api/client.js";
import {
  CustomerProvider,
  CUSTOMER_STORAGE_KEY,
} from "../customer/CustomerContext.js";
import { ProfileView } from "./ProfileView.js";

vi.mock("../api/client.js", async () => {
  const actual = await vi.importActual<typeof import("../api/client.js")>(
    "../api/client.js"
  );
  return { ...actual, registerCustomer: vi.fn() };
});

const registerMock = vi.mocked(api.registerCustomer);

function renderProfile(): void {
  render(
    <CustomerProvider>
      <MemoryRouter>
        <ProfileView />
      </MemoryRouter>
    </CustomerProvider>
  );
}

beforeEach(() => {
  registerMock.mockReset();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("CustomerForm success", () => {
  it("registers and stores the returned customer as the active identity", async () => {
    registerMock.mockResolvedValueOnce({
      mobile: "+919876543210",
      name: "Asha",
    });

    renderProfile();

    fireEvent.change(screen.getByTestId("profile-mobile"), {
      target: { value: "9876543210" },
    });
    fireEvent.change(screen.getByTestId("profile-name"), {
      target: { value: "Asha" },
    });
    fireEvent.click(screen.getByTestId("profile-submit"));

    // Confirmation surfaced.
    expect(await screen.findByTestId("profile-saved")).toHaveTextContent("Asha");

    // Called with the entered values.
    expect(registerMock).toHaveBeenCalledWith({
      mobile: "9876543210",
      name: "Asha",
    });

    // Identity persisted to localStorage (the canonical, normalized mobile).
    const stored = JSON.parse(
      window.localStorage.getItem(CUSTOMER_STORAGE_KEY) ?? "null"
    );
    expect(stored).toMatchObject({ mobile: "+919876543210", name: "Asha" });
  });
});

describe("CustomerForm INVALID_MOBILE", () => {
  it("shows the invalid-mobile error inline and stores no identity", async () => {
    registerMock.mockRejectedValueOnce(
      new ApiClientError(400, "Invalid mobile", "INVALID_MOBILE")
    );

    renderProfile();

    fireEvent.change(screen.getByTestId("profile-mobile"), {
      target: { value: "123" },
    });
    fireEvent.change(screen.getByTestId("profile-name"), {
      target: { value: "Asha" },
    });
    fireEvent.click(screen.getByTestId("profile-submit"));

    expect(await screen.findByTestId("profile-mobile-error")).toHaveTextContent(
      /valid mobile number/i
    );
    expect(window.localStorage.getItem(CUSTOMER_STORAGE_KEY)).toBeNull();
  });
});
