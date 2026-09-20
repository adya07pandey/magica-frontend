import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExecutionSteps, MarkdownText } from "../app/components/magica-chat";

describe("message rendering", () => {
  it("renders assistant markdown as structured content", () => {
    render(
      <MarkdownText text={"## Trigonometry\n\n| Function | Ratio |\n| --- | --- |\n| **Sine** | opposite / hypotenuse |"} />,
    );

    expect(screen.getByRole("heading", { name: "Trigonometry" })).toBeVisible();
    expect(screen.getByRole("table")).toBeVisible();
    expect(screen.getByText("Sine").tagName).toBe("STRONG");
  });

  it("groups tool JSON into a collapsed, readable step disclosure", () => {
    render(
      <ExecutionSteps
        hasGeneratedAsset
        blocks={[
          {
            type: "tool_call",
            toolCallId: "choice-1",
            toolName: "request_user_input",
            input: {
              question: "Which video should I exclude?",
              options: [
                { id: "video-1", label: "Italy.mp4", description: "Exclude this video." },
              ],
            },
          },
          {
            type: "tool_result",
            toolCallId: "choice-1",
            toolName: "request_user_input",
            status: "COMPLETED",
            creditsUsed: 0,
            output: {
              status: "RESOLVED",
              resolution: { kind: "option", optionId: "video-1" },
            },
          },
        ]}
      />,
    );

    const disclosure = screen.getByText("Steps").closest("details");
    expect(disclosure).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("Steps").closest("summary")!);
    expect(disclosure).toHaveAttribute("open");
    expect(screen.getAllByText("Italy.mp4")).toHaveLength(2);
    expect(screen.queryByText("video-1")).not.toBeInTheDocument();
    expect(screen.queryByText(/\"status\"/)).not.toBeInTheDocument();
  });
});
