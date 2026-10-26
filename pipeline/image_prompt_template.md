# Prompt de imagem (Adapta, em português)

Formato para o bot enviar no chat de imagem do Adapta One. Usa o campo
`image_prompt_pt` de `topics.csv` no lugar de `[ASSUNTO]`.

```
Fotografia editorial realista, cores naturais, foco nítido, plano aberto, formato paisagem 16:9.
Assunto: [ASSUNTO]
Sem texto, sem letras, sem palavras legíveis, sem números, sem logotipo, sem marca d'água,
sem conteúdo de tela visível, sem mãos ou dedos em close, sem placas ou sinalização legível.
Se aparecer alguma tela, ela deve estar desfocada ou brilhando, sem conteúdo.
```

## Três exemplos prontos para teste manual

**Produto, plano aberto (id 021)**
```
Fotografia editorial realista, cores naturais, foco nítido, plano aberto, formato paisagem 16:9.
Assunto: mesa de home office organizada vista de cima, com monitor, fones de ouvido, luminária
inteligente e carregador sem fio arrumados
Sem texto, sem letras, sem palavras legíveis, sem números, sem logotipo, sem marca d'água,
sem conteúdo de tela visível, sem mãos ou dedos em close, sem placas ou sinalização legível.
Se aparecer alguma tela, ela deve estar desfocada ou brilhando, sem conteúdo.
```

**Multidão e ambiente (id 052)**
```
Fotografia editorial realista, cores naturais, foco nítido, plano aberto, formato paisagem 16:9.
Assunto: arena de e-sports lotada durante um torneio, tela gigante brilhando acima do palco,
iluminação colorida dramática, silhuetas da torcida em primeiro plano
Sem texto, sem letras, sem palavras legíveis, sem números, sem logotipo, sem marca d'água,
sem conteúdo de tela visível, sem mãos ou dedos em close, sem placas ou sinalização legível.
Se aparecer alguma tela, ela deve estar desfocada ou brilhando, sem conteúdo.
```

**Simbólico ou conceitual (id 065)**
```
Fotografia editorial realista, cores naturais, foco nítido, plano aberto, formato paisagem 16:9.
Assunto: um anzol de pesca brilhante fisgando um envelope translúcido no ar, fundo azul escuro,
natureza morta conceitual sobre phishing
Sem texto, sem letras, sem palavras legíveis, sem números, sem logotipo, sem marca d'água,
sem conteúdo de tela visível, sem mãos ou dedos em close, sem placas ou sinalização legível.
Se aparecer alguma tela, ela deve estar desfocada ou brilhando, sem conteúdo.
```

## Por que essas restrições

Testes anteriores com um gerador gratuito mostraram os dois erros mais comuns de modelos de
imagem por IA: texto ilegível tipo garranchos quando a cena pede algo escrito (tela, jornal,
documento), e mãos com dedos errados quando aparecem em close. As instruções acima empurram o
modelo para o lado seguro nos dois casos. Se mesmo assim sair ruim, o próximo ajuste é trocar
"plano aberto" por uma distância ainda maior do assunto principal.
