import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getClientes } from '../lib/supabase'
import ClienteForm from './ClienteForm'
import ClienteDetalhes from './ClienteDetalhes'
import './Dashboard.css'

export default function Dashboard({ session }) {
  const [clientes, setClientes] = useState([])
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
    setLoading(false)
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
    if (mesFilter && cliente.negociacoes_concluidas) {
      const temNegoEmMes = cliente.negociacoes_concluidas.some(neg => {
        const data = new Date(neg.data_formalizacao)
        const mes = data.toISOString().substring(0, 7)
        return mes === mesFilter
      })
      mesMatch = temNegoEmMes
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

          <button onClick={() => setShowForm(true)} className="btn-add-cliente">
            + Novo cliente
          </button>
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
                      <td>{cliente.ultimo_contato || '—'}</td>
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
