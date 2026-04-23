import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock tRPC
const mockQueryOptions = vi.fn();
vi.mock("@/lib/trpc/client", () => ({
  useTRPC: () => ({
    package: {
      get: {
        queryOptions: mockQueryOptions,
      },
    },
  }),
}));

// Mock @tanstack/react-query — first call is for package.get, subsequent calls return null data
let useQueryCallCount = 0;
const mockUseQuery = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => {
    useQueryCallCount++;
    if (useQueryCallCount === 1) {
      return mockUseQuery(...args);
    }
    // DirectionSummaryDisplay's useQuery — return null data
    return { data: null, isLoading: false };
  },
}));

// Mock child components
vi.mock("@/features/generation/components/AssetPreview", () => ({
  AssetPreview: ({ deliverable, variant }: { deliverable: { format: string }; variant: string }) => (
    <div data-testid={`asset-${variant}`} data-format={deliverable.format}>
      {variant}
    </div>
  ),
}));

vi.mock("@/features/generation/components/DownloadActions", () => ({
  DownloadActions: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="download-actions" data-session-id={sessionId}>
      Download actions
    </div>
  ),
}));

import { PackageReveal } from "./PackageReveal";

const mockDeliverables = [
  {
    id: "d1",
    format: "cover-spotify",
    url: "https://example.com/cover.jpg",
    fileSizeBytes: 500000,
    width: 3000,
    height: 3000,
    mimeType: "image/jpeg",
  },
  {
    id: "d2",
    format: "instagram-square",
    url: "https://example.com/ig-square.jpg",
    fileSizeBytes: 300000,
    width: 1080,
    height: 1080,
    mimeType: "image/jpeg",
  },
  {
    id: "d3",
    format: "instagram-story",
    url: "https://example.com/ig-story.jpg",
    fileSizeBytes: 400000,
    width: 1080,
    height: 1920,
    mimeType: "image/jpeg",
  },
  {
    id: "d4",
    format: "twitter-header",
    url: "https://example.com/twitter.jpg",
    fileSizeBytes: 200000,
    width: 1500,
    height: 500,
    mimeType: "image/jpeg",
  },
  {
    id: "d5",
    format: "palette",
    url: "https://example.com/palette.png",
    fileSizeBytes: 10000,
    width: 700,
    height: 170,
    mimeType: "image/png",
  },
  {
    id: "d6",
    format: "direction-summary",
    url: "https://example.com/summary.json",
    fileSizeBytes: 500,
    width: null,
    height: null,
    mimeType: "application/json",
  },
];

describe("PackageReveal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useQueryCallCount = 0;
    mockQueryOptions.mockReturnValue({ queryKey: ["package.get"] });
  });

  it("renders all asset types when deliverables are loaded", () => {
    mockUseQuery.mockReturnValue({
      data: { deliverables: mockDeliverables },
      isLoading: false,
    });

    render(
      <PackageReveal sessionId="session-1" briefText="Test brief" />
    );

    expect(screen.getByTestId("asset-cover")).toBeInTheDocument();
    expect(screen.getByTestId("asset-instagram-square")).toBeInTheDocument();
    expect(screen.getByTestId("asset-instagram-story")).toBeInTheDocument();
    expect(screen.getByTestId("asset-twitter-header")).toBeInTheDocument();
    expect(screen.getByTestId("asset-palette")).toBeInTheDocument();
    expect(screen.getByTestId("download-actions")).toBeInTheDocument();
  });

  it("shows loading state while fetching", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    render(
      <PackageReveal sessionId="session-1" briefText="Test brief" />
    );

    expect(screen.getByText("Loading your package...")).toBeInTheDocument();
  });

  it("renders brief text in label section", () => {
    mockUseQuery.mockReturnValue({
      data: { deliverables: mockDeliverables },
      isLoading: false,
    });

    render(
      <PackageReveal sessionId="session-1" briefText="Dark ambient vibes" />
    );

    expect(screen.getByText("Dark ambient vibes")).toBeInTheDocument();
    expect(screen.getByText("Your creative direction")).toBeInTheDocument();
  });

  it("uses animate-reveal class for sequential animation", () => {
    mockUseQuery.mockReturnValue({
      data: { deliverables: mockDeliverables },
      isLoading: false,
    });

    const { container } = render(
      <PackageReveal sessionId="session-1" briefText="Test" />
    );

    const revealElements = container.querySelectorAll(".animate-reveal");
    expect(revealElements.length).toBeGreaterThanOrEqual(5);
  });

  it("with prefers-reduced-motion, animate-reveal class still present (CSS handles visibility)", () => {
    // The reduced motion behavior is handled purely in CSS
    // (.animate-reveal with @media prefers-reduced-motion sets animation: none, opacity: 1)
    // We verify the class is present so CSS can apply the override
    mockUseQuery.mockReturnValue({
      data: { deliverables: mockDeliverables },
      isLoading: false,
    });

    const { container } = render(
      <PackageReveal sessionId="session-1" briefText="Test" />
    );

    const revealElements = container.querySelectorAll(".animate-reveal");
    expect(revealElements.length).toBeGreaterThanOrEqual(5);

    // Each has a --reveal-delay custom property for stagger
    revealElements.forEach((el) => {
      expect(el.getAttribute("style")).toContain("--reveal-delay");
    });
  });
});
