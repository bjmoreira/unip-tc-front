import { useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  cadastrar,
  definirTamanho,
  demonstracao,
  descartarToken,
  entrar,
  eu,
  finalizar,
  gerarProva,
  guardarToken,
  historico,
  lerToken,
  listarTamanhos,
  observarRequisicoes,
  responder,
  sair,
} from './api'

export default function App() {
  // Quem chega sem token vai direto para a tela de acesso; quem tem um token
  // guardado espera a validação contra a API antes de ver o painel.
  const [tela, setTela] = useState(() => (lerToken() ? 'carregando' : 'acesso'))
  const [tamanhos, setTamanhos] = useState([10, 20, 30, 40, 50])

  const [estudante, setEstudante] = useState(null)
  const [painel, setPainel] = useState([])
  const [previsao, setPrevisao] = useState([])
  const [provas, setProvas] = useState([])
  const [emAndamento, setEmAndamento] = useState(null)

  const [prova, setProva] = useState(null)
  const [questoes, setQuestoes] = useState([])
  const [respostas, setRespostas] = useState({})
  const [indice, setIndice] = useState(0)

  const [resultado, setResultado] = useState(null)

  // Três estados de espera, com papéis distintos:
  // esperandoApi  qualquer requisição em voo, inclusive as que não bloqueiam;
  // carregando    ação que impede o uso da tela até terminar;
  // tarefa        o que está sendo esperado, para dizer ao estudante.
  const [esperandoApi, setEsperandoApi] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [tarefa, setTarefa] = useState('')
  const [salvandoResposta, setSalvandoResposta] = useState(false)
  const [erro, setErro] = useState(null)

  useEffect(() => observarRequisicoes(setEsperandoApi), [])

  useEffect(() => {
    listarTamanhos()
      .then((d) => setTamanhos(d.tamanhos))
      .catch(() => {})

    if (!lerToken()) {
      return
    }

    Promise.all([eu(), historico()])
      .then(([perfil, d]) => {
        setEstudante(perfil.estudante)
        setPainel(d.painel)
        setPrevisao(d.proxima)
        setProvas(d.provas)
        setEmAndamento(d.prova_em_andamento)
        setTela('painel')
      })
      .catch(() => {
        descartarToken()
        setTela('acesso')
      })
  }, [])

  async function executar(acao, oQue = 'Carregando') {
    setErro(null)
    setTarefa(oQue)
    setCarregando(true)
    try {
      await acao()
    } catch (e) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }

  async function carregarPainel() {
    const d = await historico()
    setPainel(d.painel)
    setPrevisao(d.proxima)
    setProvas(d.provas)
    setEmAndamento(d.prova_em_andamento)
    setTela('painel')
  }

  const aoAutenticar = (acao) =>
    executar(async () => {
      const d = await acao()
      guardarToken(d.token)
      setEstudante(d.estudante)
      await carregarPainel()
    }, 'Entrando')

  const encerrar = () =>
    executar(async () => {
      await sair().catch(() => {})
      descartarToken()
      setEstudante(null)
      setPainel([])
      setPrevisao([])
      setProvas([])
      setEmAndamento(null)
      setProva(null)
      setResultado(null)
      setTela('acesso')
    }, 'Saindo')

  const trocarTamanho = (t) =>
    executar(async () => {
      const d = await definirTamanho(t)
      setEstudante(d.estudante)
      await carregarPainel()
    }, 'Ajustando o tamanho da prova')

  const abrirProva = () =>
    executar(async () => {
      const d = await gerarProva()
      setProva(d.prova)
      setQuestoes(d.questoes)

      // Prova retomada volta com as respostas que já haviam sido marcadas.
      const marcadas = {}
      for (const q of d.questoes) {
        if (q.alternativa_id) {
          marcadas[q.questao_id] = q.alternativa_id
        }
      }
      setRespostas(marcadas)

      // Abre na primeira questão ainda sem resposta.
      const pendente = d.questoes.findIndex((q) => !q.alternativa_id)
      setIndice(pendente === -1 ? 0 : pendente)
      setResultado(null)
      setTela('prova')
    }, emAndamento ? 'Retomando a prova' : 'Montando a prova')

  // A resposta aparece marcada na hora e o envio segue em segundo plano, para
  // que o estudante não espere a rede a cada questão. O aviso de "salvando" só
  // existe para que ele saiba que a resposta ainda não chegou ao servidor.
  const marcar = (questaoId, alternativaId) => {
    setRespostas((r) => ({ ...r, [questaoId]: alternativaId }))
    setSalvandoResposta(true)

    responder(prova.id, questaoId, alternativaId)
      .catch((e) => setErro(e.message))
      .finally(() => setSalvandoResposta(false))
  }

  const entregar = () =>
    executar(async () => {
      const d = await finalizar(prova.id)
      setResultado(d.resultado)
      setPainel(d.painel)
      setPrevisao(d.proxima)
      const h = await historico()
      setProvas(h.provas)
      setEmAndamento(h.prova_em_andamento)
      setTela('resultado')
    }, 'Corrigindo a prova')

  const respondidas = Object.keys(respostas).length
  const tamanhoAtual = estudante?.tamanho_prova ?? 20

  return (
    <div className="app">
      {/* Barra fina no topo: acende em qualquer requisição, mesmo nas que não
          bloqueiam a tela, como o salvamento das respostas. */}
      <div className={esperandoApi ? 'progresso ativo' : 'progresso'} role="presentation" />

      {carregando && <Veu texto={tarefa} />}

      <header className="cabecalho">
        <div>
          <h1>Questões adaptativas</h1>
          <p>Recomendação de questões orientada ao desempenho por tópico</p>
        </div>
        {estudante && tela !== 'acesso' && (
          <div className="identidade">
            <span className="quem">{estudante.nome ?? estudante.email}</span>
            <button className="link" onClick={encerrar}>
              Sair
            </button>
          </div>
        )}
      </header>

      {erro && <div className="erro">{erro}</div>}

      {tela === 'carregando' && (
        <section className="cartao aguardando">
          <span className="girador" />
          <p className="ajuda">Recuperando seu histórico...</p>
        </section>
      )}

      {tela === 'acesso' && (
        <Acesso
          tamanhos={tamanhos}
          aoEntrar={(email, senha) => aoAutenticar(() => entrar(email, senha))}
          aoCadastrar={(dados) => aoAutenticar(() => cadastrar(dados))}
          aoDemonstrar={() => aoAutenticar(demonstracao)}
          carregando={carregando}
        />
      )}

      {tela === 'painel' && (
        <Painel
          numeroProxima={provas.length + 1}
          emAndamento={emAndamento}
          tamanho={tamanhoAtual}
          tamanhos={tamanhos}
          aoTrocarTamanho={trocarTamanho}
          painel={painel}
          previsao={previsao}
          provas={provas}
          aoIniciar={abrirProva}
          carregando={carregando}
        />
      )}

      {tela === 'prova' && (
        <Prova
          prova={prova}
          questoes={questoes}
          respostas={respostas}
          indice={indice}
          aoNavegar={setIndice}
          aoMarcar={marcar}
          respondidas={respondidas}
          aoEntregar={entregar}
          carregando={carregando}
          salvando={salvandoResposta}
        />
      )}

      {tela === 'resultado' && (
        <Resultado
          resultado={resultado}
          painel={painel}
          previsao={previsao}
          provas={provas}
          aoContinuar={() => setTela('painel')}
        />
      )}
    </div>
  )
}

/**
 * Véu de espera para as ações que impedem o uso da tela.
 *
 * A montagem de uma prova e a correção levam alguns segundos. Sem um aviso, o
 * estudante clica de novo achando que o primeiro clique não pegou.
 */
function Veu({ texto }) {
  return (
    <div className="veu" role="status" aria-live="polite">
      <div className="veu-caixa">
        <span className="girador" />
        <span>{texto}...</span>
      </div>
    </div>
  )
}

function Acesso({ tamanhos, aoEntrar, aoCadastrar, aoDemonstrar, carregando }) {
  const [modo, setModo] = useState('entrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [tamanho, setTamanho] = useState(20)

  const enviar = (e) => {
    e.preventDefault()
    if (modo === 'entrar') {
      aoEntrar(email, senha)
      return
    }
    aoCadastrar({
      name: nome,
      email,
      password: senha,
      password_confirmation: confirmacao,
      tamanho_prova: tamanho,
    })
  }

  return (
    <section className="cartao estreito">
      <div className="abas">
        <button
          className={modo === 'entrar' ? 'aba ativa' : 'aba'}
          onClick={() => setModo('entrar')}
        >
          Entrar
        </button>
        <button
          className={modo === 'cadastrar' ? 'aba ativa' : 'aba'}
          onClick={() => setModo('cadastrar')}
        >
          Criar conta
        </button>
      </div>

      <p className="ajuda">
        Seu histórico de provas e a proficiência estimada em cada tópico ficam
        guardados na conta. Ao voltar, o sistema retoma de onde você parou, em vez
        de recomeçar a estimativa do zero.
      </p>

      <form className="formulario" onSubmit={enviar}>
        {modo === 'cadastrar' && (
          <label>
            Nome
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              autoComplete="name"
            />
          </label>
        )}

        <label>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>

        <label>
          Senha
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            minLength={modo === 'cadastrar' ? 8 : undefined}
            autoComplete={modo === 'cadastrar' ? 'new-password' : 'current-password'}
          />
        </label>

        {modo === 'cadastrar' && (
          <>
            <label>
              Repita a senha
              <input
                type="password"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </label>

            <div className="campo">
              <span>Quantas questões terá cada prova?</span>
              <div className="tamanhos">
                {tamanhos.map((t) => (
                  <button
                    type="button"
                    key={t}
                    className={t === tamanho ? 'tamanho ativo' : 'tamanho'}
                    onClick={() => setTamanho(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <button className="principal" type="submit" disabled={carregando}>
          {carregando ? 'Aguarde...' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
        </button>
      </form>

      <div className="atalho">
        <button className="secundario" onClick={aoDemonstrar} disabled={carregando}>
          Entrar como usuário de teste
        </button>
        <p className="ajuda">
          Conta pronta, sem cadastro, para ver o sistema funcionando. O histórico
          dela é compartilhado por quem usar este botão.
        </p>
      </div>
    </section>
  )
}

function Painel({
  numeroProxima,
  emAndamento,
  tamanho,
  tamanhos,
  aoTrocarTamanho,
  painel,
  previsao,
  provas,
  aoIniciar,
  carregando,
}) {
  // Uma prova iniciada e não entregue continua valendo, e é ela que o botão
  // abre. O painel precisa anunciar isso, sob pena de prometer uma prova nova
  // e devolver a antiga pela metade.
  if (emAndamento) {
    return (
      <>
        <section className="cartao">
          <h2>Prova {emAndamento.numero} em andamento</h2>
          <p className="ajuda">
            Você começou esta prova e ainda não a entregou. São{' '}
            {emAndamento.respondidas} de {emAndamento.tamanho} questões
            respondidas. Ao continuar, você volta para ela, e não para uma prova
            nova. A prova {emAndamento.numero + 1} só é montada depois da
            entrega desta.
          </p>

          <button className="principal" onClick={aoIniciar} disabled={carregando}>
            {carregando ? 'Abrindo...' : `Retomar prova ${emAndamento.numero}`}
          </button>
        </section>

        {provas.length > 0 && <Historico provas={provas} />}
        {painel.length > 0 && <Proficiencias painel={painel} />}
      </>
    )
  }

  return (
    <>
      <section className="cartao">
        <h2>Prova {numeroProxima}</h2>
        <p className="ajuda">
          {numeroProxima === 1
            ? `Prova diagnóstica de ${tamanho} questões, distribuídas igualmente entre os tópicos.`
            : `Prova otimizada de ${tamanho} questões, montada a partir do seu desempenho.`}
        </p>

        <div className="campo">
          <span>Tamanho da prova</span>
          <div className="tamanhos">
            {tamanhos.map((t) => (
              <button
                key={t}
                className={t === tamanho ? 'tamanho ativo' : 'tamanho'}
                onClick={() => aoTrocarTamanho(t)}
                disabled={carregando}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {previsao.length > 0 && (
          <>
            <h3>Distribuição prevista</h3>
            <Barras itens={previsao} maximo={tamanho} />
          </>
        )}

        <button className="principal" onClick={aoIniciar} disabled={carregando}>
          {carregando ? 'Montando prova...' : `Iniciar prova ${numeroProxima}`}
        </button>
      </section>

      {provas.length > 0 && <Historico provas={provas} />}
      {painel.length > 0 && <Proficiencias painel={painel} />}
    </>
  )
}

function Prova({
  prova,
  questoes,
  respostas,
  indice,
  aoNavegar,
  aoMarcar,
  respondidas,
  aoEntregar,
  carregando,
  salvando,
}) {
  const [confirmando, setConfirmando] = useState(false)

  const q = questoes[indice]
  if (!q) return null

  const pendentes = questoes.filter((item) => !respostas[item.questao_id]).length
  const primeiraPendente = questoes.findIndex((item) => !respostas[item.questao_id])

  return (
    <section className="cartao">
      <div className="topo-prova">
        <span className="etiqueta">
          Prova {prova.numero} · {prova.tipo === 'diagnostica' ? 'diagnóstica' : 'otimizada'}
        </span>
        <span className="contador">
          {respondidas} de {questoes.length} respondidas
          {salvando && (
            <span className="salvando">
              <span className="girador pequeno" />
              salvando
            </span>
          )}
        </span>
        <button
          className="finalizar"
          onClick={() => setConfirmando(true)}
          disabled={carregando}
        >
          {carregando ? 'Corrigindo...' : 'Finalizar e corrigir'}
        </button>
      </div>

      <div className="grade-navegacao">
        {questoes.map((item, i) => {
          const feita = Boolean(respostas[item.questao_id])
          const atual = i === indice

          // O número sozinho não diz nada a quem ouve a tela: o rótulo carrega
          // o estado que a cor e a marca mostram a quem vê.
          const rotulo =
            `Questão ${i + 1}, ${feita ? 'respondida' : 'sem resposta'}` +
            (atual ? ', questão atual' : '')

          return (
            <button
              key={item.questao_id}
              className={['passo', atual ? 'atual' : '', feita ? 'feita' : ''].join(' ')}
              onClick={() => aoNavegar(i)}
              aria-current={atual ? 'step' : undefined}
              aria-label={rotulo}
            >
              {i + 1}
            </button>
          )
        })}
      </div>

      <div className="questao">
        <p className="origem">
          {q.disciplina} · {q.topico} · nível {q.nivel}
        </p>
        <p className="enunciado">
          {indice + 1}. {q.enunciado}
        </p>
        <ul className="alternativas">
          {q.alternativas.map((a) => (
            <li key={a.id}>
              <label className={respostas[q.questao_id] === a.id ? 'marcada' : ''}>
                <input
                  type="radio"
                  name={`q${q.questao_id}`}
                  checked={respostas[q.questao_id] === a.id}
                  onChange={() => aoMarcar(q.questao_id, a.id)}
                />
                <span className="letra">{a.letra}</span>
                <span>{a.texto}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="rodape-prova">
        <button
          className="secundario"
          onClick={() => aoNavegar(indice - 1)}
          disabled={indice === 0}
        >
          Anterior
        </button>

        {/* Quem pulou questões teria de caçar o número na grade. O atalho só
            aparece quando há pendente em outro lugar da prova. */}
        {primeiraPendente !== -1 && primeiraPendente !== indice && (
          <button
            className="secundario"
            onClick={() => aoNavegar(primeiraPendente)}
            aria-label={`Ir para a questão ${primeiraPendente + 1}, a primeira sem resposta`}
          >
            Primeira sem resposta
          </button>
        )}

        <button
          className="principal avancar"
          onClick={() => aoNavegar(indice + 1)}
          disabled={indice === questoes.length - 1}
        >
          Próxima
        </button>
      </div>

      <p className="ajuda">
        A correção acontece apenas ao final da prova. Questões sem resposta são
        contadas como erro.
      </p>

      {confirmando && (
        <ConfirmarEntrega
          pendentes={pendentes}
          total={questoes.length}
          aoConfirmar={() => {
            setConfirmando(false)
            aoEntregar()
          }}
          aoCancelar={() => setConfirmando(false)}
        />
      )}
    </section>
  )
}

/**
 * Confirmação da entrega.
 *
 * A entrega corrige a prova e não tem volta, e as questões em branco valem
 * erro. A contagem das pendentes aparece aqui, junto do botão que confirma,
 * porque no rodapé da prova o aviso fica longe de quem já decidiu entregar.
 */
function ConfirmarEntrega({ pendentes, total, aoConfirmar, aoCancelar }) {
  useEffect(() => {
    const aoTeclar = (e) => {
      if (e.key === 'Escape') {
        aoCancelar()
      }
    }

    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aoCancelar])

  return (
    <div className="dialogo" role="presentation">
      <div
        className="dialogo-caixa"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-entrega"
      >
        <h2 id="titulo-entrega">Entregar a prova?</h2>
        <p className="ajuda">
          {pendentes === 0
            ? `Todas as ${total} questões estão respondidas.`
            : pendentes === 1
              ? 'Uma questão continua sem resposta e será contada como erro.'
              : `${pendentes} questões continuam sem resposta e serão contadas como erro.`}{' '}
          A correção acontece agora e não há como voltar a esta prova.
        </p>

        <div className="dialogo-acoes">
          {/* O foco começa na saída segura: quem confirma por reflexo volta
              para a prova, em vez de entregá-la. */}
          <button className="secundario" onClick={aoCancelar} autoFocus>
            Voltar à prova
          </button>
          <button className="principal" onClick={aoConfirmar}>
            Entregar e corrigir
          </button>
        </div>
      </div>
    </div>
  )
}

function Resultado({ resultado, painel, previsao, provas, aoContinuar }) {
  const pior = useMemo(() => resultado?.por_topico?.[0], [resultado])
  if (!resultado) return null

  return (
    <>
      <section className="cartao">
        <h2>
          Prova {resultado.numero}: {resultado.acertos} de {resultado.tamanho} (
          {resultado.aproveitamento}%)
        </h2>

        <table className="tabela">
          <thead>
            <tr>
              <th>Disciplina</th>
              <th>Tópico</th>
              <th>Questões</th>
              <th>Acertos</th>
              <th>Erros</th>
              <th>Aproveitamento</th>
            </tr>
          </thead>
          <tbody>
            {resultado.por_topico.map((l) => (
              <tr key={l.topico}>
                <td>{l.disciplina}</td>
                <td>{l.topico}</td>
                <td className="num">{l.questoes}</td>
                <td className="num">{l.acertos}</td>
                <td className="num">{l.erros}</td>
                <td className="num">
                  <span className={l.aproveitamento < 50 ? 'ruim' : 'bom'}>
                    {l.aproveitamento}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {pior && (
          <p className="ajuda">
            Menor aproveitamento em {pior.topico}. A próxima prova receberá mais
            questões desse tópico.
          </p>
        )}

        <h3>Distribuição da próxima prova</h3>
        <Barras itens={previsao} maximo={resultado.tamanho} />

        <button className="principal" onClick={aoContinuar}>
          Continuar
        </button>
      </section>

      <Historico provas={provas} />
      <Proficiencias painel={painel} />
    </>
  )
}

function Barras({ itens, maximo }) {
  const teto = itens.reduce((m, i) => Math.max(m, i.questoes), 1)

  return (
    <div className="barras">
      {itens.map((p) => (
        <div className="barra" key={p.topico}>
          <span className="rotulo">{p.topico}</span>
          <span className="trilho">
            <span
              className="preenchimento"
              style={{ width: `${(p.questoes / teto) * 100}%` }}
            />
          </span>
          <span className="valor">
            {p.questoes} / {maximo}
          </span>
        </div>
      ))}
    </div>
  )
}

function Historico({ provas }) {
  return (
    <section className="cartao">
      <h2>Histórico</h2>
      <table className="tabela">
        <thead>
          <tr>
            <th>Prova</th>
            <th>Tipo</th>
            <th>Data</th>
            <th>Questões</th>
            <th>Acertos</th>
            <th>Aproveitamento</th>
          </tr>
        </thead>
        <tbody>
          {provas.map((p) => (
            <tr key={p.numero}>
              <td className="num">{p.numero}</td>
              <td>{p.tipo === 'diagnostica' ? 'Diagnóstica' : 'Otimizada'}</td>
              <td>{p.concluida_em ?? ''}</td>
              <td className="num">{p.tamanho}</td>
              <td className="num">{p.acertos}</td>
              <td className="num">{p.aproveitamento}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function Proficiencias({ painel }) {
  return (
    <section className="cartao">
      <h2>Proficiência estimada</h2>
      <p className="ajuda">
        A pontuação parte de 1200 e é ajustada a cada prova conforme o acerto e a
        dificuldade das questões. O peso indica a prioridade do tópico na montagem
        da próxima prova, e cresce tanto com a dificuldade quanto com o tempo sem
        praticar.
      </p>
      <table className="tabela">
        <thead>
          <tr>
            <th>Disciplina</th>
            <th>Tópico</th>
            <th>Pontuação</th>
            <th>Acertos</th>
            <th>Erros</th>
            <th>Sem praticar</th>
            <th>Nível alvo</th>
            <th>Peso</th>
          </tr>
        </thead>
        <tbody>
          {painel.map((p) => (
            <tr key={p.topico}>
              <td>{p.disciplina}</td>
              <td>{p.topico}</td>
              <td className="num">{p.pontuacao}</td>
              <td className="num">{p.acertos}</td>
              <td className="num">{p.erros}</td>
              <td className="num">
                {p.dias_sem_praticar === null ? 'nunca' : `${p.dias_sem_praticar} d`}
              </td>
              <td>{p.nivel_alvo}</td>
              <td className="num">{p.peso}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
