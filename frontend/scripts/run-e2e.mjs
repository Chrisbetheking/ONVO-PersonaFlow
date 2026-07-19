import { spawnSync } from 'node:child_process'

const tests = [
  '顾问从机会到审核、跟进、试驾和视频预览的完整路径',
  '活动明细支持单任务重试、全部失败重试和抽样送审',
  '顾问画像保存后切换和刷新仍然存在，重置后恢复',
  '两个浏览器上下文工作区互不影响，刷新路由不丢失',
  '网络中断时本地演示仍能走通生成、审核、回复、预约和批量任务',
  '顾问画像保存失败时显示错误且不显示成功提示',
  '视频接口失败时页面明确显示提交失败',
  '主要页面按钮具有可访问名称与明确禁用状态',
  '飞书知识变化生成新版本、影响分析和重新核验任务',
  '内容编辑使核验失效，重新核验后才能提交',
  '客户 360 下一最佳行动和承诺台账产生真实状态变化',
  '员工补充说明后经理创建辅导计划',
  '优秀案例由经理确认后发布',
  '角色空间与演示场景状态刷新后保留且 workspace 隔离',
  '主要企业操作按钮产生状态变化或保持明确禁用',
]

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'

for (const [index, name] of tests.entries()) {
  console.log(`\n[E2E] Running ${index + 1}/${tests.length}: ${name}`)
  const result = spawnSync(
    npx,
    ['playwright', 'test', '--workers=1', '--grep', name],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        E2E_REPORT_DIR: `playwright-report/test-${String(index + 1).padStart(2, '0')}`,
        E2E_RESULTS_DIR: `test-results/test-${String(index + 1).padStart(2, '0')}`,
      },
    },
  )
  if (result.error) {
    console.error(result.error)
    process.exit(1)
  }
  if (result.status !== 0) process.exit(result.status ?? 1)
}

console.log('\n[E2E] All 15 scenarios passed.')
