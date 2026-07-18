import { useState } from 'react'
import { Activity, Download, KeyRound, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react'
import { api } from '../api'
import { useApp } from '../app/AppContext'
import { Button, ErrorState, StatusPill } from '../shared/ui'
import type { ComplianceResult } from '../types'

export function SettingsPage() {
  const { health, workspace, boot, refreshing, refreshAll, resetDemo, showToast } = useApp()
  const [text, setText] = useState('这款车完全自动驾驶，无需接管，现在是最低价。')
  const [result, setResult] = useState<ComplianceResult | null>(null)
  const [checking, setChecking] = useState(false)

  async function check() {
    setChecking(true)
    try {
      setResult(await api.compliance({ text, has_evidence: false }))
    } catch (error) {
      showToast(error instanceof Error ? error.message : '检查失败')
    } finally {
      setChecking(false)
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ workspace, boot, exported_at: new Date().toISOString(), data_mode: workspace.data_mode }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'weijian-demo-data.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="settings-page">
      <div className="settings-grid">
        <article className="settings-section">
          <div className="settings-heading"><Activity size={19} /><div><h2>服务诊断</h2><p>连接信息只放在管理设置，不占用顾问主流程。</p></div></div>
          <dl className="diagnostic-list"><div><dt>后端服务</dt><dd><StatusPill tone={health?.status === 'ok' ? 'success' : 'danger'}>{health?.status === 'ok' ? '已连接' : '未连接'}</StatusPill></dd></div><div><dt>API 版本</dt><dd>{health?.version || '离线 fallback'}</dd></div><div><dt>车型事实版本</dt><dd>{health?.knowledge_version || '内置演示数据'}</dd></div></dl>
          <Button variant="secondary" loading={refreshing} onClick={() => void refreshAll()}><RefreshCw size={16} />重新检测服务</Button>
        </article>

        <article className="settings-section">
          <div className="settings-heading"><KeyRound size={19} /><div><h2>内容模型</h2><p>密钥只保存在后端环境变量中，浏览器无法读取。</p></div></div>
          <dl className="diagnostic-list"><div><dt>运行模式</dt><dd>{health?.provider.label || '规则兜底'}</dd></div><div><dt>模型</dt><dd>{health?.provider.model || 'grounded-template'}</dd></div><div><dt>可用状态</dt><dd><StatusPill tone={health?.provider.ready ? 'success' : 'warning'}>{health?.provider.ready ? '可调用' : '使用规则兜底'}</StatusPill></dd></div></dl>
          <p className="settings-help">Render 环境变量可配置 DeepSeek 或其他 OpenAI-compatible 服务。模型失败时不会丢失已绑定事实与基础版本。</p>
        </article>

        <article className="settings-section wide">
          <div className="settings-heading"><ShieldCheck size={19} /><div><h2>独立内容检查</h2><p>保留原有单独审核能力，用于检查外部粘贴的文案。</p></div></div>
          <textarea className="settings-textarea" value={text} onChange={event => setText(event.target.value)} />
          <Button loading={checking} onClick={() => void check()}>执行事实与风险预检</Button>
          {result ? <div className="compliance-results">{result.findings.map((item, index) => <div key={`${item.rule}-${index}`} className={`finding finding-${item.level}`}><strong>{item.rule}</strong><p>{item.message}</p><small>{item.suggestion}</small></div>)}</div> : null}
        </article>

        <article className="settings-section">
          <div className="settings-heading"><Download size={19} /><div><h2>数据导出</h2><p>导出当前演示工作区，用于复盘和调试。</p></div></div>
          <Button variant="secondary" onClick={exportJson}><Download size={16} />导出 JSON</Button>
        </article>

        <article className="settings-section">
          <div className="settings-heading"><RotateCcw size={19} /><div><h2>重置演示</h2><p>恢复初始机会、审核和跟进记录。</p></div></div>
          <Button variant="danger" onClick={() => void resetDemo()}><RotateCcw size={16} />重置演示数据</Button>
        </article>
      </div>
      {!health ? <ErrorState title="当前使用离线演示" description="界面仍可完整浏览，但生成、审核和持久化操作需要后端恢复后才能在线执行。" /> : null}
    </section>
  )
}
