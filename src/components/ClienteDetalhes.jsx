import { useState, useEffect } from 'react'
import { jsPDF } from 'jspdf'
import { updateCliente, deleteCliente, getLigacoesByCliente, saveLigacao, updateLigacao, deleteLigacao, getNegociacoesConcluidas, saveNegociacaoConcluida, getDividasByCliente, saveDivida, updateDivida, deleteDivida, getDocumentos, uploadDocumento, getDocumentoUrl, deleteDocumento } from '../lib/supabase'
import './ClienteDetalhes.css'

// Data de hoje no fuso local (evita o "pulo" de um dia do toISOString em UTC)
function hojeLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().split('T')[0]
}

// Mostra uma data 'AAAA-MM-DD' como 'DD/MM/AAAA' sem passar por new Date (que desloca o fuso)
function formatarDataBR(iso) {
  if (!iso) return ''
  const s = String(iso).slice(0, 10)
  const [y, m, d] = s.split('-')
  if (!y || !m || !d) return s
  return `${d}/${m}/${y}`
}

function formatarMoeda(v) {
  if (v === null || v === undefined || v === '') return null
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ClienteDetalhes({ cliente, onBack }) {
  const [ligacoes, setLigacoes] = useState([])
  const [negociacoesConcluidas, setNegociacoesConcluidas] = useState([])
  const [dividas, setDividas] = useState([])
  const [showNovaDivida, setShowNovaDivida] = useState(false)
  const [novaDivida, setNovaDivida] = useState({
    banco: '', tipo_divida: '', valor_divida_atualizado: '', percentual_honorarios: '', observacoes: '',
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('negociacao')
  const [showNovaLigacao, setShowNovaLigacao] = useState(false)
  const [editandoLigacaoId, setEditandoLigacaoId] = useState(null)
  const [ligacaoEdit, setLigacaoEdit] = useState({})
  const [showConcluir, setShowConcluir] = useState(false)
  const [novaLigacao, setNovaLigacao] = useState({
    data_ligacao: hojeLocal(),
    banco: '',
    numero_ligado: '',
    resumo: '',
  })
  const [conclusaoForm, setConclausaoForm] = useState({
    divida_id: '',
    valor_divida_atualizado: cliente.valor_divida_atualizado ?? '',
    valor_final_acordo: '',
    percentual_honorarios: cliente.percentual_honorarios ?? 20,
    valor_honorarios: '',
    data_formalizacao: hojeLocal(),
    responsavel: '',
  })
  const [documentos, setDocumentos] = useState([])
  const [enviandoDoc, setEnviandoDoc] = useState(false)
  const [valorDisponivel, setValorDisponivel] = useState(cliente.valor_disponivel || '')
  const [dados, setDados] = useState(cliente)
  const [editando, setEditando] = useState(false)
  const [salvandoDados, setSalvandoDados] = useState(false)
  const [form, setForm] = useState({})

  useEffect(() => {
    loadData()
  }, [])

  const abrirEdicao = () => {
    setForm({
      nome: dados.nome || '',
      cpf_cnpj: dados.cpf_cnpj || '',
      telefone: dados.telefone || '',
      email: dados.email || '',
      banco: dados.banco || '',
      tipo_divida: dados.tipo_divida || '',
      valor_divida_atualizado: dados.valor_divida_atualizado ?? '',
      percentual_honorarios: dados.percentual_honorarios ?? '',
      status: dados.status || 'em-negociacao',
      observacoes: dados.observacoes || '',
    })
    setEditando(true)
  }

  const handleSalvarDados = async (e) => {
    e.preventDefault()
    setSalvandoDados(true)
    const updates = {
      nome: form.nome.trim(),
      cpf_cnpj: form.cpf_cnpj.trim(),
      telefone: form.telefone.trim(),
      email: form.email.trim() || null,
      banco: form.banco.trim() || null,
      tipo_divida: form.tipo_divida.trim() || null,
      valor_divida_atualizado: form.valor_divida_atualizado !== '' ? parseFloat(form.valor_divida_atualizado) : null,
      percentual_honorarios: form.percentual_honorarios !== '' ? parseFloat(form.percentual_honorarios) : null,
      status: form.status,
      observacoes: form.observacoes.trim() || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await updateCliente(cliente.id, updates)
    setSalvandoDados(false)
    if (!error) {
      setDados({ ...dados, ...updates })
      setEditando(false)
    } else {
      alert('Erro ao salvar: ' + (error.message || error))
    }
  }

  const loadData = async () => {
    setLoading(true)
    const { data: ligacoesData } = await getLigacoesByCliente(cliente.id)
    const { data: negoData } = await getNegociacoesConcluidas(cliente.id)
    const { data: dividasData } = await getDividasByCliente(cliente.id)
    const { data: docsData } = await getDocumentos(cliente.id)

    setLigacoes(ligacoesData || [])
    setNegociacoesConcluidas(negoData || [])
    setDividas(dividasData || [])
    setDocumentos(docsData || [])
    setLoading(false)
  }

  const handleAddLigacao = async (e) => {
    e.preventDefault()
    
    const { error } = await saveLigacao({
      cliente_id: cliente.id,
      ...novaLigacao,
      created_at: new Date().toISOString(),
    })

    if (!error) {
      setNovaLigacao({
        data_ligacao: hojeLocal(),
        banco: '',
        numero_ligado: '',
        resumo: '',
      })
      setShowNovaLigacao(false)
      loadData()
    }
  }

  // Honorários de êxito = percentual x desconto obtido (dívida atualizada - valor formalizado)
  const calcHonorarios = (atualizado, formalizado, pct) => {
    const p = parseFloat(pct)
    const a = parseFloat(atualizado)
    const f = parseFloat(formalizado)
    if (isNaN(p) || isNaN(a) || isNaN(f)) return ''
    const desconto = a - f
    if (desconto <= 0) return ''
    return (desconto * p / 100).toFixed(2)
  }

  // dívidas ainda em aberto (principal + adicionais não concluídas)
  const dividasEmAberto = [
    ...(dados.principal_concluida ? [] : [{ id: '', label: `Dívida principal — ${dados.banco || 'principal'}`, banco: dados.banco, valor: dados.valor_divida_atualizado, pct: dados.percentual_honorarios }]),
    ...dividas.filter(d => d.status !== 'concluido').map(d => ({ id: d.id, label: `${d.banco || 'Dívida'}`, banco: d.banco, valor: d.valor_divida_atualizado, pct: d.percentual_honorarios })),
  ]

  const handleConcluirNegociacao = async (e) => {
    e.preventDefault()

    const dividaId = conclusaoForm.divida_id || null

    const baseConclusao = {
      cliente_id: cliente.id,
      valor_divida_atualizado: conclusaoForm.valor_divida_atualizado !== '' ? parseFloat(conclusaoForm.valor_divida_atualizado) : null,
      valor_final_acordo: parseFloat(conclusaoForm.valor_final_acordo),
      valor_honorarios: parseFloat(conclusaoForm.valor_honorarios) || 0,
      data_formalizacao: conclusaoForm.data_formalizacao,
      responsavel: conclusaoForm.responsavel,
      created_at: new Date().toISOString(),
    }

    const { error } = await saveNegociacaoConcluida({ ...baseConclusao, divida_id: dividaId })

    // fallback: banco ainda sem a atualização (coluna divida_id) -> comportamento antigo
    if (error) {
      const semColuna = /divida_id|column|schema cache|PGRST204/i.test(error.message || String(error))
      if (semColuna) {
        const { error: e2 } = await saveNegociacaoConcluida(baseConclusao)
        if (e2) { alert('Erro ao concluir: ' + (e2.message || e2)); return }
        await updateCliente(cliente.id, { status: 'concluido' })
        setShowConcluir(false)
        onBack()
        return
      }
      alert('Erro ao concluir: ' + (error.message || error))
      return
    }

    // (banco atualizado) marca a dívida escolhida como concluída
    if (dividaId) {
      await updateDivida(dividaId, { status: 'concluido' })
    }

    // o cliente só vira "concluído" quando TODAS as dívidas estiverem concluídas
    const principalOk = dividaId === null ? true : dados.principal_concluida === true
    const adicionaisOk = dividas.every(d => (d.id === dividaId ? true : d.status === 'concluido'))
    const tudoConcluido = principalOk && adicionaisOk

    const cliUpdates = {}
    if (dividaId === null) cliUpdates.principal_concluida = true
    if (tudoConcluido) cliUpdates.status = 'concluido'
    if (Object.keys(cliUpdates).length) await updateCliente(cliente.id, cliUpdates)

    setShowConcluir(false)
    onBack()
  }

  const handleUploadDoc = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 25 * 1024 * 1024) {
      alert('Arquivo muito grande (máx. 25 MB).')
      e.target.value = ''
      return
    }
    setEnviandoDoc(true)
    const { error } = await uploadDocumento(cliente.id, file)
    setEnviandoDoc(false)
    e.target.value = ''
    if (error) alert('Erro ao enviar: ' + (error.message || error))
    else loadData()
  }

  const handleAbrirDoc = async (path) => {
    const { url, error } = await getDocumentoUrl(path)
    if (error || !url) alert('Erro ao abrir o documento.')
    else window.open(url, '_blank')
  }

  const handleDeleteDoc = async (doc) => {
    if (window.confirm(`Remover o documento "${doc.nome}"?`)) {
      await deleteDocumento(doc.id, doc.path)
      loadData()
    }
  }

  const handleAtualizarValor = async () => {
    await updateCliente(cliente.id, {
      valor_disponivel: valorDisponivel ? parseFloat(valorDisponivel) : null
    })
  }

  const handleDeleteLigacao = async (id) => {
    if (window.confirm('Tem certeza que deseja deletar esta ligação?')) {
      await deleteLigacao(id)
      loadData()
    }
  }

  const abrirEdicaoLigacao = (lg) => {
    setLigacaoEdit({
      data_ligacao: String(lg.data_ligacao).slice(0, 10),
      banco: lg.banco || '',
      numero_ligado: lg.numero_ligado || '',
      resumo: lg.resumo || '',
    })
    setEditandoLigacaoId(lg.id)
  }

  const handleSalvarLigacao = async (e) => {
    e.preventDefault()
    const { error } = await updateLigacao(editandoLigacaoId, {
      data_ligacao: ligacaoEdit.data_ligacao,
      banco: ligacaoEdit.banco.trim(),
      numero_ligado: ligacaoEdit.numero_ligado.trim(),
      resumo: ligacaoEdit.resumo.trim(),
    })
    if (error) {
      alert('Erro ao salvar: ' + (error.message || error))
    } else {
      setEditandoLigacaoId(null)
      loadData()
    }
  }

  const handleAddDivida = async (e) => {
    e.preventDefault()
    const { error } = await saveDivida({
      cliente_id: cliente.id,
      banco: novaDivida.banco.trim() || null,
      tipo_divida: novaDivida.tipo_divida.trim() || null,
      valor_divida_atualizado: novaDivida.valor_divida_atualizado !== '' ? parseFloat(novaDivida.valor_divida_atualizado) : null,
      percentual_honorarios: novaDivida.percentual_honorarios !== '' ? parseFloat(novaDivida.percentual_honorarios) : null,
      observacoes: novaDivida.observacoes.trim() || null,
      status: 'em-negociacao',
    })
    if (!error) {
      setNovaDivida({ banco: '', tipo_divida: '', valor_divida_atualizado: '', percentual_honorarios: '', observacoes: '' })
      setShowNovaDivida(false)
      loadData()
    } else {
      alert('Erro ao adicionar dívida: ' + (error.message || error))
    }
  }

  const handleDeleteDivida = async (id) => {
    if (window.confirm('Remover esta dívida?')) {
      await deleteDivida(id)
      loadData()
    }
  }

  const handleExcluirCliente = async () => {
    if (!window.confirm(`Excluir o cliente "${dados.nome}"?\n\nIsso apaga também todas as ligações e negociações registradas dele. Não dá para desfazer.`)) return
    const { error } = await deleteCliente(cliente.id)
    if (error) {
      alert('Erro ao excluir: ' + (error.message || error))
    } else {
      onBack()
    }
  }

  const gerarRelatorio = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const W = doc.internal.pageSize.getWidth()
    const H = doc.internal.pageSize.getHeight()
    const M = 64
    const LW = W - M * 2
    const NAVY = [37, 47, 63], GOLD = [176, 141, 74], GRAY = [120, 130, 140], TX = [45, 52, 64]
    const TOP = 132            // onde o conteúdo começa (abaixo do timbre)
    const FOOTER_Y = H - 42

    // --- desenha o papel timbrado (cabeçalho + marca d'água + rodapé) em cada página ---
    const desenharTimbrado = () => {
      // marca d'água (chevron dourado, bem suave)
      try {
        doc.saveGraphicsState()
        doc.setGState(new doc.GState({ opacity: 0.035 }))
        doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2])
        doc.setLineWidth(9)
        const cx = W / 2, cy = H / 2 + 10
        for (const off of [-42, 14]) {
          doc.line(cx - 78, cy - 52 + off, cx, cy + 20 + off)
          doc.line(cx + 78, cy - 52 + off, cx, cy + 20 + off)
        }
        doc.restoreGraphicsState()
      } catch (e) { /* GState indisponível: segue sem marca d'água */ }

      // wordmark: PACCOLA & PELEGRINI  (& em dourado)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(25)
      const p1 = 'PACCOLA ', amp = '& ', p2 = 'PELEGRINI'
      const w1 = doc.getTextWidth(p1), wa = doc.getTextWidth(amp), w2 = doc.getTextWidth(p2)
      const startX = (W - (w1 + wa + w2)) / 2, topY = 60
      doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]); doc.text(p1, startX, topY)
      doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]); doc.text(amp, startX + w1, topY)
      doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]); doc.text(p2, startX + w1 + wa, topY)

      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
      doc.text('A D V O G A D O S   A S S O C I A D O S', W / 2, topY + 16, { align: 'center' })

      doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]); doc.setLineWidth(1)
      doc.line(M, topY + 30, W - M, topY + 30)

      // rodapé
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
      doc.text('(14) 99133-3863  |  contato@paccolaepelegrini.com.br', W / 2, FOOTER_Y, { align: 'center' })
    }

    let y = TOP
    const novaPagina = () => { doc.addPage(); desenharTimbrado(); y = TOP }
    const quebra = (h = 16) => { if (y + h > FOOTER_Y - 24) novaPagina() }
    const linha = (texto, { size = 10, bold = false, cor = TX, gap = 14 } = {}) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size)
      doc.setTextColor(cor[0], cor[1], cor[2])
      for (const l of doc.splitTextToSize(texto, LW)) { quebra(gap); doc.text(l, M, y); y += gap }
    }
    const secao = (titulo) => {
      quebra(30); y += 6
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
      doc.text(titulo, M, y)
      doc.setDrawColor(225, 225, 228); doc.setLineWidth(0.5); doc.line(M, y + 5, W - M, y + 5)
      y += 20
    }

    desenharTimbrado()

    // título do documento
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
    doc.text('RELATÓRIO DE NEGOCIAÇÃO', W / 2, y, { align: 'center' }); y += 16
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
    doc.text(`Emitido em ${formatarDataBR(hojeLocal())}`, W / 2, y, { align: 'center' }); y += 22

    secao('DADOS DO CLIENTE')
    linha(`Nome/Razão social: ${dados.nome}`)
    linha(`CPF/CNPJ: ${dados.cpf_cnpj}     Telefone: ${dados.telefone}`)
    if (dados.email) linha(`E-mail: ${dados.email}`)
    linha(`Credor: ${dados.banco || 'Múltiplos'}     Tipo de dívida: ${dados.tipo_divida || '—'}`)
    if (dados.valor_divida_atualizado != null)
      linha(`Valor atualizado da dívida: R$ ${formatarMoeda(dados.valor_divida_atualizado)}`)
    if (dados.percentual_honorarios != null)
      linha(`Honorários contratados: ${dados.percentual_honorarios}% sobre o desconto obtido`)

    secao(`HISTÓRICO DE CONTATOS COM O CREDOR (${ligacoes.length})`)
    if (ligacoes.length === 0) {
      linha('Nenhum contato registrado.', { cor: GRAY })
    } else {
      const ordenadas = [...ligacoes].sort((a, b) => String(a.data_ligacao).localeCompare(String(b.data_ligacao)))
      for (const lg of ordenadas) {
        quebra(28)
        linha(`${formatarDataBR(lg.data_ligacao)}  •  ${lg.banco || ''}  •  ${lg.numero_ligado || ''}`, { bold: true })
        if (lg.resumo) linha(lg.resumo, { cor: [80, 88, 98], gap: 13 })
        y += 4
      }
    }

    if (negociacoesConcluidas.length > 0) {
      secao('NEGOCIAÇÃO FORMALIZADA')
      for (const n of negociacoesConcluidas) {
        quebra(64)
        linha(`Data da formalização: ${formatarDataBR(n.data_formalizacao)}`, { bold: true })
        if (n.valor_divida_atualizado != null)
          linha(`Valor atualizado da dívida: R$ ${formatarMoeda(n.valor_divida_atualizado)}`)
        linha(`Valor formalizado (acordo): R$ ${formatarMoeda(n.valor_final_acordo)}`)
        if (n.valor_divida_atualizado != null) {
          const desc = Number(n.valor_divida_atualizado) - Number(n.valor_final_acordo)
          if (desc > 0) linha(`Desconto obtido: R$ ${formatarMoeda(desc)}`)
        }
        linha(`Honorários do escritório: R$ ${formatarMoeda(n.valor_honorarios)}`)
        if (n.responsavel) linha(`Responsável: ${n.responsavel}`)
        y += 6
      }
    }

    // número de página no rodapé de cada página
    const total = doc.internal.getNumberOfPages()
    for (let i = 1; i <= total; i++) {
      doc.setPage(i)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
      doc.text(`${i}/${total}`, W - M, FOOTER_Y, { align: 'right' })
    }

    doc.save(`Relatorio_${dados.nome.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 40)}.pdf`)
  }

  if (loading) {
    return <div className="loading">Carregando...</div>
  }

  return (
    <div className="cliente-detalhes">
      <header className="detalhes-header">
        <button onClick={onBack} className="back-button">← Voltar</button>
        <h2>{dados.nome}</h2>
        <button onClick={gerarRelatorio} className="btn-relatorio">
          📄 Gerar relatório do cliente
        </button>
        <button onClick={handleExcluirCliente} className="btn-excluir-cliente">
          Excluir
        </button>
      </header>

      {!editando ? (
        <div className="cliente-info-card">
          <div className="info-block">
            <div className="info-label">Cliente</div>
            <p className="info-value">{dados.nome}</p>
            <p className="info-meta">{dados.cpf_cnpj} • {dados.telefone}</p>
            {dados.email && <p className="info-meta">{dados.email}</p>}
            <span className={`status-badge status-${dados.status}`}>
              {dados.status === 'em-negociacao' ? 'Em negociação' : 'Concluído'}
            </span>
          </div>

          <div className="info-block">
            <div className="info-label">Dívida</div>
            <p className="info-value">{dados.banco || 'Múltiplos'}</p>
            <p className="info-meta">Tipo: {dados.tipo_divida || '—'}</p>
            {dados.valor_divida_atualizado != null && (
              <p className="info-meta">Valor atualizado: R$ {Number(dados.valor_divida_atualizado).toLocaleString('pt-BR')}</p>
            )}
            {dados.percentual_honorarios != null && (
              <p className="info-meta">Honorários: {dados.percentual_honorarios}%</p>
            )}
          </div>

          {dados.observacoes && (
            <div className="info-block info-observacoes">
              <div className="info-label">Observações</div>
              <p className="info-obs-text">{dados.observacoes}</p>
            </div>
          )}

          <button className="btn-editar-dados" onClick={abrirEdicao}>
            ✎ Editar dados do cliente
          </button>
        </div>
      ) : (
        <form onSubmit={handleSalvarDados} className="cliente-info-card editar-dados-form">
          <div className="form-row">
            <div className="form-group">
              <label>Nome / Razão social *</label>
              <input type="text" value={form.nome} required
                onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="form-group">
              <label>CPF / CNPJ *</label>
              <input type="text" value={form.cpf_cnpj} required
                onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Telefone *</label>
              <input type="text" value={form.telefone} required
                onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            </div>
            <div className="form-group">
              <label>E-mail</label>
              <input type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Banco / Credor</label>
              <input type="text" value={form.banco}
                onChange={(e) => setForm({ ...form, banco: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Tipo de dívida</label>
              <input type="text" value={form.tipo_divida}
                onChange={(e) => setForm({ ...form, tipo_divida: e.target.value })} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Valor atualizado da dívida (R$)</label>
              <input type="number" step="0.01" value={form.valor_divida_atualizado}
                onChange={(e) => setForm({ ...form, valor_divida_atualizado: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Honorários (%)</label>
              <input type="number" step="0.01" value={form.percentual_honorarios}
                onChange={(e) => setForm({ ...form, percentual_honorarios: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="em-negociacao">Em negociação</option>
                <option value="concluido">Concluído</option>
              </select>
            </div>
          </div>

          <div className="form-group full-width">
            <label>Observações</label>
            <textarea rows="5" value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-submit" disabled={salvandoDados}>
              {salvandoDados ? 'Salvando...' : 'Salvar alterações'}
            </button>
            <button type="button" className="btn-cancel" onClick={() => setEditando(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="dividas-section">
        <div className="section-header">
          <h3>Dívidas ({dividas.length + 1})</h3>
          <button onClick={() => setShowNovaDivida(true)} className="btn-add">
            + Adicionar dívida
          </button>
        </div>

        {showNovaDivida && (
          <form onSubmit={handleAddDivida} className="form-nova-divida">
            <div className="form-row">
              <div className="form-group">
                <label>Banco / Credor</label>
                <input type="text" value={novaDivida.banco}
                  onChange={(e) => setNovaDivida({ ...novaDivida, banco: e.target.value })}
                  placeholder="Nome do banco" required />
              </div>
              <div className="form-group">
                <label>Tipo de dívida</label>
                <input type="text" value={novaDivida.tipo_divida}
                  onChange={(e) => setNovaDivida({ ...novaDivida, tipo_divida: e.target.value })}
                  placeholder="Financiamento, empréstimo..." />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Valor atualizado da dívida (R$)</label>
                <input type="number" step="0.01" value={novaDivida.valor_divida_atualizado}
                  onChange={(e) => setNovaDivida({ ...novaDivida, valor_divida_atualizado: e.target.value })}
                  placeholder="R$ 0,00" />
              </div>
              <div className="form-group">
                <label>Honorários (%)</label>
                <input type="number" step="0.1" value={novaDivida.percentual_honorarios}
                  onChange={(e) => setNovaDivida({ ...novaDivida, percentual_honorarios: e.target.value })}
                  placeholder="20" />
              </div>
            </div>
            <div className="form-group full-width">
              <label>Observações</label>
              <textarea rows="2" value={novaDivida.observacoes}
                onChange={(e) => setNovaDivida({ ...novaDivida, observacoes: e.target.value })} />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-submit">Salvar dívida</button>
              <button type="button" onClick={() => setShowNovaDivida(false)} className="btn-cancel">Cancelar</button>
            </div>
          </form>
        )}

        <div className="dividas-list">
          <div className="divida-card divida-principal">
            <div className="divida-topo">
              <span className="divida-banco">{dados.banco || 'Múltiplos'}</span>
              <div className="divida-badges">
                <span className="divida-tag">Dívida principal</span>
                <span className={`divida-status ${(dados.principal_concluida || dados.status === 'concluido') ? 'status-ok' : 'status-open'}`}>
                  {(dados.principal_concluida || dados.status === 'concluido') ? 'Concluída' : 'Em negociação'}
                </span>
              </div>
            </div>
            <div className="divida-meta">
              Tipo: {dados.tipo_divida || '—'}
              {dados.valor_divida_atualizado != null && ` • Valor: R$ ${formatarMoeda(dados.valor_divida_atualizado)}`}
              {dados.percentual_honorarios != null && ` • Honorários: ${dados.percentual_honorarios}%`}
            </div>
          </div>

          {dividas.map(d => (
            <div key={d.id} className="divida-card">
              <div className="divida-topo">
                <span className="divida-banco">{d.banco || '—'}</span>
                <div className="divida-badges">
                  <span className={`divida-status ${d.status === 'concluido' ? 'status-ok' : 'status-open'}`}>
                    {d.status === 'concluido' ? 'Concluída' : 'Em negociação'}
                  </span>
                  <button onClick={() => handleDeleteDivida(d.id)} className="btn-delete">Remover</button>
                </div>
              </div>
              <div className="divida-meta">
                Tipo: {d.tipo_divida || '—'}
                {d.valor_divida_atualizado != null && ` • Valor: R$ ${formatarMoeda(d.valor_divida_atualizado)}`}
                {d.percentual_honorarios != null && ` • Honorários: ${d.percentual_honorarios}%`}
              </div>
              {d.observacoes && <div className="divida-obs">{d.observacoes}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="documentos-section">
        <div className="section-header">
          <h3>Documentos ({documentos.length})</h3>
          <label className={`btn-add btn-upload ${enviandoDoc ? 'is-loading' : ''}`}>
            {enviandoDoc ? 'Enviando...' : '+ Adicionar documento'}
            <input type="file" onChange={handleUploadDoc} disabled={enviandoDoc} style={{ display: 'none' }} />
          </label>
        </div>
        {documentos.length === 0 ? (
          <div className="empty-state"><p>Nenhum documento anexado ainda</p></div>
        ) : (
          <div className="documentos-list">
            {documentos.map(doc => (
              <div key={doc.id} className="documento-item">
                <div className="doc-info">
                  <span className="doc-nome">📎 {doc.nome}</span>
                  <span className="doc-meta">
                    {formatarDataBR(doc.created_at)}{doc.tamanho ? ` • ${(doc.tamanho / 1024).toFixed(0)} KB` : ''}
                  </span>
                </div>
                <div className="doc-acoes">
                  <button onClick={() => handleAbrirDoc(doc.path)} className="btn-editar-ligacao">Abrir</button>
                  <button onClick={() => handleDeleteDoc(doc)} className="btn-delete">Remover</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="tab-buttons">
        <button
          className={`tab-btn ${activeTab === 'negociacao' ? 'active' : ''}`}
          onClick={() => setActiveTab('negociacao')}
        >
          Negociação em andamento
        </button>
        <button
          className={`tab-btn ${activeTab === 'concluidas' ? 'active' : ''}`}
          onClick={() => setActiveTab('concluidas')}
        >
          Negociações concluídas
        </button>
      </div>

      {activeTab === 'negociacao' && (
        <div className="section">
          <div className="section-header">
            <h3>Histórico de ligações</h3>
            <button onClick={() => setShowNovaLigacao(true)} className="btn-add">
              + Registrar ligação
            </button>
          </div>

          {showNovaLigacao && (
            <form onSubmit={handleAddLigacao} className="form-nova-ligacao">
              <div className="form-row">
                <div className="form-group">
                  <label>Data da ligação</label>
                  <input
                    type="date"
                    value={novaLigacao.data_ligacao}
                    onChange={(e) => setNovaLigacao({ ...novaLigacao, data_ligacao: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Banco</label>
                  <input
                    type="text"
                    value={novaLigacao.banco}
                    onChange={(e) => setNovaLigacao({ ...novaLigacao, banco: e.target.value })}
                    placeholder="Nome do banco"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Número ligado</label>
                  <input
                    type="text"
                    value={novaLigacao.numero_ligado}
                    onChange={(e) => setNovaLigacao({ ...novaLigacao, numero_ligado: e.target.value })}
                    placeholder="(00) 0000-0000"
                    required
                  />
                </div>
              </div>

              <div className="form-group full-width">
                <label>Resumo do atendimento</label>
                <textarea
                  value={novaLigacao.resumo}
                  onChange={(e) => setNovaLigacao({ ...novaLigacao, resumo: e.target.value })}
                  placeholder="Descreva brevemente o resultado da ligação..."
                  rows="4"
                  required
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-submit">Salvar ligação</button>
                <button type="button" onClick={() => setShowNovaLigacao(false)} className="btn-cancel">Cancelar</button>
              </div>
            </form>
          )}

          {ligacoes.length === 0 ? (
            <div className="empty-state">
              <p>Nenhuma ligação registrada ainda</p>
            </div>
          ) : (
            <div className="ligacoes-list">
              {ligacoes.map(ligacao => (
                editandoLigacaoId === ligacao.id ? (
                  <form key={ligacao.id} onSubmit={handleSalvarLigacao} className="form-nova-ligacao">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Data da ligação</label>
                        <input type="date" value={ligacaoEdit.data_ligacao}
                          onChange={(e) => setLigacaoEdit({ ...ligacaoEdit, data_ligacao: e.target.value })} required />
                      </div>
                      <div className="form-group">
                        <label>Banco</label>
                        <input type="text" value={ligacaoEdit.banco}
                          onChange={(e) => setLigacaoEdit({ ...ligacaoEdit, banco: e.target.value })} required />
                      </div>
                      <div className="form-group">
                        <label>Número ligado</label>
                        <input type="text" value={ligacaoEdit.numero_ligado}
                          onChange={(e) => setLigacaoEdit({ ...ligacaoEdit, numero_ligado: e.target.value })} required />
                      </div>
                    </div>
                    <div className="form-group full-width">
                      <label>Resumo do atendimento</label>
                      <textarea rows="4" value={ligacaoEdit.resumo}
                        onChange={(e) => setLigacaoEdit({ ...ligacaoEdit, resumo: e.target.value })} required />
                    </div>
                    <div className="form-actions">
                      <button type="submit" className="btn-submit">Salvar alterações</button>
                      <button type="button" onClick={() => setEditandoLigacaoId(null)} className="btn-cancel">Cancelar</button>
                    </div>
                  </form>
                ) : (
                  <div key={ligacao.id} className="ligacao-card">
                    <div className="ligacao-header">
                      <div>
                        <div className="ligacao-data">{formatarDataBR(ligacao.data_ligacao)}</div>
                        <div className="ligacao-meta">{ligacao.banco} • {ligacao.numero_ligado}</div>
                      </div>
                      <div className="ligacao-acoes">
                        <button onClick={() => abrirEdicaoLigacao(ligacao)} className="btn-editar-ligacao">
                          Editar
                        </button>
                        <button onClick={() => handleDeleteLigacao(ligacao.id)} className="btn-delete">
                          Deletar
                        </button>
                      </div>
                    </div>
                    <div className="ligacao-resumo">{ligacao.resumo}</div>
                  </div>
                )
              ))}
            </div>
          )}

          <div className="valor-disponivel-card">
            <h4>Valor disponível do cliente</h4>
            <div className="valor-input-group">
              <input
                type="number"
                value={valorDisponivel}
                onChange={(e) => setValorDisponivel(e.target.value)}
                placeholder="R$ 0,00"
                step="0.01"
              />
              <button onClick={handleAtualizarValor} className="btn-atualizar">
                Atualizar
              </button>
            </div>
            {cliente.valor_disponivel && (
              <p className="current-value">Valor atual: R$ {cliente.valor_disponivel.toLocaleString('pt-BR')}</p>
            )}
          </div>

          <div className="conclusao-section">
            <h3>Marcar negociação como concluída</h3>
            {dividasEmAberto.length === 0 ? (
              <p className="tudo-concluido">✓ Todas as dívidas deste cliente já foram concluídas.</p>
            ) : (
            <form onSubmit={handleConcluirNegociacao} className="conclusao-form">
              <div className="form-row">
                <div className="form-group full-width">
                  <label>Qual dívida foi concluída? *</label>
                  <select
                    value={conclusaoForm.divida_id}
                    onChange={(e) => {
                      const id = e.target.value
                      const d = dividasEmAberto.find(x => String(x.id) === String(id))
                      setConclausaoForm({
                        ...conclusaoForm,
                        divida_id: id,
                        valor_divida_atualizado: d && d.valor != null ? d.valor : conclusaoForm.valor_divida_atualizado,
                        percentual_honorarios: d && d.pct != null ? d.pct : conclusaoForm.percentual_honorarios,
                      })
                    }}
                  >
                    {dividasEmAberto.map(d => (
                      <option key={d.id || 'principal'} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                  <span className="helper-text">Só esta dívida será concluída; as outras continuam em negociação.</span>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Valor atualizado da dívida *</label>
                  <input
                    type="number"
                    value={conclusaoForm.valor_divida_atualizado}
                    onChange={(e) => {
                      const v = e.target.value
                      setConclausaoForm({
                        ...conclusaoForm,
                        valor_divida_atualizado: v,
                        valor_honorarios: calcHonorarios(v, conclusaoForm.valor_final_acordo, conclusaoForm.percentual_honorarios) || conclusaoForm.valor_honorarios,
                      })
                    }}
                    placeholder="R$ 0,00"
                    step="0.01"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Valor que formalizamos (acordo) *</label>
                  <input
                    type="number"
                    value={conclusaoForm.valor_final_acordo}
                    onChange={(e) => {
                      const v = e.target.value
                      setConclausaoForm({
                        ...conclusaoForm,
                        valor_final_acordo: v,
                        valor_honorarios: calcHonorarios(conclusaoForm.valor_divida_atualizado, v, conclusaoForm.percentual_honorarios) || conclusaoForm.valor_honorarios,
                      })
                    }}
                    placeholder="R$ 0,00"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              {(() => {
                const va = parseFloat(conclusaoForm.valor_divida_atualizado)
                const vf = parseFloat(conclusaoForm.valor_final_acordo)
                if (isNaN(va) || isNaN(vf) || va <= 0) return null
                const desc = va - vf
                if (desc <= 0) return null
                const pct = (desc / va) * 100
                return (
                  <div className="desconto-banner">
                    <span>Desconto obtido</span>
                    <strong>R$ {formatarMoeda(desc)}</strong>
                    <span className="desconto-pct">({pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)</span>
                  </div>
                )
              })()}

              <div className="form-row">
                <div className="form-group">
                  <label>% de honorários</label>
                  <input
                    type="number"
                    value={conclusaoForm.percentual_honorarios}
                    onChange={(e) => {
                      const p = e.target.value
                      setConclausaoForm({
                        ...conclusaoForm,
                        percentual_honorarios: p,
                        valor_honorarios: calcHonorarios(conclusaoForm.valor_divida_atualizado, conclusaoForm.valor_final_acordo, p) || conclusaoForm.valor_honorarios,
                      })
                    }}
                    placeholder="20"
                    step="0.1"
                  />
                  <span className="helper-text">Aplicado sobre o desconto obtido</span>
                </div>
                <div className="form-group">
                  <label>Honorários do escritório *</label>
                  <input
                    type="number"
                    value={conclusaoForm.valor_honorarios}
                    onChange={(e) => setConclausaoForm({ ...conclusaoForm, valor_honorarios: e.target.value })}
                    placeholder="R$ 0,00"
                    step="0.01"
                    required
                  />
                  <span className="helper-text">Calculado automaticamente — pode ajustar manualmente</span>
                </div>
                <div className="form-group">
                  <label>Data de formalização *</label>
                  <input
                    type="date"
                    value={conclusaoForm.data_formalizacao}
                    onChange={(e) => setConclausaoForm({ ...conclusaoForm, data_formalizacao: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group full-width">
                <label>Responsável pela formalização</label>
                <input
                  type="text"
                  value={conclusaoForm.responsavel}
                  onChange={(e) => setConclausaoForm({ ...conclusaoForm, responsavel: e.target.value })}
                  placeholder="Nome do advogado responsável"
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-submit btn-success">
                  ✓ Concluir negociação
                </button>
                <button type="button" onClick={() => setShowConcluir(false)} className="btn-cancel">
                  Cancelar
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}

      {activeTab === 'concluidas' && (
        <div className="section">
          <h3>Negociações concluídas</h3>
          {negociacoesConcluidas.length === 0 ? (
            <div className="empty-state">
              <p>Nenhuma negociação concluída ainda</p>
            </div>
          ) : (
            <div className="negociacoes-list">
              {negociacoesConcluidas.map(neg => {
                const desconto = neg.valor_divida_atualizado != null
                  ? Number(neg.valor_divida_atualizado) - Number(neg.valor_final_acordo)
                  : null
                return (
                  <div key={neg.id} className="negociacao-card">
                    <div className="neg-data">{formatarDataBR(neg.data_formalizacao)}</div>
                    <div className="neg-details">
                      {neg.valor_divida_atualizado != null && (
                        <p><strong>Valor atualizado da dívida:</strong> R$ {formatarMoeda(neg.valor_divida_atualizado)}</p>
                      )}
                      <p><strong>Valor formalizado (acordo):</strong> R$ {formatarMoeda(neg.valor_final_acordo)}</p>
                      {desconto != null && desconto > 0 && (
                        <p><strong>Desconto obtido:</strong> R$ {formatarMoeda(desconto)}</p>
                      )}
                      <p><strong>Honorários:</strong> R$ {formatarMoeda(neg.valor_honorarios)}</p>
                      {neg.responsavel && <p><strong>Responsável:</strong> {neg.responsavel}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
