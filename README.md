# Questões Adaptativas: interface

Interface do sistema de recomendação adaptativa de questões. Consome a API do
repositório `questoes-adaptativas-api`.

Trabalho de Curso, Ciência da Computação, Universidade Paulista.

## Fluxo

1. O estudante cria uma conta ou entra com o botão de usuário de teste, e
   escolhe o tamanho da prova: 10, 20, 30, 40 ou 50 questões.
2. A prova 1 é diagnóstica, com as questões distribuídas igualmente entre os
   tópicos.
3. Durante a prova ele navega livremente entre as questões e pode revisar as
   respostas. Não há correção parcial.
4. Ao finalizar, a tela de resultado mostra o desempenho por tópico, a
   proficiência estimada e a distribuição prevista para a próxima prova.
5. As provas seguintes são otimizadas a partir desse desempenho.

O histórico de provas e a proficiência estimada ficam guardados na conta, no
servidor. O `localStorage` guarda apenas o token de acesso, para que o estudante
continue autenticado ao voltar. Limpar o navegador exige novo login, mas não
apaga o histórico.

O botão de usuário de teste entra em uma conta fixa, sem cadastro, para
demonstrar o sistema. O histórico dela é compartilhado por quem usar o botão.

## Executando

Com a API já em execução em `http://localhost:8000`:

```bash
docker compose up -d
```

A interface fica disponível em `http://localhost:5173`.

O endereço da API pode ser alterado pela variável `VITE_API_URL`, definida no
`docker-compose.yml`.

## Stack

React 19, Vite, Docker.
