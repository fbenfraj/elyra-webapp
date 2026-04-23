"use client";

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { RecoveryFlow } from "./RecoveryFlow";

describe("RecoveryFlow", () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    isSubmitting: false,
  };

  it("renders heading, pills, text input, and hint text", () => {
    render(<RecoveryFlow {...defaultProps} />);

    expect(
      screen.getByText("Let's try a different angle")
    ).toBeInTheDocument();

    expect(screen.getByText("Grittier?")).toBeInTheDocument();
    expect(screen.getByText("Darker?")).toBeInTheDocument();
    expect(screen.getByText("More abstract?")).toBeInTheDocument();
    expect(screen.getByText("More minimal?")).toBeInTheDocument();
    expect(screen.getByText("More raw?")).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText("Or describe what you're looking for")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "try naming an artist or album that captures what you're after"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Try this angle" })
    ).toBeInTheDocument();
  });

  it("toggles pill selection with aria-pressed", () => {
    render(<RecoveryFlow {...defaultProps} />);

    const grittierPill = screen.getByRole("button", { name: "Grittier?" });
    expect(grittierPill).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(grittierPill);
    expect(grittierPill).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(grittierPill);
    expect(grittierPill).toHaveAttribute("aria-pressed", "false");
  });

  it("allows multiple pills to be selected", () => {
    render(<RecoveryFlow {...defaultProps} />);

    const grittierPill = screen.getByRole("button", { name: "Grittier?" });
    const darkerPill = screen.getByRole("button", { name: "Darker?" });

    fireEvent.click(grittierPill);
    fireEvent.click(darkerPill);

    expect(grittierPill).toHaveAttribute("aria-pressed", "true");
    expect(darkerPill).toHaveAttribute("aria-pressed", "true");
  });

  it("disables submit button when no pills selected and text is empty", () => {
    render(<RecoveryFlow {...defaultProps} />);

    const submitButton = screen.getByRole("button", { name: "Try this angle" });
    expect(submitButton).toBeDisabled();
  });

  it("enables submit button when a pill is selected", () => {
    render(<RecoveryFlow {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Grittier?" }));

    const submitButton = screen.getByRole("button", { name: "Try this angle" });
    expect(submitButton).not.toBeDisabled();
  });

  it("enables submit button when text is entered", () => {
    render(<RecoveryFlow {...defaultProps} />);

    const input = screen.getByPlaceholderText(
      "Or describe what you're looking for"
    );
    fireEvent.change(input, { target: { value: "like Arca album covers" } });

    const submitButton = screen.getByRole("button", { name: "Try this angle" });
    expect(submitButton).not.toBeDisabled();
  });

  it("calls onSubmit with pills and text when submitted", () => {
    const onSubmit = vi.fn();
    render(<RecoveryFlow {...defaultProps} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Grittier?" }));
    fireEvent.click(screen.getByRole("button", { name: "Darker?" }));

    const input = screen.getByPlaceholderText(
      "Or describe what you're looking for"
    );
    fireEvent.change(input, { target: { value: "more industrial" } });

    fireEvent.click(screen.getByRole("button", { name: "Try this angle" }));

    expect(onSubmit).toHaveBeenCalledWith({
      selectedPills: ["Grittier?", "Darker?"],
      refinementText: "more industrial",
    });
  });

  it("disables submit button when isSubmitting is true", () => {
    render(<RecoveryFlow {...defaultProps} isSubmitting={true} />);

    fireEvent.click(screen.getByRole("button", { name: "Grittier?" }));

    const submitButton = screen.getByRole("button", { name: "Try this angle" });
    expect(submitButton).toBeDisabled();
  });
});
