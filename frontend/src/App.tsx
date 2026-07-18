import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Bot,
  Boxes,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Copy,
  Download,
  FileCheck2,
  FileVideo2,
  Gauge,
  Home,
  LoaderCircle,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react'
import {
  api,
  type Advisor,
  type ComplianceResult,
  type ContentVariant,
  type GenerationResponse,
  type HealthResponse,
  type LeadAnalysis,
  type Vehicle,
} from './api'

type View = 'create' | 'advisors' | 'batch' | 'review' | 'leads' | 'about'

type Bootstrap = {
  advisors: Advisor[]
  vehicles: Vehicle[]
  defaults: { campaign_name: string; campaign_brief: string; platforms: string[] }
  data_notice: string
}

const fallbackAdvisors: Advisor[] = [
  { id: 'advisor-sh-01', name: '林悦', city: '上海', store: '上海浦东体验店', model_focus: 'L60', audience: '年轻三口之家', style: '理性亲和', platforms: ['小红书', '朋友圈', '抖音'], experience_years: 4, private_domain_size: 1680 },
  { id: 'advisor-hz-02', name: '周辰', city: '杭州', store: '杭州城西体验店', model_focus: 'L80', audience: '重视空间的二孩家庭', style: '场景叙事', platforms: ['朋友圈', '视频号', '私聊'], experience_years: 6, private_domain_size: 2360 },
  { id: 'advisor-cd-03', name: '顾安', city: '成都', store: '成都高新体验店', model_focus: 'L90', audience: '多人出行与三代同堂家庭', style: '专业稳重', platforms: ['抖音', '小红书', '朋友圈'], experience_years: 5, private_domain_size: 1940 },
]

const fallbackVehicles: Vehicle[] = [
  { id: 'l60', name: '乐道 L60', positioning: '中型 SUV 科技旗舰', full_purchase_from: '19.28 万元起', baas_from: '13.58 万元起', scenarios: ['城市通勤', '年轻家庭', '周末郊游'], source_title: '乐道 L60 官方产品页', source_url: 'https://www.onvo.cn/l60', verified_at: '2026-07-18' },
  { id: 'l80', name: '乐道 L80', positioning: '智能双舱大五座旗舰 SUV', full_purchase_from: '24.28 万元起', baas_from: '15.68 万元起', scenarios: ['二孩家庭', '大五座空间', '长途出行'], source_title: '乐道 L80 官方产品页', source_url: 'https://www.onvo.cn/l80', verified_at: '2026-07-18' },
  { id: 'l90', name: '乐道 L90', positioning: '智能大空间旗舰 SUV', full_purchase_from: '26.58 万元起', baas_from: '17.98 万元起', scenarios: ['三代同堂', '多人出行', '家庭大三排'], source_title: '乐道 L90 官方产品页', source_url: 'https://www.onvo.cn/l90', verified_at: '2026-07-18' },
]

const sampleLeads = [
  '家里两个孩子，L80 第二排和后备箱够不够用？周末经常露营。',
  'BaaS 到底怎么选？想先了解全购和租电的差别。',
  '上海最近能不能约 L60 试驾？我工作日晚上有空。',
  '辅助驾驶是不是可以完全不用管方向盘？',
].join('\n')

const platformOptions = ['朋友圈', '小红书', '抖音口播', '视频号口播', '私聊跟进']

const navigation: Array<{ id: View; label: string; hint: string; icon: typeof Home }> = [
  { id: 'create', label: '内容任务', hint: '从需求到可发布内容', icon: Home },
  { id: 'advisors', label: '顾问与门店', hint: '管理表达与客群差异', icon: Users },
  { id: 'batch', label: '批量生成', hint: '一个活动，多位顾问', icon: Boxes },
  { id: 'review', label: '审核中心', hint: '事实、风险与发布闸门', icon: ShieldCheck },
  { id: 'leads', label: '客户反馈', hint: '把评论变成下一条内容', icon: MessagesSquare },
  { id: 'about', label: '方案说明', hint: '看清系统怎样工作', icon: BriefcaseBusiness },
]

const pageTitles: Record<View, { title: string; subtitle: string }> = {
  create: { title: '新建内容任务', subtitle: '先确定顾问、车型和真实传播目标，再生成不同平台的版本。' },
  advisors: { title: '顾问与门店', subtitle: '画像不是标签堆砌，而是决定内容说什么、怎么说、对谁说。' },
  batch: { title: '批量生成', subtitle: '总部只配置一次活动，门店顾问得到符合自身客群和表达习惯的版本。' },
  review: { title: '审核中心', subtitle: '把事实来源和风险检查放在发布之前。' },
  leads: { title: '客户反馈', subtitle: '识别真实问题、跟进优先级，并把高频顾虑变成下一轮选题。' },
  about: { title: '方案说明', subtitle: '这不是文案生成器，而是一套可审、可追溯、可规模化的内容工作流。' },
}

function cx(...items: Array<string | false | undefined>) {
  return items.filter(Boolean).join(' ')
}

function StatusDot({ online }: { online: boolean }) {
  return <span className={cx('status-dot', online && 'online')} />
}

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'dark' }) {
  return <span className={cx('badge', `badge-${tone}`)}>{children}</span>
}

function Empty({ icon: Icon, title, text }: { icon: typeof Bot; title: string; text: string }) {
  return <div className="empty"><span><Icon size={24} /></span><h3>{title}</h3><p>{text}</p></div>
}

function App() {
  const [view, setView] = useState<View>('create')
  const [boot, setBoot] = useState<Bootstrap>({
    advisors: fallbackAdvisors,
    vehicles: fallbackVehicles,
    defaults: {
      campaign_name: '周末家庭用车体验',
      campaign_brief: '围绕真实家庭周末出行场景，说明空间、补能和日常使用体验，引导用户按自己的路线预约试驾。',
      platforms: ['朋友圈', '小红书', '抖音口播', '私聊跟进'],
    },
    data_notice: '当前使用脱敏示例顾问画像。',
  })
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [connectionError, setConnectionError] = useState('')
  const [advisorId, setAdvisorId] = useState(fallbackAdvisors[0].id)
  const [vehicleId, setVehicleId] = useState(fallbackVehicles[0].id)
  const [campaignName, setCampaignName] = useState('周末家庭用车体验')
  const [campaignBrief, setCampaignBrief] = useState('围绕真实家庭周末出行场景，说明空间、补能和日常使用体验，引导用户按自己的路线预约试驾。')
  const [platforms, setPlatforms] = useState(['朋友圈', '小红书', '抖音口播', '私聊跟进'])
  const [useAi, setUseAi] = useState(true)
  const [result, setResult] = useState<GenerationResponse | null>(null)
  const [activeVariantId, setActiveVariantId] = useState('')
  const [generating, setGenerating] = useState(false)
  const [batching, setBatching] = useState(false)
  const [batchResult, setBatchResult] = useState<{ advisor_count: number; variant_count: number; summary: Record<string, number>; warnings: string[] } | null>(null)
  const [reviewText, setReviewText] = useState('')
  const [reviewResult, setReviewResult] = useState<ComplianceResult | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [leadText, setLeadText] = useState(sampleLeads)
  const [leadResult, setLeadResult] = useState<LeadAnalysis | null>(null)
  const [leadLoading, setLeadLoading] = useState(false)
  const [toast, setToast] = useState('')

  const advisors = boot.advisors.length ? boot.advisors : fallbackAdvisors
  const vehicles = boot.vehicles.length ? boot.vehicles : fallbackVehicles
  const advisor = advisors.find(item => item.id === advisorId) || advisors[0]
  const vehicle = vehicles.find(item => item.id === vehicleId) || vehicles[0]
  const activeVariant = result?.variants.find(item => item.id === activeVariantId) || result?.variants[0] || null
  const providerReady = Boolean(health?.provider.ready)
  const backendOnline = health?.status === 'ok'

  useEffect(() => {
    refreshConnection()
  }, [])

  async function refreshConnection() {
    setConnectionError('')
    try {
      const [healthData, bootData] = await Promise.all([api.health(), api.bootstrap()])
      setHealth(healthData)
      setBoot(bootData)
      setCampaignName(current => current || bootData.defaults.campaign_name)
      setCampaignBrief(current => current || bootData.defaults.campaign_brief)
      if (!currentPlatformSelectionValid(platforms)) setPlatforms(bootData.defaults.platforms)
      if (bootData.advisors[0] && !bootData.advisors.some(item => item.id === advisorId)) setAdvisorId(bootData.advisors[0].id)
      if (bootData.vehicles[0] && !bootData.vehicles.some(item => item.id === vehicleId)) setVehicleId(bootData.vehicles[0].id)
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : '后端连接失败')
      setHealth(null)
    }
  }

  function currentPlatformSelectionValid(items: string[]) {
    return items.length > 0 && items.every(item => platformOptions.includes(item))
  }

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }

  function togglePlatform(platform: string) {
    setPlatforms(current => current.includes(platform) ? current.filter(item => item !== platform) : [...current, platform])
  }

  async function generate() {
    if (!backendOnline) return showToast('后端服务还没有连接成功')
    if (!campaignName.trim() || !campaignBrief.trim() || !platforms.length) return showToast('请把任务信息填写完整')
    setGenerating(true)
    try {
      const data = await api.generate({
        advisor_id: advisor.id,
        vehicle_id: vehicle.id,
        campaign_name: campaignName.trim(),
        campaign_brief: campaignBrief.trim(),
        platforms,
        objective: '预约试驾',
        use_llm: useAi,
      })
      setResult(data)
      setActiveVariantId(data.variants[0]?.id || '')
      setReviewText(data.variants.map(item => `${item.title}\n${item.body}\n${item.call_to_action}`).join('\n\n'))
      showToast(data.audit.ai_used ? `已由 ${data.audit.provider || 'AI'} 生成并完成预检` : '已生成基础版本并完成预检')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  async function runBatch() {
    if (!backendOnline) return showToast('后端服务还没有连接成功')
    setBatching(true)
    try {
      const data = await api.batchGenerate({
        advisor_ids: advisors.map(item => item.id),
        vehicle_id: vehicle.id,
        campaign_name: campaignName.trim(),
        campaign_brief: campaignBrief.trim(),
        platforms: ['朋友圈', '小红书'],
        use_llm: false,
      })
      setBatchResult({ advisor_count: data.advisor_count, variant_count: data.variant_count, summary: data.summary, warnings: data.warnings })
      showToast('批量任务已完成，所有内容仍需人工确认')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '批量生成失败')
    } finally {
      setBatching(false)
    }
  }

  async function runReview() {
    if (!reviewText.trim()) return showToast('先粘贴需要检查的内容')
    setReviewing(true)
    try {
      setReviewResult(await api.compliance({ text: reviewText, has_evidence: Boolean(result?.evidence.length) }))
    } catch (error) {
      showToast(error instanceof Error ? error.message : '检查失败')
    } finally {
      setReviewing(false)
    }
  }

  async function analyzeLeads() {
    const messages = leadText.split('\n').map(item => item.trim()).filter(Boolean)
    if (!messages.length) return showToast('先输入评论或私信')
    setLeadLoading(true)
    try {
      setLeadResult(await api.analyzeLeads(messages))
    } catch (error) {
      showToast(error instanceof Error ? error.message : '分析失败')
    } finally {
      setLeadLoading(false)
    }
  }

  async function startVideo() {
    if (!result) return
    try {
      const data = await api.startVideo({ task_id: result.task_id, advisor_id: advisor.id, video_package: result.video_package })
      showToast(data.message)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '提交失败')
    }
  }

  function copyVariant(variant: ContentVariant) {
    const text = `${variant.title}\n\n${variant.body}\n\n${variant.call_to_action}\n\n${variant.hashtags.map(tag => `#${tag}`).join(' ')}`
    navigator.clipboard?.writeText(text)
    showToast('内容已复制')
  }

  function downloadTask() {
    if (!result) return
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${result.campaign_name}-${result.task_id}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  function useTopic(topic: string) {
    setCampaignName(topic)
    setCampaignBrief(`围绕“${topic}”给出真实、克制、可核验的解释，并邀请用户按自身需求预约体验。`)
    setView('create')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">蔚</span>
          <div><strong>蔚见</strong><small>购车顾问内容工作台</small></div>
        </div>

        <nav>
          {navigation.map(item => {
            const Icon = item.icon
            return <button key={item.id} className={cx('nav-item', view === item.id && 'active')} onClick={() => setView(item.id)}>
              <Icon size={18} />
              <span><strong>{item.label}</strong><small>{item.hint}</small></span>
              {view === item.id && <ChevronRight size={15} />}
            </button>
          })}
        </nav>

        <div className="sidebar-status">
          <div className="status-line"><StatusDot online={backendOnline} /><strong>{backendOnline ? '服务已连接' : '服务未连接'}</strong></div>
          <p>{backendOnline ? (providerReady ? `${health?.provider.label} · ${health?.provider.model}` : '当前使用规则与事实库') : '检查 VITE_API_BASE 或 Render 状态'}</p>
          <button onClick={refreshConnection}><RefreshCw size={14} />重新检测</button>
        </div>
        <p className="sidebar-note">学生团队产品原型 · 非官方业务系统</p>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><h1>{pageTitles[view].title}</h1><p>{pageTitles[view].subtitle}</p></div>
          <div className="topbar-actions">
            <div className={cx('connection-chip', backendOnline && 'connected')}><StatusDot online={backendOnline} />{backendOnline ? '接口在线' : '接口离线'}</div>
            <div className={cx('connection-chip', providerReady && 'connected')}><Bot size={14} />{providerReady ? `${health?.provider.label} 已配置` : '基础模式'}</div>
            {view !== 'create' && <button className="primary small" onClick={() => setView('create')}><Sparkles size={16} />新建任务</button>}
          </div>
        </header>

        {connectionError && <div className="global-alert"><AlertTriangle size={18} /><div><strong>前端没有连到后端</strong><p>{connectionError}</p><small>当前页面仍可查看，但生成、审核和评论分析不可用。</small></div></div>}

        <div className="page-body">
          {view === 'create' && <CreateView
            advisor={advisor}
            vehicle={vehicle}
            advisors={advisors}
            vehicles={vehicles}
            advisorId={advisorId}
            vehicleId={vehicleId}
            setAdvisorId={setAdvisorId}
            setVehicleId={setVehicleId}
            campaignName={campaignName}
            campaignBrief={campaignBrief}
            setCampaignName={setCampaignName}
            setCampaignBrief={setCampaignBrief}
            platforms={platforms}
            togglePlatform={togglePlatform}
            useAi={useAi}
            setUseAi={setUseAi}
            providerReady={providerReady}
            providerLabel={health?.provider.label || 'DeepSeek'}
            generating={generating}
            backendOnline={backendOnline}
            generate={generate}
            result={result}
            activeVariant={activeVariant}
            setActiveVariantId={setActiveVariantId}
            copyVariant={copyVariant}
            downloadTask={downloadTask}
            startVideo={startVideo}
            dataNotice={boot.data_notice}
          />}

          {view === 'advisors' && <AdvisorsView advisors={advisors} selectedId={advisorId} onSelect={id => { setAdvisorId(id); setView('create') }} dataNotice={boot.data_notice} />}

          {view === 'batch' && <BatchView advisors={advisors} vehicle={vehicle} vehicles={vehicles} vehicleId={vehicleId} setVehicleId={setVehicleId} campaignName={campaignName} campaignBrief={campaignBrief} setCampaignName={setCampaignName} setCampaignBrief={setCampaignBrief} batching={batching} runBatch={runBatch} batchResult={batchResult} />}

          {view === 'review' && <ReviewView text={reviewText} setText={setReviewText} reviewing={reviewing} runReview={runReview} reviewResult={reviewResult} result={result} />}

          {view === 'leads' && <LeadsView leadText={leadText} setLeadText={setLeadText} loading={leadLoading} analyze={analyzeLeads} result={leadResult} useTopic={useTopic} />}

          {view === 'about' && <AboutView />}
        </div>
      </main>

      {toast && <div className="toast"><CheckCircle2 size={17} /><span>{toast}</span><button onClick={() => setToast('')}><X size={15} /></button></div>}
    </div>
  )
}

function CreateView(props: {
  advisor: Advisor
  vehicle: Vehicle
  advisors: Advisor[]
  vehicles: Vehicle[]
  advisorId: string
  vehicleId: string
  setAdvisorId: (value: string) => void
  setVehicleId: (value: string) => void
  campaignName: string
  campaignBrief: string
  setCampaignName: (value: string) => void
  setCampaignBrief: (value: string) => void
  platforms: string[]
  togglePlatform: (value: string) => void
  useAi: boolean
  setUseAi: (value: boolean) => void
  providerReady: boolean
  providerLabel: string
  generating: boolean
  backendOnline: boolean
  generate: () => void
  result: GenerationResponse | null
  activeVariant: ContentVariant | null
  setActiveVariantId: (value: string) => void
  copyVariant: (variant: ContentVariant) => void
  downloadTask: () => void
  startVideo: () => void
  dataNotice: string
}) {
  const { advisor, vehicle, result, activeVariant } = props
  return <>
    <section className="task-layout">
      <div className="card task-card">
        <div className="card-heading"><span className="eyebrow">任务信息</span><h2>今天准备让哪位顾问讲什么？</h2><p>同一份活动信息，会根据顾问所在城市、服务客群和表达习惯生成不同内容。</p></div>

        <div className="form-grid two">
          <label className="field"><span>购车顾问</span><select value={props.advisorId} onChange={e => props.setAdvisorId(e.target.value)}>{props.advisors.map(item => <option key={item.id} value={item.id}>{item.name} · {item.city} · {item.store}</option>)}</select></label>
          <label className="field"><span>主推车型</span><select value={props.vehicleId} onChange={e => props.setVehicleId(e.target.value)}>{props.vehicles.map(item => <option key={item.id} value={item.id}>{item.name} · {item.positioning}</option>)}</select></label>
        </div>
        <label className="field"><span>任务名称</span><input value={props.campaignName} onChange={e => props.setCampaignName(e.target.value)} placeholder="例如：周末家庭用车体验" /></label>
        <label className="field"><span>这次具体要讲什么</span><textarea rows={5} value={props.campaignBrief} onChange={e => props.setCampaignBrief(e.target.value)} placeholder="写清目标客群、场景、想回答的问题和希望用户采取的下一步。" /></label>
        <div className="field"><span>输出平台</span><div className="platform-list">{platformOptions.map(item => <button key={item} className={cx('platform-button', props.platforms.includes(item) && 'selected')} onClick={() => props.togglePlatform(item)}>{props.platforms.includes(item) && <Check size={14} />}{item}</button>)}</div></div>

        <div className="generation-row">
          <button className={cx('ai-toggle', props.useAi && 'on')} onClick={() => props.setUseAi(!props.useAi)} role="switch" aria-checked={props.useAi}><span /><div><strong>AI 润色</strong><small>{props.providerReady ? `使用 ${props.providerLabel}` : '未配置模型时自动使用基础版本'}</small></div></button>
          <button className="primary generate-button" disabled={props.generating || !props.backendOnline || !props.platforms.length} onClick={props.generate}>{props.generating ? <LoaderCircle className="spin" size={18} /> : <WandSparkles size={18} />}{props.generating ? '正在生成并检查…' : '生成内容'}</button>
        </div>
      </div>

      <aside className="context-column">
        <div className="card context-card">
          <div className="context-avatar">{advisor.name.slice(0, 1)}</div>
          <h3>{advisor.name}</h3><p><MapPin size={14} />{advisor.city} · {advisor.store}</p>
          <dl><div><dt>主要客群</dt><dd>{advisor.audience}</dd></div><div><dt>表达方式</dt><dd>{advisor.style}</dd></div><div><dt>常用平台</dt><dd>{advisor.platforms.join('、')}</dd></div></dl>
        </div>
        <div className="card fact-card">
          <div className="section-title"><BookOpen size={18} /><div><strong>{vehicle.name} 事实卡</strong><small>核验于 {vehicle.verified_at}</small></div></div>
          <h3>{vehicle.positioning}</h3>
          <div className="price-pair"><div><span>整车购买</span><strong>{vehicle.full_purchase_from}</strong></div><div><span>电池租用</span><strong>{vehicle.baas_from}</strong></div></div>
          <div className="scenario-tags">{vehicle.scenarios.map(item => <span key={item}>{item}</span>)}</div>
          <a href={vehicle.source_url} target="_blank" rel="noreferrer">查看官方来源 <ArrowRight size={14} /></a>
        </div>
        <p className="data-notice"><FileCheck2 size={14} />{props.dataNotice}</p>
      </aside>
    </section>

    <section className="result-section">
      <div className="section-header"><div><span className="eyebrow">生成结果</span><h2>每个平台各写各的，不是简单换标题</h2></div>{result && <div className="section-actions"><Badge tone={result.compliance.passed ? 'good' : 'warn'}><ShieldCheck size={14} />预检 {result.compliance.score} 分</Badge><button className="secondary" onClick={props.downloadTask}><Download size={15} />导出任务</button></div>}</div>
      {!result ? <div className="card"><Empty icon={Sparkles} title="生成后在这里看结果" text="你会看到多平台文案、官方事实引用、风险检查和短视频分镜。" /></div> : <div className="result-grid">
        <div className="card content-result">
          <div className="variant-tabs">{result.variants.map(item => <button key={item.id} className={cx(activeVariant?.id === item.id && 'active')} onClick={() => props.setActiveVariantId(item.id)}>{item.platform}</button>)}</div>
          {activeVariant && <div className="copy-sheet">
            <div className="copy-sheet-top"><div><Badge tone="dark">{activeVariant.platform}</Badge><span>{activeVariant.advisor_name} 的版本</span></div><button className="icon-button" onClick={() => props.copyVariant(activeVariant)}><Copy size={16} /></button></div>
            <h3>{activeVariant.title}</h3>
            <p>{activeVariant.body}</p>
            <div className="hashtag-list">{activeVariant.hashtags.map(tag => <span key={tag}>#{tag}</span>)}</div>
            <div className="cta"><MessageCircle size={16} /><span>{activeVariant.call_to_action}</span></div>
            <div className="quality-row"><div><span>画像命中</span><strong>{activeVariant.personalization_score}</strong></div><div><span>事实完整</span><strong>{activeVariant.grounding_score}</strong></div><div><span>合规预检</span><strong>{activeVariant.compliance_score}</strong></div></div>
          </div>}
        </div>

        <div className="result-side">
          <div className="card audit-card">
            <div className="section-title"><Bot size={18} /><div><strong>本次生成方式</strong><small>{new Date(result.audit.generated_at).toLocaleString('zh-CN')}</small></div></div>
            <div className="audit-provider"><span>{result.audit.ai_used ? result.audit.provider : '规则与事实库'}</span><strong>{result.audit.ai_used ? result.audit.model : '基础版本'}</strong></div>
            {result.audit.ai_warning && <div className="inline-warning"><AlertTriangle size={15} />{result.audit.ai_warning}</div>}
            <p><CheckCircle2 size={14} />所有版本都需要顾问确认后再发布。</p>
          </div>
          <div className="card evidence-card">
            <div className="section-title"><BadgeCheck size={18} /><div><strong>引用的官方事实</strong><small>{result.evidence.length} 条</small></div></div>
            {result.evidence.map(item => <a key={item.field} href={item.source_url} target="_blank" rel="noreferrer"><span>{item.field}</span><strong>{item.value}</strong><small>{item.verified_at}</small></a>)}
          </div>
        </div>

        <div className="card video-card full-span">
          <div className="section-header compact"><div><span className="eyebrow">短视频草稿</span><h3>{result.video_package.hook}</h3></div><button className="secondary" onClick={props.startVideo}><Play size={15} />保存分镜任务</button></div>
          <div className="shot-list">{result.video_package.shots.map(shot => <article key={shot.index}><span>{String(shot.index).padStart(2, '0')}</span><div><strong>{shot.visual}</strong><p>{shot.subtitle}</p><small>{shot.asset_hint}</small></div><em>{shot.duration}s</em></article>)}</div>
        </div>
      </div>}
    </section>
  </>
}

function AdvisorsView({ advisors, selectedId, onSelect, dataNotice }: { advisors: Advisor[]; selectedId: string; onSelect: (id: string) => void; dataNotice: string }) {
  return <>
    <div className="intro-card card"><div><span className="eyebrow">画像底座</span><h2>不是给所有顾问发同一份话术</h2><p>系统只保留与内容相关的字段：城市、门店、服务客群、表达方式和常用平台。真实上线时应由顾问本人确认，而不是后台替他猜。</p></div><Badge tone="neutral">当前为脱敏示例</Badge></div>
    <div className="advisor-grid">{advisors.map(item => <article className={cx('card advisor-card', selectedId === item.id && 'selected')} key={item.id}>
      <div className="advisor-card-top"><span>{item.name.slice(0, 1)}</span><Badge tone="neutral">{item.city}</Badge></div>
      <h3>{item.name}</h3><p>{item.store}</p>
      <dl><div><dt>服务客群</dt><dd>{item.audience}</dd></div><div><dt>表达方式</dt><dd>{item.style}</dd></div><div><dt>重点车型</dt><dd>乐道 {item.model_focus}</dd></div></dl>
      <div className="platform-tags">{item.platforms.map(platform => <span key={platform}>{platform}</span>)}</div>
      <button className="secondary wide" onClick={() => onSelect(item.id)}>用这个画像新建任务 <ArrowRight size={15} /></button>
    </article>)}</div>
    <p className="wide-note"><FileCheck2 size={15} />{dataNotice}</p>
  </>
}

function BatchView(props: { advisors: Advisor[]; vehicle: Vehicle; vehicles: Vehicle[]; vehicleId: string; setVehicleId: (id: string) => void; campaignName: string; campaignBrief: string; setCampaignName: (value: string) => void; setCampaignBrief: (value: string) => void; batching: boolean; runBatch: () => void; batchResult: { advisor_count: number; variant_count: number; summary: Record<string, number>; warnings: string[] } | null }) {
  return <div className="batch-layout">
    <section className="card batch-config">
      <div className="card-heading"><span className="eyebrow">总部活动</span><h2>配置一次，按顾问画像分别生成</h2><p>演示只运行三位脱敏顾问，不虚构“上千人已经使用”的经营数据。</p></div>
      <label className="field"><span>车型</span><select value={props.vehicleId} onChange={e => props.setVehicleId(e.target.value)}>{props.vehicles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="field"><span>活动名称</span><input value={props.campaignName} onChange={e => props.setCampaignName(e.target.value)} /></label>
      <label className="field"><span>统一 Brief</span><textarea rows={5} value={props.campaignBrief} onChange={e => props.setCampaignBrief(e.target.value)} /></label>
      <div className="batch-scope"><span>本次覆盖</span><div>{props.advisors.map(item => <Badge key={item.id} tone="neutral"><UserRound size={13} />{item.name} · {item.city}</Badge>)}</div></div>
      <button className="primary wide" onClick={props.runBatch} disabled={props.batching}>{props.batching ? <LoaderCircle className="spin" size={17} /> : <Boxes size={17} />}{props.batching ? '正在生成…' : '运行批量任务'}</button>
    </section>

    <section className="card batch-output">
      <div className="card-heading"><span className="eyebrow">运行结果</span><h2>生成之后，先审再发</h2><p>批量能力的价值不在于“发得更快”，而在于统一事实、保留差异、可追踪审核。</p></div>
      {!props.batchResult ? <Empty icon={Boxes} title="还没有运行批量任务" text="运行后展示真实返回数量和审核概况。" /> : <>
        <div className="batch-numbers"><div><span>顾问</span><strong>{props.batchResult.advisor_count}</strong></div><div><span>内容版本</span><strong>{props.batchResult.variant_count}</strong></div><div><span>平均画像命中</span><strong>{props.batchResult.summary.avg_personalization || 0}</strong></div><div><span>平均合规预检</span><strong>{props.batchResult.summary.avg_compliance || 0}</strong></div></div>
        <div className="review-rule"><ShieldCheck size={19} /><div><strong>发布闸门保持开启</strong><p>每条内容都需要对应顾问或门店审核，不会自动外发。</p></div></div>
        {props.batchResult.warnings.length > 0 && <div className="inline-warning"><AlertTriangle size={15} />{props.batchResult.warnings.join('；')}</div>}
      </>}
    </section>
  </div>
}

function ReviewView({ text, setText, reviewing, runReview, reviewResult, result }: { text: string; setText: (value: string) => void; reviewing: boolean; runReview: () => void; reviewResult: ComplianceResult | null; result: GenerationResponse | null }) {
  return <div className="review-layout">
    <section className="card review-input">
      <div className="card-heading"><span className="eyebrow">内容预检</span><h2>先看风险，再决定是否发布</h2><p>检查绝对化表达、辅助驾驶边界、动态价格时效和事实来源。</p></div>
      <textarea rows={16} value={text} onChange={e => setText(e.target.value)} placeholder="粘贴朋友圈、小红书、口播或私聊内容…" />
      <div className="review-actions"><button className="secondary" onClick={() => setText(result?.variants.map(item => `${item.title}\n${item.body}\n${item.call_to_action}`).join('\n\n') || '')}><Clipboard size={15} />载入最近生成内容</button><button className="primary" onClick={runReview} disabled={reviewing}>{reviewing ? <LoaderCircle className="spin" size={16} /> : <ShieldCheck size={16} />}{reviewing ? '检查中…' : '开始检查'}</button></div>
    </section>
    <section className="card review-output">
      {!reviewResult ? <Empty icon={ShieldCheck} title="等待检查" text="结果会说明哪里有问题、为什么有风险，以及应该怎样改。" /> : <>
        <div className="review-score"><div className={cx('score-circle', reviewResult.passed && 'pass')}><strong>{reviewResult.score}</strong><small>预检分</small></div><div><Badge tone={reviewResult.passed ? 'good' : 'warn'}>{reviewResult.passed ? '未发现阻断项' : '需要修改'}</Badge><h3>{reviewResult.passed ? '可以进入人工确认' : '暂不建议发布'}</h3><p>自动检查不能替代门店与品牌审核。</p></div></div>
        <div className="finding-list">{reviewResult.findings.map((finding, index) => <article key={`${finding.rule}-${index}`} className={cx(finding.level === 'block' && 'block', finding.level === 'warning' && 'warning')}><span>{finding.level === 'pass' ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}</span><div><strong>{finding.rule}</strong><p>{finding.message}</p><small>建议：{finding.suggestion}</small></div></article>)}</div>
      </>}
    </section>
  </div>
}

function LeadsView({ leadText, setLeadText, loading, analyze, result, useTopic }: { leadText: string; setLeadText: (value: string) => void; loading: boolean; analyze: () => void; result: LeadAnalysis | null; useTopic: (topic: string) => void }) {
  return <>
    <div className="lead-layout">
      <section className="card lead-input"><div className="card-heading"><span className="eyebrow">评论与私信</span><h2>把客户原话放进来</h2><p>每行一条。真实使用时应先脱敏，不要上传手机号、身份证或完整聊天记录。</p></div><textarea rows={14} value={leadText} onChange={e => setLeadText(e.target.value)} /><button className="primary wide" onClick={analyze} disabled={loading}>{loading ? <LoaderCircle className="spin" size={17} /> : <MessageCircle size={17} />}{loading ? '分析中…' : '分析意向与顾虑'}</button></section>
      <section className="card lead-summary">{!result ? <Empty icon={MessagesSquare} title="等待分析" text="系统会给出意向等级、主要顾虑、下一步动作和回复建议。" /> : <><div className="intent-grid"><div className="high"><strong>{result.high_intent}</strong><span>高意向</span></div><div><strong>{result.medium_intent}</strong><span>中意向</span></div><div><strong>{result.low_intent}</strong><span>低意向</span></div></div><h3 className="sub-title">大家最关心什么</h3><div className="concern-list">{result.top_concerns.map(item => <div key={item.topic}><span>{item.topic}</span><div><i style={{ width: `${Math.max(16, item.count / Math.max(1, result.total) * 100)}%` }} /></div><strong>{item.count}</strong></div>)}</div></>}</section>
    </div>
    {result && <>
      <section className="card lead-table"><div className="section-header compact"><div><span className="eyebrow">逐条建议</span><h3>顾问下一步应该做什么</h3></div></div>{result.leads.map(item => <article key={item.id}><div><Badge tone={item.intent === '高' ? 'good' : item.intent === '中' ? 'neutral' : 'dark'}>{item.intent}意向</Badge><strong>{item.concern}</strong></div><p>{item.text}</p><div><span>下一步</span><strong>{item.next_action}</strong></div><div><span>建议回复</span><p>{item.recommended_reply}</p></div></article>)}</section>
      <section className="card topic-section"><div><span className="eyebrow">内容回流</span><h3>这些问题可以直接变成下一轮选题</h3></div><div>{result.next_content_topics.map(topic => <button key={topic} onClick={() => useTopic(topic)}><span>{topic}</span><ArrowRight size={16} /></button>)}</div></section>
    </>}
  </>
}

function AboutView() {
  const steps = [
    ['01', '理解顾问', '读取城市、门店、主要客群和表达方式，不依赖空泛的“人设标签”。'],
    ['02', '绑定事实', '车型定位、价格和动态信息都保留来源与核验日期。'],
    ['03', '按平台生成', '朋友圈、小红书、口播和私聊分别写，不做机械改写。'],
    ['04', '发布前审核', '风险表达、辅助驾驶边界和事实来源先检查，再交给人确认。'],
    ['05', '客户反馈回流', '从评论和私信中识别真实问题，形成下一轮选题。'],
  ]
  return <>
    <section className="card about-hero"><span className="eyebrow">PersonaFlow</span><h2>让内容规模化，但不把顾问变成同一种声音</h2><p>目标不是帮顾问“多发几条文案”，而是降低准备成本、减少事实错误，并让客户反馈真正回到内容计划里。</p><div className="principles"><span><BadgeCheck size={17} />事实可追溯</span><span><Users size={17} />顾问有差异</span><span><ShieldCheck size={17} />发布有人审</span><span><MessageCircle size={17} />反馈能回流</span></div></section>
    <section className="workflow-list">{steps.map(([number, title, text]) => <article className="card" key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div><ChevronRight size={18} /></article>)}</section>
    <section className="about-grid"><div className="card"><div className="section-title"><Gauge size={19} /><div><strong>怎么判断方案有效</strong><small>不展示未经验证的经营大盘</small></div></div><ul><li>同一 Brief 在不同顾问之间的内容差异</li><li>事实引用完整率与风险拦截情况</li><li>顾问从接到任务到完成确认所需时间</li><li>评论问题进入下一轮选题的转化比例</li></ul></div><div className="card"><div className="section-title"><Zap size={19} /><div><strong>真实落地还要补什么</strong><small>原型之外的企业能力</small></div></div><ul><li>企业账号与门店权限体系</li><li>官方知识库的自动同步与版本管理</li><li>真实发布、互动和试驾转化数据回传</li><li>品牌法务规则、审计日志与数据合规</li></ul></div></section>
  </>
}

export default App
