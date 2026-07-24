import { useState } from 'react'
import { saveCliente } from '../lib/supabase'
import './ClienteForm.css'

export default function ClienteForm({ onClose, onClienteAdicionado }) {
  const [formData, setFormData] = useState({
    nome: '',
    cpf_cnpj: '',
    telefone: '',
    email: '',
    tipo_divida: '',
    banco: '',
    valor_divida_inicial: '',
    valor_divida_atualizado: '',
    percentual_honorarios: 20,
    valor_disponivel: '',
    observacoes: '',
    status: 'em-negociacao',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error: saveError } = await saveCliente({
        ...formData,
        valor_divida_inicial: parseFloat(formData.valor_divida_inicial) || 0,
        valor_divida_atualizado: parseFloat(formData.valor_divida_atualizado) || null,
        percentual_honorarios: parseFloat(formData.percentual_honorarios) || 0,
        valor_disponivel: parseFloat(formData.valor_disponivel) || null,
        created_at: new Date().toISOString(),
      })

      if (saveError) {
        setError(saveError.message)
      } else {
        onClienteAdicionado()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Novo cliente</h2>
          <button onClick={onClose} className="close-button">×</button>
        </div>

        <form onSubmit={handleSubmit} className="cliente-form">
          <div className="form-section">
            <h3>Dados pessoais</h3>

            <div className="form-group">
              <label htmlFor="nome">Nome ou razão social *</label>
              <input
                id="nome"
                name="nome"
                type="text"
                value={formData.nome}
                onChange={handleChange}
                placeholder="Nome completo"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="cpf_cnpj">CPF ou CNPJ *</label>
                <input
                  id="cpf_cnpj"
                  name="cpf_cnpj"
                  type="text"
                  value={formData.cpf_cnpj}
                  onChange={handleChange}
                  placeholder="000.000.000-00"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="telefone">Telefone de contato *</label>
                <input
                  id="telefone"
                  name="telefone"
                  type="tel"
                  value={formData.telefone}
                  onChange={handleChange}
                  placeholder="(00) 00000-0000"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="email@exemplo.com"
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Informações da dívida</h3>

            <div className="form-group">
              <label htmlFor="tipo_divida">Tipo de dívida *</label>
              <select
                id="tipo_divida"
                name="tipo_divida"
                value={formData.tipo_divida}
                onChange={handleChange}
                required
              >
                <option value="">Selecione...</option>
                <option value="financiamento">Financiamento</option>
                <option value="emprestimo">Empréstimo</option>
                <option value="cartao">Cartão de crédito</option>
                <option value="cheque-especial">Cheque especial</option>
                <option value="consorcio">Consórcio</option>
                <option value="multiplas">Múltiplas</option>
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="banco">Banco/Instituição *</label>
                <input
                  id="banco"
                  name="banco"
                  type="text"
                  value={formData.banco}
                  onChange={handleChange}
                  placeholder="Nome do banco"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="valor_divida_inicial">Valor inicial da dívida</label>
                <input
                  id="valor_divida_inicial"
                  name="valor_divida_inicial"
                  type="number"
                  value={formData.valor_divida_inicial}
                  onChange={handleChange}
                  placeholder="R$ 0,00"
                  step="0.01"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="valor_divida_atualizado">
                Valor atualizado da dívida
              </label>
              <input
                id="valor_divida_atualizado"
                name="valor_divida_atualizado"
                type="number"
                value={formData.valor_divida_atualizado}
                onChange={handleChange}
                placeholder="R$ 0,00"
                step="0.01"
              />
              <span className="helper-text">Preenchimento opcional — pode ser atualizado depois</span>
            </div>
          </div>

          <div className="form-section">
            <h3>Condições de pagamento</h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="percentual_honorarios">Percentual de honorários (%)</label>
                <input
                  id="percentual_honorarios"
                  name="percentual_honorarios"
                  type="number"
                  value={formData.percentual_honorarios}
                  onChange={handleChange}
                  placeholder="20"
                  step="0.1"
                />
                <span className="helper-text">Será calculado sobre o desconto obtido</span>
              </div>

              <div className="form-group">
                <label htmlFor="valor_disponivel">Valor disponível do cliente</label>
                <input
                  id="valor_disponivel"
                  name="valor_disponivel"
                  type="number"
                  value={formData.valor_disponivel}
                  onChange={handleChange}
                  placeholder="R$ 0,00"
                  step="0.01"
                />
                <span className="helper-text">Pode ser atualizado conforme o cliente comunica</span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="observacoes">Observações iniciais</label>
              <textarea
                id="observacoes"
                name="observacoes"
                value={formData.observacoes}
                onChange={handleChange}
                placeholder="Qualquer informação adicional sobre o cliente ou a negociação..."
                rows="4"
              />
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button type="submit" disabled={loading} className="btn-submit">
              {loading ? 'Cadastrando...' : 'Cadastrar cliente'}
            </button>
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
