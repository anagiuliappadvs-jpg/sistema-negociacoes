import { useState, useEffect } from 'react'
import { updateCliente, getLigacoesByCliente, saveLigacao, deleteLigacao, getNegociacoesConcluidas, saveNegociacaoConcluida } from '../lib/supabase'
import './ClienteDetalhes.css'

export default function ClienteDetalhes({ cliente, onBack }) {
  const [ligacoes, setLigacoes] = useState([])
  const [negociacoesConcluidas, setNegociacoesConcluidas] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('negociacao')
  const [showNovaLigacao, setShowNovaLigacao] = useState(false)
  const [showConcluir, setShowConcluir] = useState(false)
  const [novaLigacao, setNovaLigacao] = useState({
    data_ligacao: new Date().toISOString().split('T')[0],
    banco: '',
    numero_ligado: '',
    resumo: '',
  })
  const [conclusaoForm, setConclausaoForm] = useState({
    valor_final_acordo: '',
    valor_honorarios: '',
    data_formalizacao: new Date().toISOString().split('T')[0],
    responsavel: '',
  })
  const [valorDisponivel, setValorDisponivel] = useState(cliente.valor_disponivel || '')

  useEffect(() => {
    loadData()
  }, [])

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
        data_ligacao: new Date().toISOString().split('T')[0],
        banco: '',
        numero_ligado: '',
        resumo: '',
      })
      setShowNovaLigacao(false)
      loadData()
    }
  }

  const handleConcluirNegociacao = async (e) => {
    e.preventDefault()
    
    const { error } = await saveNegociacaoConcluida({
      cliente_id: cliente.id,
      ...conclusaoForm,
      valor_final_acordo: parseFloat(conclusaoForm.valor_final_acordo),
      valor_honorarios: parseFloat(conclusaoForm.valor_honorarios),
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

  if (loading) {
    return <div className="loading">Carregando...</div>
  }

  return (
    <div className="cliente-detalhes">
      <header className="detalhes-header">
        <button onClick={onBack} className="back-button">← Voltar</button>
        <h2>{cliente.nome}</h2>
      </header>

      <div className="cliente-info-card">
        <div className="info-block">
          <div className="info-label">Cliente</div>
          <p className="info-value">{cliente.nome}</p>
          <p className="info-meta">{cliente.cpf_cnpj} • {cliente.telefone}</p>
          <span className={`status-badge status-${cliente.status}`}>
            {cliente.status === 'em-negociacao' ? 'Em negociação' : 'Concluído'}
          </span>
        </div>

        <div className="info-block">
          <div className="info-label">Dívida</div>
          <p className="info-value">{cliente.banco || 'Múltiplos'}</p>
          <p className="info-meta">Tipo: {cliente.tipo_divida}</p>
          {cliente.valor_divida_atualizado && (
            <p className="info-meta">Valor atualizado: R$ {cliente.valor_divida_atualizado.toLocaleString('pt-BR')}</p>
          )}
        </div>
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
                <div key={ligacao.id} className="ligacao-card">
                  <div className="ligacao-header">
                    <div>
                      <div className="ligacao-data">{new Date(ligacao.data_ligacao).toLocaleDateString('pt-BR')}</div>
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
                  <label>Valor final do acordo *</label>
                  <input
                    type="number"
                    value={conclusaoForm.valor_final_acordo}
                    onChange={(e) => setConclausaoForm({ ...conclusaoForm, valor_final_acordo: e.target.value })}
                    placeholder="R$ 0,00"
                    step="0.01"
                    required
                  />
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
              {negociacoesConcluidas.map(neg => (
                <div key={neg.id} className="negociacao-card">
                  <div className="neg-data">{new Date(neg.data_formalizacao).toLocaleDateString('pt-BR')}</div>
                  <div className="neg-details">
                    <p><strong>Valor final:</strong> R$ {neg.valor_final_acordo.toLocaleString('pt-BR')}</p>
                    <p><strong>Honorários:</strong> R$ {neg.valor_honorarios.toLocaleString('pt-BR')}</p>
                    {neg.responsavel && <p><strong>Responsável:</strong> {neg.responsavel}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
