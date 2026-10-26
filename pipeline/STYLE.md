# Guia de estilo dos artigos

Regras para todo artigo gerado neste projeto. Quem escreve (pessoa ou agente) segue isto à risca.

## Formato do arquivo

Um arquivo Markdown por artigo em `blogs/<blog>/articles/<id>-<slug>.md`, com frontmatter YAML no topo:

```
---
id: "001"
title: "Título exatamente como está no topics.csv"
slug: "slug-do-topics-csv"
category: "Categoria exatamente como está no topics.csv"
date: "AAAA-MM-DD"
description: "Uma frase de até 160 caracteres resumindo o artigo."
image: ""
image_prompt: "prompt em inglês copiado do topics.csv"
---
```

Depois do frontmatter vem o corpo. Não repetir o título como H1 no corpo. O corpo começa direto no parágrafo de abertura.

## Tamanho

Entre 2.100 e 2.400 palavras no corpo, contando por espaço em branco como o contador do invertexto.com. Nunca abaixo de 2.000. Se ficar curto, aprofundar as seções existentes em vez de inventar seção nova.

## Estrutura

1. Abertura de 2 a 3 parágrafos que situa o leitor e diz o que ele vai encontrar. Sem "Neste artigo você vai aprender".
2. De 6 a 9 seções com título H2. Subtítulos H3 só quando ajudam de verdade.
3. Listas com marcadores no máximo em 2 ou 3 seções. O resto é prosa.
4. Uma seção prática perto do fim, tipo passo a passo, checklist ou erros comuns.
5. Fechamento de 2 parágrafos que amarra o assunto. Título do fechamento variado, nunca "Conclusão" em todos os artigos.

## Voz e língua

- Português do Brasil, natural, como alguém explicando para um amigo que entende um pouco do assunto.
- Frases curtas e médias. Parágrafos de 3 a 5 linhas.
- Você pode usar "você". Evitar "nós" institucional.
- Nada de travessão (—) nem de meia-risca (–). Usar vírgula ou ponto.
- Nada de dois pontos no meio de frase para introduzir explicação. Ponto e frase nova.
- Nada de emoji.
- Evitar clichês de texto gerado: "no mundo de hoje", "em constante evolução", "é importante ressaltar", "vale destacar", "em resumo", "em suma", "além disso" repetido, "desbloquear", "revolucionar", "mergulhar".
- Não abrir seções com pergunta retórica toda vez.

## Conteúdo

- Explicar de verdade, com exemplos concretos do dia a dia brasileiro (reais, operadoras, lojas, apps que o brasileiro usa).
- Sem estatísticas inventadas com número exato. Pode dizer "a maioria", "boa parte", "nos últimos anos". Sem porcentagem inventada.
- Sem preço exato de produto. Pode falar em faixas como "na faixa dos mil reais".
- Sem data de lançamento específica de produto nem nome de modelo que pode não existir. Preferir categorias de produto a modelos exatos.
- Em finanças, tom educativo. Nunca prometer retorno, nunca recomendar produto ou corretora específica, sempre lembrar que cada caso é um caso.
- Em saúde, nunca substituir orientação médica.
- Não citar fontes com link. Não citar "estudos mostram" sem dizer qual, então simplesmente não usar.

## Checagem antes de entregar

- Contagem de palavras do corpo entre 2.100 e 2.400.
- Frontmatter completo, título e categoria idênticos ao topics.csv.
- Nenhum travessão, nenhum emoji.
- Nenhuma seção repetindo a mesma ideia de outra.
