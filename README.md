# Vibrasound · Neural Aligner

Um espaço minimalista de pausa: áudio binaural ou isocrônico gerado em tempo real, acompanhado por partículas cósmicas, órbitas harmônicas ou luz pulsante opcional.

**Aplicação:** [vibrasound.mapazero.com](https://vibrasound.mapazero.com)

## Usar

A aplicação abre diretamente no painel, com a logo no topo. Escolha o ritmo, a frequência base, o modo sonoro e a cor. Inicie a sessão: os controles desaparecem após alguns segundos e voltam ao mover o cursor, tocar ou navegar pelo teclado.

- Preset inicial: portadora **528 Hz** e ritmo **6 Hz**.
- Binaural: **525 Hz no canal esquerdo / 531 Hz no direito**. Use fones estéreo.
- Binaural com modulação opcional: preserva os tons separados e aplica pulsos de volume ao ritmo escolhido. Ative “Modular o binaural” nos ajustes finos.
- Isocrônico: portadora senoidal em ambos os canais, modulada em amplitude a 6 Hz.
- Presets Theta, Alpha e Delta; frequências, cor, duração, volume e intensidade personalizáveis.
- Sessão livre ou temporizada, pausa, retomada, silenciamento e tela cheia.
- Espaço pausa/retoma; Esc encerra. Ao trocar de aba, a sessão pausa.
- Preferências ficam apenas no navegador. A sincronização luminosa nunca é restaurada automaticamente.

O padrão visual é contínuo, sem flashes rítmicos. “Sincronizar visual ao ritmo” é uma escolha explícita nos ajustes finos: tamanho, movimento e brilho acompanham a fase do áudio. **Luz e padrões pulsantes podem provocar crises em pessoas fotossensíveis**, inclusive quando chamados de “suaves”. Use volume confortável.

## Precisão e limites

Todo tempo de fase é expresso em **segundos**. O áudio usa os osciladores nativos do Web Audio, e a modulação isocrônica é calculada pelo motor de áudio, sem timers de JavaScript. Um `PeriodicWave` cossenoidal alinha a fase inicial do LFO à envoltória visual.

```text
L(t) = sin(2π(f₀ − f/2)t)
R(t) = sin(2π(f₀ + f/2)t)
g(t) = 0.5 + 0.5 cos(2πft)
visual(t) = 0.5 + 0.3 cos(2πft)
```

A intensidade visual reduz a contribuição luminosa da envoltória. O modo Órbitas usa curvas de Lissajous como representação matemática, sem alegação terapêutica. O renderizador usa `requestAnimationFrame`, resolução limitada e qualidade adaptativa para buscar fluidez próxima de 60 FPS; o hardware e o navegador determinam o resultado. O áudio e o cálculo visual compartilham o relógio `AudioContext.currentTime`. Taxa de atualização da tela, latência de saída e Bluetooth impedem garantir sincronização física exata entre som e luz.

A sincronização visual exige taxa de quadros medida maior que duas vezes o ritmo solicitado. Por exemplo, uma tela de 60 Hz não pode representar um pulso de 40 Hz fielmente: a opção fica indisponível e o visual permanece contínuo, com o limite indicado no painel. A frequência sonora não é alterada. O renderizador também interrompe a pulsação se o desempenho cair abaixo desse limite.

A renderização real dos três modos foi comparada às fórmulas amostra por amostra, em 48 kHz. O relatório e o procedimento para repetir essa verificação estão em [validation/](validation/README.md).

**6 Hz descreve o estímulo, não uma frequência cerebral medida.** A evidência de arrastamento binaural é heterogênea. 528 Hz é uma escolha sonora, sem benefício terapêutico específico estabelecido. Não há EEG nem medição de estado cerebral na aplicação. Veja [SCIENCE.md](SCIENCE.md) para referências e limitações.

## Executar localmente

Requer Node.js 18+ e Python 3. Sem dependências de produção nem etapa de compilação.

```sh
npm run dev
# Abrir http://localhost:8788

npm test
npm run check
```

O áudio precisa de uma interação do usuário e de uma origem segura (HTTPS ou localhost). Recomenda-se navegador recente com Web Audio e Canvas 2D. A aplicação não coleta dados, não requer conta e não envia áudio ao servidor. As fontes são hospedadas junto da aplicação.

## Estrutura

```text
dist/index.html        Interface e informações da experiência
dist/styles.css        Layout responsivo e modo imersivo
dist/app.js            Controles e ciclo de vida da sessão
dist/audio-engine.js   Osciladores estéreo, modulação e relógio
dist/visualizer.js     Partículas, órbitas e envoltória visual
tests/                 Testes do motor e das fórmulas
SCIENCE.md             Evidências e limites
deploy/                Configuração de publicação em Nginx
```

`dist/` é o site completo. Pode ser hospedado em qualquer serviço estático com HTTPS. `.openai/hosting.json` também permite publicação via Sites.

## Licença

MIT. DM Sans e Instrument Serif usam SIL Open Font License; os textos das licenças estão em `dist/fonts/`.
