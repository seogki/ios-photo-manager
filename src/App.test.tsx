import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { routeTree } from "./routeTree.gen";

function createScanResult(pairCount: number) {
  return {
    folder: "C:\\photos",
    totalFiles: 10,
    pairCount,
    orphanPhotos: 1,
    orphanVideos: 2,
    previews: [],
  };
}

async function renderApp(initialEntries: string[] = ["/"]) {
  const history = createMemoryHistory({ initialEntries });
  const router = createRouter({ routeTree, history });
  await router.load();
  return render(<RouterProvider router={router} />);
}

describe("App", () => {
  beforeEach(() => {
    window.livePhotoApi = {
      pickFolder: vi.fn().mockResolvedValue("C:\\photos"),
      scan: vi.fn().mockResolvedValue(createScanResult(2)),
      analyzeFolder: vi.fn().mockResolvedValue({
        scan: createScanResult(2),
        locations: {
          folder: "C:\\photos",
          totalCandidates: 0,
          located: 0,
          locatedPhotos: 0,
          locatedVideos: 0,
          items: [],
        },
      }),
      process: vi.fn().mockResolvedValue({
        folder: "C:\\photos",
        action: "move-video",
        processed: 2,
        failed: [],
      }),
      getMediaLocations: vi.fn().mockResolvedValue({
        folder: "C:\\photos",
        totalCandidates: 0,
        located: 0,
        locatedPhotos: 0,
        locatedVideos: 0,
        items: [],
      }),
      getFileThumbnail: vi.fn().mockResolvedValue({
        ok: false,
      }),
      getVideoThumbnail: vi.fn().mockResolvedValue({
        ok: false,
      }),
    };
  });

  it("처리 방식 안내 문구를 보여준다", async () => {
    await renderApp();

    expect(screen.getByText("처리 방식 안내")).toBeInTheDocument();
    expect(
      screen.getByText(/_livephoto_videos/, { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByText(/즉시 삭제합니다/)).toBeInTheDocument();
  });

  it("폴더 선택 후 스캔 결과를 표시하고 처리 버튼을 활성화한다", async () => {
    await renderApp();

    const moveButton = screen.getByRole("button", { name: "동영상 이동" });
    const deleteButton = screen.getByRole("button", { name: "동영상 삭제" });
    expect(moveButton).toBeDisabled();
    expect(deleteButton).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "폴더 선택" }));

    await waitFor(() => {
      expect(window.livePhotoApi.analyzeFolder).toHaveBeenCalledWith("C:\\photos");
    });
    expect(
      await screen.findByText(
        (_, element) => element?.textContent === "라이브쌍2",
      ),
    ).toBeInTheDocument();
    expect(moveButton).toBeEnabled();
    expect(deleteButton).toBeEnabled();
  });
});
