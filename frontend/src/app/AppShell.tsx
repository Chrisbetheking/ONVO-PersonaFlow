import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Activity, BookOpenText, Building2, CalendarRange, ChevronDown, CircleUserRound, ClipboardCheck,
  Compass, FileClock, Gauge, GraduationCap, LibraryBig, RefreshCw, Settings2, ShieldAlert,
  Sparkles, Target, UsersRound, X,
} from 'lucide-react'
import { useApp } from './AppContext'
import { navigate, routeTitles, type RouteId } from './router'
import type { RoleSpace } from '../types'

const roleItems: Record<RoleSpace, Array<{ id: RouteId; label: string; icon: typeof Compass }>> = {
  advisor: [
    { id: 'today', label: '今日机会', icon: Compass },
    { id: 'followup', label: '客户沟通', icon: Activity },
    { id: 'studio', label: '内容作战台', icon: Sparkles },
    { id: 'promises', label: '跟进与承诺', icon: FileClock },
    { id: 'customers', label: '客户档案', icon: UsersRound },
  ],
  manager: [
    { id: 'manager-radar', label: '门店雷达', icon: Gauge },
    { id: 'review', label: '审核队列', icon: ClipboardCheck },
    { id: 'customer-risks', label: '客户风险', icon: ShieldAlert },
    { id: 'quality', label: '质量与辅导', icon: GraduationCap },
    { id: 'promises', label: '承诺履约', icon: FileClock },
    { id: 'campaigns', label: '活动执行', icon: CalendarRange },
  ],
  hq: [
    { id: 'hotspots', label: '热点与洞察', icon: Target },
    { id: 'knowledge', label: '知识中心', icon: LibraryBig },
    { id: 'policies', label: '政策与权益', icon: FileClock },
    { id: 'campaigns', label: '活动编排', icon: CalendarRange },
    { id: 'best-practices', label: '优秀案例', icon: BookOpenText },
    { id: 'experiments', label: '效果验证', icon: Gauge },
    { id: 'governance', label: '系统治理', icon: Settings2 },
  ],
}

const utilityItems: Array<{ id: RouteId; label: string; icon: typeof Settings2 }> = [
  { id: 'advisors', label: '顾问与门店', icon: Building2 },
  { id: 'settings', label: '系统设置', icon: Settings2 },
  { id: 'about', label: '方案说明', icon: BookOpenText },
]

const roleLabel: Record<RoleSpace, string> = { advisor: '顾问空间', manager: '门店经理空间', hq: '总部运营空间' }
const roleHome: Record<RoleSpace, RouteId> = { advisor: 'today', manager: 'manager-radar', hq: 'hotspots' }

export function AppShell({ route, children }: { route: RouteId; children: ReactNode }) {
  const { boot, workspace, dataMode, refreshing, connectionError, refreshAll, toast, switchRole } = useApp()
  const [utilityOpen, setUtilityOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const page = routeTitles[route]
  const role = workspace.enterprise?.enterprise_meta?.current_role || 'advisor'
  const actorId = workspace.enterprise?.enterprise_meta?.current_actor_id
  const advisor = boot.advisors.find(item => item.id === actorId) || boot.advisors.find(item => item.id === 'advisor-hz-02') || boot.advisors[0]
  const accountIdentity = role === 'advisor'
    ? { name: advisor?.name || '顾问演示用户', detail: `${advisor?.store || '演示门店'} · 顾问` }
    : role === 'manager'
      ? { name: '门店经理 Demo', detail: '杭州城西体验店 · 经理演示' }
      : { name: '总部运营 Demo', detail: '总部运营空间 · 角色演示' }
  const navItems = useMemo(() => roleItems[role], [role])

  useEffect(() => { setUtilityOpen(false); setAccountOpen(false) }, [route])

  async function changeRole(next: RoleSpace) {
    await switchRole(next)
    navigate(roleHome[next])
  }

  return (
    <div className="app-shell">
      <aside className="side-rail" aria-label="主导航">
        <button className="brand" onClick={() => navigate(roleHome[role])} aria-label="返回当前空间首页">
          <span className="brand-mark">蔚</span><span><strong>蔚见</strong><small>客户经营与销售质量中枢</small></span>
        </button>
        <div className="role-space-label"><span>{roleLabel[role]}</span><small>角色演示</small></div>
        <nav className="primary-nav">
          {navItems.map(item => {
            const Icon = item.icon
            const active = item.id === route
            return <button key={item.id} className={active ? 'nav-item active' : 'nav-item'} aria-current={active ? 'page' : undefined} onClick={() => navigate(item.id)}><Icon size={19}/><span>{item.label}</span></button>
          })}
          <button className={utilityItems.some(item => item.id === route) ? 'nav-item active' : 'nav-item'} onClick={() => setUtilityOpen(value => !value)}><Settings2 size={19}/><span>管理与设置</span><ChevronDown size={15} className={utilityOpen ? 'rotate' : ''}/></button>
        </nav>
        <div className="rail-footnote"><span className={`mode-dot mode-${dataMode}`}/><span>{dataMode === 'live' ? '业务数据' : dataMode === 'fallback' ? '本地演示' : '演示数据'}</span></div>
      </aside>

      {utilityOpen ? <div className="manage-layer" onClick={() => setUtilityOpen(false)}><aside className="manage-panel" onClick={event => event.stopPropagation()}>
        <div className="manage-heading"><div><strong>管理与设置</strong><p>支持角色之外的维护与诊断能力</p></div><button onClick={() => setUtilityOpen(false)} aria-label="关闭"><X size={18}/></button></div>
        <div className="manage-list">{utilityItems.map(item => { const Icon=item.icon; return <button key={item.id} onClick={() => navigate(item.id)} className={route===item.id?'manage-item active':'manage-item'}><Icon size={19}/><span><strong>{item.label}</strong><small>{routeTitles[item.id].subtitle}</small></span></button> })}</div>
      </aside></div> : null}

      <div className="app-main">
        <header className="topbar">
          <div className="page-heading"><h1>{page.title}</h1><p>{page.subtitle}</p></div>
          <div className="topbar-actions">
            <span className="demo-label">{dataMode === 'fallback' ? '本地工作区 · 未连接生产系统' : dataMode === 'demo' ? '演示数据 · 未连接生产系统' : '业务数据'}</span>
            <button className="icon-button" onClick={() => void refreshAll()} disabled={refreshing} aria-label="刷新数据"><RefreshCw className={refreshing?'spin':''} size={18}/></button>
            <div className="account-menu">
              <button className="account-button" data-testid="role-menu" onClick={() => setAccountOpen(value => !value)}><CircleUserRound size={20}/><span><strong>{accountIdentity.name}</strong><small>{accountIdentity.detail}</small></span><ChevronDown size={14}/></button>
              {accountOpen ? <div className="account-popover role-popover"><strong>{accountIdentity.name}</strong><p>{accountIdentity.detail}</p><span className="demo-inline">角色演示，不代表已接入企业 RBAC</span><div className="role-options">{(['advisor','manager','hq'] as RoleSpace[]).map(value => <button data-testid={`switch-role-${value}`} key={value} className={role===value?'active':''} onClick={() => void changeRole(value)}>{roleLabel[value]}</button>)}</div></div> : null}
            </div>
          </div>
        </header>
        {connectionError ? <div className="connection-banner"><span>后端暂时不可用，已切换到明确标记的本地演示数据。</span><button onClick={() => void refreshAll()}>重新连接</button></div> : null}
        <main className="page-content">{children}</main>
      </div>
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  )
}
