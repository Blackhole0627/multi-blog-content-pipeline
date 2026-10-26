# Handoff, bots de conteúdo

## Papéis

- **Outra sessão (constrói os bots)**: dois bots em Playwright, sem API.
  - **Bot 1, artigo**: abre o chat do DeepSeek no navegador, manda o prompt, copia o texto
    que ele responde, salva num arquivo simples.
  - **Bot 2, imagem**: abre o Adapta One no navegador, manda o prompt de imagem, baixa a
    imagem gerada, salva num arquivo simples.
  - Nenhum dos dois precisa se preocupar com frontmatter, validação, categoria certa, nada
    disso. Só precisa produzir o arquivo certo, no lugar certo, com o id certo.

- **Esta sessão (organiza e publica)**: pega o que os bots deixaram, confere contra as regras,
  monta o artigo final com frontmatter, casa artigo com imagem, atualiza a planilha de
  controle, e publica quando o acesso ao CMS chegar.

## Onde cada bot salva o resultado

Pasta base, por blog: `blogs\<nome-do-blog>\raw\`

```
blogs\blog1-tecnologia\raw\articles\<id>.txt      texto puro do artigo, sem frontmatter
blogs\blog1-tecnologia\raw\images\<id>.jpg        imagem baixada
```

`<id>` é o número de três dígitos de `topics.csv` (001 a 120), mesmo id da linha do tópico.
Um arquivo por artigo, um arquivo por imagem, nome igual ao id, mais nada.

## O que cada bot precisa ler pra montar o prompt

- `blogs\blog1-tecnologia\topics.csv`: colunas `id`, `category`, `title` (pro artigo) e
  `image_prompt_pt` (pra imagem, já em português).
- `pipeline\article_prompt.md`: texto exato pra colar no chat do DeepSeek antes do pedido de
  cada artigo (system prompt de estilo) mais o template do pedido em si.
- `pipeline\image_prompt_template.md`: template do prompt de imagem em português, já com as
  regras que evitam texto borrado e mãos deformadas.

Ritmo: um id de cada vez, com pausa entre cada um, nunca em lote. Se um id falhar (site
travou, resposta veio cortada), pula e segue, não trava o resto.

## Credenciais

Login do DeepSeek e do Adapta ficam em variável de ambiente na hora de rodar o bot, nunca
salvos em arquivo dentro do projeto. Senha do Adapta está em `enviar.txt`, na raiz do
projeto, só pra referência manual.

## O resto (esta sessão)

`pipeline\STYLE.md`, `pipeline\check_articles.py`, `pipeline\gen_images.py` (fallback) e
`pipeline\WORKFLOW.md` continuam do jeito que estão, não precisam ser tocados por quem for
construir os bots.
