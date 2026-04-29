import { test, expect } from "@playwright/test";

/**
 * Regression guard for the account-request flow.
 *
 * What we verify, end-to-end, against the live preview/published app:
 *  1. A brand-new email + password can be submitted via the "Request access" form.
 *  2. Sign-up is auto-confirmed (no email verification required).
 *  3. The user lands on the authenticated console (/dashboard) without a
 *     "verify your email" toast.
 *  4. The handle_new_user trigger ran (we never see a permission error and the
 *     authenticated dashboard renders).
 *
 * If sign-up regresses (e.g. someone disables auto_confirm_email, the
 * handle_new_user trigger errors, has_role gets revoked again, OAuth secrets
 * break the page), this test fails loudly.
 *
 * We do NOT exercise Google OAuth in CI — that requires a real Google account.
 * Instead we assert that the "Continue with Google" button is wired and does
 * not throw a client-side error when clicked (the redirect itself is allowed
 * to happen).
 */

function uniqueEmail(): string {
  const slug = Math.random().toString(36).slice(2, 10);
  const ts = Date.now();
  return `vellum-e2e+${ts}-${slug}@example.test`;
}

test.describe("Request account flow", () => {
  test("new email + password creates an auto-confirmed account and routes to console", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console: ${m.text()}`);
    });

    await page.goto("/auth");

    // Switch to sign-up mode.
    await page.getByRole("button", { name: /request an account/i }).click();
    await expect(page.getByRole("heading", { name: /create account/i })).toBeVisible();

    const email = uniqueEmail();
    const password = `Vellum-${Math.random().toString(36).slice(2, 10)}!A1`;

    await page.getByLabel(/full name/i).fill("Vellum E2E");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);

    await page.getByRole("button", { name: /request access/i }).click();

    // Auto-confirm should land us on the dashboard. If it shows the
    // "Check your email to verify" toast instead, fail loudly.
    const verifyToast = page.getByText(/verify.*before signing in/i);
    const dashboardHeader = page.locator('h1, h2, h3').filter({ hasText: /dashboard|console|overview|encounters/i }).first();

    await Promise.race([
      page.waitForURL(/\/(dashboard|encounters)/, { timeout: 25_000 }),
      verifyToast.waitFor({ state: "visible", timeout: 25_000 }),
    ]);

    expect(
      await verifyToast.isVisible().catch(() => false),
      "Sign-up surfaced an email-verification toast — auto_confirm_email is OFF or signup is broken."
    ).toBe(false);

    await expect(page).toHaveURL(/\/(dashboard|encounters)/, { timeout: 10_000 });
    await expect(dashboardHeader).toBeVisible({ timeout: 10_000 });

    // No has_role / RLS permission errors should have surfaced during the
    // first authenticated page load.
    const permErrors = errors.filter((e) => /permission denied|has_role|row.level security/i.test(e));
    expect(permErrors, `Authenticated page hit RLS errors:\n${permErrors.join("\n")}`).toEqual([]);
  });

  test("Google OAuth button is wired and does not throw client-side", async ({ page, context }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/auth");

    // The button should exist on both signin and signup screens.
    const googleBtn = page.getByRole("button", { name: /continue with google/i });
    await expect(googleBtn).toBeVisible();

    // We block actual navigation to Google so the test stays hermetic.
    await context.route("**/accounts.google.com/**", (route) => route.abort());
    await context.route("**/oauth.lovable.app/**", (route) => route.abort());

    await googleBtn.click();

    // Give the SDK a moment to call /~oauth or trigger redirect.
    await page.waitForTimeout(1500);

    const oauthErrors = errors.filter((e) => /oauth|signinwithoauth|auth/i.test(e));
    expect(oauthErrors, `Google OAuth button threw client-side errors:\n${oauthErrors.join("\n")}`).toEqual([]);
  });
});