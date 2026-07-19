import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
  type Route,
} from "@playwright/test";

const e2eHost = process.env.E2E_HOST || "127.0.0.1";
const apiBase = `http://${e2eHost}:8012`;
const workspaceKey = "weijian:workspace-id:v1";
const demoTokenKey = "weijian:demo-token:v1";

async function resetWorkspace(context: BrowserContext, workspaceId: string) {
  const response = await context.request.post(`${apiBase}/api/demo/reset`, {
    headers: { "X-Workspace-Id": workspaceId },
    data: {},
  });
  expect(response.ok()).toBeTruthy();
}

async function newWorkspaceContext(browser: Browser, workspaceId: string) {
  const context = await browser.newContext();
  await context.addInitScript(
    ({ workspaceKeyName, tokenKeyName, workspaceIdValue }) => {
      window.localStorage.setItem(workspaceKeyName, workspaceIdValue);
      window.localStorage.setItem(tokenKeyName, "e2e-token");
    },
    {
      workspaceKeyName: workspaceKey,
      tokenKeyName: demoTokenKey,
      workspaceIdValue: workspaceId,
    },
  );
  await resetWorkspace(context, workspaceId);
  return context;
}

async function waitForInitialData(page: Page) {
  await page.goto("/#/today");
  await expect(page.getByTestId("opportunity-row-opp-chen-l80")).toBeVisible();
}

test("角色乐观切换在 150ms 内完成且慢审计不阻塞页面", async ({ browser }) => {
  const context = await newWorkspaceContext(browser, "e2e-role-optimistic-001");
  const page = await context.newPage();
  await waitForInitialData(page);

  let heldRoute: Route | undefined;
  let releaseAudit: (() => void) | undefined;
  const auditGate = new Promise<void>((resolve) => {
    releaseAudit = resolve;
  });
  await page.route("**/api/enterprise/role", async (route) => {
    heldRoute = route;
    await auditGate;
    await route.abort("failed");
  });
  await page.getByTestId("space-switcher").click();
  await page.evaluate(() => {
    const target = document.querySelector('[data-testid="switch-role-hq"]');
    const state = window as typeof window & {
      __roleDelta?: number;
      __roleStart?: number;
    };
    target?.addEventListener(
      "click",
      () => {
        state.__roleStart = performance.now();
      },
      { once: true },
    );
    window.addEventListener(
      "hashchange",
      () => {
        state.__roleDelta =
          performance.now() - (state.__roleStart || performance.now());
      },
      { once: true },
    );
  });
  await page.getByTestId("switch-role-hq").click();
  await expect(page).toHaveURL(/#\/hotspots/);
  await expect(page.getByTestId("space-switcher")).toContainText(
    "总部运营空间",
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { __roleDelta?: number }).__roleDelta ??
          Number.POSITIVE_INFINITY,
      ),
    )
    .toBeLessThan(150);
  const roleSwitchMilliseconds = await page.evaluate(
    () =>
      (window as typeof window & { __roleDelta?: number }).__roleDelta ?? -1,
  );
  console.log(`[ROLE_SWITCH_MS] ${roleSwitchMilliseconds.toFixed(2)}`);
  expect(roleSwitchMilliseconds).toBeGreaterThanOrEqual(0);
  expect(heldRoute).toBeTruthy();
  releaseAudit?.();
  await expect(page.getByTestId("role-sync-error")).toBeVisible();
  await expect(page.getByText("本地演示", { exact: true })).toHaveCount(0);
  await context.close();
});

test("客户沟通消息保持水平排版且三个目标视口无页面溢出", async ({
  browser,
}) => {
  const context = await newWorkspaceContext(browser, "e2e-timeline-layout-001");
  const page = await context.newPage();
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/#/followup?customer=customer-chen");
    await expect(page.getByTestId("conversation-timeline")).toBeVisible();
    const bodies = page.locator(".timeline-body:visible");
    expect(await bodies.count()).toBeGreaterThan(0);
    for (let index = 0; index < (await bodies.count()); index += 1) {
      const style = await bodies.nth(index).evaluate((element) => {
        const computed = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return { width: rect.width, writingMode: computed.writingMode };
      });
      expect(style.width).toBeGreaterThanOrEqual(240);
      expect(style.writingMode).toBe("horizontal-tb");
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  }
  await context.close();
});

test("收起侧栏后品牌文案完全隐藏且不发生中文竖排", async ({ browser }) => {
  const context = await newWorkspaceContext(browser, "e2e-nav-collapse-001");
  const page = await context.newPage();
  await waitForInitialData(page);
  await page.getByRole("button", { name: "收起导航" }).click();
  const style = await page.locator(".brand-copy").evaluate((element) => {
    const computed = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      display: computed.display,
      width: rect.width,
      writingMode: computed.writingMode,
    };
  });
  expect(style.display).toBe("none");
  expect(style.width).toBe(0);
  expect(style.writingMode).toBe("horizontal-tb");
  await context.close();
});

test("中文页面不暴露内部状态且经理雷达只有一个主操作", async ({ browser }) => {
  const context = await newWorkspaceContext(browser, "e2e-status-chinese-001");
  const page = await context.newPage();
  const forbidden =
    /\b(?:open|pending_review|high|current|superseded|manager_assigned|published)\b/;
  for (const route of [
    "manager-radar",
    "quality",
    "knowledge",
    "best-practices",
    "customer-risks",
  ]) {
    await page.goto(`/#/${route}`);
    await expect(page.locator(".page-content")).toBeVisible();
    expect(await page.locator(".page-content").innerText()).not.toMatch(
      forbidden,
    );
  }
  await page.goto("/#/manager-radar");
  expect(
    await page
      .locator(".enterprise-action-pane .button-primary:visible")
      .count(),
  ).toBeLessThanOrEqual(1);
  await page.goto("/#/quality");
  expect(
    await page.locator(".quality-action-pane .button-primary:visible").count(),
  ).toBeLessThanOrEqual(2);
  await page.goto("/#/hotspots");
  expect(
    await page.locator(".hotspot-action-pane .button-primary:visible").count(),
  ).toBeLessThanOrEqual(1);
  await context.close();
});

test("单个网络请求失败进入 stale_online 而不是静默本地演示", async ({
  browser,
}) => {
  const context = await newWorkspaceContext(browser, "e2e-stale-online-001");
  const page = await context.newPage();
  await waitForInitialData(page);
  await page.route("**/api/workspace", (route) => route.abort("failed"));
  await page.getByRole("button", { name: "刷新数据" }).click();
  await expect(page.getByTestId("stale-online-banner")).toBeVisible();
  await expect(page.getByTestId("stale-online-banner")).toContainText(
    "保留最近成功数据",
  );
  await expect(page.locator(".environment-chip")).toContainText(
    "在线数据暂时陈旧",
  );
  await expect(page.getByText("本地演示", { exact: true })).toHaveCount(0);
  await context.close();
});

test("公开模型接口超过分钟额度返回 429 中文提示", async ({ browser }) => {
  const workspaceId = "e2e-quota-workspace-001";
  const context = await newWorkspaceContext(browser, workspaceId);
  const headers = {
    "X-Workspace-Id": workspaceId,
    "X-Demo-Token": "e2e-token",
    "X-Forwarded-For": "198.51.100.12",
  };
  const payload = {
    advisor_id: "advisor-hz-02",
    vehicle_id: "l80",
    campaign_name: "公开额度测试",
    campaign_brief: "验证公开演示模型费用保护。",
    platforms: ["朋友圈"],
    opportunity_id: "opp-chen-l80",
    use_llm: true,
  };
  const first = await context.request.post(`${apiBase}/api/content/generate`, {
    headers,
    data: payload,
  });
  const second = await context.request.post(`${apiBase}/api/content/generate`, {
    headers,
    data: payload,
  });
  expect(first.status()).toBe(200);
  expect(second.status()).toBe(429);
  expect((await second.json()).detail).toContain("频繁");
  await context.close();
});

test("客户沟通视觉回归基线", async ({ browser }) => {
  const context = await newWorkspaceContext(
    browser,
    "e2e-visual-conversation-001",
  );
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/followup?customer=customer-chen");
  await expect(page.getByTestId("conversation-timeline")).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page).toHaveScreenshot("conversation-workbench-1440.png", {
    animations: "disabled",
    caret: "hide",
    fullPage: false,
    // GitHub-hosted Chromium and local Linux render CJK glyph edges slightly
    // differently. Functional width/writing-mode assertions above still catch
    // real layout regressions; this allowance only absorbs rasterization noise.
    maxDiffPixelRatio: 0.035,
  });
  await context.close();
});
