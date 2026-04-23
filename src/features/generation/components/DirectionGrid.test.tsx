import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DirectionGrid, DirectionGridSkeleton } from "./DirectionGrid";
import type { Direction } from "@/lib/schemas/direction";

// Mock next/image
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { fill, priority, ...rest } = props;
    return <img data-fill={fill} data-priority={priority} {...rest} />;
  },
}));

// Mock BriefDisplay
vi.mock("./BriefDisplay", () => ({
  BriefDisplay: ({ text }: { text: string }) => (
    <div data-testid="brief-display">{text}</div>
  ),
}));

// Mock DirectionExpanded
vi.mock("./DirectionExpanded", () => ({
  DirectionExpanded: () => <div data-testid="expanded" />,
}));

// Mock window.matchMedia for prefers-reduced-motion
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
});

const createDirection = (id: string, label: string): Direction => ({
  id,
  heroImageUrl: `https://example.com/${id}.webp`,
  moodLabel: label,
  tags: ["tag1", "tag2"],
  supportingImageUrls: ["https://example.com/s1.webp"],
  colorPalette: ["#111", "#222", "#333", "#444", "#555"],
  description: `Description for ${label}`,
});

const mockDirections: Direction[] = [
  createDirection("d1", "Dark cinematic"),
  createDirection("d2", "Ethereal dreamscape"),
  createDirection("d3", "Raw industrial"),
];

describe("DirectionGrid", () => {
  const defaultProps = {
    directions: mockDirections,
    briefText: "A dark aggressive track with industrial vibes",
    selectedDirectionId: null,
    onSelect: vi.fn(),
    isSelectPending: false,
  };

  it("renders the correct number of direction cards", () => {
    render(<DirectionGrid {...defaultProps} />);

    const radios = screen.getAllByRole("radio");
    // Desktop grid (3) + mobile carousel (3)
    expect(radios.length).toBe(6);
  });

  it("displays the brief text via BriefDisplay", () => {
    render(<DirectionGrid {...defaultProps} />);

    expect(screen.getByTestId("brief-display")).toHaveTextContent(
      "A dark aggressive track with industrial vibes"
    );
  });

  it("renders radiogroup containers", () => {
    render(<DirectionGrid {...defaultProps} />);

    const groups = screen.getAllByRole("radiogroup");
    // Desktop + mobile
    expect(groups.length).toBe(2);
  });

  it("does not render 'None of these' when onRecovery is not provided", () => {
    render(<DirectionGrid {...defaultProps} />);

    expect(
      screen.queryByText("None of these -- try a different angle")
    ).not.toBeInTheDocument();
  });

  it("renders 'None of these' as enabled when onRecovery is provided", () => {
    const onRecovery = vi.fn();
    render(<DirectionGrid {...defaultProps} onRecovery={onRecovery} />);

    const noneLink = screen.getByText(
      "None of these -- try a different angle"
    );
    expect(noneLink).not.toBeDisabled();
    noneLink.click();
    expect(onRecovery).toHaveBeenCalledOnce();
  });

  it("hides 'None of these' when a direction is already selected", () => {
    render(
      <DirectionGrid {...defaultProps} selectedDirectionId="d2" onRecovery={vi.fn()} />
    );

    expect(
      screen.queryByText("None of these -- try a different angle")
    ).not.toBeInTheDocument();
  });

  it("renders dot indicators for mobile carousel", () => {
    const { container } = render(<DirectionGrid {...defaultProps} />);

    // Three dot indicators (aria-hidden)
    const dots = container.querySelectorAll("[aria-hidden='true']");
    expect(dots.length).toBe(3);
  });
});

describe("DirectionGridSkeleton", () => {
  it("renders skeleton placeholders", () => {
    const { container } = render(<DirectionGridSkeleton />);
    expect(
      container.querySelectorAll(".animate-pulse").length
    ).toBeGreaterThan(0);
  });
});
