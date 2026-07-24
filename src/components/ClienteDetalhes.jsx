import { useState, useEffect } from 'react'
import { jsPDF } from 'jspdf'
import { updateCliente, getLigacoesByCliente, saveLigacao, deleteLigacao, getNegociacoesConcluidas, saveNegociacaoConcluida } from '../lib/supabase'
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
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('negociacao')
  const [showNovaLigacao, setShowNovaLigacao] = useState(false)
  const [showConcluir, setShowConcluir] = useState(false)
  const [novaLigacao, setNovaLigacao] = useState({
    data_ligacao: hojeLocal(),
    banco: '',
    numero_ligado: '',
    resumo: '',
  })
  const [conclusaoForm, setConclausaoForm] = useState({
    valor_divida_atualizado: cliente.valor_divida_atualizado ?? '',
    valor_final_acordo: '',
    valor_honorarios: '',
    data_formalizacao: hojeLocal(),
    responsavel: '',
  })
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
    
    setLigacoes(ligacoesData || [])
    setNegociacoesConcluidas(negoData || [])
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

  // Honorários de êxito = percentual do cliente x desconto obtido (dívida atualizada - valor formalizado)
  const calcHonorarios = (atualizado, formalizado) => {
    const pct = parseFloat(dados.percentual_honorarios)
    const a = parseFloat(atualizado)
    const f = parseFloat(formalizado)
    if (isNaN(pct) || isNaN(a) || isNaN(f)) return ''
    const desconto = a - f
    if (desconto <= 0) return ''
    return (desconto * pct / 100).toFixed(2)
  }

  const handleConcluirNegociacao = async (e) => {
    e.preventDefault()

    const { error } = await saveNegociacaoConcluida({
      cliente_id: cliente.id,
      valor_divida_atualizado: conclusaoForm.valor_divida_atualizado !== '' ? parseFloat(conclusaoForm.valor_divida_atualizado) : null,
      valor_final_acordo: parseFloat(conclusaoForm.valor_final_acordo),
      valor_honorarios: parseFloat(conclusaoForm.valor_honorarios) || 0,
      data_formalizacao: conclusaoForm.data_formalizacao,
      responsavel: conclusaoForm.responsavel,
      created_at: new Date().toISOString(),
    })

    if (!error) {
      await updateCliente(cliente.id, { status: 'concluido' })
      setShowConcluir(false)
      onBack()
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

  const gerarRelatorio = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const M = 48                     // margem
    const W = doc.internal.pageSize.getWidth()
    const LW = W - M * 2             // largura útil
    let y = M

    const quebraPagina = (precisa = 16) => {
      if (y + precisa > doc.internal.pageSize.getHeight() - M) {
        doc.addPage(); y = M
      }
    }
    const linha = (texto, { size = 10, bold = false, cor = 40, gap = 14 } = {}) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.setFontSize(size)
      doc.setTextColor(cor)
      const linhas = doc.splitTextToSize(texto, LW)
      for (const l of linhas) { quebraPagina(gap); doc.text(l, M, y); y += gap }
    }

    // Cabeçalho
    doc.setFillColor(30, 41, 59)
    doc.rect(0, 0, W, 72, 'F')
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15)
    doc.text('Paccola & Pelegrini Advogados', M, 34)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11)
    doc.text('Relatório de Negociação Bancária', M, 54)
    y = 100

    linha(`Emitido em ${formatarDataBR(hojeLocal())}`, { size: 9, cor: 120, gap: 18 })

    // Dados do cliente
    linha('DADOS DO CLIENTE', { size: 11, bold: true, cor: 30, gap: 18 })
    linha(`Nome/Razão social: ${dados.nome}`)
    linha(`CPF/CNPJ: ${dados.cpf_cnpj}    Telefone: ${dados.telefone}`)
    if (dados.email) linha(`E-mail: ${dados.email}`)
    linha(`Credor: ${dados.banco || 'Múltiplos'}    Tipo de dívida: ${dados.tipo_divida || '—'}`)
    if (dados.valor_divida_atualizado != null)
      linha(`Valor atualizado da dívida: R$ ${formatarMoeda(dados.valor_divida_atualizado)}`)
    if (dados.percentual_honorarios != null)
      linha(`Honorários contratados: ${dados.percentual_honorarios}% sobre o desconto obtido`)
    y += 8

    // Histórico de ligações/contatos
    linha(`HISTÓRICO DE CONTATOS COM O CREDOR (${ligacoes.length})`, { size: 11, bold: true, cor: 30, gap: 18 })
    if (ligacoes.length === 0) {
      linha('Nenhum contato registrado.', { cor: 120 })
    } else {
      const ordenadas = [...ligacoes].sort((a, b) => String(a.data_ligacao).localeCompare(String(b.data_ligacao)))
      for (const lg of ordenadas) {
        quebraPagina(28)
        linha(`${formatarDataBR(lg.data_ligacao)}  •  ${lg.banco || ''}  •  ${lg.numero_ligado || ''}`, { size: 10, bold: true, gap: 14 })
        if (lg.resumo) linha(lg.resumo, { size: 10, cor: 70, gap: 13 })
        y += 4
      }
    }
    y += 8

    // Negociações concluídas
    if (negociacoesConcluidas.length > 0) {
      linha('NEGOCIAÇÃO FORMALIZADA', { size: 11, bold: true, cor: 30, gap: 18 })
      for (const n of negociacoesConcluidas) {
        quebraPagina(60)
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

    // Rodapé em todas as páginas
    const total = doc.internal.getNumberOfPages()
    for (let i = 1; i <= total; i++) {
      doc.setPage(i)
      doc.setFontSize(8); doc.setTextColor(150); doc.setFont('helvetica', 'normal')
      doc.text('Documento gerado pelo Sistema de Negociações — Paccola & Pelegrini Advogados',
        M, doc.internal.pageSize.getHeight() - 24)
      doc.text(`Página ${i}/${total}`, W - M, doc.internal.pageSize.getHeight() - 24, { align: 'right' })
    }

    const nomeArq = `Relatorio_${dados.nome.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 40)}.pdf`
    doc.save(nomeArq)
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
                <div key={ligacao.id} className="ligacao-card">
                  <div className="ligacao-header">
                    <div>
                      <div className="ligacao-data">{formatarDataBR(ligacao.data_ligacao)}</div>
                      <div className="ligacao-meta">{ligacao.banco} • {ligacao.numero_ligado}</div>
                    </div>
                    <button
                      onClick={() => handleDeleteLigacao(ligacao.id)}
                      className="btn-delete"
                    >
                      Deletar
                    </button>
                  </div>
                  <div className="ligacao-resumo">{ligacao.resumo}</div>
                </div>
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
            <form onSubmit={handleConcluirNegociacao} className="conclusao-form">
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
                        valor_honorarios: calcHonorarios(v, conclusaoForm.valor_final_acordo) || conclusaoForm.valor_honorarios,
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
                        valor_honorarios: calcHonorarios(conclusaoForm.valor_divida_atualizado, v) || conclusaoForm.valor_honorarios,
                      })
                    }}
                    placeholder="R$ 0,00"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
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
                  <span className="helper-text">
                    Calculado automaticamente: {dados.percentual_honorarios != null ? `${dados.percentual_honorarios}% do desconto` : 'defina o % no cadastro'} — pode ajustar manualmente
                  </span>
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
