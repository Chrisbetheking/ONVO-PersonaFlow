import type { BootstrapResponse, WorkspaceResponse } from '../types'
import { fallbackEnterprise } from './enterpriseDemo'

export const fallbackBootstrap: BootstrapResponse = {
  advisors: [
    { id: 'advisor-sh-01', name: '林悦', city: '上海', store: '上海浦东体验店', model_focus: 'L60', audience: '年轻三口之家', style: '理性亲和', platforms: ['小红书', '朋友圈', '抖音'], experience_years: 4, private_domain_size: 1680 },
    { id: 'advisor-hz-02', name: '周辰', city: '杭州', store: '杭州城西体验店', model_focus: 'L80', audience: '重视空间的二孩家庭', style: '场景叙事', platforms: ['朋友圈', '视频号', '私聊'], experience_years: 6, private_domain_size: 2360 },
    { id: 'advisor-cd-03', name: '顾安', city: '成都', store: '成都高新体验店', model_focus: 'L90', audience: '多人出行与三代同堂家庭', style: '专业稳重', platforms: ['抖音', '小红书', '朋友圈'], experience_years: 5, private_domain_size: 1940 },
  ],
  vehicles: [
    { id: 'l60', name: '乐道 L60', positioning: '中型 SUV 科技旗舰', full_purchase_from: '19.28 万元起', baas_from: '13.58 万元起', scenarios: ['城市通勤', '年轻家庭', '周末郊游'], source_title: '乐道 L60 官方产品页', source_url: 'https://www.onvo.cn/l60', verified_at: '2026-07-18' },
    { id: 'l80', name: '乐道 L80', positioning: '智能双舱大五座旗舰 SUV', full_purchase_from: '24.28 万元起', baas_from: '15.68 万元起', scenarios: ['二孩家庭', '大五座空间', '长途出行'], source_title: '乐道 L80 官方产品页', source_url: 'https://www.onvo.cn/l80', verified_at: '2026-07-18' },
    { id: 'l90', name: '乐道 L90', positioning: '智能大空间旗舰 SUV', full_purchase_from: '26.58 万元起', baas_from: '17.98 万元起', scenarios: ['三代同堂', '多人出行', '家庭大三排'], source_title: '乐道 L90 官方产品页', source_url: 'https://www.onvo.cn/l90', verified_at: '2026-07-18' },
  ],
  defaults: {
    campaign_name: 'L80 家庭空间体验周',
    campaign_brief: '围绕二孩家庭满员乘坐、儿童用品收纳和周末出行，邀请客户携带真实物品到店体验。',
    platforms: ['私聊跟进', '朋友圈', '小红书'],
  },
  data_notice: '当前使用本地演示数据，未调用 DeepSeek 或生产系统。',
}

const l80Evidence = [
  { id: 'evidence-positioning', field: '车型定位', value: '智能双舱大五座旗舰 SUV', source_title: '乐道 L80 官方产品页', source_url: 'https://www.onvo.cn/l80', verified_at: '2026-07-18', source_type: '官方产品页' },
  { id: 'evidence-price-full', field: '整车购买起价', value: '24.28 万元起', source_title: '乐道 L80 官方产品页', source_url: 'https://www.onvo.cn/l80', verified_at: '2026-07-18', source_type: '官方产品页' },
]

const reviewBody = '想象一个周六早晨：两个孩子、露营车和全家人的随身物品，都要一起出发。\n\n乐道 L80 定位为智能双舱大五座旗舰 SUV，当前官方页面显示整车购买 24.28 万元起。对重视空间的二孩家庭，建议把试驾重点放在满员乘坐和真实物品装载。\n\n具体配置、价格与权益以乐道官方最新信息为准。'

export const fallbackWorkspace: WorkspaceResponse = {
  data_mode: 'demo',
  enterprise: fallbackEnterprise,
  opportunities: [
    {
      id: 'opp-chen-l80', kind: 'customer', priority: 'high', status: 'pending', title: '陈女士 · L80 家庭空间咨询', source: '微信私聊',
      why_now: '昨晚再次追问第三排启用后的行李空间，并表示周末可以到店。', signal: '高意向 · 二孩家庭 · 周末可试驾',
      recommended_action: '先回应满员收纳顾虑，再邀请全家按真实行李清单体验。', due_label: '今天 18:00 前', advisor_id: 'advisor-hz-02', vehicle_id: 'l80', campaign_id: 'camp-l80-family',
      customer: { id: 'customer-chen', name: '陈女士', city: '杭州', stage: '试驾前', family: '两位成人、两个孩子', concerns: ['第三排启用后的后备箱空间', '儿童用品收纳', '周末长途补能'], recent_message: '第三排坐人以后，露营车和两个登机箱还能放下吗？这周日可以去看看。', last_contact: '昨晚 21:18' },
    },
    {
      id: 'opp-family-segment', kind: 'segment', priority: 'medium', status: 'pending', title: '18 位二孩家庭适合本周活动', source: '总部活动匹配',
      why_now: '近期咨询中有 18 位客户同时关注空间与补能，适合统一活动后再个性化跟进。', signal: '潜客分组 · L80 · 家庭体验活动',
      recommended_action: '为不同顾问生成朋友圈与私聊版本，抽样审核后触达。', due_label: '明天中午前', advisor_id: 'advisor-hz-02', vehicle_id: 'l80', campaign_id: 'camp-l80-family', customer: null,
    },
  ],
  followups: [
    {
      customer_id: 'customer-chen', customer_name: '陈女士', advisor_id: 'advisor-hz-02', vehicle_id: 'l80', stage: '试驾前', next_action: '确认周日到店时间，并准备儿童用品与行李模拟体验。', next_action_due: '今天 18:00',
      memories: [
        { id: 'memory-chen-1', scope: 'customer', title: '家庭结构', value: '两位成人、两个孩子，周末经常露营', source: '客户私聊', updated_at: '2026-07-17 21:18', active: true },
        { id: 'memory-chen-2', scope: 'customer', title: '核心顾虑', value: '第三排启用后的后备箱与儿童用品收纳', source: '最近两次咨询', updated_at: '2026-07-17 21:18', active: true },
      ],
      events: [
        { id: 'event-1', type: 'customer_message', actor: '陈女士', time: '昨天 21:18', title: '客户追问空间', content: '第三排坐人以后，露营车和两个登机箱还能放下吗？这周日可以去看看。', status: 'received' },
      ],
    },
    {
      customer_id: 'customer-xu', customer_name: '许先生', advisor_id: 'advisor-sh-01', vehicle_id: 'l60', stage: '预约中', next_action: '确认工作日晚间试驾时段。', next_action_due: '今天 17:00',
      memories: [{ id: 'memory-xu-1', scope: 'customer', title: '到店时间偏好', value: '工作日晚上七点后', source: '小红书私信', updated_at: '2026-07-18 09:10', active: true }],
      events: [{ id: 'event-xu-1', type: 'customer_message', actor: '许先生', time: '今天 09:10', title: '询问晚间试驾', content: '周三晚上七点后方便吗？', status: 'received' }],
    },
  ],
  reviews: [
    {
      id: 'review-l80-001', task_id: 'task-l80-001', variant_id: 'variant-review-l80', title: 'L80 家庭体验活动 · 朋友圈', content_title: '满员以后，怎么判断空间是否适合自己', advisor_id: 'advisor-hz-02', advisor_name: '周辰', vehicle_id: 'l80', platform: '朋友圈', status: 'pending', risk_level: 'medium', reason: '内容引用动态价格，发布前需再次确认官方页面。', body: reviewBody, call_to_action: '欢迎携带儿童推车和常用行李预约家庭场景试驾。',
      claims: [{ id: 'claim-review-l80', text: '乐道 L80 定位为智能双舱大五座旗舰 SUV，当前官方页面显示整车购买 24.28 万元起。', evidence_id: 'evidence-positioning', field: '车型定位与价格' }],
      risk_annotations: [{ id: 'risk-review-l80', text: '乐道 L80 定位为智能双舱大五座旗舰 SUV，当前官方页面显示整车购买 24.28 万元起。', level: 'info', rule: '动态事实复核', reason: '价格可能随时间和地区变化，发布前应再次核验。', suggestion: '乐道 L80 定位为智能双舱大五座旗舰 SUV，具体价格与权益以发布当天官方页面为准。' }],
      evidence: l80Evidence, reviewed_body: reviewBody, reviewed_call_to_action: '欢迎携带儿童推车和常用行李预约家庭场景试驾。', evidence_status: '已绑定 · 本地演示', verification_status: 'verified', compliance_status: 'verified', knowledge_version: 'demo-2026.07', verification_version: 1, verified_at: '2026-07-18T10:16:00', version_history: [{ type: 'generated', at: '2026-07-18T10:16:00' }], submitted_at: '今天 10:16', decision_reason: '', change_log: [],
    },
  ],
  campaigns: [
    {
      id: 'camp-l80-family', name: 'L80 家庭空间体验周', vehicle_id: 'l80', brief: '围绕二孩家庭满员乘坐、儿童用品收纳和周末出行，邀请客户携带真实物品到店体验。', channels: ['朋友圈', '私聊跟进', '小红书'], target_advisors: ['advisor-sh-01', 'advisor-hz-02', 'advisor-cd-03'], status: 'ready', created_by: '总部运营', task_summary: { total: 1, ready: 0, pending_review: 0, failed: 1 }, last_run: '本地演示初始状态',
      tasks: [{ id: 'local-seed-failed', campaign_id: 'camp-l80-family', advisor_id: 'advisor-cd-03', advisor_name: '顾安', platform: '小红书', status: 'failed', failure_reason: '本地演示：上次任务超时，可点击重试。', retry_count: 0, generated_at: '', result: null, review_id: '' }],
    },
  ],
}
