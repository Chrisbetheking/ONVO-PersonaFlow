export type RouteId = 'today' | 'studio' | 'followup' | 'review' | 'campaigns' | 'advisors' | 'settings' | 'about'

export type RouteState = {
  id: RouteId
  params: URLSearchParams
}

const validRoutes = new Set<RouteId>(['today', 'studio', 'followup', 'review', 'campaigns', 'advisors', 'settings', 'about'])

export function parseRoute(hash = window.location.hash): RouteState {
  const normalized = hash.replace(/^#\/?/, '') || 'today'
  const [path, query = ''] = normalized.split('?')
  const id = validRoutes.has(path as RouteId) ? path as RouteId : 'today'
  return { id, params: new URLSearchParams(query) }
}

export function navigate(id: RouteId, params?: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value) query.set(key, value)
  })
  window.location.hash = `/${id}${query.size ? `?${query.toString()}` : ''}`
}

export const routeTitles: Record<RouteId, { title: string; subtitle: string }> = {
  today: { title: '今日机会', subtitle: '先处理最可能推动客户下一步行动的事项。' },
  studio: { title: '内容作战台', subtitle: '把客户问题变成有依据、可审核、能继续跟进的沟通内容。' },
  followup: { title: '跟进与记忆', subtitle: '查看客户时间线，并管理会影响下一次沟通的记忆。' },
  review: { title: '门店审核', subtitle: '只处理需要经理判断的风险、事实与转化异常。' },
  campaigns: { title: '活动与批量任务', subtitle: '一次配置活动，再为不同顾问和客群生成差异化内容。' },
  advisors: { title: '顾问与门店', subtitle: '维护顾问画像、服务客群和表达偏好。' },
  settings: { title: '系统设置', subtitle: '查看模型、服务、数据模式与诊断信息。' },
  about: { title: '方案说明', subtitle: '了解业务闭环、数据边界和当前原型范围。' },
}
