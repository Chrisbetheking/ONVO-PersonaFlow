import type { EnterpriseWorkspace } from '../types'

export const fallbackEnterprise = {
  "enterprise_meta": {
    "current_role": "advisor",
    "current_actor_id": "advisor-hz-02",
    "demo_scenario": "customer-space",
    "data_mode": "demo",
    "role_demo": true,
    "last_sync_at": "2026-07-19T09:00:00+08:00"
  },
  "hotspots": [
    {
      "id": "hotspot-l80-trunk",
      "title": "L80 满员状态下的后备箱空间成为高频问题",
      "source_type": "客户咨询聚合",
      "vehicle_ids": [
        "l80"
      ],
      "audiences": [
        "二孩家庭",
        "周末露营家庭"
      ],
      "stores": [
        "杭州城西体验店",
        "上海浦东体验店"
      ],
      "evidence_count": 12,
      "last_seen": "2026-07-19 08:40",
      "trend": "上升",
      "status": "待处理",
      "owner": "总部内容运营",
      "recommended_action": "建立场景化解释内容，并让相关客户携带真实物品到店体验。",
      "demo_flag": true,
      "source_label": "演示样本：最近 7 天 12 条模拟客户咨询",
      "evidence": [
        {
          "id": "hotev-l80-1",
          "type": "客户消息",
          "summary": "第三排坐人以后，露营车和两个登机箱还能放下吗？",
          "store": "杭州城西体验店",
          "advisor": "周辰",
          "occurred_at": "2026-07-18 21:18"
        },
        {
          "id": "hotev-l80-2",
          "type": "客户消息",
          "summary": "满员时儿童推车放哪里更合适？",
          "store": "上海浦东体验店",
          "advisor": "林悦",
          "occurred_at": "2026-07-18 17:22"
        },
        {
          "id": "hotev-l80-3",
          "type": "审核退回",
          "summary": "内容只讲大空间，没有回答满员收纳。",
          "store": "杭州城西体验店",
          "advisor": "周辰",
          "occurred_at": "2026-07-18 15:10"
        }
      ],
      "impact": {
        "customers": 18,
        "advisors": 4,
        "contents": 7,
        "campaigns": 1,
        "knowledge": 2,
        "stores": 2
      },
      "created_task_ids": []
    },
    {
      "id": "hotspot-price-change",
      "title": "客户集中确认 L80 当前价格与活动截止时间",
      "source_type": "知识变更",
      "vehicle_ids": [
        "l80"
      ],
      "audiences": [
        "近期到店客户"
      ],
      "stores": [
        "杭州城西体验店"
      ],
      "evidence_count": 6,
      "last_seen": "2026-07-19 08:05",
      "trend": "上升",
      "status": "跟进中",
      "owner": "政策与权益负责人",
      "recommended_action": "核验活动截止时间并创建客户通知任务。",
      "demo_flag": true,
      "source_label": "演示样本：6 条模拟价格与权益咨询",
      "evidence": [
        {
          "id": "hotev-price-1",
          "type": "客户消息",
          "summary": "这个价格和周末活动到哪天结束？",
          "store": "杭州城西体验店",
          "advisor": "周辰",
          "occurred_at": "2026-07-19 08:05"
        },
        {
          "id": "hotev-price-2",
          "type": "知识变更",
          "summary": "活动结束日期可能由 7 月 31 日提前至 7 月 28 日。",
          "store": "总部",
          "advisor": "运营",
          "occurred_at": "2026-07-19 07:50"
        }
      ],
      "impact": {
        "customers": 18,
        "advisors": 4,
        "contents": 15,
        "campaigns": 1,
        "knowledge": 1,
        "stores": 2
      },
      "created_task_ids": []
    },
    {
      "id": "hotspot-commitment",
      "title": "试驾前准备事项出现重复承诺",
      "source_type": "顾问重复问题",
      "vehicle_ids": [
        "l80",
        "l90"
      ],
      "audiences": [
        "家庭试驾客户"
      ],
      "stores": [
        "杭州城西体验店",
        "成都高新体验店"
      ],
      "evidence_count": 5,
      "last_seen": "2026-07-18 19:30",
      "trend": "平稳",
      "status": "待确认",
      "owner": "门店经理",
      "recommended_action": "将儿童座椅、行李试装和路线准备沉淀为承诺清单。",
      "demo_flag": true,
      "source_label": "演示样本：5 条模拟试驾准备沟通",
      "evidence": [
        {
          "id": "hotev-promise-1",
          "type": "顾问发送",
          "summary": "周日会提前准备儿童座椅和常见露营装备。",
          "store": "杭州城西体验店",
          "advisor": "周辰",
          "occurred_at": "2026-07-18 19:30"
        }
      ],
      "impact": {
        "customers": 5,
        "advisors": 3,
        "contents": 2,
        "campaigns": 0,
        "knowledge": 1,
        "stores": 2
      },
      "created_task_ids": []
    },
    {
      "id": "hotspot-public-trend",
      "title": "家庭用户更关注真实装载而不是参数表",
      "source_type": "模拟公开趋势",
      "vehicle_ids": [
        "l60",
        "l80",
        "l90"
      ],
      "audiences": [
        "家庭购车用户"
      ],
      "stores": [
        "全部演示门店"
      ],
      "evidence_count": 8,
      "last_seen": "2026-07-18 18:10",
      "trend": "上升",
      "status": "观察中",
      "owner": "趋势研究员",
      "recommended_action": "将内容模板从参数罗列改为真实家庭任务清单。",
      "demo_flag": true,
      "source_label": "模拟公开趋势，不代表真实平台统计",
      "evidence": [
        {
          "id": "hotev-trend-1",
          "type": "模拟公开讨论",
          "summary": "用户更愿意看儿童推车、行李箱等真实物品试装。",
          "store": "公开趋势 Demo Adapter",
          "advisor": "无",
          "occurred_at": "2026-07-18 18:10"
        }
      ],
      "impact": {
        "customers": 0,
        "advisors": 6,
        "contents": 10,
        "campaigns": 2,
        "knowledge": 1,
        "stores": 3
      },
      "created_task_ids": []
    }
  ],
  "knowledge_items": [
    {
      "id": "knowledge-l80-positioning",
      "title": "乐道 L80 车型定位与价格口径",
      "type": "车型定位",
      "content": "乐道 L80 定位为智能双舱大五座旗舰 SUV。当前演示知识记录整车购买 24.28 万元起，动态价格与权益须在发布当天核验官方页面。",
      "source": "乐道 L80 官方产品页",
      "source_url": "https://www.onvo.cn/l80",
      "vehicle_ids": [
        "l80"
      ],
      "regions": [
        "全国"
      ],
      "effective_at": "2026-05-15",
      "expires_at": "2026-08-31",
      "version": "3.0",
      "status": "生效中",
      "created_by": "总部产品知识组",
      "reviewed_by": "演示审核人",
      "updated_at": "2026-07-18 10:00",
      "replacement_id": "",
      "linked_content_count": 15,
      "linked_customer_count": 18,
      "demo_flag": false,
      "versions": [
        {
          "id": "kv-l80-3",
          "version": "3.0",
          "content": "乐道 L80 定位为智能双舱大五座旗舰 SUV。整车购买 24.28 万元起。活动结束日期为 2026-07-31。",
          "status": "current",
          "created_at": "2026-07-18 10:00",
          "source": "官方产品页与活动 Demo 记录",
          "created_by": "总部产品知识组"
        },
        {
          "id": "kv-l80-2",
          "version": "2.0",
          "content": "乐道 L80 定位为智能双舱大五座旗舰 SUV。价格需以官方页面为准。",
          "status": "superseded",
          "created_at": "2026-06-30 09:00",
          "source": "官方产品页",
          "created_by": "总部产品知识组"
        }
      ]
    },
    {
      "id": "knowledge-l80-space",
      "title": "L80 家庭空间体验建议",
      "type": "FAQ",
      "content": "对二孩家庭，建议按满员乘坐、儿童用品和周末行李三个步骤组织试驾。不得将统一参数替代客户真实体验。",
      "source": "门店优秀沟通与官方车型资料",
      "source_url": "demo://knowledge/l80-space",
      "vehicle_ids": [
        "l80"
      ],
      "regions": [
        "全国"
      ],
      "effective_at": "2026-07-01",
      "expires_at": "2026-12-31",
      "version": "1.2",
      "status": "生效中",
      "created_by": "总部培训组",
      "reviewed_by": "门店经理",
      "updated_at": "2026-07-18 16:20",
      "replacement_id": "",
      "linked_content_count": 7,
      "linked_customer_count": 12,
      "demo_flag": true,
      "versions": [
        {
          "id": "kv-l80-space-12",
          "version": "1.2",
          "content": "按满员乘坐、儿童用品和周末行李三个步骤组织试驾。",
          "status": "current",
          "created_at": "2026-07-18 16:20",
          "source": "演示门店反馈",
          "created_by": "总部培训组"
        }
      ]
    },
    {
      "id": "knowledge-compliance-absolute",
      "title": "绝对化宣传与动态权益表达规范",
      "type": "合规规则",
      "content": "不得使用‘完全不用担心’‘保证’等无法证明的绝对表达。涉及价格、权益和活动日期时必须保留来源与时效说明。",
      "source": "演示合规规则库",
      "source_url": "demo://compliance/absolute",
      "vehicle_ids": [
        "l60",
        "l80",
        "l90"
      ],
      "regions": [
        "全国"
      ],
      "effective_at": "2026-07-01",
      "expires_at": "2027-01-01",
      "version": "1.0",
      "status": "生效中",
      "created_by": "合规运营",
      "reviewed_by": "演示审核人",
      "updated_at": "2026-07-15 11:00",
      "replacement_id": "",
      "linked_content_count": 28,
      "linked_customer_count": 0,
      "demo_flag": true,
      "versions": [
        {
          "id": "kv-compliance-1",
          "version": "1.0",
          "content": "不得使用无法证明的绝对表达。动态事实必须带时效说明。",
          "status": "current",
          "created_at": "2026-07-15 11:00",
          "source": "演示规则库",
          "created_by": "合规运营"
        }
      ]
    }
  ],
  "knowledge_impacts": [],
  "sync_events": [
    {
      "id": "sync-feishu-001",
      "integration": "feishu",
      "mode": "demo",
      "status": "completed",
      "summary": "模拟同步 3 条知识记录",
      "created_at": "2026-07-18 10:00",
      "details": {
        "created": 0,
        "updated": 3,
        "conflicts": 0
      }
    },
    {
      "id": "sync-crm-001",
      "integration": "crm",
      "mode": "demo",
      "status": "completed",
      "summary": "模拟同步 3 位客户状态",
      "created_at": "2026-07-18 09:30",
      "details": {
        "created": 1,
        "updated": 2,
        "conflicts": 1
      }
    }
  ],
  "customer_profiles": [
    {
      "id": "customer-chen",
      "name": "陈女士",
      "city": "杭州",
      "family": "两位成人、两个孩子",
      "current_vehicle": "紧凑型燃油 SUV",
      "target_vehicle_ids": [
        "l80"
      ],
      "budget": "25–30 万元",
      "purchase_window": "1 个月内",
      "channel_source": "授权私聊 Demo",
      "advisor_id": "advisor-hz-02",
      "data_source": "CRM Demo Adapter + 手动确认",
      "last_synced_at": "2026-07-19 08:30",
      "consent_status": "已确认演示授权",
      "allowed_scope": "销售跟进与试驾准备",
      "retention_until": "2026-12-31",
      "model_analysis_allowed": true,
      "delete_request_status": "无",
      "demo_flag": true,
      "state": {
        "need_clarity": {
          "level": "高",
          "evidence": [
            "连续询问第三排和后备箱",
            "明确周末可以到店",
            "会携带儿童推车"
          ]
        },
        "product_fit": {
          "level": "较高",
          "evidence": [
            "二孩家庭",
            "重视大五座空间",
            "周末长途频率高"
          ]
        },
        "price_acceptance": {
          "level": "待确认",
          "evidence": [
            "已询问当前价格和 BaaS",
            "尚未确认最终预算结构"
          ]
        },
        "family_decision": {
          "level": "共同决策",
          "evidence": [
            "配偶将一同到店",
            "需要儿童乘坐体验"
          ]
        },
        "urgency": {
          "level": "高",
          "evidence": [
            "计划周日到店",
            "购车时间 1 个月内"
          ]
        },
        "relationship": {
          "level": "温暖",
          "evidence": [
            "两次主动追问",
            "愿意分享家庭使用细节"
          ]
        },
        "concerns": [
          "第三排启用后的后备箱空间",
          "儿童用品收纳",
          "周末补能"
        ],
        "blocker": "需要通过真实物品试装确认空间",
        "next_best_action": "确认周日家庭场景试驾并准备儿童座椅、露营车和行李箱"
      },
      "next_best_actions": [
        {
          "id": "nba-chen-1",
          "action": "确认周日 15:00 家庭场景试驾",
          "reason": "客户已表达明确到店时间和具体空间顾虑",
          "due_at": "2026-07-20 12:00",
          "owner": "周辰",
          "risk": "未及时确认可能降低到店意愿",
          "required_materials": [
            "儿童座椅",
            "露营车",
            "两个登机箱"
          ],
          "manager_help": false,
          "status": "recommended"
        },
        {
          "id": "nba-chen-2",
          "action": "发送官方价格与权益时效说明",
          "reason": "客户集中确认价格与活动截止时间",
          "due_at": "2026-07-19 18:00",
          "owner": "周辰",
          "risk": "动态信息可能过期",
          "required_materials": [
            "官方产品页",
            "活动版本记录"
          ],
          "manager_help": true,
          "status": "recommended"
        }
      ]
    },
    {
      "id": "customer-xu",
      "name": "许先生",
      "city": "上海",
      "family": "年轻三口之家",
      "current_vehicle": "轿车",
      "target_vehicle_ids": [
        "l60"
      ],
      "budget": "20–25 万元",
      "purchase_window": "2 个月内",
      "channel_source": "小红书私信 Demo",
      "advisor_id": "advisor-sh-01",
      "data_source": "CRM Demo Adapter",
      "last_synced_at": "2026-07-19 08:10",
      "consent_status": "已确认演示授权",
      "allowed_scope": "销售跟进",
      "retention_until": "2026-12-31",
      "model_analysis_allowed": true,
      "delete_request_status": "无",
      "demo_flag": true,
      "state": {
        "need_clarity": {
          "level": "中",
          "evidence": [
            "已确认晚间试驾偏好",
            "仍在比较通勤体验"
          ]
        },
        "product_fit": {
          "level": "中高",
          "evidence": [
            "城市通勤为主",
            "周末短途家庭出行"
          ]
        },
        "price_acceptance": {
          "level": "可接受",
          "evidence": [
            "预算覆盖当前演示价格区间"
          ]
        },
        "family_decision": {
          "level": "待共同确认",
          "evidence": [
            "计划带配偶一起试驾"
          ]
        },
        "urgency": {
          "level": "中",
          "evidence": [
            "购车时间 2 个月内"
          ]
        },
        "relationship": {
          "level": "建立中",
          "evidence": [
            "已主动询问晚间时间"
          ]
        },
        "concerns": [
          "城市通勤",
          "晚间试驾",
          "补能便利"
        ],
        "blocker": "需要确认工作日晚间可用时段",
        "next_best_action": "确认周三 19:30 晚间试驾并提供通勤路线建议"
      },
      "next_best_actions": [
        {
          "id": "nba-xu-1",
          "action": "确认周三 19:30 晚间试驾",
          "reason": "客户明确偏好工作日晚间",
          "due_at": "2026-07-19 17:00",
          "owner": "林悦",
          "risk": "可用时段较少",
          "required_materials": [
            "通勤路线建议"
          ],
          "manager_help": false,
          "status": "recommended"
        }
      ]
    },
    {
      "id": "customer-li",
      "name": "李女士",
      "city": "成都",
      "family": "三代同堂六口之家",
      "current_vehicle": "中型 MPV",
      "target_vehicle_ids": [
        "l90"
      ],
      "budget": "30–35 万元",
      "purchase_window": "3 个月内",
      "channel_source": "活动到店 Demo",
      "advisor_id": "advisor-cd-03",
      "data_source": "CRM Demo Adapter",
      "last_synced_at": "2026-07-18 17:00",
      "consent_status": "待确认",
      "allowed_scope": "仅到店记录",
      "retention_until": "2026-10-31",
      "model_analysis_allowed": false,
      "delete_request_status": "无",
      "demo_flag": true,
      "state": {
        "need_clarity": {
          "level": "中",
          "evidence": [
            "关注六人乘坐",
            "尚未确认常带行李"
          ]
        },
        "product_fit": {
          "level": "较高",
          "evidence": [
            "三代同堂",
            "多人出行频率高"
          ]
        },
        "price_acceptance": {
          "level": "待确认",
          "evidence": [
            "尚未讨论购买方式"
          ]
        },
        "family_decision": {
          "level": "多人共同决策",
          "evidence": [
            "老人和配偶都参与"
          ]
        },
        "urgency": {
          "level": "低",
          "evidence": [
            "购车时间 3 个月内"
          ]
        },
        "relationship": {
          "level": "建立中",
          "evidence": [
            "完成一次到店"
          ]
        },
        "concerns": [
          "第三排舒适性",
          "六人行李",
          "老人上下车"
        ],
        "blocker": "需安排全家共同体验",
        "next_best_action": "邀请六位家庭成员进行满员试乘与上下车体验"
      },
      "next_best_actions": [
        {
          "id": "nba-li-1",
          "action": "预约全家满员试乘",
          "reason": "决策人较多且核心顾虑需要现场验证",
          "due_at": "2026-07-23 18:00",
          "owner": "顾安",
          "risk": "需要协调多人时间",
          "required_materials": [
            "踏板演示",
            "行李模拟"
          ],
          "manager_help": false,
          "status": "recommended"
        }
      ]
    }
  ],
  "promises": [
    {
      "id": "promise-chen-seat",
      "customer_id": "customer-chen",
      "advisor_id": "advisor-hz-02",
      "original_message": "周日我会提前准备儿童座椅和常见露营装备。",
      "commitment": "准备儿童座椅和常见露营装备",
      "due_at": "2026-07-20 14:00",
      "completion_criteria": "现场可用于家庭试驾",
      "status": "pending_execution",
      "source": "顾问私聊 Demo",
      "created_at": "2026-07-18 19:30",
      "remind_at": "2026-07-20 10:00",
      "overdue": false,
      "manager_attention": false,
      "evidence": [],
      "demo_flag": true
    },
    {
      "id": "promise-xu-route",
      "customer_id": "customer-xu",
      "advisor_id": "advisor-sh-01",
      "original_message": "今晚把晚间通勤试驾路线发给您。",
      "commitment": "发送晚间通勤试驾路线",
      "due_at": "2026-07-19 20:00",
      "completion_criteria": "客户收到路线和停车说明",
      "status": "pending_confirmation",
      "source": "小红书私信 Demo",
      "created_at": "2026-07-19 09:00",
      "remind_at": "2026-07-19 18:00",
      "overdue": false,
      "manager_attention": false,
      "evidence": [],
      "demo_flag": true
    }
  ],
  "quality_signals": [
    {
      "id": "quality-price-stale",
      "advisor_id": "advisor-hz-02",
      "customer_id": "customer-chen",
      "category": "事实准确",
      "risk_level": "high",
      "status": "pending_review",
      "original_message": "这次活动肯定到 7 月 31 日，价格不会变化。",
      "trigger_rule": "使用待变更活动日期并作绝对化承诺",
      "system_explanation": "知识中心存在活动截止时间待更新信号，且‘肯定不会变化’属于无法证明的表达。",
      "fact_ids": [
        "knowledge-l80-positioning"
      ],
      "repeat_count": 1,
      "employee_response": "",
      "manager_decision": "",
      "decision_reason": "",
      "created_at": "2026-07-19 08:10",
      "demo_flag": true
    },
    {
      "id": "quality-good-listening",
      "advisor_id": "advisor-hz-02",
      "customer_id": "customer-chen",
      "category": "客户理解",
      "risk_level": "low",
      "status": "candidate_best_practice",
      "original_message": "你可以把儿童推车和两个登机箱带来，我们按满员状态一起试装。",
      "trigger_rule": "准确回应客户具体顾虑并提出可验证下一步",
      "system_explanation": "顾问将抽象空间问题转化为真实物品试装，且没有做无法证明的保证。",
      "fact_ids": [
        "knowledge-l80-space"
      ],
      "repeat_count": 1,
      "employee_response": "",
      "manager_decision": "",
      "decision_reason": "",
      "created_at": "2026-07-18 21:30",
      "demo_flag": true
    }
  ],
  "coaching_plans": [],
  "best_practices": [
    {
      "id": "practice-space-test",
      "scenario": "二孩家庭空间顾虑",
      "customer_question": "第三排启用后还能否放下露营车和两个登机箱？",
      "advisor_approach": "邀请客户携带真实物品，按满员状态试乘与装载。",
      "why_effective": "把无法由统一参数回答的问题转化为客户可亲自验证的体验。",
      "result": "客户表达周日到店意愿（演示结果）",
      "audiences": [
        "二孩家庭",
        "露营家庭"
      ],
      "vehicle_ids": [
        "l80"
      ],
      "not_for": [
        "未确认客户授权的公开案例"
      ],
      "reviewer": "杭州城西体验店经理",
      "source": "脱敏演示沟通",
      "anonymous": true,
      "status": "published",
      "demo_flag": true
    },
    {
      "id": "practice-evening-drive",
      "scenario": "工作日晚间试驾",
      "customer_question": "周三晚上七点后是否方便？",
      "advisor_approach": "先确认可用时段，再提供通勤路线和停车说明。",
      "why_effective": "降低客户安排晚间体验的成本。",
      "result": "待经理确认",
      "audiences": [
        "城市通勤家庭"
      ],
      "vehicle_ids": [
        "l60"
      ],
      "not_for": [],
      "reviewer": "",
      "source": "脱敏演示沟通",
      "anonymous": true,
      "status": "candidate",
      "demo_flag": true
    }
  ],
  "customer_risks": [
    {
      "id": "risk-chen-price",
      "customer_id": "customer-chen",
      "level": "high",
      "reason": "价格与活动截止时间可能变化，但客户尚未收到更新说明。",
      "evidence": [
        "客户追问活动截止时间",
        "知识中心存在待同步版本"
      ],
      "impact": "可能造成信任下降或到店计划变化",
      "recommended_action": "完成知识同步后，由顾问发送带来源和时效说明的更新。",
      "manager_help": true,
      "due_at": "2026-07-19 18:00",
      "status": "open",
      "demo_flag": true
    },
    {
      "id": "risk-li-followup",
      "customer_id": "customer-li",
      "level": "medium",
      "reason": "首次到店后 48 小时内尚未确认全家共同体验时间。",
      "evidence": [
        "已完成一次到店",
        "决策人包括老人和配偶"
      ],
      "impact": "家庭决策链可能中断",
      "recommended_action": "由顾安确认全家可用时间，并提供老人上下车体验安排。",
      "manager_help": false,
      "due_at": "2026-07-20 17:00",
      "status": "open",
      "demo_flag": true
    }
  ],
  "experiments": [
    {
      "id": "experiment-reply-time",
      "name": "家庭空间咨询准备时间对比",
      "metric": "首次回复准备时间",
      "manual_process": "顾问手工查资料并组织回复",
      "personaflow_process": "客户状态、知识和合规同时准备",
      "validation": "固定案例手工计时",
      "sample_size": 6,
      "period": "2026-07-18 至 2026-07-25",
      "demo_flag": true,
      "status": "设计中",
      "conclusion": "尚未形成真实业务结论"
    },
    {
      "id": "experiment-fact-error",
      "name": "动态事实错误率双盲审核",
      "metric": "事实错误率",
      "manual_process": "人工自由撰写",
      "personaflow_process": "知识版本绑定与重新核验",
      "validation": "专家双盲标注",
      "sample_size": 0,
      "period": "待开始",
      "demo_flag": true,
      "status": "未开始",
      "conclusion": "尚未形成真实业务结论"
    }
  ],
  "notifications": [
    {
      "id": "notice-promise-1",
      "channel": "飞书机器人 Demo",
      "title": "试驾准备承诺即将到期",
      "body": "周辰需在 7 月 20 日 14:00 前准备儿童座椅和露营装备。",
      "status": "preview",
      "created_at": "2026-07-19 09:00",
      "demo_flag": true
    }
  ],
  "approvals": [],
  "revalidation_tasks": [],
  "audit_log": [
    {
      "id": "audit-init-1",
      "actor": "系统 Demo",
      "role": "总部运营空间",
      "action": "初始化企业演示工作区",
      "object_type": "workspace",
      "object_id": "enterprise-demo",
      "before": null,
      "after": {
        "scenario": "customer-space"
      },
      "knowledge_version": "onvo-cn-2026.07.18",
      "demo_flag": true,
      "workspace_id": "template",
      "created_at": "2026-07-19 09:00"
    }
  ],
  "demo_scenarios": [
    {
      "id": "knowledge-change",
      "name": "飞书知识变更",
      "description": "模拟 L80 活动截止时间提前并触发影响分析。"
    },
    {
      "id": "customer-space",
      "name": "客户空间顾虑",
      "description": "陈女士从空间咨询到家庭试驾和承诺。"
    },
    {
      "id": "promise-overdue",
      "name": "顾问承诺超时",
      "description": "模拟承诺到期、提醒和完成。"
    },
    {
      "id": "quality-coaching",
      "name": "质量与辅导",
      "description": "过期价格信号、员工说明和经理辅导。"
    },
    {
      "id": "best-practice",
      "name": "优秀案例",
      "description": "经理确认并发布场景试驾案例。"
    }
  ],
  "integrations": [
    {
      "name": "feishu",
      "label": "飞书知识",
      "mode": "demo",
      "connected": false,
      "ready": true,
      "notice": "演示连接器，未连接生产系统",
      "record_count": 2
    },
    {
      "name": "crm",
      "label": "CRM 客户",
      "mode": "demo",
      "connected": false,
      "ready": true,
      "notice": "演示连接器，未连接生产系统",
      "record_count": 2
    },
    {
      "name": "messaging",
      "label": "授权沟通渠道",
      "mode": "demo",
      "connected": false,
      "ready": true,
      "notice": "演示连接器，未连接生产系统",
      "record_count": 1
    },
    {
      "name": "trends",
      "label": "公开趋势",
      "mode": "demo",
      "connected": false,
      "ready": true,
      "notice": "演示连接器，未连接生产系统",
      "record_count": 1
    }
  ],
  "data_mode": "demo"
} as EnterpriseWorkspace
