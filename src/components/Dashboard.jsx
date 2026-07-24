import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getClientes, getTodasNegociacoesConcluidas } from '../lib/supabase'
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

      <div className="dashboard-content">
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
      </div>
    </div>
  )
}
