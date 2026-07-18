import { useEffect, useState, type ReactNode } from 'react'
import {
  Activity,
  BookOpenText,
  Building2,
  CalendarRange,
  ChevronDown,
  CircleUserRound,
  ClipboardCheck,
  Compass,
  MoreHorizontal,
  RefreshCw,
  Settings2,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react'
import { useApp } from './AppContext'
import { navigate, routeTitles, type RouteId } from './router'

const primaryItems: Array<{ id: RouteId | 'more'; label: string; icon: typeof Compass }> = [
  { id: 'today', label: '今日机会', icon: Compass },
  { id: 'studio', label: '内容作战台', icon: Sparkles },
  { id: 'followup', label: '跟进与记忆', icon: Activity },
  { id: 'more', label: '更多', icon: MoreHorizontal },
]

const manageItems: Array<{ id: RouteId; label: string; description: string; icon: typeof Building2 }> = [
  { id: 'review', label: '门店审核', description: '待审核、风险和事实更新', icon: ClipboardCheck },
  { id: 'campaigns', label: '活动与批量任务', description: '活动配置、生成状态和重试', icon: CalendarRange },
  { id: 'advisors', label: '顾问与门店', description: '画像、客群和表达偏好', icon: UsersRound },
  { id: 'settings', label: '系统设置', description: '模型、服务和数据诊断', icon: Settings2 },
  { id: 'about', label: '方案说明', description: '业务闭环和原型边界', icon: BookOpenText },
]

export function AppShell({ route, children }: { route: RouteId; children: ReactNode }) {
  const { boot, dataMode, refreshing, connectionError, refreshAll, toast } = useApp()
  const [manageOpen, setManageOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const page = routeTitles[route]
  const advisor = boot.advisors.find(item => item.id === 'advisor-hz-02') || boot.advisors[0]

  useEffect(() => {
    setManageOpen(false)
    setAccountOpen(false)
  }, [route])

  return (
    <div className="app-shell">
      <aside className="side-rail" aria-label="主导航">
        <button className="brand" onClick={() => navigate('today')} aria-label="返回今日机会">
          <span className="brand-mark">蔚</span>
          <span><strong>蔚见</strong><small>购车顾问工作台</small></span>
        </button>
        <nav className="primary-nav">
          {primaryItems.map(item => {
            const Icon = item.icon
            const active = item.id === 'more' ? manageItems.some(manage => manage.id === route) : item.id === route
            return (
              <button
                key={item.id}
                className={active ? 'nav-item active' : 'nav-item'}
                aria-current={active ? 'page' : undefined}
                onClick={() => item.id === 'more' ? setManageOpen(value => !value) : navigate(item.id)}
              >
                <Icon size={19} />
                <span>{item.label}</span>
                {item.id === 'more' ? <ChevronDown size={15} className={manageOpen ? 'rotate' : ''} /> : null}
              </button>
            )
          })}
        </nav>
        <div className="rail-footnote">
          <span className={`mode-dot mode-${dataMode}`} />
          <span>{dataMode === 'live' ? '实时数据' : dataMode === 'fallback' ? '离线演示' : '演示数据'}</span>
        </div>
      </aside>

      {manageOpen ? (
        <div className="manage-layer" onClick={() => setManageOpen(false)}>
          <aside className="manage-panel" onClick={event => event.stopPropagation()} aria-label="管理功能">
            <div className="manage-heading"><div><strong>更多与管理</strong><p>按角色收起非高频能力</p></div><button onClick={() => setManageOpen(false)} aria-label="关闭"><X size={18} /></button></div>
            <div className="manage-list">
              {manageItems.map(item => {
                const Icon = item.icon
                return <button key={item.id} onClick={() => navigate(item.id)} className={route === item.id ? 'manage-item active' : 'manage-item'}><Icon size={19} /><span><strong>{item.label}</strong><small>{item.description}</small></span></button>
              })}
            </div>
          </aside>
        </div>
      ) : null}

      <div className="app-main">
        <header className="topbar">
          <div className="page-heading"><h1>{page.title}</h1><p>{page.subtitle}</p></div>
          <div className="topbar-actions">
            <span className="demo-label">{dataMode === 'fallback' ? '离线演示数据' : dataMode === 'demo' ? '脱敏演示数据' : '业务数据'}</span>
            <button className="icon-button" onClick={() => void refreshAll()} disabled={refreshing} aria-label="刷新数据"><RefreshCw className={refreshing ? 'spin' : ''} size={18} /></button>
            <div className="account-menu">
              <button className="account-button" onClick={() => setAccountOpen(value => !value)}><CircleUserRound size={20} /><span><strong>{advisor?.name || '顾问'}</strong><small>{advisor?.store || '体验店'}</small></span><ChevronDown size={14} /></button>
              {accountOpen ? <div className="account-popover"><strong>{advisor?.name}</strong><p>{advisor?.audience}</p><p>{advisor?.style} · {advisor?.city}</p></div> : null}
            </div>
          </div>
        </header>
        {connectionError ? <div className="connection-banner"><span>后端暂时不可用，已切换到明确标记的离线演示数据。</span><button onClick={() => void refreshAll()}>重新连接</button></div> : null}
        <main className="page-content">{children}</main>
      </div>
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  )
}
