import { useEffect, useState } from 'react'
import { Building2, MapPin, Save, UserRound } from 'lucide-react'
import { useApp } from '../app/AppContext'
import { Button, ErrorState, StatusPill } from '../shared/ui'

export function AdvisorsPage() {
  const { boot, updateAdvisor, showToast, dataMode } = useApp()
  const [selectedId, setSelectedId] = useState(boot.advisors[0]?.id || '')
  const advisor = boot.advisors.find(item => item.id === selectedId) || boot.advisors[0]
  const [style, setStyle] = useState(advisor?.style || '')
  const [audience, setAudience] = useState(advisor?.audience || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setStyle(advisor?.style || '')
    setAudience(advisor?.audience || '')
  }, [advisor?.id, advisor?.style, advisor?.audience])

  function select(id: string) {
    setSelectedId(id)
    setError('')
  }

  async function save() {
    if (!advisor) return
    setSaving(true)
    setError('')
    try {
      await updateAdvisor(advisor.id, { audience: audience.trim(), style: style.trim() })
      showToast(dataMode === 'fallback' ? '顾问画像已保存到当前浏览器的本地演示工作区' : '顾问画像已保存到当前工作区')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '画像保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="advisors-page">
      <div className="advisor-directory">
        <div className="section-title"><div><p className="eyebrow">顾问目录</p><h2>画像只保留会影响沟通的字段</h2></div><StatusPill tone="info">当前工作区</StatusPill></div>
        {boot.advisors.map(item => <button data-testid={`advisor-row-${item.id}`} key={item.id} className={advisor?.id === item.id ? 'advisor-row active' : 'advisor-row'} onClick={() => select(item.id)}><span className="avatar">{item.name.slice(0, 1)}</span><span><strong>{item.name}</strong><small>{item.store}</small></span><em>{item.model_focus}</em></button>)}
      </div>
      {advisor ? <article className="advisor-editor">
        <header><span className="avatar large">{advisor.name.slice(0, 1)}</span><div><h2>{advisor.name}</h2><p><Building2 size={14} />{advisor.store} · <MapPin size={14} />{advisor.city}</p></div></header>
        <div className="advisor-facts"><div><span>主要车型</span><strong>{advisor.model_focus}</strong></div><div><span>从业时间</span><strong>{advisor.experience_years} 年</strong></div><div><span>常用平台</span><strong>{advisor.platforms.join('、')}</strong></div></div>
        <label className="field-label">主要服务客群<textarea data-testid="advisor-audience" value={audience} onChange={event => setAudience(event.target.value)} /></label>
        <label className="field-label">表达方式<textarea data-testid="advisor-style" value={style} onChange={event => setStyle(event.target.value)} /></label>
        <div className="persona-guidance"><UserRound size={18} /><div><strong>这些字段怎样参与生成</strong><p>服务客群决定优先场景和问题顺序；表达方式决定语气、句式和行动引导。系统不会根据年龄、性别等敏感属性推断客户。</p></div></div>
        {error ? <ErrorState description={error} /> : null}
        <Button data-testid="save-advisor" loading={saving} disabled={!audience.trim() || !style.trim()} onClick={() => void save()}><Save size={16} />保存画像</Button>
      </article> : null}
    </section>
  )
}
