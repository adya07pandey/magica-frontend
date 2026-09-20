import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExecutionSteps, MarkdownText, RunActivity, StopButton } from "../app/components/magica-chat";

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

  it("replaces Thinking with partial Markdown as soon as text streams", () => {
    const { rerender } = render(
      <RunActivity run={{ id: "run-1", status: "RUNNING", steps: [] }} />,
    );
    expect(screen.getByText("Thinking")).toBeVisible();

    rerender(
      <RunActivity
        run={{
          id: "run-1",
          status: "RUNNING",
          steps: [
            {
              id: "step-1",
              stepNumber: 1,
              type: "MODEL_CALL",
              name: "Initial model call",
              status: "RUNNING",
              output: { content: "## Geometry\n\nAngles and shapes" },
            },
          ],
        }}
      />,
    );

    expect(screen.queryByText("Thinking")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Geometry" })).toBeVisible();
    expect(screen.getByText("Angles and shapes")).toBeVisible();
  });

  it("turns the send control into an actionable stop button", () => {
    let stopped = false;
    const { rerender } = render(
      <StopButton stopping={false} onStop={() => { stopped = true; }} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Stop generating" }));
    expect(stopped).toBe(true);

    rerender(<StopButton stopping onStop={() => undefined} />);
    expect(screen.getByRole("button", { name: "Stopping run" })).toBeDisabled();
  });
});
