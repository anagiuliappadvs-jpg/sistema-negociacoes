import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getClientes, getTodasNegociacoesConcluidas, updateNegociacaoConcluida } from '../lib/supabase'
import ClienteForm from './ClienteForm'
import ClienteDetalhes from './ClienteDetalhes'
import './Dashboard.css'

const fmtMoeda = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtData = (iso) => iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—'

export default function Dashboard({ session }) {
  const [clientes, setClientes] = useState([])
  const [negociacoes, setNegociacoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedCliente, setSelectedCliente] = useState(null)
  const [statusFilter, setStatusFilter] = useState('em-negociacao')
  const [valorFilter, setValorFilter] = useState('todos')
  const [mesFilter, setMesFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [dashTab, setDashTab] = useState('clientes')
  const [mesConcluidas, setMesConcluidas] = useState('')
  const [editNeg, setEditNeg] = useState(null)
  const [negForm, setNegForm] = useState({})

  const COMISSAO_JULIA = 0.05

  useEffect(() => {
    loadClientes()
  }, [])

  const loadClientes = async () => {
    setLoading(true)
    const { data, error } = await getClientes()
    if (!error) {
      setClientes(data || [])
    }
    const { data: negs } = await getTodasNegociacoesConcluidas()
    setNegociacoes(negs || [])
    setLoading(false)
  }

  // meses de conclusão por cliente (para o filtro por mês)
  const mesesPorCliente = {}
  negociacoes.forEach(n => {
    const mes = String(n.data_formalizacao).slice(0, 7)
    ;(mesesPorCliente[n.cliente_id] = mesesPorCliente[n.cliente_id] || new Set()).add(mes)
  })

  // total de honorários (respeitando o filtro de mês, se houver)
  const negParaTotal = mesFilter
    ? negociacoes.filter(n => String(n.data_formalizacao).slice(0, 7) === mesFilter)
    : negociacoes
  const honorariosTotal = negParaTotal.reduce((s, n) => s + Number(n.valor_honorarios || 0), 0)

  // ----- aba "Negociações concluídas" -----
  const nomePorCliente = {}
  clientes.forEach(c => { nomePorCliente[c.id] = c.nome })

  const concluidasFiltradas = (mesConcluidas
    ? negociacoes.filter(n => String(n.data_formalizacao).slice(0, 7) === mesConcluidas)
    : negociacoes
  ).slice().sort((a, b) => String(b.data_formalizacao).localeCompare(String(a.data_formalizacao)))

  const totalAcordoConc = concluidasFiltradas.reduce((s, n) => s + Number(n.valor_final_acordo || 0), 0)
  const totalHonorConc = concluidasFiltradas.reduce((s, n) => s + Number(n.valor_honorarios || 0), 0)
  const totalComissaoJulia = totalHonorConc * COMISSAO_JULIA
  const comissaoPendente = concluidasFiltradas
    .filter(n => !n.repasse_julia)
    .reduce((s, n) => s + Number(n.valor_honorarios || 0) * COMISSAO_JULIA, 0)

  const toggleRepasse = async (neg, checked) => {
    setNegociacoes(prev => prev.map(x => x.id === neg.id ? { ...x, repasse_julia: checked } : x))
    const { error } = await updateNegociacaoConcluida(neg.id, { repasse_julia: checked })
    if (error) {
      // desfaz em caso de erro
      setNegociacoes(prev => prev.map(x => x.id === neg.id ? { ...x, repasse_julia: !checked } : x))
      alert('Erro ao salvar o repasse: ' + (error.message || error))
    }
  }

  const abrirEdicaoNeg = (n) => {
    setNegForm({
      valor_divida_atualizado: n.valor_divida_atualizado ?? '',
      valor_final_acordo: n.valor_final_acordo ?? '',
      valor_honorarios: n.valor_honorarios ?? '',
      data_formalizacao: String(n.data_formalizacao).slice(0, 10),
      responsavel: n.responsavel || '',
    })
    setEditNeg(n)
  }

  const salvarEdicaoNeg = async (e) => {
    e.preventDefault()
    const updates = {
      valor_divida_atualizado: negForm.valor_divida_atualizado !== '' ? parseFloat(negForm.valor_divida_atualizado) : null,
      valor_final_acordo: parseFloat(negForm.valor_final_acordo) || 0,
      valor_honorarios: parseFloat(negForm.valor_honorarios) || 0,
      data_formalizacao: negForm.data_formalizacao,
      responsavel: negForm.responsavel.trim() || null,
    }
    const { error } = await updateNegociacaoConcluida(editNeg.id, updates)
    if (error) { alert('Erro ao salvar: ' + (error.message || error)); return }
    setNegociacoes(prev => prev.map(x => x.id === editNeg.id ? { ...x, ...updates } : x))
    setEditNeg(null)
  }

  const exportarConcluidas = () => {
    const cols = ['Cliente', 'Data da formalização', 'Valor do acordo', 'Honorários do escritório', 'Comissão Julia (5%)', 'Repasse feito?', 'Responsável']
    const linhas = concluidasFiltradas.map(n => [
      nomePorCliente[n.cliente_id] || '—',
      fmtData(n.data_formalizacao),
      fmtMoeda(n.valor_final_acordo),
      fmtMoeda(n.valor_honorarios),
      fmtMoeda(Number(n.valor_honorarios || 0) * COMISSAO_JULIA),
      n.repasse_julia ? 'Sim' : 'Não',
      n.responsavel || '',
    ])
    linhas.push(['TOTAL', '', fmtMoeda(totalAcordoConc), fmtMoeda(totalHonorConc), fmtMoeda(totalComissaoJulia), '', ''])
    const esc = v => '"' + (v == null ? '' : String(v)).replace(/"/g, '""') + '"'
    const csv = '﻿' + [cols, ...linhas].map(r => r.map(esc).join(';')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `negociacoes-concluidas${mesConcluidas ? '_' + mesConcluidas : ''}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleClienteAdicionado = async () => {
    setShowForm(false)
    await loadClientes()
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const filteredClientes = clientes.filter(cliente => {
    // Filtro de status
    const statusMatch = statusFilter === 'todos' || cliente.status === statusFilter

    // Filtro de valor disponível
    let valorMatch = true
    if (valorFilter === 'com-valor') {
      valorMatch = cliente.valor_disponivel && cliente.valor_disponivel > 0
    } else if (valorFilter === 'sem-valor') {
      valorMatch = !cliente.valor_disponivel || cliente.valor_disponivel === 0
    }

    // Filtro de mês de conclusão
    let mesMatch = true
    if (mesFilter) {
      mesMatch = mesesPorCliente[cliente.id] ? mesesPorCliente[cliente.id].has(mesFilter) : false
    }

    // Filtro de busca
    const searchMatch =
      cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.cpf_cnpj.includes(searchTerm)

    return statusMatch && valorMatch && mesMatch && searchMatch
  })

  const stats = {
    emNegociacao: clientes.filter(c => c.status === 'em-negociacao').length,
    concluidas: clientes.filter(c => c.status === 'concluido').length,
    comValor: clientes.filter(c => c.valor_disponivel && c.valor_disponivel > 0).length,
  }

  const exportarCSV = () => {
    const cols = ['Nome', 'CPF/CNPJ', 'Telefone', 'Email', 'Banco', 'Tipo de dívida',
      'Status', 'Valor atualizado', '% Honorários', 'Último contato', 'Observações']
    const linhas = filteredClientes.map(c => [
      c.nome, c.cpf_cnpj, c.telefone, c.email, c.banco, c.tipo_divida,
      c.status === 'concluido' ? 'Concluído' : 'Em negociação',
      c.valor_divida_atualizado != null ? fmtMoeda(c.valor_divida_atualizado) : '',
      c.percentual_honorarios != null ? c.percentual_honorarios : '',
      fmtData(c.ultimo_contato), (c.observacoes || '').replace(/\s+/g, ' '),
    ])
    const esc = v => '"' + (v == null ? '' : String(v)).replace(/"/g, '""') + '"'
    const csv = '﻿' + [cols, ...linhas].map(r => r.map(esc).join(';')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
    a.href = url
    a.download = `clientes-negociacoes_${hoje}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (selectedCliente) {
    return (
      <ClienteDetalhes
        cliente={selectedCliente}
        onBack={() => {
          setSelectedCliente(null)
          loadClientes()
        }}
      />
    )
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Sistema de Negociações Bancárias</h1>
          <p>Paccola & Pelegrini Advogados</p>
        </div>
        <div className="header-actions">
          <span className="user-email">{session.user.email}</span>
          <button onClick={handleLogout} className="logout-button">
            Sair
          </button>
        </div>
      </header>

      {showForm && (
        <ClienteForm
          onClose={() => setShowForm(false)}
          onClienteAdicionado={handleClienteAdicionado}
        />
      )}

      {editNeg && (
        <div className="modal-overlay" onClick={() => setEditNeg(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Editar negociação concluída</h2>
              <button onClick={() => setEditNeg(null)} className="close-button">×</button>
            </div>
            <form onSubmit={salvarEdicaoNeg} className="cliente-form">
              <div className="form-section">
                <p className="editneg-cliente">{nomePorCliente[editNeg.cliente_id] || 'Cliente'}</p>
                <div className="form-row">
                  <div className="form-group">
                    <label>Valor atualizado da dívida</label>
                    <input type="number" step="0.01" value={negForm.valor_divida_atualizado}
                      onChange={(e) => setNegForm({ ...negForm, valor_divida_atualizado: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Valor do acordo</label>
                    <input type="number" step="0.01" value={negForm.valor_final_acordo}
                      onChange={(e) => setNegForm({ ...negForm, valor_final_acordo: e.target.value })} required />
                  </div>
                </div>
                {(() => {
                  const a = parseFloat(negForm.valor_divida_atualizado), f = parseFloat(negForm.valor_final_acordo)
                  if (isNaN(a) || isNaN(f) || a <= 0 || a - f <= 0) return null
                  const d = a - f, p = (d / a) * 100
                  return <p className="editneg-desc">Desconto: <strong>R$ {fmtMoeda(d)}</strong> ({p.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)</p>
                })()}
                <div className="form-row">
                  <div className="form-group">
                    <label>Honorários do escritório</label>
                    <input type="number" step="0.01" value={negForm.valor_honorarios}
                      onChange={(e) => setNegForm({ ...negForm, valor_honorarios: e.target.value })} required />
                    <span className="helper-text">Comissão Julia (5%): R$ {fmtMoeda((parseFloat(negForm.valor_honorarios) || 0) * COMISSAO_JULIA)}</span>
                  </div>
                  <div className="form-group">
                    <label>Data de formalização</label>
                    <input type="date" value={negForm.data_formalizacao}
                      onChange={(e) => setNegForm({ ...negForm, data_formalizacao: e.target.value })} required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Responsável</label>
                  <input type="text" value={negForm.responsavel}
                    onChange={(e) => setNegForm({ ...negForm, responsavel: e.target.value })} />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-submit">Salvar alterações</button>
                <button type="button" onClick={() => setEditNeg(null)} className="btn-cancel">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="dashboard-content">
        <div className="dash-tabs">
          <button
            className={`dash-tab ${dashTab === 'clientes' ? 'active' : ''}`}
            onClick={() => setDashTab('clientes')}
          >
            Clientes
          </button>
          <button
            className={`dash-tab ${dashTab === 'concluidas' ? 'active' : ''}`}
            onClick={() => setDashTab('concluidas')}
          >
            Negociações concluídas
          </button>
        </div>

        {dashTab === 'clientes' && (<>
        <div className="filters-section">
          <div className="filters">
            <div className="filter-group">
              <label>Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="todos">Todos</option>
                <option value="em-negociacao">Em negociação</option>
                <option value="concluido">Concluído</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Valor disponível</label>
              <select value={valorFilter} onChange={(e) => setValorFilter(e.target.value)}>
                <option value="todos">Todos</option>
                <option value="com-valor">Com valor</option>
                <option value="sem-valor">Sem valor</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Mês de conclusão</label>
              <input
                type="month"
                value={mesFilter}
                onChange={(e) => setMesFilter(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label>Buscar cliente</label>
              <input
                type="text"
                placeholder="Nome ou CPF"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="header-buttons">
            <button onClick={exportarCSV} className="btn-exportar">
              ⭳ Exportar
            </button>
            <button onClick={() => setShowForm(true)} className="btn-add-cliente">
              + Novo cliente
            </button>
          </div>
        </div>

        <div className="stats">
          <div className="stat-card">
            <div className="stat-label">Negociações ativas</div>
            <div className="stat-value">{stats.emNegociacao}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Concluídas</div>
            <div className="stat-value">{stats.concluidas}</div>
          </div>
          <div className="stat-card stat-honorarios">
            <div className="stat-label">Honorários {mesFilter ? 'no mês' : '(total)'}</div>
            <div className="stat-value">R$ {fmtMoeda(honorariosTotal)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Com valor disponível</div>
            <div className="stat-value">{stats.comValor}</div>
          </div>
        </div>

        {loading ? (
          <div className="loading">Carregando clientes...</div>
        ) : (
          <div className="table-wrapper">
            <table className="clientes-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Banco/Dívida</th>
                  <th>Valor disponível</th>
                  <th>Último contato</th>
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {filteredClientes.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="empty-message">
                      Nenhum cliente encontrado
                    </td>
                  </tr>
                ) : (
                  filteredClientes.map(cliente => (
                    <tr key={cliente.id}>
                      <td className="cliente-name">{cliente.nome}</td>
                      <td>{cliente.banco || 'Múltiplos'}</td>
                      <td>
                        {cliente.valor_disponivel
                          ? `R$ ${cliente.valor_disponivel.toLocaleString('pt-BR')}`
                          : '—'}
                      </td>
                      <td>{cliente.ultimo_contato ? cliente.ultimo_contato.slice(0, 10).split('-').reverse().join('/') : '—'}</td>
                      <td>
                        <span className={`badge badge-${cliente.status}`}>
                          {cliente.status === 'em-negociacao' ? 'Em negociação' : 'Concluído'}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => setSelectedCliente(cliente)}
                          className="btn-details"
                        >
                          Ver detalhes
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        </>)}

        {dashTab === 'concluidas' && (
          <div className="concluidas-view">
            <div className="filters-section">
              <div className="filters">
                <div className="filter-group">
                  <label>Mês da conclusão</label>
                  <input
                    type="month"
                    value={mesConcluidas}
                    onChange={(e) => setMesConcluidas(e.target.value)}
                  />
                </div>
                {mesConcluidas && (
                  <div className="filter-group">
                    <label>&nbsp;</label>
                    <button className="btn-exportar" onClick={() => setMesConcluidas('')}>Limpar mês</button>
                  </div>
                )}
              </div>
              <div className="header-buttons">
                <button onClick={exportarConcluidas} className="btn-exportar">⭳ Exportar</button>
              </div>
            </div>

            <div className="stats">
              <div className="stat-card">
                <div className="stat-label">Acordos {mesConcluidas ? 'no mês' : '(total)'}</div>
                <div className="stat-value">{concluidasFiltradas.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Valor formalizado</div>
                <div className="stat-value">R$ {fmtMoeda(totalAcordoConc)}</div>
              </div>
              <div className="stat-card stat-honorarios">
                <div className="stat-label">Honorários do escritório</div>
                <div className="stat-value">R$ {fmtMoeda(totalHonorConc)}</div>
              </div>
              <div className="stat-card stat-comissao">
                <div className="stat-label">Comissão Julia (5%)</div>
                <div className="stat-value">R$ {fmtMoeda(totalComissaoJulia)}</div>
              </div>
              <div className="stat-card stat-pendente">
                <div className="stat-label">Pendente de repasse</div>
                <div className="stat-value">R$ {fmtMoeda(comissaoPendente)}</div>
              </div>
            </div>

            {loading ? (
              <div className="loading">Carregando...</div>
            ) : (
              <div className="table-wrapper">
                <table className="clientes-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Data</th>
                      <th>Valor do acordo</th>
                      <th>Honorários</th>
                      <th>Comissão Julia (5%)</th>
                      <th className="col-check">Repasse feito?</th>
                      <th>Responsável</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {concluidasFiltradas.length === 0 ? (
                      <tr><td colSpan="8" className="empty-message">Nenhuma negociação concluída neste período</td></tr>
                    ) : (
                      concluidasFiltradas.map(n => (
                        <tr key={n.id} className={n.repasse_julia ? 'repasse-ok' : ''}>
                          <td className="cliente-name">{nomePorCliente[n.cliente_id] || '—'}</td>
                          <td>{fmtData(n.data_formalizacao)}</td>
                          <td>R$ {fmtMoeda(n.valor_final_acordo)}</td>
                          <td>R$ {fmtMoeda(n.valor_honorarios)}</td>
                          <td className="col-comissao">R$ {fmtMoeda(Number(n.valor_honorarios || 0) * COMISSAO_JULIA)}</td>
                          <td className="col-check">
                            <label className="repasse-check">
                              <input
                                type="checkbox"
                                checked={!!n.repasse_julia}
                                onChange={(e) => toggleRepasse(n, e.target.checked)}
                              />
                              <span>{n.repasse_julia ? 'Repassado' : 'Pendente'}</span>
                            </label>
                          </td>
                          <td>{n.responsavel || '—'}</td>
                          <td>
                            <button className="btn-details" onClick={() => abrirEdicaoNeg(n)}>Editar</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {concluidasFiltradas.length > 0 && (
                    <tfoot>
                      <tr className="linha-total">
                        <td colSpan="2"><strong>TOTAL</strong></td>
                        <td><strong>R$ {fmtMoeda(totalAcordoConc)}</strong></td>
                        <td><strong>R$ {fmtMoeda(totalHonorConc)}</strong></td>
                        <td className="col-comissao"><strong>R$ {fmtMoeda(totalComissaoJulia)}</strong></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
