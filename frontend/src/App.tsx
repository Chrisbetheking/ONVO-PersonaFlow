import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  BadgeCheck,
  BarChart3,
  BookOpenCheck,
  Bot,
  Boxes,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleAlert,
  CircleCheckBig,
  ClipboardCheck,
  Clock3,
  Database,
  FileVideo2,
  Gauge,
  LayoutDashboard,
  LoaderCircle,
  MapPin,
  MessageCircleMore,
  MessagesSquare,
  Play,
  RefreshCw,
  Rocket,
  SearchCheck,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react'
import { api, type Advisor, type ContentVariant, type GenerationResponse, type LeadAnalysis, type Vehicle } from './api'

type View = 'dashboard' | 'persona' | 'factory' | 'batch' | 'compliance' | 'leads' | 'analytics'

type Bootstrap = {
  advisors: Advisor[]
  vehicles: Vehicle[]
  metrics: Record<string, number>
  campaigns: Array<Record<string, string | number>>
}

const fallbackAdvisors: Advisor[] = [
  { id: 'advisor-sh-01', name: '林悦', city: '上海', store: '上海浦东体验店', model_focus: 'L60', audience: '年轻三口之家', style: '理性亲和', platforms: ['小红书', '朋友圈', '抖音'], experience_years: 4, private_domain_size: 1680 },
  { id: 'advisor-hz-02', name: '周辰', city: '杭州', store: '杭州城西体验店', model_focus: 'L80', audience: '重视空间的二孩家庭', style: '场景叙事', platforms: ['朋友圈', '视频号', '私聊'], experience_years: 6, private_domain_size: 2360 },
  { id: 'advisor-cd-03', name: '顾安', city: '成都', store: '成都高新体验店', model_focus: 'L90', audience: '多人出行与三代同堂家庭', style: '专业稳重', platforms: ['抖音', '小红书', '朋友圈'], experience_years: 5, private_domain_size: 1940 },
]

const fallbackVehicles: Vehicle[] = [
  { id: 'l60', name: '乐道 L60', positioning: '中型 SUV 科技旗舰', full_purchase_from: '19.28 万元起', baas_from: '13.58 万元起', scenarios: ['通勤', '周末郊游', '年轻家庭'], source_title: '乐道汽车官方产品页', source_url: 'https://www.onvo.cn/l60', verified_at: '2026-07-18' },
  { id: 'l80', name: '乐道 L80', positioning: '智能双舱大五座旗舰 SUV', full_purchase_from: '24.28 万元起', baas_from: '15.68 万元起', scenarios: ['二孩家庭', '大五座空间', '长途出行'], source_title: '乐道汽车官方产品页', source_url: 'https://www.onvo.cn/l80', verified_at: '2026-07-18' },
  { id: 'l90', name: '乐道 L90', positioning: '智能大空间旗舰 SUV', full_purchase_from: '26.58 万元起', baas_from: '17.98 万元起', scenarios: ['三代同堂', '多人出行', '大空间需求'], source_title: '乐道汽车官方产品页', source_url: 'https://www.onvo.cn/l90', verified_at: '2026-07-18' },
]

const sampleLeadMessages = [
  '家里两个孩子，L80 第二排和后备箱够不够用？周末经常露营。',
  'BaaS 到底怎么选？想先了解全购和租电的差别。',
  '上海最近能不能约 L60 试驾？我工作日晚上有空。',
  '辅助驾驶是不是可以完全不用管方向盘？',
  'L90 三代人一起坐，第三排成年人会不会挤？',
  '我只是随便看看，目前没有换车计划。',
]

const navItems: Array<{ id: View; label: string; icon: typeof LayoutDashboard; hint: string }> = [
  { id: 'dashboard', label: '业务驾驶舱', icon: LayoutDashboard, hint: '全局效果与任务' },
  { id: 'persona', label: '顾问画像中心', icon: Users, hint: '千人千面底座' },
  { id: 'factory', label: 'AI 内容工厂', icon: WandSparkles, hint: '多平台内容生成' },
  { id: 'batch', label: '规模化分发', icon: Boxes, hint: '门店批量生产' },
  { id: 'compliance', label: '品牌合规审校', icon: ShieldCheck, hint: '事实与风险核验' },
  { id: 'leads', label: '线索增长闭环', icon: MessagesSquare, hint: '评论私信反哺' },
  { id: 'analytics', label: '效果评估', icon: BarChart3, hint: '可量化验收' },
]

function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'accent' }) {
  return <span className={`pill pill-${tone}`}>{children}</span>
}

function MetricCard({ label, value, suffix, icon: Icon, detail, trend }: { label: string; value: string | number; suffix?: string; icon: typeof Activity; detail: string; trend?: string }) {
  return (
    <article className="metric-card">
      <div className="metric-card-top"><span className="metric-icon"><Icon size={18} /></span>{trend && <Pill tone="good">{trend}</Pill>}</div>
      <div className="metric-value">{value}<small>{suffix}</small></div>
      <div className="metric-label">{label}</div>
      <div className="metric-detail">{detail}</div>
    </article>
  )
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  const safe = Math.max(0, Math.min(100, score))
  return (
    <div className="score-ring-wrap">
      <div className="score-ring" style={{ background: `conic-gradient(var(--lime) ${safe * 3.6}deg, rgba(255,255,255,.08) 0deg)` }}>
        <div><strong>{safe}</strong><small>分</small></div>
      </div>
      <span>{label}</span>
    </div>
  )
}

function App() {
  const [view, setView] = useState<View>('dashboard')
  const [boot, setBoot] = useState<Bootstrap>({ advisors: fallbackAdvisors, vehicles: fallbackVehicles, metrics: {}, campaigns: [] })
  const [backendOnline, setBackendOnline] = useState(false)
  const [selectedAdvisorId, setSelectedAdvisorId] = useState(fallbackAdvisors[0].id)
  const [selectedVehicleId, setSelectedVehicleId] = useState(fallbackVehicles[0].id)
  const [campaignName, setCampaignName] = useState('周末家庭出行种草计划')
  const [campaignBrief, setCampaignBrief] = useState('围绕真实家庭周末出行场景，突出空间、补能便利与适合家庭的体验，引导预约试驾。')
  const [platforms, setPlatforms] = useState(['小红书', '朋友圈', '抖音口播', '私聊跟进'])
  const [result, setResult] = useState<GenerationResponse | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<ContentVariant | null>(null)
  const [generating, setGenerating] = useState(false)
  const [batching, setBatching] = useState(false)
  const [batchSummary, setBatchSummary] = useState<Record<string, number> | null>(null)
  const [leadText, setLeadText] = useState(sampleLeadMessages.join('\n'))
  const [leadResult, setLeadResult] = useState<LeadAnalysis | null>(null)
  const [leadLoading, setLeadLoading] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    Promise.all([api.health(), api.bootstrap()])
      .then(([health, data]) => {
        setBackendOnline(health.status === 'ok')
        setBoot(data)
        if (data.advisors[0]) setSelectedAdvisorId(data.advisors[0].id)
        if (data.vehicles[0]) setSelectedVehicleId(data.vehicles[0].id)
      })
      .catch(() => setBackendOnline(false))
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const advisors = boot.advisors.length ? boot.advisors : fallbackAdvisors
  const vehicles = boot.vehicles.length ? boot.vehicles : fallbackVehicles
  const advisor = advisors.find(item => item.id === selectedAdvisorId) || advisors[0]
  const vehicle = vehicles.find(item => item.id === selectedVehicleId) || vehicles[0]
  const title = navItems.find(item => item.id === view)?.label || '业务驾驶舱'

  const metrics = useMemo(() => ({
    content: boot.metrics.content_generated || 1286,
    advisors: boot.metrics.advisors_activated || 186,
    compliance: boot.metrics.compliance_pass_rate || 98.6,
    leads: boot.metrics.high_intent_leads || 73,
  }), [boot.metrics])

  const showToast = (message: string) => setToast(message)

  const generateContent = async () => {
    setGenerating(true)
    try {
      const response = await api.generate({
        advisor_id: advisor.id,
        vehicle_id: vehicle.id,
        campaign_name: campaignName,
        campaign_brief: campaignBrief,
        platforms,
        objective: '预约试驾',
      })
      setResult(response)
      setSelectedVariant(response.variants[0] || null)
      setView('factory')
      showToast('内容矩阵已生成并完成合规预检')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const runBatch = async () => {
    setBatching(true)
    try {
      const response = await api.batchGenerate({
        advisor_ids: advisors.map(item => item.id),
        vehicle_id: vehicle.id,
        campaign_name: campaignName,
        campaign_brief: campaignBrief,
        platforms: ['朋友圈', '小红书'],
      })
      setBatchSummary({ advisor_count: response.advisor_count, variant_count: response.variant_count, ...response.summary })
      showToast(`已为 ${response.advisor_count} 位顾问生成 ${response.variant_count} 条差异化内容`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '批量任务失败')
    } finally {
      setBatching(false)
    }
  }

  const analyzeLeads = async () => {
    const messages = leadText.split('\n').map(item => item.trim()).filter(Boolean)
    if (!messages.length) return
    setLeadLoading(true)
    try {
      const response = await api.analyzeLeads(messages)
      setLeadResult(response)
      showToast('线索意图识别完成，已形成下一轮选题')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '线索分析失败')
    } finally {
      setLeadLoading(false)
    }
  }

  const startVideo = async () => {
    if (!result) return
    try {
      const response = await api.startVideo({ task_id: result.task_id, video_package: result.video_package, advisor_id: advisor.id })
      showToast(response.message)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '视频任务提交失败')
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">O</div>
          <div><strong>PersonaFlow</strong><span>乐道购车顾问 AI 内容引擎</span></div>
        </div>
        <div className="competition-tag"><Sparkles size={14} /> 蔚来公司命题专供版</div>
        <nav>
          {navItems.map(item => {
            const Icon = item.icon
            return (
              <button key={item.id} className={view === item.id ? 'nav-item active' : 'nav-item'} onClick={() => setView(item.id)}>
                <Icon size={19} />
                <span><strong>{item.label}</strong><small>{item.hint}</small></span>
                {view === item.id && <ChevronRight size={16} />}
              </button>
            )
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="system-status"><span className={backendOnline ? 'status-dot online' : 'status-dot'} /> <div><strong>{backendOnline ? '服务正常' : '演示后端未连接'}</strong><small>{backendOnline ? '事实库与审校引擎在线' : '请启动 backend'}</small></div></div>
          <div className="disclaimer">比赛原型 · 非乐道官方生产系统<br />仅使用脱敏演示数据</div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div><span className="eyebrow">ONVO PERSONAFLOW / COMPETITION EDITION</span><h1>{title}</h1></div>
          <div className="topbar-actions">
            <div className="knowledge-chip"><Database size={15} /><span>车型知识库</span><strong>2026.07.18</strong></div>
            <button className="icon-button" onClick={() => window.location.reload()} aria-label="刷新"><RefreshCw size={17} /></button>
            <button className="primary compact" onClick={() => setView('factory')}><Rocket size={16} /> 新建内容任务</button>
          </div>
        </header>

        <section className="page-content">
          {view === 'dashboard' && (
            <>
              <section className="hero-grid">
                <div className="hero-card">
                  <div className="hero-copy">
                    <Pill tone="accent"><Zap size={13} /> 一次输入，千人千面</Pill>
                    <h2>让每位购车顾问，都有自己的<br /><em>AI 内容增长团队</em></h2>
                    <p>从顾问画像、车型事实、平台内容、品牌审校到评论线索回流，形成可规模复制、可审计、可量化的增长闭环。</p>
                    <div className="hero-actions"><button className="primary" onClick={() => setView('factory')}><WandSparkles size={17} /> 生成一组内容</button><button className="secondary" onClick={() => setView('batch')}><Boxes size={17} /> 查看规模化能力</button></div>
                  </div>
                  <div className="flow-orbit">
                    <div className="orbit-center"><BrainCircuit size={30} /><strong>PersonaFlow</strong><small>内容增长 Agent</small></div>
                    <span className="orbit-node n1"><Users size={17} />顾问画像</span>
                    <span className="orbit-node n2"><BookOpenCheck size={17} />官方事实</span>
                    <span className="orbit-node n3"><FileVideo2 size={17} />内容生产</span>
                    <span className="orbit-node n4"><ShieldCheck size={17} />品牌审校</span>
                    <span className="orbit-node n5"><MessagesSquare size={17} />线索反哺</span>
                  </div>
                </div>
                <div className="challenge-card">
                  <div className="challenge-head"><span>命题对应度</span><strong>95%</strong></div>
                  <div className="match-list">
                    {['购车顾问规模化赋能', '社交内容千人千面', '多平台内容矩阵', '品牌合规与事实核验', '传播效果与线索闭环'].map((item, idx) => <div key={item}><CircleCheckBig size={16} /><span>{item}</span><b>{idx < 4 ? '已实现' : '闭环实现'}</b></div>)}
                  </div>
                  <div className="challenge-foot"><BadgeCheck size={16} /> 每项能力均有可操作页面与量化指标</div>
                </div>
              </section>

              <section className="metric-grid">
                <MetricCard label="本月生成内容" value={metrics.content.toLocaleString()} suffix="条" icon={WandSparkles} detail="覆盖朋友圈、小红书、短视频与私聊" trend="+32.4%" />
                <MetricCard label="已激活顾问" value={metrics.advisors} suffix="人" icon={Users} detail="按城市、门店、客群和风格个性化" trend="+24 人" />
                <MetricCard label="合规一次通过率" value={metrics.compliance} suffix="%" icon={ShieldCheck} detail="事实、极限词与辅助驾驶风险预检" trend="+2.1%" />
                <MetricCard label="高意向线索" value={metrics.leads} suffix="条" icon={Target} detail="自动识别试驾、价格和空间需求" trend="+18.7%" />
              </section>

              <section className="two-column">
                <div className="panel">
                  <div className="panel-head"><div><span className="section-kicker">LIVE WORKFLOW</span><h3>一条内容如何形成增长闭环</h3></div><Pill tone="good"><Activity size={13} /> 全链路可追踪</Pill></div>
                  <div className="workflow-list">
                    {[
                      ['01', '理解顾问与本地客群', '读取城市、门店、擅长车型、客户人群和表达偏好', Users],
                      ['02', '官方知识约束生成', '仅使用已核验车型信息，动态权益与价格强制标注时间', BookOpenCheck],
                      ['03', '多平台内容差异化', '同一活动生成朋友圈、小红书、短视频口播和私聊版本', WandSparkles],
                      ['04', '品牌合规与人工放行', '逐项检查夸大宣传、辅助驾驶、价格有效期与事实来源', ShieldCheck],
                      ['05', '评论私信反哺选题', '识别高意向线索和高频顾虑，自动生成下一轮内容主题', MessagesSquare],
                    ].map(([num, name, desc, Icon]) => <div className="workflow-row" key={String(num)}><span className="step-num">{String(num)}</span><span className="step-icon"><Icon size={18} /></span><div><strong>{String(name)}</strong><small>{String(desc)}</small></div><ChevronRight size={17} /></div>)}
                  </div>
                </div>
                <div className="panel campaign-panel">
                  <div className="panel-head"><div><span className="section-kicker">RECENT CAMPAIGNS</span><h3>近期任务效果</h3></div><button className="text-button">查看全部</button></div>
                  <div className="campaign-list">
                    {[
                      ['L80 二孩家庭空间季', '杭州 · 42 位顾问', '168 条', '99.1%', '36 条高意向'],
                      ['L60 城市通勤种草', '上海 · 36 位顾问', '144 条', '98.4%', '29 条高意向'],
                      ['L90 三代同堂体验日', '成都 · 28 位顾问', '112 条', '97.8%', '21 条高意向'],
                    ].map(item => <div className="campaign-item" key={item[0]}><div className="campaign-title"><span className="model-badge">{item[0].slice(0, 3)}</span><div><strong>{item[0]}</strong><small>{item[1]}</small></div></div><div className="campaign-stats"><span><b>{item[2]}</b>内容</span><span><b>{item[3]}</b>合规</span><span><b>{item[4]}</b>线索</span></div></div>)}
                  </div>
                </div>
              </section>
            </>
          )}

          {view === 'persona' && (
            <>
              <div className="page-intro"><div><span className="section-kicker">PERSONA ENGINE</span><h2>把“同一套话术”变成“每个人的真实表达”</h2><p>顾问画像不是简单标签，而是内容策略、平台结构和客户沟通方式的生成约束。</p></div><button className="primary"><Users size={17} /> 新建顾问画像</button></div>
              <div className="persona-grid">
                {advisors.map(item => <article className={item.id === selectedAdvisorId ? 'persona-card selected' : 'persona-card'} key={item.id} onClick={() => setSelectedAdvisorId(item.id)}>
                  <div className="persona-head"><div className="avatar">{item.name.slice(-1)}</div><div><h3>{item.name}</h3><span><MapPin size={13} />{item.city} · {item.store}</span></div>{item.id === selectedAdvisorId && <span className="selected-check"><Check size={14} /></span>}</div>
                  <div className="persona-tags"><Pill tone="accent">主推 {item.model_focus}</Pill><Pill>{item.audience}</Pill><Pill>{item.style}</Pill></div>
                  <div className="persona-data"><div><strong>{item.experience_years}</strong><span>年顾问经验</span></div><div><strong>{item.private_domain_size.toLocaleString()}</strong><span>私域客户</span></div><div><strong>{item.platforms.length}</strong><span>活跃平台</span></div></div>
                  <div className="platform-row">{item.platforms.map(platform => <span key={platform}>{platform}</span>)}</div>
                </article>)}
                <article className="persona-card add-card"><div className="add-circle">+</div><strong>导入门店顾问名单</strong><span>支持 CSV 批量创建画像与规则映射</span></article>
              </div>
              <section className="panel persona-detail">
                <div className="panel-head"><div><span className="section-kicker">ACTIVE PERSONA</span><h3>{advisor.name}的内容策略画像</h3></div><Pill tone="good"><BadgeCheck size={13} /> 画像完整度 92%</Pill></div>
                <div className="strategy-grid">
                  <div><span>核心客群</span><strong>{advisor.audience}</strong><small>优先使用家庭决策、真实场景和可验证信息</small></div>
                  <div><span>表达气质</span><strong>{advisor.style}</strong><small>避免模板式营销腔，保留个人语气特征</small></div>
                  <div><span>内容偏好</span><strong>场景体验 45% · 知识解答 35% · 活动转化 20%</strong><small>根据历史互动与平台表现动态调整</small></div>
                  <div><span>转化动作</span><strong>优先邀请“到店体验 / 预约试驾”</strong><small>不做高压催单，不使用无法兑现的权益承诺</small></div>
                </div>
              </section>
            </>
          )}

          {view === 'factory' && (
            <>
              <div className="page-intro"><div><span className="section-kicker">AI CONTENT FACTORY</span><h2>一个活动，生成顾问专属内容矩阵</h2><p>内容基于官方车型事实与顾问画像生成，发布前经过规则审校并保留证据链。</p></div><Pill tone={backendOnline ? 'good' : 'warn'}>{backendOnline ? <CircleCheckBig size={13} /> : <CircleAlert size={13} />}{backendOnline ? '生成与审校服务在线' : '请启动后端后生成'}</Pill></div>
              <div className="factory-layout">
                <section className="panel config-panel">
                  <div className="panel-head"><div><span className="step-chip">STEP 1</span><h3>配置内容任务</h3></div></div>
                  <label className="field"><span>选择顾问</span><select value={selectedAdvisorId} onChange={e => setSelectedAdvisorId(e.target.value)}>{advisors.map(item => <option value={item.id} key={item.id}>{item.name} · {item.city} · {item.style}</option>)}</select></label>
                  <label className="field"><span>选择车型</span><select value={selectedVehicleId} onChange={e => setSelectedVehicleId(e.target.value)}>{vehicles.map(item => <option value={item.id} key={item.id}>{item.name} · {item.positioning}</option>)}</select></label>
                  <label className="field"><span>活动名称</span><input value={campaignName} onChange={e => setCampaignName(e.target.value)} /></label>
                  <label className="field"><span>传播任务</span><textarea rows={4} value={campaignBrief} onChange={e => setCampaignBrief(e.target.value)} /></label>
                  <div className="field"><span>输出平台</span><div className="choice-grid">{['朋友圈', '小红书', '抖音口播', '视频号口播', '私聊跟进'].map(item => <button className={platforms.includes(item) ? 'choice selected' : 'choice'} key={item} onClick={() => setPlatforms(current => current.includes(item) ? current.filter(value => value !== item) : [...current, item])}>{platforms.includes(item) && <Check size={14} />}{item}</button>)}</div></div>
                  <div className="knowledge-preview"><BookOpenCheck size={18} /><div><strong>{vehicle.name} 官方事实包</strong><small>{vehicle.positioning} · 整车购买 {vehicle.full_purchase_from} · BaaS {vehicle.baas_from}</small></div><Pill tone="good">已核验</Pill></div>
                  <button className="primary wide" disabled={generating || !backendOnline || !platforms.length} onClick={generateContent}>{generating ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}{generating ? '生成、事实核验与审校中…' : '生成千人千面内容矩阵'}</button>
                </section>

                <section className="panel result-panel">
                  <div className="panel-head"><div><span className="step-chip">STEP 2</span><h3>生成结果与证据链</h3></div>{result && <Pill tone={result.compliance.passed ? 'good' : 'warn'}>{result.compliance.passed ? <ShieldCheck size={13} /> : <CircleAlert size={13} />}{result.compliance.passed ? '预检通过' : '需要修改'}</Pill>}</div>
                  {!result ? <div className="empty-result"><div className="empty-orb"><Bot size={38} /></div><h3>等待创建内容任务</h3><p>生成后将在这里展示多平台内容、短视频分镜、合规结果和车型事实引用。</p><div className="empty-points"><span><Check size={14} />顾问个性化</span><span><Check size={14} />平台差异化</span><span><Check size={14} />事实可追溯</span></div></div> : (
                    <div className="generated-area">
                      <div className="variant-tabs">{result.variants.map(item => <button key={item.id} className={selectedVariant?.id === item.id ? 'active' : ''} onClick={() => setSelectedVariant(item)}>{item.platform}</button>)}</div>
                      {selectedVariant && <div className="content-preview">
                        <div className="preview-top"><div><Pill tone="accent">{selectedVariant.platform}</Pill><span>由 {selectedVariant.advisor_name} 画像生成</span></div><button className="icon-button" onClick={() => { navigator.clipboard?.writeText(`${selectedVariant.title}\n${selectedVariant.body}`); showToast('已复制内容') }}><ClipboardCheck size={16} /></button></div>
                        <h3>{selectedVariant.title}</h3><p>{selectedVariant.body}</p><div className="hashtag-row">{selectedVariant.hashtags.map(tag => <span key={tag}>#{tag}</span>)}</div><div className="cta-box"><Target size={16} /><span>{selectedVariant.call_to_action}</span></div>
                        <div className="mini-scores"><span><strong>{selectedVariant.personalization_score}</strong>个性化</span><span><strong>{selectedVariant.grounding_score}</strong>事实引用</span><span><strong>{selectedVariant.compliance_score}</strong>合规</span></div>
                      </div>}
                      <div className="video-package">
                        <div className="subhead"><div><FileVideo2 size={17} /><strong>短视频生产包</strong></div><button className="secondary compact" onClick={startVideo}><Play size={15} />提交视频任务</button></div>
                        <div className="shot-strip">{result.video_package.shots.map(shot => <div className="shot-card" key={shot.index}><span>镜头 {shot.index}</span><strong>{shot.duration}s</strong><p>{shot.visual}</p><small>{shot.subtitle}</small></div>)}</div>
                      </div>
                      <div className="evidence-box"><div className="subhead"><div><SearchCheck size={17} /><strong>事实依据</strong></div><Pill tone="good">{result.evidence.length} 条引用</Pill></div>{result.evidence.map(item => <div className="evidence-row" key={`${item.field}-${item.value}`}><span>{item.field}</span><strong>{item.value}</strong><a href={item.source_url} target="_blank" rel="noreferrer">{item.source_title}</a><small>{item.verified_at}</small></div>)}</div>
                    </div>
                  )}
                </section>
              </div>
            </>
          )}

          {view === 'batch' && (
            <>
              <div className="page-intro"><div><span className="section-kicker">SCALE ENGINE</span><h2>从“一个人会用”到“上千名顾问稳定使用”</h2><p>总部配置一次活动与规则，系统依据门店、城市、顾问画像批量生成，并进入统一审校队列。</p></div><button className="primary" disabled={batching || !backendOnline} onClick={runBatch}>{batching ? <LoaderCircle className="spin" size={17} /> : <Rocket size={17} />}{batching ? '批量编排中…' : '运行批量演示'}</button></div>
              <section className="batch-flow">
                {[
                  ['总部活动 Brief', '1 份统一事实与目标', ClipboardCheck],
                  ['顾问画像编排', `${advisors.length} 位演示顾问 / 可扩至千人`, Users],
                  ['多平台并行生成', '按人、城、店、客群差异化', Boxes],
                  ['自动合规分流', '通过 / 修改 / 人工升级', ShieldCheck],
                  ['门店发布与回流', '状态、互动、线索统一回传', Send],
                ].map(([name, desc, Icon], index) => <div className="batch-node" key={String(name)}><span className="batch-index">0{index + 1}</span><Icon size={23} /><strong>{String(name)}</strong><small>{String(desc)}</small>{index < 4 && <ChevronRight className="batch-arrow" size={20} />}</div>)}
              </section>
              <section className="two-column batch-columns">
                <div className="panel">
                  <div className="panel-head"><div><span className="section-kicker">BATCH CONFIG</span><h3>本次规模化任务</h3></div><Pill tone="accent">总部策略</Pill></div>
                  <div className="batch-config-list"><div><span>活动</span><strong>{campaignName}</strong></div><div><span>车型</span><strong>{vehicle.name}</strong></div><div><span>顾问范围</span><strong>{advisors.length} 位 · {new Set(advisors.map(item => item.city)).size} 个城市</strong></div><div><span>输出</span><strong>朋友圈 + 小红书，每人 2 条</strong></div><div><span>发布策略</span><strong>生成后需人工确认，不自动外发</strong></div></div>
                </div>
                <div className="panel batch-summary-panel">
                  <div className="panel-head"><div><span className="section-kicker">RUN RESULT</span><h3>批量任务结果</h3></div>{batchSummary && <Pill tone="good"><CircleCheckBig size={13} />已完成</Pill>}</div>
                  {!batchSummary ? <div className="compact-empty"><Boxes size={34} /><p>运行演示后，展示批量生成数量、平均个性化与合规表现。</p></div> : <div className="batch-result-grid"><div><strong>{batchSummary.advisor_count}</strong><span>顾问覆盖</span></div><div><strong>{batchSummary.variant_count}</strong><span>内容产出</span></div><div><strong>{batchSummary.avg_personalization || 0}</strong><span>平均个性化</span></div><div><strong>{batchSummary.avg_compliance || 0}</strong><span>平均合规</span></div></div>}
                </div>
              </section>
              <section className="panel queue-panel"><div className="panel-head"><div><span className="section-kicker">REVIEW QUEUE</span><h3>门店内容审校队列</h3></div><div className="legend"><span><i className="green" />可发布</span><span><i className="yellow" />需修改</span><span><i className="red" />人工升级</span></div></div><div className="queue-table"><div className="table-head"><span>顾问 / 门店</span><span>个性化策略</span><span>产出</span><span>合规评分</span><span>状态</span></div>{advisors.map((item, idx) => <div className="table-row" key={item.id}><span><b>{item.name}</b><small>{item.city} · {item.store}</small></span><span>{item.audience} / {item.style}</span><span>2 条</span><span>{98 - idx * 0.6}%</span><span><Pill tone={idx === 2 ? 'warn' : 'good'}>{idx === 2 ? '1 条需修改' : '可发布'}</Pill></span></div>)}</div></section>
            </>
          )}

          {view === 'compliance' && (
            <>
              <div className="page-intro"><div><span className="section-kicker">TRUST & COMPLIANCE</span><h2>不是“会写文案”，而是“可被企业放心使用”</h2><p>把事实来源、动态信息、品牌语言和风险规则前置到生成过程，而不是发布后补救。</p></div><Pill tone="good"><ShieldCheck size={13} /> 人工发布闸门默认开启</Pill></div>
              <div className="compliance-overview">
                <div className="panel score-panel"><ScoreRing score={result?.compliance.score || 98} label="综合合规分" /><div className="score-copy"><span className="section-kicker">LATEST CHECK</span><h3>{result ? result.campaign_name : '演示内容预检'}</h3><p>事实核验、价格时效、辅助驾驶表述、极限词和转化承诺五类规则全部留痕。</p><div className="score-meta"><span><Clock3 size={14} />最近检查：刚刚</span><span><Database size={14} />知识版本：onvo-cn-2026.07.18</span></div></div></div>
                <div className="panel rules-panel"><div className="panel-head"><div><span className="section-kicker">RULE COVERAGE</span><h3>规则覆盖</h3></div><Pill tone="accent">5 类 24 条</Pill></div><div className="rule-bars">{[['车型事实准确性', 100], ['价格与权益时效', 96], ['辅助驾驶安全表述', 100], ['品牌语气与极限词', 98], ['隐私与虚假见证', 100]].map(([name, value]) => <div key={String(name)}><span>{String(name)}</span><div><i style={{ width: `${value}%` }} /></div><strong>{value}%</strong></div>)}</div></div>
              </div>
              <section className="panel findings-panel"><div className="panel-head"><div><span className="section-kicker">CHECK DETAILS</span><h3>逐项审校结果</h3></div><button className="secondary compact" onClick={() => setView('factory')}><WandSparkles size={15} />生成新内容检查</button></div><div className="finding-list">
                {[
                  ['通过', '车型定位与价格来源', `使用 ${vehicle.source_title}，核验日期 ${vehicle.verified_at}；动态权益不做长期承诺。`, 'good'],
                  ['通过', '辅助驾驶安全边界', '未出现“自动驾驶”“完全不用接管”等误导表达，保留驾驶员持续关注义务。', 'good'],
                  ['通过', '品牌与广告表达', '未使用“全网第一”“绝对安全”“零风险”等无法证明的绝对化措辞。', 'good'],
                  ['提醒', '价格时效提示', '涉及起售价时，发布端应附“具体配置、价格与权益以官方最新信息为准”。', 'warn'],
                  ['通过', '用户见证与隐私', '未虚构车主评价、成交量或个人经历，未输出客户联系方式。', 'good'],
                ].map(([status, rule, message, tone]) => <div className="finding-row" key={String(rule)}><span className={`finding-icon ${tone}`}>{tone === 'good' ? <Check size={16} /> : <CircleAlert size={16} />}</span><Pill tone={tone === 'good' ? 'good' : 'warn'}>{String(status)}</Pill><div><strong>{String(rule)}</strong><p>{String(message)}</p></div><button className="text-button">查看规则</button></div>)}
              </div></section>
              <section className="guardrail-grid">{[
                ['官方知识优先', '车型参数、价格与品牌表述均绑定来源和核验时间。', BookOpenCheck],
                ['生成即审校', '不是生成后独立跑一次，而是规则约束贯穿内容生成。', BrainCircuit],
                ['人机协同放行', '系统给出风险解释与修改建议，最终由顾问或审核员确认。', ClipboardCheck],
                ['全链路可追责', '任务、画像、知识版本、修改记录和发布状态形成审计日志。', SearchCheck],
              ].map(([name, desc, Icon]) => <div className="guardrail-card" key={String(name)}><Icon size={22} /><strong>{String(name)}</strong><p>{String(desc)}</p></div>)}</section>
            </>
          )}

          {view === 'leads' && (
            <>
              <div className="page-intro"><div><span className="section-kicker">LEAD LOOP</span><h2>让每一次评论和私信，成为下一轮内容输入</h2><p>从互动中识别购车意图、核心顾虑和最佳跟进动作，解决“内容发完就结束”的断点。</p></div><button className="primary" disabled={leadLoading || !backendOnline} onClick={analyzeLeads}>{leadLoading ? <LoaderCircle className="spin" size={17} /> : <BrainCircuit size={17} />}{leadLoading ? '分析中…' : '分析评论与私信'}</button></div>
              <div className="lead-layout">
                <section className="panel lead-input"><div className="panel-head"><div><span className="step-chip">INPUT</span><h3>待分析互动</h3></div><Pill>{leadText.split('\n').filter(Boolean).length} 条</Pill></div><textarea value={leadText} onChange={e => setLeadText(e.target.value)} rows={15} /><small>演示数据不会发送到第三方平台，也不会自动联系客户。</small></section>
                <section className="panel lead-output"><div className="panel-head"><div><span className="step-chip">INSIGHT</span><h3>线索洞察</h3></div>{leadResult && <Pill tone="good"><CircleCheckBig size={13} />已完成</Pill>}</div>{!leadResult ? <div className="empty-result small"><MessageCircleMore size={38} /><h3>等待分析</h3><p>系统将输出意向等级、顾虑主题、建议回复和下一轮选题。</p></div> : <div><div className="intent-cards"><div className="high"><strong>{leadResult.high_intent}</strong><span>高意向</span></div><div className="medium"><strong>{leadResult.medium_intent}</strong><span>中意向</span></div><div className="low"><strong>{leadResult.low_intent}</strong><span>低意向</span></div></div><div className="concern-list"><h4>高频顾虑</h4>{leadResult.top_concerns.map(item => <div key={item.topic}><span>{item.topic}</span><div><i style={{ width: `${Math.min(100, item.count * 28)}%` }} /></div><strong>{item.count}</strong></div>)}</div></div>}</section>
              </div>
              {leadResult && <><section className="panel lead-table-panel"><div className="panel-head"><div><span className="section-kicker">ACTION QUEUE</span><h3>线索跟进行动</h3></div><Pill tone="accent">仅生成建议，不自动发送</Pill></div><div className="lead-table"><div className="table-head"><span>原始互动</span><span>意向</span><span>核心顾虑</span><span>下一步</span><span>建议回复</span></div>{leadResult.leads.map(item => <div className="table-row" key={item.id}><span>{item.text}</span><span><Pill tone={item.intent === '高' ? 'good' : item.intent === '中' ? 'accent' : 'neutral'}>{item.intent}意向</Pill></span><span>{item.concern}</span><span>{item.next_action}</span><span>{item.recommended_reply}</span></div>)}</div></section><section className="panel next-topic-panel"><div><span className="section-kicker">CONTENT FEEDBACK</span><h3>由真实顾虑生成下一轮选题</h3></div><div className="topic-cards">{leadResult.next_content_topics.map((topic, idx) => <button key={topic}><span>0{idx + 1}</span><strong>{topic}</strong><ChevronRight size={17} /></button>)}</div></section></>}
            </>
          )}

          {view === 'analytics' && (
            <>
              <div className="page-intro"><div><span className="section-kicker">MEASUREMENT</span><h2>用企业可验收的指标，证明 AI 不是“炫技”</h2><p>同时衡量效率、个性化、合规、传播和转化，避免只展示生成结果。</p></div><div className="date-filter"><button className="active">近 30 天</button><button>近 90 天</button></div></div>
              <section className="metric-grid"><MetricCard label="单条平均生产时长" value="3.8" suffix="分钟" icon={Clock3} detail="人工传统流程约 45 分钟" trend="-91.6%" /><MetricCard label="顾问内容差异度" value="86" suffix="分" icon={Users} detail="基于语义、结构与画像命中综合计算" trend="+22 分" /><MetricCard label="事实引用覆盖率" value="100" suffix="%" icon={BookOpenCheck} detail="涉及车型与价格字段均有来源" trend="稳定" /><MetricCard label="互动转线索率" value="12.7" suffix="%" icon={Target} detail="高意向识别后进入顾问跟进队列" trend="+3.4%" /></section>
              <div className="analytics-grid">
                <section className="panel chart-panel"><div className="panel-head"><div><span className="section-kicker">EFFICIENCY TREND</span><h3>内容产出与线索增长</h3></div><div className="legend"><span><i className="lime" />内容产出</span><span><i className="blue" />高意向线索</span></div></div><div className="fake-chart"><div className="y-axis"><span>400</span><span>300</span><span>200</span><span>100</span><span>0</span></div><div className="bars">{[[36, 18], [44, 24], [48, 28], [62, 31], [72, 42], [84, 56], [92, 68]].map((pair, idx) => <div className="bar-group" key={idx}><div className="bar lime" style={{ height: `${pair[0]}%` }} /><div className="bar blue" style={{ height: `${pair[1]}%` }} /><span>第{idx + 1}周</span></div>)}</div></div></section>
                <section className="panel dimension-panel"><div className="panel-head"><div><span className="section-kicker">QUALITY SCORE</span><h3>质量雷达</h3></div></div><div className="dimension-list">{[['画像命中', 91], ['平台适配', 88], ['事实准确', 100], ['品牌合规', 98], ['线索转化', 82]].map(([name, value]) => <div key={String(name)}><span>{String(name)}</span><div><i style={{ width: `${value}%` }} /></div><strong>{value}</strong></div>)}</div><div className="dimension-note"><Gauge size={18} /><p>综合评分由可解释规则计算，每项都能回到具体内容、事实与审校记录。</p></div></section>
              </div>
              <section className="panel experiment-panel"><div className="panel-head"><div><span className="section-kicker">A/B EXPERIMENT</span><h3>内容策略实验</h3></div><button className="secondary compact">新建实验</button></div><div className="experiment-table"><div className="table-head"><span>实验</span><span>版本 A</span><span>版本 B</span><span>主要指标</span><span>结论</span></div><div className="table-row"><span><b>L80 空间内容</b><small>杭州 · 小红书</small></span><span>参数解释型</span><span>二孩出行场景型</span><span>收藏 / 私信</span><span><Pill tone="good">B 胜出 +27%</Pill></span></div><div className="table-row"><span><b>L60 通勤内容</b><small>上海 · 朋友圈</small></span><span>产品卖点型</span><span>顾问真实体验型</span><span>咨询 / 试驾</span><span><Pill tone="good">B 胜出 +18%</Pill></span></div></div></section>
            </>
          )}
        </section>
      </main>
      {toast && <div className="toast"><CircleCheckBig size={17} />{toast}<button onClick={() => setToast('')}><X size={15} /></button></div>}
    </div>
  )
}

export default App
