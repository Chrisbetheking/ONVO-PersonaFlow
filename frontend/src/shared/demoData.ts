import type { BootstrapResponse, WorkspaceResponse } from '../types'

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
  data_notice: '当前使用内置演示数据，连接恢复后会自动切换到后端数据。',
}

export const fallbackWorkspace: WorkspaceResponse = {
  data_mode: 'demo',
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
    {
      id: 'opp-space-topic', kind: 'topic', priority: 'medium', status: 'pending', title: '本周高频问题：满员状态下怎么装行李', source: '客户反馈聚合',
      why_now: '过去 7 天出现 6 次相近问题，顾问缺少统一、可核验的解释素材。', signal: '高频顾虑 · 内容机会', recommended_action: '制作一条空间体验解释内容，并关联官方事实与试驾检查清单。', due_label: '本周完成', advisor_id: 'advisor-hz-02', vehicle_id: 'l80', campaign_id: 'camp-l80-family', customer: null,
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
        { id: 'event-2', type: 'intent_detected', actor: '系统', time: '昨天 21:18', title: '识别为高意向', content: '出现明确试驾时间和具体家庭场景，建议在 24 小时内回应。', status: 'completed' },
      ],
    },
  ],
  reviews: [
    { id: 'review-l80-001', task_id: 'task-l80-001', title: 'L80 家庭体验活动 · 朋友圈', advisor_id: 'advisor-hz-02', advisor_name: '周辰', vehicle_id: 'l80', status: 'pending', risk_level: 'medium', reason: '内容引用动态价格，发布前需再次确认官方页面。', content_excerpt: 'L80 当前官方页面显示整车购买 24.28 万元起，具体配置、价格与权益以乐道官方最新信息为准。', evidence_status: '已绑定 · 今日核验', submitted_at: '今天 10:16', decision_reason: '' },
  ],
  campaigns: [
    { id: 'camp-l80-family', name: 'L80 家庭空间体验周', vehicle_id: 'l80', brief: '围绕二孩家庭满员乘坐、儿童用品收纳和周末出行，邀请客户携带真实物品到店体验。', channels: ['朋友圈', '私聊跟进', '小红书'], target_advisors: ['advisor-sh-01', 'advisor-hz-02', 'advisor-cd-03'], status: 'ready', created_by: '总部运营', task_summary: { total: 9, ready: 5, pending_review: 3, failed: 1 }, last_run: '尚未执行本轮' },
  ],
}
