import { useState } from 'react'
import { Building2, MapPin, Save, UserRound } from 'lucide-react'
import { useApp } from '../app/AppContext'
import { Button, StatusPill } from '../shared/ui'

export function AdvisorsPage() {
  const { boot, showToast } = useApp()
  const [selectedId, setSelectedId] = useState(boot.advisors[0]?.id || '')
  const advisor = boot.advisors.find(item => item.id === selectedId) || boot.advisors[0]
  const [style, setStyle] = useState(advisor?.style || '')
  const [audience, setAudience] = useState(advisor?.audience || '')

  function select(id: string) {
    const next = boot.advisors.find(item => item.id === id)
    setSelectedId(id)
    setStyle(next?.style || '')
    setAudience(next?.audience || '')
  }

  return (
    <section className="advisors-page">
      <div className="advisor-directory">
        <div className="section-title"><div><p className="eyebrow">顾问目录</p><h2>画像只保留会影响沟通的字段</h2></div><StatusPill tone="info">脱敏示例</StatusPill></div>
        {boot.advisors.map(item => <button key={item.id} className={advisor?.id === item.id ? 'advisor-row active' : 'advisor-row'} onClick={() => select(item.id)}><span className="avatar">{item.name.slice(0, 1)}</span><span><strong>{item.name}</strong><small>{item.store}</small></span><em>{item.model_focus}</em></button>)}
      </div>
      {advisor ? <article className="advisor-editor">
        <header><span className="avatar large">{advisor.name.slice(0, 1)}</span><div><h2>{advisor.name}</h2><p><Building2 size={14} />{advisor.store} · <MapPin size={14} />{advisor.city}</p></div></header>
        <div className="advisor-facts"><div><span>主要车型</span><strong>{advisor.model_focus}</strong></div><div><span>从业时间</span><strong>{advisor.experience_years} 年</strong></div><div><span>常用平台</span><strong>{advisor.platforms.join('、')}</strong></div></div>
        <label className="field-label">主要服务客群<textarea value={audience} onChange={event => setAudience(event.target.value)} /></label>
        <label className="field-label">表达方式<textarea value={style} onChange={event => setStyle(event.target.value)} /></label>
        <div className="persona-guidance"><UserRound size={18} /><div><strong>这些字段怎样参与生成</strong><p>服务客群决定优先场景和问题顺序；表达方式决定语气、句式和行动引导。系统不会根据年龄、性别等敏感属性推断客户。</p></div></div>
        <Button onClick={() => showToast('原型中已保存到当前会话；接入门店系统后可持久化')}><Save size={16} />保存画像</Button>
      </article> : null}
    </section>
  )
}
