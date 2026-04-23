import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PaywallModal } from "./PaywallModal";
import { packConfig } from "@/config/pricing";

// Mock @base-ui/react/dialog to avoid portal/focus-trap in tests
vi.mock("@base-ui/react/dialog", () => {
  const Dialog = {
    Root: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
      open ? <div data-testid="dialog-root">{children}</div> : null,
    Trigger: ({ children, ...props }: Record<string, unknown>) => (
      <button {...props}>{children as React.ReactNode}</button>
    ),
    Portal: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="dialog-portal">{children}</div>
    ),
    Backdrop: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
      <div data-testid="dialog-backdrop" className={className}>
        {children}
      </div>
    ),
    Popup: ({
      children,
      className,
      ...props
    }: {
      children: React.ReactNode;
      className?: string;
      onTouchStart?: React.TouchEventHandler;
      onTouchEnd?: React.TouchEventHandler;
    }) => (
      <div data-testid="dialog-popup" className={className} {...props}>
        {children}
      </div>
    ),
    Close: ({ children, ...props }: Record<string, unknown>) => (
      <button {...props}>{children as React.ReactNode}</button>
    ),
    Title: ({
      children,
      className,
    }: {
      children: React.ReactNode;
      className?: string;
    }) => (
      <h2 data-testid="dialog-title" className={className}>
        {children}
      </h2>
    ),
    Description: ({
      children,
      className,
    }: {
      children: React.ReactNode;
      className?: string;
    }) => (
      <p data-testid="dialog-description" className={className}>
        {children}
      </p>
    ),
  };
  return { Dialog };
});

describe("PaywallModal", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onUnlock: vi.fn(),
  };

  it("renders correct heading", () => {
    render(<PaywallModal {...defaultProps} />);
    expect(
      screen.getByText("Unlock your release package")
    ).toBeInTheDocument();
  });

  it("renders price from config", () => {
    render(<PaywallModal {...defaultProps} />);
    expect(screen.getByText(packConfig.priceDisplay)).toBeInTheDocument();
  });

  it("renders all included features from config", () => {
    render(<PaywallModal {...defaultProps} />);
    for (const item of packConfig.includes) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });

  it("renders regeneration limit from config", () => {
    render(<PaywallModal {...defaultProps} />);
    expect(
      screen.getByText(
        `Includes ~${packConfig.regenLimit} regenerations within this direction`
      )
    ).toBeInTheDocument();
  });

  it("renders Unlock CTA button", () => {
    render(<PaywallModal {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Unlock" })
    ).toBeInTheDocument();
  });

  it("calls onUnlock when CTA is clicked", () => {
    const onUnlock = vi.fn();
    render(<PaywallModal {...defaultProps} onUnlock={onUnlock} />);
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    expect(onUnlock).toHaveBeenCalledOnce();
  });

  it("does not render when open is false", () => {
    render(<PaywallModal {...defaultProps} open={false} />);
    expect(screen.queryByText("Unlock your release package")).not.toBeInTheDocument();
  });

  it("shows loading state when isLoading is true", () => {
    render(<PaywallModal {...defaultProps} isLoading={true} />);
    const button = screen.getByRole("button", { name: "Processing..." });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it("shows error message when error is provided", () => {
    render(
      <PaywallModal
        {...defaultProps}
        error="Payment didn't go through. Try a different card?"
      />
    );
    expect(
      screen.getByText("Payment didn't go through. Try a different card?")
    ).toBeInTheDocument();
  });

  it("does not call onUnlock when loading", () => {
    const onUnlock = vi.fn();
    render(<PaywallModal {...defaultProps} onUnlock={onUnlock} isLoading={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Processing..." }));
    expect(onUnlock).not.toHaveBeenCalled();
  });
});
