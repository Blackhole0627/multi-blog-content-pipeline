# Multi-blog content pipeline

Pipeline completo para gerar e publicar blogs inteiros de artigos em português do Brasil:
5 blogs x 12 categorias x 10 artigos (600 artigos de 2 mil+ palavras, cada um com imagem),
publicados como posts Markdown em repositórios Astro gerenciados pelo Pages CMS.

Estado: os 5 blogs estão 100% gerados, conferidos e publicados.

## Estrutura

```
blogs/<blog>/
  topics.csv          120 linhas: id, category, slug, title, image_prompt, image_prompt_pt
  raw/articles/<id>.txt   texto puro de cada artigo (saída do bot de artigo)
  raw/images/<id>.jpg     imagem de capa de cada artigo (saída do bot de imagem)
  links.csv           id -> url da imagem hospedada (direct_url, viewer_url)
  upload_log.txt / push_log.txt   registro do que foi hospedado e publicado

pipeline/
  STYLE.md                    regras de escrita dos artigos
  article_prompt.md           prompt de geração (system + user + correção)
  article_prompt_receitas.md  adendo só pro blog de receitas (quantidades exatas)
  image_prompt_template.md    prompt de imagem em português, anti-artefato
  WORKFLOW.md / HANDOFF.md    desenho do pipeline e contrato de entrada/saída dos bots
  check_raw.py                audita a saída bruta (tamanho, clichês, marcadores de citação,
                              duplicidade entre artigos, imagens repetidas ou corrompidas)
  check_articles.py           valida artigos finais e confere o par artigo+imagem
  upload_raw_images.py        sobe raw/images pro imgbb e grava links.csv
  push_github.py              monta o .md final (frontmatter do content.config.ts do site)
                              e faz commit direto no repositório do blog, um post por commit
  gen_images.py               gerador de imagem gratuito de fallback
  generate_articles.py        gerador de artigo via API (alternativa ao bot de navegador)
  adapta_bot/                 bots Playwright (article_bot.js, image_bot.js) que operam
                              o DeepSeek e o Adapta One pelo navegador, mais utilitários
```

## Como retomar

```
git clone <este repositório>
cd pipeline/adapta_bot && npm install && npx playwright install chromium
```

Python 3.12 com `Pillow` instalado. Scripts Python rodam da raiz do projeto, por exemplo:

```
python pipeline/check_raw.py blogs/blog1-tecnologia
```

Credenciais nunca ficam em arquivo. Na hora de rodar, passe por variável de ambiente:
`IMGBB_API_KEY` (upload), `GITHUB_TOKEN` (publicação, token do dono dos repositórios
de destino), `DEEPSEEK_API_KEY` (só pro gerador via API). Os bots de navegador usam uma
sessão já logada, apontada por `ADAPTA_CDP`.

## Regras que valem pra todo artigo

- 2 mil+ palavras no corpo (alvo interno 2100 a 2400), português natural, sem travessão,
  sem emoji, sem clichê de texto gerado, sem fonte citada sem nome.
- Categoria e título exatamente iguais ao `topics.csv` do blog.
- Finanças: tom educativo, nunca promete retorno nem indica produto ou corretora.
- Receitas: quantidades, tempos e temperaturas exatos são obrigatórios (ver adendo).
- Um id de cada vez, com pausa, nunca em lote. Se um id falhar, pula e registra.

## Publicação

Os sites são repositórios Astro privados do cliente, editados pelo Pages CMS. O schema dos
posts está em `src/content.config.ts` de cada repositório. `push_github.py` gera o
frontmatter exatamente nesse formato (`heroImage` precisa ser URL absoluta) e commita em
`src/content/posts/<id>-<slug>.md`.
