import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ImageSelection } from "./ImageSelection";

// Mock tRPC
const mockMutate = vi.fn();
vi.mock("@/lib/trpc/client", () => ({
  useTRPC: () => ({
    generation: {
      selectImage: {
        mutationOptions: () => ({
          mutationFn: mockMutate,
        }),
      },
    },
    feedback: {
      getLikes: {
        queryOptions: () => ({
          queryKey: ["feedback", "getLikes"],
          queryFn: vi.fn().mockResolvedValue([]),
        }),
        queryKey: () => ["feedback", "getLikes"],
      },
      like: {
        mutationOptions: () => ({
          mutationFn: mockMutate,
        }),
      },
    },
  }),
}));

// Mock tanstack react-query
vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: Record<string, unknown>) => ({
    mutate: mockMutate,
    isPending: false,
  }),
  useQuery: () => ({ data: [], isLoading: false }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

// Mock CreativeProcessLoader
vi.mock("@/features/generation/components/CreativeProcessLoader", () => ({
  CreativeProcessLoader: ({ briefText }: { briefText: string }) => (
    <div data-testid="loader">{briefText}</div>
  ),
}));

const mockImages = [
  { id: "img-1", imageUrl: "https://example.com/1.webp", batchNumber: 1 },
  { id: "img-2", imageUrl: "https://example.com/2.webp", batchNumber: 1 },
  { id: "img-3", imageUrl: "https://example.com/3.webp", batchNumber: 2 },
];

const defaultProps = {
  sessionId: "session-1",
  briefText: "A dark cinematic cover",
  images: mockImages,
  canRegenerate: true,
  regenCount: 0,
  maxRegens: 3,
  isRegenerating: false,
  onRegenerate: vi.fn(),
  onConfirm: vi.fn(),
  isConfirmPending: false,
};

describe("ImageSelection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with pre-selected first image", () => {
    render(<ImageSelection {...defaultProps} />);

    // Hero image should be the first image
    const heroImg = screen.getByAltText("Selected cover art");
    expect(heroImg).toHaveAttribute("src", "https://example.com/1.webp");
  });

  it("renders all curated images in the selection row", () => {
    render(<ImageSelection {...defaultProps} />);

    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBe(3);
  });

  it("clicking image updates selection state", () => {
    render(<ImageSelection {...defaultProps} />);

    const radios = screen.getAllByRole("radio");
    // Click the second image
    fireEvent.click(radios[1]!);

    // The second radio should now be checked
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
  });

  it("shows 'Your strongest options' when images span multiple batches", () => {
    render(<ImageSelection {...defaultProps} />);

    expect(screen.getByText("Your strongest options")).toBeInTheDocument();
  });

  it("does not show multi-batch label for single batch", () => {
    const singleBatchImages = [
      { id: "img-1", imageUrl: "https://example.com/1.webp", batchNumber: 1 },
      { id: "img-2", imageUrl: "https://example.com/2.webp", batchNumber: 1 },
    ];

    render(<ImageSelection {...defaultProps} images={singleBatchImages} />);

    expect(screen.queryByText("Your strongest options")).not.toBeInTheDocument();
  });

  it("shows Regenerate button when canRegenerate is true", () => {
    render(<ImageSelection {...defaultProps} />);

    expect(screen.getByText("Regenerate")).toBeInTheDocument();
  });

  it("hides Regenerate button when canRegenerate is false", () => {
    render(
      <ImageSelection
        {...defaultProps}
        canRegenerate={false}
        regenCount={3}
        maxRegens={3}
      />
    );

    expect(screen.queryByText("Regenerate")).not.toBeInTheDocument();
    expect(
      screen.getByText("These are your strongest options")
    ).toBeInTheDocument();
  });

  it("calls onRegenerate when Regenerate is clicked", () => {
    const onRegenerate = vi.fn();
    render(<ImageSelection {...defaultProps} onRegenerate={onRegenerate} />);

    fireEvent.click(screen.getByText("Regenerate"));
    expect(onRegenerate).toHaveBeenCalledOnce();
  });

  it("calls onConfirm when Use this image is clicked", () => {
    const onConfirm = vi.fn();
    render(<ImageSelection {...defaultProps} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByText("Use this image"));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("dims hero image during regeneration", () => {
    render(<ImageSelection {...defaultProps} isRegenerating={true} />);

    const heroImg = screen.getByAltText("Selected cover art");
    expect(heroImg.style.opacity).toBe("0.4");
  });

  it("shows loader during regeneration", () => {
    render(<ImageSelection {...defaultProps} isRegenerating={true} />);

    expect(screen.getByTestId("loader")).toBeInTheDocument();
  });

  it("hides Regenerate during regeneration", () => {
    render(<ImageSelection {...defaultProps} isRegenerating={true} />);

    expect(screen.queryByText("Regenerate")).not.toBeInTheDocument();
  });

  it("renders radiogroup for keyboard navigation", () => {
    render(<ImageSelection {...defaultProps} />);

    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
  });

  // Heart/Like feature tests
  it("renders heart icons on each image thumbnail", () => {
    render(<ImageSelection {...defaultProps} />);

    const heartButtons = screen.getAllByRole("button", {
      name: /like this image/i,
    });
    expect(heartButtons).toHaveLength(3);
  });

  it("heart click does not trigger image selection change", () => {
    render(<ImageSelection {...defaultProps} />);

    // First image is auto-selected. Click heart on second image.
    const heartButtons = screen.getAllByRole("button", {
      name: /like this image/i,
    });
    fireEvent.click(heartButtons[1]!);

    // First image should still be selected (hero)
    const heroImg = screen.getByAltText("Selected cover art");
    expect(heroImg).toHaveAttribute("src", "https://example.com/1.webp");
  });

  it("heart icons have accessible aria-labels", () => {
    render(<ImageSelection {...defaultProps} />);

    const likeButtons = screen.getAllByRole("button", {
      name: /like this image/i,
    });
    expect(likeButtons.length).toBe(3);
    likeButtons.forEach((btn) => {
      expect(btn).toHaveAttribute("aria-label", "Like this image");
    });
  });
});
