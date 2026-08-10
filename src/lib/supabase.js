import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Variáveis de ambiente Supabase não configuradas. Usando localStorage.')
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Funções de autenticação
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  return { data, error }
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getSession()
  return data?.session?.user || null
}

// Funções do banco de dados
export async function saveCliente(cliente) {
  if (!supabase) return { error: 'Supabase não configurado' }
  
  const { data, error } = await supabase
    .from('clientes')
    .insert([cliente])
    .select()
  
  return { data, error }
}

export async function updateCliente(id, updates) {
  if (!supabase) return { error: 'Supabase não configurado' }
  
  const { data, error } = await supabase
    .from('clientes')
    .update(updates)
    .eq('id', id)
    .select()
  
  return { data, error }
}

export async function getClientes() {
  if (!supabase) return { data: [], error: null }
  
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .order('created_at', { ascending: false })
  
  return { data, error }
}

export async function getClienteById(id) {
  if (!supabase) return { data: null, error: 'Supabase não configurado' }
  
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .single()
  
  return { data, error }
}

export async function deleteCliente(id) {
  if (!supabase) return { error: 'Supabase não configurado' }
  
  const { error } = await supabase
    .from('clientes')
    .delete()
    .eq('id', id)
  
  return { error }
}

// Funções para negociações
export async function saveLigacao(ligacao) {
  if (!supabase) return { error: 'Supabase não configurado' }
  
  const { data, error } = await supabase
    .from('ligacoes')
    .insert([ligacao])
    .select()
  
  return { data, error }
}

export async function getLigacoesByCliente(clienteId) {
  if (!supabase) return { data: [], error: null }
  
  const { data, error } = await supabase
    .from('ligacoes')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('data_ligacao', { ascending: false })
  
  return { data, error }
}

export async function updateLigacao(id, updates) {
  if (!supabase) return { error: 'Supabase não configurado' }
  
  const { data, error } = await supabase
    .from('ligacoes')
    .update(updates)
    .eq('id', id)
    .select()
  
  return { data, error }
}

export async function deleteLigacao(id) {
  if (!supabase) return { error: 'Supabase não configurado' }
  
  const { error } = await supabase
    .from('ligacoes')
    .delete()
    .eq('id', id)
  
  return { error }
}

// Funções para negociações concluídas
export async function saveNegociacaoConcluida(negociacao) {
  if (!supabase) return { error: 'Supabase não configurado' }
  
  const { data, error } = await supabase
    .from('negociacoes_concluidas')
    .insert([negociacao])
    .select()
  
  return { data, error }
}

export async function getNegociacoesConcluidas(clienteId) {
  if (!supabase) return { data: [], error: null }

  const { data, error } = await supabase
    .from('negociacoes_concluidas')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('data_formalizacao', { ascending: false })

  return { data, error }
}

export async function getTodasNegociacoesConcluidas() {
  if (!supabase) return { data: [], error: null }

  const { data, error } = await supabase
    .from('negociacoes_concluidas')
    .select('*')
    .order('data_formalizacao', { ascending: false })

  return { data, error }
}

export async function updateNegociacaoConcluida(id, updates) {
  if (!supabase) return { error: 'Supabase não configurado' }
  
  const { data, error } = await supabase
    .from('negociacoes_concluidas')
    .update(updates)
    .eq('id', id)
    .select()
  
  return { data, error }
}

export async function deleteNegociacaoConcluida(id) {
  if (!supabase) return { error: 'Supabase não configurado' }

  const { error } = await supabase
    .from('negociacoes_concluidas')
    .delete()
    .eq('id', id)

  return { error }
}

// Dívidas adicionais do cliente
export async function getDividasByCliente(clienteId) {
  if (!supabase) return { data: [], error: null }

  const { data, error } = await supabase
    .from('dividas')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: true })

  return { data, error }
}

export async function saveDivida(divida) {
  if (!supabase) return { error: 'Supabase não configurado' }

  const { data, error } = await supabase
    .from('dividas')
    .insert([divida])
    .select()

  return { data, error }
}

export async function updateDivida(id, updates) {
  if (!supabase) return { error: 'Supabase não configurado' }

  const { data, error } = await supabase
    .from('dividas')
    .update(updates)
    .eq('id', id)
    .select()

  return { data, error }
}

export async function deleteDivida(id) {
  if (!supabase) return { error: 'Supabase não configurado' }

  const { error } = await supabase
    .from('dividas')
    .delete()
    .eq('id', id)

  return { error }
}

// Documentos (arquivos anexados ao cliente)
export async function getDocumentos(clienteId) {
  if (!supabase) return { data: [], error: null }

  const { data, error } = await supabase
    .from('documentos')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false })

  return { data, error }
}

export async function uploadDocumento(clienteId, file) {
  if (!supabase) return { error: 'Supabase não configurado' }

  const nomeLimpo = file.name.replace(/[^\w.\-]+/g, '_')
  const path = `${clienteId}/${Date.now()}_${nomeLimpo}`

  const { error: upErr } = await supabase.storage
    .from('documentos')
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (upErr) return { error: upErr }

  const { data, error } = await supabase
    .from('documentos')
    .insert([{ cliente_id: clienteId, nome: file.name, path, tamanho: file.size }])
    .select()

  return { data, error }
}

export async function getDocumentoUrl(path) {
  if (!supabase) return { error: 'Supabase não configurado' }

  const { data, error } = await supabase.storage
    .from('documentos')
    .createSignedUrl(path, 60 * 10) // link válido por 10 minutos

  return { url: data?.signedUrl, error }
}

export async function deleteDocumento(id, path) {
  if (!supabase) return { error: 'Supabase não configurado' }

  await supabase.storage.from('documentos').remove([path])
  const { error } = await supabase.from('documentos').delete().eq('id', id)

  return { error }
}
