const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
const CHAVE_TOKEN = 'qa.token'

export const lerToken = () => localStorage.getItem(CHAVE_TOKEN)
export const guardarToken = (t) => localStorage.setItem(CHAVE_TOKEN, t)
export const descartarToken = () => localStorage.removeItem(CHAVE_TOKEN)

/*
 * Contador de requisições em voo.
 *
 * A interface precisa avisar que está esperando a API mesmo nas chamadas que
 * não bloqueiam a tela, como o registro de cada resposta durante a prova. Por
 * isso a contagem fica aqui, no único ponto por onde todas as requisições
 * passam, e não em cada tela.
 */
let emVoo = 0
const ouvintes = new Set()

function avisar() {
  for (const ouvinte of ouvintes) {
    ouvinte(emVoo > 0)
  }
}

/** Registra um observador do estado de espera. Devolve a função que cancela. */
export function observarRequisicoes(ouvinte) {
  ouvintes.add(ouvinte)
  ouvinte(emVoo > 0)

  return () => ouvintes.delete(ouvinte)
}

async function req(metodo, caminho, corpo) {
  const token = lerToken()

  emVoo++
  avisar()

  let resp
  try {
    resp = await fetch(BASE + caminho, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
    })
  } catch {
    throw new Error('Não foi possível falar com o servidor. Verifique se a API está no ar.')
  } finally {
    emVoo--
    avisar()
  }

  if (resp.status === 401) {
    descartarToken()
    throw new Error('Sua sessão expirou. Entre novamente.')
  }

  if (!resp.ok) {
    const erro = await resp.json().catch(() => ({}))
    // O Laravel devolve os erros de validação agrupados por campo.
    const doCampo = erro.errors && Object.values(erro.errors)[0]?.[0]
    throw new Error(doCampo || erro.message || erro.erro || `Falha na requisição (${resp.status})`)
  }

  return resp.json()
}

export const listarTamanhos = () => req('GET', '/tamanhos')

export const cadastrar = (dados) => req('POST', '/cadastro', dados)
export const entrar = (email, password) => req('POST', '/login', { email, password })
export const demonstracao = () => req('POST', '/demonstracao')
export const sair = () => req('POST', '/logout')
export const eu = () => req('GET', '/eu')
export const definirTamanho = (tamanhoProva) =>
  req('PATCH', '/eu', { tamanho_prova: tamanhoProva })

export const gerarProva = () => req('POST', '/provas')

export const responder = (provaId, questaoId, alternativaId) =>
  req('POST', `/provas/${provaId}/respostas`, {
    questao_id: questaoId,
    alternativa_id: alternativaId,
  })

export const finalizar = (provaId) => req('POST', `/provas/${provaId}/finalizar`)

export const historico = () => req('GET', '/historico')
