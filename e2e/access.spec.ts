import { expect, test } from "@playwright/test";

/**
 * Access-control smoke tests. The first group needs only a running app (no session, so no database lookups).
 * The second group needs a seeded database and an administrator created with `npm run create-admin`;
 * set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to enable it.
 */
test.describe("unauthenticated access", () => {
  test("login chooser offers the three portals", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("link", { name: /student/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /teacher/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /admin/i }).first()).toBeVisible();
  });

  for (const [path, login] of [
    ["/admin", "/admin/login"],
    ["/admin/smart-id", "/admin/login"],
    ["/teacher", "/teacher/login"],
    ["/student", "/kiosk/login"],
  ] as const) {
    test(`${path} redirects to ${login}`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${login}`));
    });
  }

  test("a malformed Smart ID payload is rejected", async ({ request }) => {
    const res = await request.post("/api/auth/smart-id", { data: { payload: "not-a-card", portal: "kiosk" }, headers: { origin: "http://localhost:3000" } });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe("administrator", () => {
  test.skip(!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD, "needs E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD");

  test("can sign in and reach the overview", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_ADMIN_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_ADMIN_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/admin$/);
  });
});
