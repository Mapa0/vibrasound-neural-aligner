# Verificação do sinal de áudio

O relatório [audio-signal.json](./audio-signal.json) registra uma execução aprovada no Chromium. O verificador usa o motor de produção com o `OfflineAudioContext` nativo para renderizar os canais e inspecionar suas amostras. Também verifica pausa, retomada e encerramento com um `AudioContext` real.

O preset 528/6 é conferido em três condições: binaural puro com canais de 525 e 531 Hz; isocrônico com portadora de 528 Hz e modulação de 6 Hz; binaural com modulação adicional opcional. As verificações incluem separação estéreo, forma de onda, bandas laterais esperadas e ausência do erro de escala que geraria 6.000 Hz.

Isso verifica o sinal digital e o funcionamento do motor no navegador. Não mede a saída acústica dos fones, atividade cerebral, benefício terapêutico ou resposta fisiológica.

## Reproduzir

Use Node.js 22 ou superior. Execute os comandos a partir da raiz do projeto.

Instale a ferramenta opcional e seu navegador:

```sh
npm install --no-save playwright
npx playwright install chromium
```

Inicie a aplicação e mantenha este terminal aberto:

```sh
npm run dev
```

Em outro terminal, execute:

```sh
node validation/render-audio.mjs
```

Uma execução aprovada imprime `passed: true` e atualiza `validation/audio-signal.json`. Qualquer asserção reprovada encerra o processo com erro. Pequenas diferenças numéricas entre versões do Chromium são esperadas dentro das tolerâncias definidas.

O endereço padrão é `http://localhost:8788`. Para outro servidor, configure `SITE_URL`. Para um Chromium já instalado, configure `BROWSER_EXECUTABLE` com o caminho do executável; caso contrário, o Playwright usa seu navegador instalado.
