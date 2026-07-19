export type RouteId =
  | 'today' | 'studio' | 'followup' | 'review' | 'campaigns' | 'advisors' | 'settings' | 'about'
  | 'customers' | 'promises' | 'manager-radar' | 'customer-risks' | 'quality'
  | 'hotspots' | 'knowledge' | 'policies' | 'best-practices' | 'experiments' | 'governance'

export type RouteState = { id: RouteId; params: URLSearchParams }

const validRoutes = new Set<RouteId>([
  'today','studio','followup','review','campaigns','advisors','settings','about','customers','promises',
  'manager-radar','customer-risks','quality','hotspots','knowledge','policies','best-practices','experiments','governance',
])

export function parseRoute(hash = window.location.hash): RouteState {
  const normalized = hash.replace(/^#\/?/, '') || 'today'
  const [path, query = ''] = normalized.split('?')
  const id = validRoutes.has(path as RouteId) ? path as RouteId : 'today'
  return { id, params: new URLSearchParams(query) }
}

export function navigate(id: RouteId, params?: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  Object.entries(params || {}).forEach(([key, value]) => { if (value) query.set(key, value) })
  window.location.hash = `/${id}${query.size ? `?${query.toString()}` : ''}`
}

export const routeTitles: Record<RouteId, { title: string; subtitle: string }> = {
  today: { title: '今日机会', subtitle: '先处理最可能推动客户下一步行动的事项。' },
  studio: { title: '内容作战台', subtitle: '把客户问题变成有依据、可审核、能继续跟进的沟通内容。' },
  followup: { title: '客户沟通', subtitle: '围绕真实会话、下一步动作与客户记忆持续经营。' },
  customers: { title: '客户档案', subtitle: '查看客户 360、判断依据与下一最佳行动。' },
  promises: { title: '跟进与承诺', subtitle: '把沟通中的承诺变成可确认、可提醒、可完成的事项。' },
  review: { title: '审核队列', subtitle: '逐句确认事实、风险和顾问修改后的重新核验状态。' },
  'manager-radar': { title: '门店雷达', subtitle: '聚合门店客户问题、承诺和质量信号，形成待处理任务。' },
  'customer-risks': { title: '客户风险', subtitle: '基于原始证据识别需要经理介入的客户经营风险。' },
  quality: { title: '质量与辅导', subtitle: '先看证据和员工说明，再由经理确认辅导动作。' },
  campaigns: { title: '活动执行', subtitle: '批量任务、失败重试、抽样审核和活动状态。' },
  hotspots: { title: '热点与洞察', subtitle: '把内部信号与模拟公开趋势转成内容、知识或触达任务。' },
  knowledge: { title: '知识中心', subtitle: '管理企业知识版本，并查看变化对内容、客户和活动的影响。' },
  policies: { title: '政策与权益', subtitle: '按有效期、区域和知识新鲜度管理价格、权益与销售口径。' },
  'best-practices': { title: '优秀案例', subtitle: '经理确认后再沉淀可复用的沟通方法。' },
  experiments: { title: '效果验证', subtitle: '展示验证方案、样本边界和尚未形成真实结论的状态。' },
  governance: { title: '系统治理', subtitle: '管理 Demo Adapter、审计记录、演示场景和生产接入边界。' },
  advisors: { title: '顾问与门店', subtitle: '维护顾问画像、服务客群和表达偏好。' },
  settings: { title: '系统设置', subtitle: '查看模型、服务、数据模式与诊断信息。' },
  about: { title: '方案说明', subtitle: '了解业务闭环、数据边界和当前原型范围。' },
}
