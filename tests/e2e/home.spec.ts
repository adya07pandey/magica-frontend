import { expect, test } from "playwright/test";

test("renders the Magica workspace", async ({ page }) => {
  await page.goto("/chat");
  await expect(page.getByRole("heading", { name: "Your AI worker" })).toBeVisible();
  await expect(page.getByPlaceholder("Assign a task or ask anything...")).toBeVisible();
  await expect(page.getByText("Magica Auto")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/sign-in",
  );
  await expect(page.getByRole("link", { name: "Sign up" })).toHaveAttribute(
    "href",
    "/sign-up",
  );
});
