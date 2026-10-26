# Workflow do projeto, 5 blogs x 120 artigos

Este documento é a referência para quem for construir os bots (artigo, imagem, publicação).
Não é código, é o desenho de como as peças se encaixam.

## Visão geral

```
topics.csv (120 linhas por blog)
    |
    +--> gerar artigo (DeepSeek)  --> validar (check_articles.py) --> articles/<id>-<slug>.md
    |
    +--> gerar imagem (Adapta, prompt PT) --> images/<id>.jpg
    |
    +--> conferir par (check_articles.py) --> controle.csv (pronto_para_publicar = SIM/NAO)
    |
    +--> publicar (bot Pages CMS, só depois do dia 22) --> url_publicada em controle.csv
```

Cada blog é uma pasta independente em `blogs/<nome-do-blog>/`, com a mesma estrutura:
`topics.csv`, `articles/`, `images/`, `controle.csv`.

## A chave que amarra tudo: o id

Todo artigo, toda imagem, toda linha da planilha usa o mesmo id de três dígitos vindo de
`topics.csv` (`001` a `120`). Isso nunca muda, nenhum bot deve inventar outro esquema de nome.

| Coisa | Onde fica | Nome do arquivo |
|---|---|---|
| Tópico e prompts | `topics.csv`, coluna `id` | linha `001`...`120` |
| Artigo | `articles/` | `<id>-<slug>.md` |
| Imagem | `images/` | `<id>.jpg` (ou `.png`/`.webp`) |
| Registro | `controle.csv`, coluna `id` | uma linha por id |

`topics.csv` tem estas colunas: `id, category, slug, title, image_prompt, image_prompt_pt`.
`image_prompt` é o prompt em inglês (usado pelo gerador gratuito de fallback,
`pipeline/gen_images.py`). `image_prompt_pt` é o prompt em português (usado pelo bot que
opera o Adapta, já que o histórico de chat fica visível para o cliente).

## Etapa 1, artigo

Regras completas em `pipeline/STYLE.md` e o prompt pronto em `pipeline/article_prompt.md`
(system + user + prompt de correção). Resumo:

- 2100 a 2400 palavras no corpo.
- Sem travessão, sem emoji, sem clichês de texto gerado por IA.
- Frontmatter com id, title, slug, category, date, description, image (vazio até a imagem
  ficar pronta), image_prompt.
- Categoria e título têm que bater exatamente com `topics.csv`.

Script de referência já pronto: `pipeline/generate_articles.py` (usa a API da DeepSeek
diretamente, com até 2 tentativas de correção automática antes de marcar
REVISAR). Se o bot for escrito em outra linguagem, a lógica de retry é a mesma: gerar, validar
localmente, se falhar reenviar com a lista exata de problemas, nunca confiar no modelo dizendo
"tá dentro da regra" sem checar.

## Etapa 2, imagem

Prompt em português pronto em `pipeline/image_prompt_template.md`, monta a partir de
`image_prompt_pt`. Pontos que o bot do Adapta precisa respeitar:

- Um artigo por vez, igual ao script do cliente (`enviar.txt`), nunca pedir 10 de uma vez.
- Salvar a imagem baixada como `images/<id>.<ext>`, sem renomear com o título.
- Depois de gerar, rodar `check_articles.py` pra confirmar que o par bateu (ver Etapa 3).
- Se o Adapta recusar, travar ou devolver algo estranho, pular o id e seguir pro próximo, sem
  travar o lote inteiro. Registrar o id pulado em algum log pra retry manual depois.

## Etapa 3, conferência do par

`pipeline/check_articles.py <pasta-do-blog>` já faz isso. Ele:

- Confere cada artigo contra as regras de `STYLE.md`.
- Confere se existe uma imagem `images/<id>.*` pro mesmo id.
- Escreve `controle.csv` com uma coluna `pronto_para_publicar` (SIM só quando artigo E
  imagem passam).

Rode isso depois de cada lote, nunca confie que "gerou sem erro" significa "pronto".
`controle.csv` é a única fonte de verdade sobre o que pode ir pro CMS.

## Etapa 4, publicação (bloqueada até dia 22/09)

O acesso é por convite de colaborador por email no Pages CMS, sem GitHub, chega através do
dev do cliente. Quando chegar:

1. Abrir o convite, confirmar login.
2. Olhar a estrutura real do formulário de "novo artigo" (campos, dropdown de categoria, campo
   de imagem, editor de corpo).
3. Publicar só as linhas com `pronto_para_publicar = SIM`, uma de cada vez, igual ao script do
   cliente, com uma pausa entre cada save.
4. Depois de cada save, escrever a URL publicada na coluna `url_publicada` de `controle.csv`.

Esse bot ainda não foi escrito porque não existe página real pra inspecionar antes do dia 22.

## Credenciais, onde ficam

Nada de senha em arquivo dentro do projeto. Login do Adapta e credenciais do CMS ficam em
variáveis de ambiente na hora de rodar o bot (`ADAPTA_EMAIL`, `ADAPTA_PASS`, etc.), nunca
salvas em texto plano no repositório do projeto nem em nenhum arquivo gerado por script.

## Ritmo

O cliente foi explícito, artigo por artigo, sem importação em massa, sem gerar os 120 de
uma vez antes de publicar. Isso vale tanto pra geração quanto pra publicação, mesmo rodando
por script: um id de cada vez, com pausa entre eles, não em paralelo maciço.
