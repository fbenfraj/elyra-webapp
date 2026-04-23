import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CreativeProcessLoader } from "./CreativeProcessLoader";

describe("CreativeProcessLoader", () => {
  it("renders standard narrative in normal state", () => {
    render(
      <CreativeProcessLoader briefText="A moody album cover" />
    );
    expect(screen.getByText("A moody album cover")).toBeInTheDocument();
    expect(screen.getByText("Interpreting your vision...")).toBeInTheDocument();
  });

  it("shows delayed message when timeoutLevel is delayed", () => {
    render(
      <CreativeProcessLoader
        briefText="A moody album cover"
        timeoutLevel="delayed"
      />
    );
    expect(
      screen.getByText("Taking a bit longer than usual...")
    ).toBeInTheDocument();
  });

  it("shows extended message with retry button when timeoutLevel is extended", () => {
    const onRetry = vi.fn();
    render(
      <CreativeProcessLoader
        briefText="A moody album cover"
        timeoutLevel="extended"
        onRetry={onRetry}
      />
    );
    expect(
      screen.getByText(/We hit a snag/)
    ).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: /try again/i });
    expect(retryButton).toBeInTheDocument();
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("does not show retry button in extended state without onRetry", () => {
    render(
      <CreativeProcessLoader
        briefText="A moody album cover"
        timeoutLevel="extended"
      />
    );
    expect(
      screen.queryByRole("button", { name: /try again/i })
    ).not.toBeInTheDocument();
  });

  it("never includes provider names or error codes in any state", () => {
    const { container: normal } = render(
      <CreativeProcessLoader briefText="test" timeoutLevel="normal" />
    );
    const { container: delayed } = render(
      <CreativeProcessLoader briefText="test" timeoutLevel="delayed" />
    );
    const { container: extended } = render(
      <CreativeProcessLoader briefText="test" timeoutLevel="extended" />
    );

    const allText = [normal, delayed, extended]
      .map((c) => c.textContent ?? "")
      .join(" ")
      .toLowerCase();

    expect(allText).not.toContain("fal");
    expect(allText).not.toContain("openai");
    expect(allText).not.toContain("gpt");
    expect(allText).not.toContain("error code");
    expect(allText).not.toContain("500");
    expect(allText).not.toContain("timeout");
  });
});
