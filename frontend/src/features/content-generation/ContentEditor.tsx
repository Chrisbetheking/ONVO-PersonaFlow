import { useMemo, useState } from 'react'
import { Check, Clipboard, Copy, Download, RotateCcw, Save, Send, Undo2, Redo2, WandSparkles, ShieldCheck } from 'lucide-react'
import type { ContentVariant, Evidence, RiskAnnotation } from '../../types'
import { annotateText, canSubmitVariant } from '../../shared/workflow'
import { Button, StatusPill } from '../../shared/ui'

export function ContentEditor({
  variant,
  evidence,
  dirty,
  canUndo,
  canRedo,
  saving,
  submitting,
  onChange,
  onSelectEvidence,
  onSelectRisk,
  onSave,
  onSubmit,
  onUndo,
  onRedo,
  onRegenerate,
  onRewrite,
  rewriting,
  onRevalidate,
  revalidating,
}: {
  variant: ContentVariant
  evidence: Evidence[]
  dirty: boolean
  canUndo: boolean
  canRedo: boolean
  saving: boolean
  submitting: boolean
  onChange: (patch: Partial<Pick<ContentVariant, 'title' | 'body' | 'call_to_action'>>) => void
  onSelectEvidence: (id: string) => void
  onSelectRisk: (id: string) => void
  onSave: () => void
  onSubmit: () => void
  onUndo: () => void
  onRedo: () => void
  onRegenerate: () => void
  onRewrite: (paragraphIndex: number, instruction: string) => void
  rewriting: boolean
  onRevalidate: () => void
  revalidating: boolean
}) {
  const [paragraphIndex, setParagraphIndex] = useState(0)
  const [instruction, setInstruction] = useState('更简洁')
  const paragraphs = useMemo(() => variant.body.split(/\n{2,}/).filter(Boolean), [variant.body])
  const blocking = variant.risk_annotations.filter(item => item.level === 'block').length
  const structurallyReady = canSubmitVariant(variant.body, variant.claims.length, blocking)
  const verified = variant.verification_status === 'verified'
  const canSubmit = structurallyReady && verified
  const preview = `${variant.title}\n\n${variant.body}\n\n${variant.call_to_action}`
  const segments = annotateText(preview, variant.claims, variant.risk_annotations)

  async function copyText() {
    await navigator.clipboard.writeText(preview)
  }

  function downloadText() {
    const blob = new Blob([preview], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${variant.platform}-${variant.advisor_name}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="editor-workspace">
      <div className="editor-toolbar">
        <div className="editor-status"><StatusPill tone={dirty ? 'warning' : 'success'}>{dirty ? '有未保存修改' : '草稿已同步'}</StatusPill><span>版本 {variant.version}</span></div>
        <div className="editor-tools">
          <button onClick={onUndo} disabled={!canUndo} aria-label="撤销"><Undo2 size={16} /></button>
          <button onClick={onRedo} disabled={!canRedo} aria-label="恢复"><Redo2 size={16} /></button>
          <button onClick={() => void copyText()} aria-label="复制"><Copy size={16} /></button>
          <button onClick={downloadText} aria-label="导出文本"><Download size={16} /></button>
        </div>
      </div>
      {verified ? <div className="verification-banner verified"><ShieldCheck size={17} /><span><strong>事实与合规已核验</strong><small>知识版本 {variant.knowledge_version} · {variant.verified_at || '本次生成'}</small></span></div> : <div className="verification-banner stale" data-testid="content-revalidation-warning"><ShieldCheck size={17} /><span><strong>内容已发生变化</strong><small>原事实与合规结论已失效，请重新核验后提交。</small></span><Button data-testid="revalidate-content" variant="secondary" loading={revalidating} onClick={onRevalidate}>重新核验</Button></div>}
      <label className="field-label">标题<input data-testid="content-title" value={variant.title} onChange={event => onChange({ title: event.target.value })} /></label>
      <label className="field-label editor-body-label">正文<textarea data-testid="content-body" value={variant.body} onChange={event => onChange({ body: event.target.value })} /></label>
      <div className="rewrite-bar">
        <WandSparkles size={16} />
        <select value={paragraphIndex} onChange={event => setParagraphIndex(Number(event.target.value))}>{paragraphs.map((paragraph, index) => <option key={`${index}-${paragraph.slice(0, 12)}`} value={index}>第 {index + 1} 段 · {paragraph.slice(0, 20)}</option>)}</select>
        <select value={instruction} onChange={event => setInstruction(event.target.value)}><option>更简洁</option><option>更像私聊</option><option>更克制</option><option>更具体但不新增事实</option></select>
        <button disabled={rewriting || !paragraphs.length} onClick={() => onRewrite(paragraphIndex, instruction)}>{rewriting ? '正在改写…' : '局部改写'}</button>
      </div>
      <label className="field-label">行动引导<input data-testid="content-cta" value={variant.call_to_action} onChange={event => onChange({ call_to_action: event.target.value })} /></label>

      <div className="annotated-preview">
        <div className="preview-heading"><div><Clipboard size={16} /><strong>逐句校对</strong></div><span>点击有底色的陈述查看右侧依据或风险</span></div>
        <p>{segments.map((segment, index) => segment.type === 'plain' ? <span key={index}>{segment.text}</span> : <button data-testid={`content-mark-${segment.type}`} key={index} className={`inline-mark inline-${segment.type}`} onClick={() => segment.type === 'claim' ? onSelectEvidence(segment.refId || '') : onSelectRisk(segment.refId || '')}>{segment.text}</button>)}</p>
      </div>

      <div className="editor-actions">
        <Button variant="ghost" onClick={onRegenerate}><RotateCcw size={16} />重新生成此版本</Button>
        <div><Button data-testid="save-draft" variant="secondary" loading={saving} onClick={onSave}><Save size={16} />保存草稿</Button><Button data-testid="submit-review" loading={submitting} disabled={!canSubmit} onClick={onSubmit}><Send size={16} />提交审核</Button></div>
      </div>
      {!canSubmit ? <div className="submission-hint"><Check size={15} /><span>{!verified ? '内容修改后必须重新核验事实与合规。' : blocking ? '存在阻断风险，修改后才能提交。' : !variant.claims.length ? '至少需要绑定一条事实依据。' : '正文内容过短，暂不适合提交。'}</span></div> : null}
    </div>
  )
}
