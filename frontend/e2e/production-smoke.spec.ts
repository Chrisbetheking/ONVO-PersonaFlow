import { expect, test, type Page, type TestInfo } from "@playwright/test";

const webUrl = (process.env.PRODUCTION_WEB_URL || "").replace(/\/$/, "");
const apiUrl = (process.env.PRODUCTION_API_URL || "").replace(/\/$/, "");
const expectedCommit = (process.env.PRODUCTION_EXPECTED_COMMIT || "").trim();

test.skip(
  !webUrl || !apiUrl,
  "未配置生产 URL，仅在 Production Smoke 工作流执行。",
);

function requireProductionConfiguration() {
  if (!webUrl || !apiUrl) {
    throw new Error(
      "生产 Smoke 需要 PRODUCTION_WEB_URL 和 PRODUCTION_API_URL。",
    );
  }
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: false,
    animations: "disabled",
  });
}

test.beforeEach(() => {
  requireProductionConfiguration();
});

test("生产首页、版本和 API schema 一致", async ({ page, request }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  let health: Record<string, unknown> = {};
  await expect
    .poll(
      async () => {
        const healthResponse = await request.get(`${apiUrl}/api/health`);
        if (!healthResponse.ok()) return false;
        health = await healthResponse.json();
        const commit = String(health.git_commit || "").toLowerCase();
        const commitMatches = expectedCommit
          ? commit.includes(expectedCommit.toLowerCase().slice(0, 7))
          : Boolean(commit && commit !== "unknown");
        return (
          health.app_version === "0.4.3" &&
          health.api_schema_version === "1" &&
          commitMatches
        );
      },
      {
        message: "等待 Render 与 Vercel 收敛到同一 v0.4.3 Commit",
        timeout: 300_000,
        intervals: [5_000, 10_000, 15_000],
      },
    )
    .toBe(true);

  await page.goto(`${webUrl}/#/today`, { waitUntil: "domcontentloaded" });
  await expect(
    page.getByText("今日机会", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator("body")).toContainText("蔚见");
  await expect(page.locator("body")).not.toContainText("购车顾问内容工作台");
  await expect(page.locator("body")).not.toContainText("API 版本不兼容");
  expect(consoleErrors).toEqual([]);
});

test("生产三角色空间路由可切换", async ({ page }) => {
  await page.goto(`${webUrl}/#/today`, { waitUntil: "domcontentloaded" });

  await page.getByTestId("space-switcher").click();
  await page.getByTestId("switch-role-manager").click();
  await expect(page).toHaveURL(/#\/manager-radar/);
  await expect(page.getByTestId("space-switcher")).toContainText(
    "门店经理空间",
  );

  await page.getByTestId("space-switcher").click();
  await page.getByTestId("switch-role-hq").click();
  await expect(page).toHaveURL(/#\/hotspots/);
  await expect(page.getByTestId("space-switcher")).toContainText(
    "总部运营空间",
  );

  await page.getByTestId("space-switcher").click();
  await page.getByTestId("switch-role-advisor").click();
  await expect(page).toHaveURL(/#\/today/);
  await expect(page.getByTestId("space-switcher")).toContainText("顾问空间");
});

test("生产客户沟通与收起导航截图", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${webUrl}/#/followup?customer=customer-chen`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId("conversation-timeline")).toBeVisible();
  const bodies = page.locator(".timeline-body:visible");
  expect(await bodies.count()).toBeGreaterThan(0);
  for (let index = 0; index < (await bodies.count()); index += 1) {
    const metrics = await bodies.nth(index).evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        width: element.getBoundingClientRect().width,
        writingMode: style.writingMode,
      };
    });
    expect(metrics.width).toBeGreaterThanOrEqual(240);
    expect(metrics.writingMode).toBe("horizontal-tb");
  }
  await capture(page, testInfo, "production-customer-conversation-1440");

  await page.getByRole("button", { name: "收起导航" }).click();
  await expect(page.locator(".brand-copy")).toHaveCSS("display", "none");
  await capture(page, testInfo, "production-collapsed-navigation-1440");
  expect(consoleErrors).toEqual([]);
});
