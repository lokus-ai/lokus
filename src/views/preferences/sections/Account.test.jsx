import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Account from "./Account.jsx";
import Updates from "./Updates.jsx";
import Import from "./Import.jsx";

const authProps = {
  isLoading: false,
  isGuest: false,
  isAuthenticated: false,
  user: null,
  authMode: "signin",
  setAuthMode: vi.fn(),
  authEmail: "",
  setAuthEmail: vi.fn(),
  authPassword: "",
  setAuthPassword: vi.fn(),
  authConfirmPassword: "",
  setAuthConfirmPassword: vi.fn(),
  authError: "",
  setAuthError: vi.fn(),
  authMessage: "",
  setAuthMessage: vi.fn(),
  authLoading: false,
  setAuthLoading: vi.fn(),
  isSigningOut: false,
  setIsSigningOut: vi.fn(),
  signInWithGoogle: vi.fn(),
  signInWithApple: vi.fn(),
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  resetPassword: vi.fn(),
  signOut: vi.fn(),
  deleteAccount: vi.fn(),
};

describe("Account", () => {
  it("renders the resolving state", () => {
    render(<Account {...authProps} isLoading />);
    expect(screen.getByText(/Checking your account/)).toBeTruthy();
  });

  it("offers guests a way in", () => {
    render(<Account {...authProps} isGuest />);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
  });

  it("renders a labelled email field in every auth mode", () => {
    for (const mode of ["signin", "signup", "reset"]) {
      const { unmount } = render(<Account {...authProps} authMode={mode} />);
      expect(screen.getByLabelText("Email")).toBeTruthy();
      unmount();
    }
  });

  it("blocks submit with an empty email", () => {
    const setAuthError = vi.fn();
    const signInWithEmail = vi.fn();
    const { container } = render(
      <Account {...authProps} setAuthError={setAuthError} signInWithEmail={signInWithEmail} />
    );
    fireEvent.submit(container.querySelector("form"));
    expect(setAuthError).toHaveBeenCalledWith("Enter the email address for your account.");
    expect(signInWithEmail).not.toHaveBeenCalled();
  });

  it("confirms before deleting the account", () => {
    const deleteAccount = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <Account
        {...authProps}
        isAuthenticated
        user={{ name: "Ada", email: "ada@example.com" }}
        deleteAccount={deleteAccount}
      />
    );
    expect(screen.getByText("ada@example.com")).toBeTruthy();
    fireEvent.click(screen.getByText("Delete account"));
    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteAccount).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});

describe("Updates", () => {
  it("shows the version and dispatches a manual check", () => {
    const listener = vi.fn();
    window.addEventListener("check-for-update", listener);
    render(<Updates appVersion="1.2.3" betaUpdates={false} onBetaUpdatesChange={vi.fn()} />);
    expect(screen.getByText("v1.2.3")).toBeTruthy();
    fireEvent.click(screen.getByText("Check for updates now"));
    expect(listener).toHaveBeenCalled();
    window.removeEventListener("check-for-update", listener);
  });

  it("toggles the beta channel through the parent handler", () => {
    const onBetaUpdatesChange = vi.fn();
    render(<Updates appVersion="1.2.3" betaUpdates={false} onBetaUpdatesChange={onBetaUpdatesChange} />);
    fireEvent.click(screen.getByRole("switch", { name: "Beta builds" }));
    expect(onBetaUpdatesChange).toHaveBeenCalledWith(true);
  });
});

describe("Import", () => {
  it("opens the picker from every source", () => {
    const onImport = vi.fn();
    render(<Import onImport={onImport} />);
    for (const name of ["Logseq", "Roam Research", "Obsidian"]) {
      fireEvent.click(screen.getByText(name));
    }
    expect(onImport).toHaveBeenCalledTimes(3);
  });
});
