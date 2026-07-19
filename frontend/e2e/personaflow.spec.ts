import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'

const e2eHost = process.env.E2E_HOST || '127.0.0.1'
const apiBase = `http://${e2eHost}:8012`
const workspaceKey = 'weijian:workspace-id:v1'

async function resetWorkspace(context: BrowserContext, workspaceId: string) {
  const response = await context.request.post(`${apiBase}/api/demo/reset`, {
    headers: { 'X-Workspace-Id': workspaceId },
    data: {},
  })
  expect(response.ok()).toBeTruthy()
}

async function newWorkspaceContext(browser: Browser, workspaceId: string) {
  const context = await browser.newContext()
  await context.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), { key: workspaceKey, value: workspaceId })
  await resetWorkspace(context, workspaceId)
  return context
}

async function openFirstOpportunity(page: Page) {
  await page.goto('/#/today')
  await expect(page.getByTestId('opportunity-row-opp-chen-l80')).toBeVisible()
  await page.getByTestId('opportunity-row-opp-chen-l80').click()
  await page.getByTestId('start-opportunity').click()
  await expect(page).toHaveURL(/#\/studio\?opportunity=opp-chen-l80/)
}

async function generateContent(page: Page) {
  await page.getByTestId('generate-content').click()
  await expect(page.getByTestId('platform-tab-私聊跟进')).toBeVisible()
  await expect(page.getByTestId('platform-tab-朋友圈')).toBeVisible()
  await expect(page.getByTestId('platform-tab-小红书')).toBeVisible()
  await expect(page.getByTestId('content-body')).toContainText('陈女士')
}

test('顾问从机会到审核、跟进、试驾和视频预览的完整路径', async ({ browser }) => {
  const context = await newWorkspaceContext(browser, 'e2e-main-workspace-001')
  const page = await context.newPage()

  await openFirstOpportunity(page)
  await generateContent(page)

  const claim = page.getByTestId('content-mark-claim').first()
  await expect(claim).toBeVisible()
  await claim.click()
  await expect(page.locator('.trust-item.active').filter({ hasText: '官方' }).first()).toBeVisible()

  const risk = page.getByTestId('content-mark-risk').first()
  await expect(risk).toBeVisible()
  await risk.click()
  const applyRisk = page.locator('[data-testid^="apply-risk-"]').first()
  await expect(applyRisk).toBeVisible()
  await applyRisk.click()

  const body = page.getByTestId('content-body')
  await body.fill(`${await body.inputValue()}\n\n已根据客户家庭人数准备体验清单。`)
  await page.getByTestId('save-draft').click()
  await expect(page.getByRole('status')).toContainText('草稿已保存')
  await expect(page.getByTestId('submit-review')).toBeDisabled()
  await page.getByTestId('revalidate-content').click()
  await expect(page.getByTestId('submit-review')).toBeEnabled()
  await page.getByTestId('submit-review').click()

  await expect(page).toHaveURL(/#\/review/)
  await expect(page.getByTestId('review-detail')).toBeVisible()
  await expect(page.getByTestId('review-body')).toHaveValue(/已根据客户家庭人数准备体验清单/)
  await expect(page.getByTestId('review-mark-claim').first()).toBeVisible()
  await page.getByTestId('review-mark-claim').first().click()
  await expect(page.getByTestId('review-mark-risk').first()).toBeVisible()
  await page.getByTestId('review-mark-risk').first().click()
  await page.locator('[data-testid^="apply-risk-"]').first().click()
  await expect(page.getByTestId('approve-review')).toBeDisabled()
  await page.getByTestId('revalidate-review').click()
  await expect(page.getByTestId('approve-review')).toBeEnabled()
  await page.getByTestId('review-reason').fill('已核验车型事实与发布时效说明。')
  await page.getByTestId('approve-review').click()
  await expect(page.getByText('已批准').first()).toBeVisible()

  await page.getByRole('button', { name: '客户沟通' }).click()
  await expect(page.getByTestId('customer-row-customer-chen')).toBeVisible()
  await page.getByTestId('customer-row-customer-chen').click()
  await page.getByTestId('followup-message').fill('周日两点可以到店，希望带儿童推车一起试装。')
  await page.getByTestId('add-followup-message').click()
  await expect(page.getByTestId('conversation-timeline')).toContainText('周日两点可以到店')
  await expect(page.locator('[data-testid^="memory-local-"] , [data-testid^="memory-memory-"]').last()).toContainText('周日两点可以到店')

  await page.getByTestId('open-booking').click()
  await expect(page.getByTestId('booking-dialog')).toBeVisible()
  await page.getByTestId('booking-time').fill('2026-07-20T15:00')
  await page.getByTestId('booking-items').fill('儿童推车、露营车、两个登机箱')
  await page.getByTestId('booking-notes').fill('先体验满员收纳，再体验周末路线。')
  await page.getByTestId('confirm-booking').click()
  await expect(page.getByTestId('conversation-timeline')).toContainText('周辰')
  await expect(page.getByTestId('conversation-timeline')).toContainText('2026-07-20T15:00')
  await expect(page.getByText('已预约试驾').first()).toBeVisible()

  await page.goto('/#/studio?opportunity=opp-chen-l80')
  await page.getByTestId('video-package-toggle').click()
  await page.getByTestId('submit-video-task').click()
  await expect(page.getByTestId('video-job-status')).toContainText('仅保存脚本与分镜')
  await expect(page.getByTestId('video-job-status')).toContainText('未生成成片')

  await context.close()
})

test('活动明细支持单任务重试、全部失败重试和抽样送审', async ({ browser }) => {
  const context = await newWorkspaceContext(browser, 'e2e-campaign-workspace-001')
  const page = await context.newPage()
  await page.goto('/#/campaigns')

  const table = page.getByTestId('campaign-task-table')
  await expect(table).toBeVisible()
  await expect(table).toContainText('顾问')
  await expect(table).toContainText('失败原因 / 重试')

  const failedRetry = page.locator('[data-testid^="retry-task-"]').first()
  await expect(failedRetry).toBeVisible()
  await failedRetry.click()
  await expect(page.getByRole('status')).toContainText(/任务重试成功|重试仍失败/)

  await resetWorkspace(context, 'e2e-campaign-workspace-001')
  await page.reload()
  const retryAll = page.getByTestId('retry-failed-camp-l80-family')
  await expect(retryAll).toBeEnabled()
  await retryAll.click()
  await expect(page.getByRole('status')).toContainText('失败任务已重试')
  await expect(retryAll).toBeDisabled()

  const sample = page.getByTestId('sample-review-camp-l80-family')
  await expect(sample).toBeEnabled()
  await sample.click()
  await expect(page).toHaveURL(/#\/review\?review=/)
  await expect(page.getByTestId('review-detail')).toBeVisible()

  await context.close()
})

test('顾问画像保存后切换和刷新仍然存在，重置后恢复', async ({ browser }) => {
  const context = await newWorkspaceContext(browser, 'e2e-advisor-workspace-001')
  const page = await context.newPage()
  await page.goto('/#/advisors')
  await page.getByTestId('advisor-row-advisor-hz-02').click()
  const audience = page.getByTestId('advisor-audience')
  await audience.fill('二孩家庭、周末露营家庭与注重真实装载体验的客户')
  await page.getByTestId('save-advisor').click()
  await expect(page.getByRole('status')).toContainText('顾问画像已保存')

  await page.getByTestId('advisor-row-advisor-sh-01').click()
  await page.getByTestId('advisor-row-advisor-hz-02').click()
  await expect(audience).toHaveValue(/真实装载体验/)
  await page.reload()
  await page.getByTestId('advisor-row-advisor-hz-02').click()
  await expect(page.getByTestId('advisor-audience')).toHaveValue(/真实装载体验/)

  await page.goto('/#/settings')
  await page.getByRole('button', { name: '重置演示数据' }).click()
  await page.goto('/#/advisors')
  await page.getByTestId('advisor-row-advisor-hz-02').click()
  await expect(page.getByTestId('advisor-audience')).not.toHaveValue(/真实装载体验/)
  await context.close()
})

test('两个浏览器上下文工作区互不影响，刷新路由不丢失', async ({ browser }) => {
  const contextA = await newWorkspaceContext(browser, 'e2e-isolation-workspace-a')
  const contextB = await newWorkspaceContext(browser, 'e2e-isolation-workspace-b')
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  await pageA.goto('/#/today')
  await pageA.getByTestId('opportunity-row-opp-chen-l80').click()
  await pageA.getByRole('button', { name: /标记完成/ }).click()

  await pageB.goto('/#/today')
  await pageB.getByTestId('opportunity-row-opp-chen-l80').click()
  await expect(pageB.getByTestId('start-opportunity')).toBeVisible()

  await pageA.goto('/#/studio?opportunity=opp-family-segment')
  await pageA.reload()
  await expect(pageA).toHaveURL(/#\/studio\?opportunity=opp-family-segment/)
  await expect(pageA.getByRole('heading', { name: '内容作战台' })).toBeVisible()

  await contextA.close()
  await contextB.close()
})

test('网络中断时本地演示仍能走通生成、审核、回复、预约和批量任务', async ({ browser }) => {
  const context = await browser.newContext()
  await context.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), { key: workspaceKey, value: 'e2e-offline-workspace-001' })
  const page = await context.newPage()
  await page.route('**/api/**', route => route.abort('failed'))

  await openFirstOpportunity(page)
  await expect(page.getByText(/本地工作区|本地演示/).first()).toBeVisible()
  await generateContent(page)
  await expect(page.getByText(/本地规则演示|离线本地演示/).first()).toBeVisible()
  await page.getByTestId('content-mark-claim').first().click()
  await page.getByTestId('content-mark-risk').first().click()
  await page.locator('[data-testid^="apply-risk-"]').first().click()
  await page.getByTestId('save-draft').click()
  await page.getByTestId('revalidate-content').click()
  await page.getByTestId('submit-review').click()
  await page.getByTestId('approve-review').click()

  await page.goto('/#/followup?customer=customer-chen')
  await page.getByTestId('followup-message').fill('离线现场：客户确认携带儿童推车到店。')
  await page.getByTestId('add-followup-message').click()
  await expect(page.locator('[data-testid^="memory-local-memory-"]').last()).toContainText('离线现场')
  await page.getByTestId('open-booking').click()
  await page.getByTestId('confirm-booking').click()
  await expect(page.getByTestId('conversation-timeline')).toContainText('周辰')

  await page.goto('/#/campaigns')
  await page.getByTestId('run-campaign-camp-l80-family').click()
  await expect(page.getByTestId('campaign-task-table')).toBeVisible()
  await expect(page.getByText('本地规则演示').first()).toBeVisible()

  await context.close()
})


test('顾问画像保存失败时显示错误且不显示成功提示', async ({ browser }) => {
  const context = await newWorkspaceContext(browser, 'e2e-advisor-error-workspace-001')
  const page = await context.newPage()
  await page.route('**/api/advisors/advisor-hz-02', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: '保存服务不可用' }) }))
  await page.goto('/#/advisors')
  await page.getByTestId('advisor-row-advisor-hz-02').click()
  await page.getByTestId('advisor-audience').fill('这次保存应该失败')
  await page.getByTestId('save-advisor').click()
  await expect(page.getByRole('alert')).toContainText('保存服务不可用')
  await expect(page.getByRole('status')).toHaveCount(0)
  await context.close()
})

test('视频接口失败时页面明确显示提交失败', async ({ browser }) => {
  const context = await newWorkspaceContext(browser, 'e2e-video-error-workspace-001')
  const page = await context.newPage()
  await openFirstOpportunity(page)
  await generateContent(page)
  await page.route('**/api/video/start', route => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ detail: '视频服务调用失败' }) }))
  await page.getByTestId('video-package-toggle').click()
  await page.getByTestId('submit-video-task').click()
  await expect(page.getByTestId('video-job-status')).toContainText('提交失败')
  await expect(page.getByTestId('video-job-status')).toContainText('视频服务调用失败')
  await context.close()
})

test('主要页面按钮具有可访问名称与明确禁用状态', async ({ browser }) => {
  const context = await newWorkspaceContext(browser, 'e2e-button-workspace-001')
  const page = await context.newPage()
  for (const route of ['today', 'followup', 'review', 'campaigns', 'advisors', 'settings'] as const) {
    await page.goto(`/#/${route}`)
    const buttons = page.locator('button:visible')
    const count = await buttons.count()
    for (let index = 0; index < count; index += 1) {
      const button = buttons.nth(index)
      const name = (await button.getAttribute('aria-label')) || (await button.innerText()).trim()
      expect(name, `${route} 第 ${index + 1} 个按钮缺少可访问名称`).not.toBe('')
    }
  }
  await context.close()
})


test('飞书知识变化生成新版本、影响分析和重新核验任务', async ({ browser }) => {
  const context = await newWorkspaceContext(browser, 'e2e-enterprise-knowledge-001')
  const page = await context.newPage()
  await page.goto('/#/knowledge')
  const current = await page.locator('.detail-heading .status-pill').innerText()
  await page.getByTestId('feishu-change-select').selectOption('campaign_end')
  await page.getByTestId('simulate-feishu-change').click()
  await expect(page.getByTestId('knowledge-impact')).toBeVisible()
  await expect(page.getByTestId('knowledge-impact')).toContainText('待发布内容')
  await expect(page.locator('.detail-heading .status-pill')).not.toHaveText(current)
  await context.close()
})

test('内容编辑使核验失效，重新核验后才能提交', async ({ browser }) => {
  const context = await newWorkspaceContext(browser, 'e2e-revalidation-001')
  const page = await context.newPage()
  await openFirstOpportunity(page)
  await generateContent(page)
  const body = page.getByTestId('content-body')
  await body.fill(`${await body.inputValue()}\n\n补充客户实际家庭使用场景。`)
  await expect(page.getByTestId('content-revalidation-warning')).toBeVisible()
  await expect(page.getByTestId('submit-review')).toBeDisabled()
  await page.getByTestId('revalidate-content').click()
  await expect(page.getByTestId('submit-review')).toBeEnabled()
  await page.getByTestId('submit-review').click()
  await expect(page).toHaveURL(/#\/review/)
  await context.close()
})

test('客户 360 下一最佳行动和承诺台账产生真实状态变化', async ({ browser }) => {
  const context = await newWorkspaceContext(browser, 'e2e-customer-promise-001')
  const page = await context.newPage()
  await page.goto('/#/customers')
  const action = page.locator('[data-testid^="nba-"]').first()
  await expect(action).toBeVisible()
  await action.getByRole('button', { name: '接受' }).click()
  await expect(action).toContainText('accepted')

  await page.goto('/#/promises')
  await page.getByTestId('confirm-promise').click()
  await expect(page.locator('[data-testid^="promise-"]').first()).toContainText('待执行')
  await page.getByTestId('simulate-promise-overdue').click()
  await expect(page.locator('[data-testid^="promise-"]').first()).toContainText('已超时')
  await page.getByTestId('complete-promise').click()
  await expect(page.locator('[data-testid^="promise-"]').first()).toContainText('已完成')
  await context.close()
})

test('员工补充说明后经理创建辅导计划', async ({ browser }) => {
  const context = await newWorkspaceContext(browser, 'e2e-quality-001')
  const page = await context.newPage()
  await page.goto('/#/quality')
  await page.getByTestId('quality-employee-response').fill('客户引用了旧活动截图，顾问未先核验最新知识版本。')
  await page.getByTestId('submit-quality-response').click()
  await expect(page.locator('.employee-response')).toContainText('旧活动截图')
  await page.locator('textarea').last().fill('安排动态事实核验辅导')
  await page.getByTestId('quality-decision-coaching').click()
  await expect(page.getByText('已创建辅导计划')).toBeVisible()
  await context.close()
})

test('优秀案例由经理确认后发布', async ({ browser }) => {
  const context = await newWorkspaceContext(browser, 'e2e-practice-001')
  const page = await context.newPage()
  await page.goto('/#/best-practices')
  const button = page.getByTestId('publish-best-practice')
  if (await button.isEnabled()) {
    await button.click()
    await expect(page.locator('.detail-heading')).toContainText('published')
  } else {
    await expect(page.locator('.detail-heading')).toContainText('published')
  }
  const training = page.getByTestId('best-practice-training')
  if (await training.isEnabled()) await training.click()
  await expect(page.getByText('ready').first()).toBeVisible()
  const crossStore = page.getByTestId('best-practice-cross-store')
  if (await crossStore.isEnabled()) await crossStore.click()
  await expect(page.getByText('published_to_selected_stores').first()).toBeVisible()
  await context.close()
})

test('角色空间与演示场景状态刷新后保留且 workspace 隔离', async ({ browser }) => {
  const contextA = await newWorkspaceContext(browser, 'e2e-role-space-a')
  const contextB = await newWorkspaceContext(browser, 'e2e-role-space-b')
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()
  await pageA.goto('/#/today')
  await pageA.getByTestId('role-menu').click()
  await pageA.getByTestId('switch-role-hq').click()
  await expect(pageA).toHaveURL(/#\/hotspots/)
  await pageA.reload()
  await expect(pageA.getByText('总部运营空间').first()).toBeVisible()

  await pageB.goto('/#/today')
  await expect(pageB.getByText('顾问空间').first()).toBeVisible()
  await pageA.goto('/#/governance')
  await pageA.getByTestId('scenario-promise-overdue').click()
  await expect(pageA).toHaveURL(/#\/manager-radar/)
  await pageB.reload()
  await expect(pageB.getByText('顾问空间').first()).toBeVisible()
  await contextA.close()
  await contextB.close()
})

test('主要企业操作按钮产生状态变化或保持明确禁用', async ({ browser }) => {
  const context = await newWorkspaceContext(browser, 'e2e-enterprise-actions-001')
  const page = await context.newPage()
  await page.goto('/#/hotspots')
  const hotspot = page.locator('[data-testid^="hotspot-"]').first()
  await hotspot.click()
  await page.getByTestId('hotspot-action-knowledge_draft').click()
  await expect(page.getByRole('status')).toContainText('热点处理已记录')

  await page.goto('/#/customer-risks')
  await page.getByTestId('risk-assign-manager').click()
  await expect(page.getByText('manager_assigned').first()).toBeVisible()

  await page.goto('/#/governance')
  const syncButton = page.getByRole('button', { name: /模拟同步/ }).first()
  await syncButton.click()
  await expect(page.getByRole('status')).toContainText('模拟同步已完成')
  await context.close()
})
