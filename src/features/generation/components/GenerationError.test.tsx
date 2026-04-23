import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GenerationError } from "./GenerationError";

describe("GenerationError", () => {
  it("renders inline with default message", () => {
    render(<GenerationError />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText("Something went wrong. Try again?")
    ).toBeInTheDocument();
  });

  it("shows retry button when canRetry is true", () => {
    const onRetry = vi.fn();
    render(<GenerationError canRetry onRetry={onRetry} />);
    const button = screen.getByRole("button", { name: /try again/i });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows edit brief button when showEditBrief is true", () => {
    const onEditBrief = vi.fn();
    render(
      <GenerationError
        canRetry={false}
        showEditBrief
        onEditBrief={onEditBrief}
      />
    );
    expect(
      screen.queryByRole("button", { name: /try again/i })
    ).not.toBeInTheDocument();
    const editButton = screen.getByRole("button", { name: /edit your brief/i });
    expect(editButton).toBeInTheDocument();
    fireEvent.click(editButton);
    expect(onEditBrief).toHaveBeenCalledOnce();
  });

  it("shows dimmed brief context when briefText is provided", () => {
    render(<GenerationError briefText="A dark moody cover" />);
    expect(screen.getByText("A dark moody cover")).toBeInTheDocument();
    expect(screen.getByText("Your brief")).toBeInTheDocument();
  });

  it("renders custom message", () => {
    render(
      <GenerationError message="We couldn't generate that image. Try adjusting your brief." />
    );
    expect(
      screen.getByText(
        "We couldn't generate that image. Try adjusting your brief."
      )
    ).toBeInTheDocument();
  });

  it("never contains provider names or technical details", () => {
    const { container } = render(
      <GenerationError
        message="Something went wrong. Try again?"
        briefText="test brief"
      />
    );
    const text = (container.textContent ?? "").toLowerCase();
    expect(text).not.toContain("fal");
    expect(text).not.toContain("openai");
    expect(text).not.toContain("gpt");
    expect(text).not.toContain("500");
    expect(text).not.toContain("error code");
    expect(text).not.toContain("api");
  });
});
