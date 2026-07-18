import { ArrowDown, CheckCircle2, Database, FileCheck2, MessageSquareText, ShieldCheck, Sparkles, UsersRound } from 'lucide-react'

const flow = [
  { icon: MessageSquareText, title: '机会识别', text: '从客户消息、总部活动和历史反馈中找出今天值得处理的事项。' },
  { icon: UsersRound, title: '理解客户与顾问', text: '带入客户阶段、顾虑、顾问客群和表达习惯，而不是只套一个 Persona 标签。' },
  { icon: Sparkles, title: '多渠道内容', text: '私聊、朋友圈、小红书和短视频使用不同结构，并支持编辑和版本记录。' },
  { icon: FileCheck2, title: '事实逐句关联', text: '价格、车型定位等具体陈述绑定来源和核验日期。' },
  { icon: ShieldCheck, title: '审核与发送', text: '风险在正文内定位，经理只处理需要判断的内容；原型不会自动发布。' },
  { icon: Database, title: '反馈与记忆', text: '客户回复、试驾和高频顾虑进入时间线，影响下一轮沟通。' },
]

export function AboutPage() {
  return (
    <section className="about-page">
      <div className="about-hero"><p className="eyebrow">一句话定位</p><h2>帮助购车顾问把客户问题转化成可信沟通和试驾机会</h2><p>蔚见不是一个“输入主题、生成文案”的工具。它把机会、内容、事实、审核、跟进和记忆放进同一条可追溯的工作流。</p></div>
      <div className="flow-strip">{flow.map((item, index) => { const Icon = item.icon; return <div key={item.title} className="flow-node"><span><Icon size={20} /></span><div><strong>{item.title}</strong><p>{item.text}</p></div>{index < flow.length - 1 ? <ArrowDown className="flow-arrow" size={18} /> : null}</div> })}</div>
      <div className="about-columns">
        <article><h3>当前已经实现</h3>{['机会列表到内容作战台的完整跳转','多平台内容生成、编辑、保存与提交审核','官方事实来源和动态事实提醒','客户跟进时间线、记忆开关与试驾记录','门店审核和活动批量任务','DeepSeek / 规则兜底双路径'].map(item => <p key={item}><CheckCircle2 size={16} />{item}</p>)}</article>
        <article><h3>原型真实边界</h3><ul><li>客户、顾问与活动数据为脱敏演示数据，不代表真实 CRM。</li><li>车型事实来自公开页面，仍需在发布当天复核动态信息。</li><li>审核批准不会自动发布到社交平台。</li><li>顾问画像和记忆当前使用演示存储，生产环境需接入权限与数据库。</li><li>效果提升需要通过真实门店 A/B 测试验证，当前不虚构转化数据。</li></ul></article>
      </div>
    </section>
  )
}
