# Ciência, precisão e limites

Revisão das fontes: 5 de novembro de 2026.

O VibraSound é um ambiente de escuta e visualização para relaxamento. As frequências descritas na interface são parâmetros do estímulo gerado. A aplicação não mede EEG nem confirma um estado cerebral, e não constitui tratamento médico.

## O que o preset significa

O preset inicial combina uma frequência central audível de **528 Hz** com um ritmo de **6 ciclos por segundo**. “Theta” identifica uma faixa convencional de frequências de EEG, não um resultado que a aplicação possa verificar.

No modo binaural, dois tons diferentes chegam separadamente aos ouvidos. São necessários fones estéreo e reprodução sem conversão para mono. O exemplo 528/6 produz **525 Hz à esquerda e 531 Hz à direita**. A diferença entre os tons é 6 Hz; não se trata de reproduzir um tom audível de 6 Hz.

No modo isocrônico, a amplitude de uma portadora de 528 Hz oscila seis vezes por segundo nos dois canais. Isso funciona também em caixas de som. Embora a portadora seja senoidal, a modulação de amplitude acrescenta componentes espectrais em torno dela; não se deve descrever o sinal modulado completo como contendo apenas uma única frequência.

A opção “Modular o binaural” aplica a mesma envoltória cossenoidal aos canais binaurais, preservando as duas portadoras separadas. Esse estímulo combina diferença binaural e modulação de amplitude; não equivale ao protocolo binaural não modulado e não implica maior eficácia.

## Evidência e linguagem do produto

Os resultados experimentais sobre batidas binaurais variam conforme o protocolo. Um estudo de 2021 não confirmou o arrastamento esperado a 40 Hz nas condições testadas. Um experimento de 2025 encontrou respostas de EEG em 16 e 40 Hz dependentes dos parâmetros, e alguns efeitos na tarefa de atenção. Esses resultados não demonstram que o preset 528/6 coloque qualquer pessoa em um estado cerebral específico ou produza relaxamento garantido. [Estudo de 2021](https://pubmed.ncbi.nlm.nih.gov/34245340/), [estudo de 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC11799511/).

Um estudo exploratório de 2018 com nove participantes observou mudanças em alguns indicadores de estresse após música afinada para incluir 528 Hz. O estímulo era música de piano, e não uma senoide isolada de 528 Hz. A amostra pequena e a diferença de estímulo impedem extrapolar esse resultado para uma propriedade terapêutica da portadora desta aplicação. Essa é uma limitação de interpretação, não uma comparação clínica realizada com o VibraSound. [Akimoto et al., 2018](https://www.scirp.org/journal/paperinformation?paperid=87146).

Evitar alegações como “reparação de DNA”, “cura”, “frequência do amor”, “neuroajuste comprovado”, “induz Theta” e indicadores fictícios de atividade cerebral. As opções de frequência são escolhas acústicas e rítmicas.

Texto curto para o painel de informações:

> Geramos tons e ritmos definidos. A resposta cerebral varia: 6 Hz descreve o estímulo, não uma frequência cerebral medida. 528 Hz é uma escolha sonora, sem garantia de benefício terapêutico específico. Use volume confortável e fones estéreo no modo binaural.

## Pulsação visual

Luzes intermitentes podem provocar crises em pessoas fotossensíveis. A Epilepsy Foundation identifica 5–30 flashes por segundo como uma faixa especialmente relevante, com variação individual. **6 Hz está nessa faixa.** Brilho, contraste, cor e área visual também influenciam o risco; chamar um efeito de “suave” não o torna comprovadamente seguro. [Epilepsy Foundation](https://www.epilepsy.com/what-is-epilepsy/seizure-triggers/photosensitivity).

Um fluxo contínuo sem pulsação rápida deve estar disponível. A pulsação sincronizada deve depender de escolha explícita do usuário, e o aviso deve aparecer junto dessa escolha. Ele também se aplica a partículas que variam rapidamente de brilho, mesmo sem uma camada de estrobo em tela inteira.

Texto curto para a opção de luz pulsante:

> Luz pulsante pode provocar crises em pessoas fotossensíveis. Se esse for seu caso, escolha o visual contínuo. Pare se houver desconforto.

O visual contínuo é uma alternativa de conforto, não uma técnica de arrastamento validada. Não acrescentar um selo científico a um novo efeito apenas por ele ser animado.

## Fórmulas e unidade de tempo

Em todas as expressões, `t` está em **segundos**, `f` em **hertz** e o argumento de seno/cosseno em radianos. Para amostras de áudio, `t = índiceDaAmostra / sampleRate`.

```text
L(t) = sin(2π × (f_cobertura − f_alvo / 2) × t)
R(t) = sin(2π × (f_cobertura + f_alvo / 2) × t)

g(t) = 0.5 + 0.5 × cos(2π × f_alvo × t)
isocrônico(t) = g(t) × sin(2π × f_cobertura × t)

envoltória_visual(t) = 0.5 + 0.3 × cos(2π × f_alvo × t)
```

Para 6 Hz, um ciclo dura `1/6` de segundo e há seis ciclos em um segundo. A envoltória visual normalizada varia de 0,2 a 0,8; a intensidade selecionada e a máscara espacial reduzem a luminosidade efetiva. A envoltória isocrônica varia de 0 a 1 antes da aplicação do volume de escuta e das transições de entrada e saída.

O relógio `AudioContext.currentTime` já utiliza segundos. Um carimbo de tempo de `requestAnimationFrame` usa milissegundos e precisa ser dividido por 1.000 antes de entrar em qualquer fórmula de frequência. Não calcular frequência contando quadros nem gerar o áudio com temporizadores da interface. [Web Audio API, W3C](https://www.w3.org/TR/webaudio/#dom-baseaudiocontext-currenttime), [requestAnimationFrame, MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame).

O áudio e a animação podem compartilhar uma fase de referência calculada pelo relógio de áudio. Isso evita deriva acumulada do cálculo, mas não elimina latência de saída, Bluetooth, atualização da tela ou quadros perdidos. Não prometer sincronização física de laboratório.

## Atualização da tela e verificabilidade

O renderizador deve acompanhar a atualização disponível da tela, mirando 60 FPS ou mais quando o dispositivo permitir. `requestAnimationFrame` acompanha normalmente a tela e pode pausar em abas ocultas. Não há como garantir 60 FPS em todo equipamento. A animação precisa retomar na fase correspondente ao tempo atual, sem acelerar para recuperar quadros. [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame).

A 60 FPS, um estímulo de 6 Hz possui cerca de dez quadros por ciclo. A forma visual é uma amostragem da função contínua. Frequências próximas ou superiores à metade da taxa real de atualização podem produzir aliasing, de modo que o movimento aparente não representa fielmente o valor pedido. Essa é uma consequência da amostragem, e deve orientar os limites do modo visual, sem alterar silenciosamente o ritmo solicitado para o áudio.

As verificações do motor devem confirmar a separação estéreo, os tons 525/531 Hz no preset, a portadora 528 Hz e a envoltória 6 Hz no modo isocrônico, os limites de ganho e opacidade, a estabilidade de fase com quadros perdidos e a conversão correta de milissegundos para segundos. Frequência nominal no software não comprova uma resposta fisiológica do ouvinte.

## Validação desta implementação

Os testes do motor verificam os três caminhos: binaural puro, binaural modulado e isocrônico. A renderização de 192.000 amostras por canal em `OfflineAudioContext` a 48 kHz confirmou os tons de 525/531 Hz, separação estéreo, bandas laterais esperadas e modulação cossenoidal de 6 Hz em relação ao instante de início do motor. Isso valida o sinal digital no navegador, não a reprodução física de qualquer dispositivo nem uma resposta cerebral.
