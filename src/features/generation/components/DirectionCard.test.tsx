import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DirectionCard, DirectionCardSkeleton } from "./DirectionCard";
import type { Direction } from "@/lib/schemas/direction";

// Mock next/image
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { fill, priority, ...rest } = props;
    return <img data-fill={fill} data-priority={priority} {...rest} />;
  },
}));

// Mock DirectionExpanded
vi.mock("./DirectionExpanded", () => ({
  DirectionExpanded: ({ onSelect }: { onSelect: (e: React.MouseEvent) => void }) => (
    <div data-testid="expanded">
      <button onClick={onSelect}>Choose this direction</button>
    </div>
  ),
}));

const mockDirection: Direction = {
  id: "dir-1",
  heroImageUrl: "https://example.com/hero.webp",
  moodLabel: "Dark cinematic / urban isolation",
  tags: ["gritty", "night", "analog"],
  supportingImageUrls: [
    "https://example.com/s1.webp",
    "https://example.com/s2.webp",
  ],
  colorPalette: ["#1a1a2e", "#16213e", "#0f3460", "#e94560", "#533483"],
  description: "A dark, moody direction with cinematic urban imagery.",
};

describe("DirectionCard", () => {
  const defaultProps = {
    direction: mockDirection,
    index: 0,
    isExpanded: false,
    isSelected: false,
    isDimmed: false,
    onToggleExpand: vi.fn(),
    onSelect: vi.fn(),
    isSelectPending: false,
  };

  it("renders mood label and tags", () => {
    render(<DirectionCard {...defaultProps} />);

    expect(
      screen.getByText("Dark cinematic / urban isolation")
    ).toBeInTheDocument();
    expect(screen.getByText("gritty")).toBeInTheDocument();
    expect(screen.getByText("night")).toBeInTheDocument();
    expect(screen.getByText("analog")).toBeInTheDocument();
  });

  it("renders hero image with correct alt text", () => {
    render(<DirectionCard {...defaultProps} />);

    const img = screen.getByRole("img", {
      name: "Dark cinematic / urban isolation direction -- gritty, night, analog",
    });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/hero.webp");
  });

  it("has correct ARIA attributes", () => {
    render(<DirectionCard {...defaultProps} />);

    const card = screen.getByRole("radio");
    expect(card).toHaveAttribute("aria-checked", "false");
    expect(card).toHaveAttribute(
      "aria-label",
      "Dark cinematic / urban isolation direction -- gritty, night, analog"
    );
  });

  it("calls onToggleExpand on click", () => {
    const onToggleExpand = vi.fn();
    render(
      <DirectionCard {...defaultProps} onToggleExpand={onToggleExpand} />
    );

    fireEvent.click(screen.getByRole("radio"));
    expect(onToggleExpand).toHaveBeenCalledOnce();
  });

  it("calls onToggleExpand on Enter key", () => {
    const onToggleExpand = vi.fn();
    render(
      <DirectionCard {...defaultProps} onToggleExpand={onToggleExpand} />
    );

    fireEvent.keyDown(screen.getByRole("radio"), { key: "Enter" });
    expect(onToggleExpand).toHaveBeenCalledOnce();
  });

  it("calls onToggleExpand on Space key", () => {
    const onToggleExpand = vi.fn();
    render(
      <DirectionCard {...defaultProps} onToggleExpand={onToggleExpand} />
    );

    fireEvent.keyDown(screen.getByRole("radio"), { key: " " });
    expect(onToggleExpand).toHaveBeenCalledOnce();
  });

  it("shows expanded section when isExpanded is true", () => {
    render(<DirectionCard {...defaultProps} isExpanded={true} />);

    expect(screen.getByTestId("expanded")).toBeInTheDocument();
    expect(screen.getByRole("radio").dataset.expanded).toBeDefined();
  });

  it("hides expanded section when isExpanded is false", () => {
    render(<DirectionCard {...defaultProps} isExpanded={false} />);

    expect(screen.queryByTestId("expanded")).not.toBeInTheDocument();
    expect(screen.getByRole("radio").dataset.expanded).toBeUndefined();
  });

  it("reflects selected state via aria-checked and data attribute", () => {
    render(<DirectionCard {...defaultProps} isSelected={true} />);

    const card = screen.getByRole("radio");
    expect(card).toHaveAttribute("aria-checked", "true");
    expect(card.dataset.selected).toBeDefined();
  });

  it("applies dimmed state", () => {
    render(<DirectionCard {...defaultProps} isDimmed={true} />);

    const card = screen.getByRole("radio");
    expect(card.dataset.dimmed).toBeDefined();
    expect(card.style.opacity).toBe("0.6");
  });
});

describe("DirectionCardSkeleton", () => {
  it("renders a skeleton placeholder", () => {
    const { container } = render(<DirectionCardSkeleton />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });
});
