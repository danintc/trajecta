# Roadmap de Produto & Arquitetura — Futuras Features (Trajecta)

> **Nota:** Este documento registra o plano técnico e arquitetural para implementação futura no **Trajecta**, respeitando a **Arquitetura Hexagonal (Ports & Adapters)**, a precisão monetária estrita em **centavos inteiros (`amountInCents` / `priceInCents`)** e a sincronização híbrida **Local-First (`Dexie`) + Cloud (`Supabase`)**.
>
> **Diretriz Financeira ("Custo Zero First"):** Todas as features foram desenhadas para operar **100% sem custos de mensalidade de APIs de terceiros**, utilizando fontes abertas/gratuitas e importadores inteligentes com verificação visual. Integrações B2B pagas (como agregadores Open Finance em produção) ficam isoladas como adaptadores opcionais no futuro.

---

## Matriz de Custos: Estratégia "Custo Zero" vs. APIs Corporativas

| Feature | Solução Padrão Trajecta (Custo R$ 0,00) | Alternativa B2B Paga (Opcional no Futuro) |
| :--- | :--- | :--- |
| **1. Login 2FA (MFA)** | **Supabase Auth MFA (TOTP)** nativo (incluso no plano Free) | SMS MFA (Twilio / Vonage) |
| **2. Importação Planilha/PDF/OFX** | Parser local (`xlsx`, `pdfjs-dist`, parser `OFX`) + **Revisão Visual** | — |
| **3. Custódia B3 (Carteira)** | **Importador do Relatório `.xlsx` da Área do Investidor B3** | API Oficial B3 Parceiros |
| **4. Cotações B3 & Exterior** | **Yahoo Finance (`.SA` / Global)** + **Brapi Free Tier** c/ Cache Supabase | B3 Market Data Oficial / Brapi Pro |
| **5. CDI / Selic / IPCA / Dólar** | **API Oficial Aberta do Banco Central (SGS BCB)** | — |
| **6. Criptomoedas** | **API Pública Binance / CoinGecko (Par BRL)** | CoinMarketCap Enterprise |
| **7. Leitor de Nota Fiscal** | **`BarcodeDetector` (QR Code NFC-e)** + SEFAZ Scraper / Gemini Free Tier | APIs comerciais de OCR fiscal (Serpro/Infosimples) |
| **8. Sincronização Bancária** | **Importação Assistida de `OFX` / `CSV` / `PDF`** dos bancos | Agregadores Open Finance (**Pluggy / Belvo**) |

---

## Visão Geral e Ordem Recomendada de Implementação

As funcionalidades estão organizadas em **4 Horizontes (Fases)** priorizando impacto imediato e custo zero de infraestrutura:

1. **Horizonte 1 — Segurança & Ingestão Visual Assistida (Custo Zero)**
   - 1.1. Login com 2FA (MFA TOTP nativo via Supabase Auth)
   - 1.2. Importação de Planilhas (`.xlsx`/`.csv`), Extratos Bancários (`.ofx`), Faturas (`.pdf`) e Relatório da **Área do Investidor B3** com Etapa de Verificação Visual (Preview / Staging)
2. **Horizonte 2 — Cotações Gratuitas em Tempo Real & Inteligência de Carteira**
   - 2.1. Atualização em tempo real da cotação dos ativos (Yahoo Finance `.SA` + API Banco Central SGS + Binance + Cache no Supabase)
   - 2.2. Balanceamento recomendado de carteira (alocação macro/micro e presets por Fase Patrimonial)
   - 2.3. Recomendação de compra/investimento (conversão do aporte em ordens sugeridas com quantidade inteira de cotas/ações)
3. **Horizonte 3 — Automação de Lançamentos**
   - 3.1. Leitor de Nota Fiscal (QR Code NFC-e via `BarcodeDetector` + Scraper SEFAZ / Gemini Free Tier OCR) para preenchimento direto no modal de novo lançamento
4. **Horizonte 4 — Conectividade Bancária (Arquitetura em 2 Camadas)**
   - 4.1. Camada 1 (Custo Zero): Sincronização via arquivos `OFX` e Relatório `.xlsx` da B3 com deduplicação idempotente
   - 4.2. Camada 2 (Opcional / Sandbox): Adaptador Open Finance via Pluggy/Belvo utilizando o mesmo contrato canônico

---

## 1. Login com 2FA (Autenticação em Dois Fatores / MFA) — *Custo Zero*

### Contexto Atual na Base de Código
- A autenticação atual em `src/adapters/in/ui/composables/useAuth.ts` e `src/adapters/in/ui/screens/AuthScreen.vue` utiliza `@supabase/supabase-js` com login via e-mail/senha e OAuth (Google), operando em nível `aal1` (Assurance Level 1).

### Arquitetura Proposta
Utilizar a API nativa e gratuita **Supabase Auth MFA (TOTP — Time-based One-Time Password)** compatível com Google Authenticator, Authy, 1Password, Bitwarden e Senhas da Apple, elevando a sessão para `aal2` antes de liberar a sincronização com o banco na nuvem.

- **Camada de Adaptação (`src/adapters/in/ui/composables/useAuth.ts`):**
  - `enrollTotpFactor()`: Chama `supabase.auth.mfa.enroll({ factorType: 'totp' })` e retorna o `qr_code` (SVG/Data URI) + `secret` para cópia manual.
  - `verifyAndChallengeTotp(factorId, code)`: Executa `challengeAndVerify` para confirmar ativação ou validar o login.
  - `checkAssuranceLevel()`: Consulta `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`. Se `currentLevel === 'aal1'` e `nextLevel === 'aal2'`, intercepta a entrada no app e exige a tela de desafio 2FA.
- **Interface (`src/adapters/in/ui/screens/AuthScreen.vue` + Modal de Segurança):**
  - **Fluxo de Desafio no Login:** Passo adicional para digitar o código de 6 dígitos (inputs segmentados com auto-focus e suporte a `paste`) logo após `signInWithEmail`.
  - **Fluxo de Configuração (Enrollment):** Modal no menu do perfil do usuário exibindo o QR Code para pareamento do app autenticador.
- **Segurança no Banco (Supabase RLS):**
  - Políticas críticas podem verificar `(auth.jwt()->>'aal') = 'aal2'` quando o usuário tiver um fator MFA ativo.

---

## 2. Importar Planilhas, PDF, OFX e Relatório B3 com Etapa de Verificação Visual — *Custo Zero*

### Contexto Atual na Base de Código
- O contrato `CanonicalTransactionInput` (`src/core/domain/canonical-ingestion.contract.ts`) já prevê `source: 'excel' | 'pdf' | 'open_finance' | 'b3'`.
- Porém, o adaptador atual `importExcelFile` (`src/adapters/in/ingestion/excel/excel-adapter.ts`) lê o buffer e insere diretamente no IndexedDB (`db.transactions.bulkAdd`) sem permitir revisão visual prévia.

### Arquitetura Proposta (Pipeline em 3 Etapas: *Parse/Stage* ➔ *Revisão Visual* ➔ *Commit*)
1. **Fase 1 — Extração e Staging (`parseToStaging`):**
   - **Planilhas Genéricas (`.xlsx`, `.csv`):** Refatorar `excel-adapter.ts` para separar a leitura (`parseExcelToStaging`) da persistência (`commitStagedTransactions`). Retorna uma lista de `StagedImportRow` com `tempId`, `parsedData`, `status: 'ready' | 'duplicate' | 'invalid'` e `validationErrors`.
   - **Preset Oficial "Área do Investidor B3" (`.xlsx`):** Criar `src/adapters/in/ingestion/b3/b3-excel-adapter.ts` que reconhece o layout exportado gratuitamente em `investidor.b3.com.br` (*Posição*, *Movimentação* e *Negociação*), importando ativos e dividendos a custo zero.
   - **Extratos Bancários (`.ofx`):** Criar `src/adapters/in/ingestion/ofx/ofx-adapter.ts` para ler arquivos OFX exportados pelos bancos brasileiros, aproveitando o `<FITID>` como `externalId`.
   - **Faturas e Extratos em PDF (`.pdf`):** Criar `src/adapters/in/ingestion/pdf/pdf-adapter.ts` utilizando `pdfjs-dist` (100% local no navegador) para reconhecer linhas de faturas de cartão e extratos bancários.
2. **Fase 2 — Etapa de Verificação Visual (`ImportVerificationModal.vue`):**
   - **Mapeamento de Colunas:** Caso os nomes das colunas da planilha divirjam do padrão, permitir mapear visualmente qual coluna corresponde a *Data*, *Descrição*, *Valor* e *Categoria*.
   - **Tabela Interativa de Revisão antes da Conclusão:**
     - Indicadores visuais por linha: *Novo*, *Duplicado (detectado via `dedupHash`)* ou *Erro/Incompleto*.
     - Edição inline de **Categoria**, **Descrição**, **Data**, **Tipo (`Receita`/`Despesa`)** e **Checkbox de seleção** para incluir/excluir linhas específicas.
     - Totalizadores de conferência no cabeçalho (*Total de entradas*, *Total de saídas*, *Itens selecionados*).
3. **Fase 3 — Persistência Confirmada (`commitStagedTransactions`):**
   - Apenas os itens revisados e aprovados pelo usuário são convertidos para `Transaction` ou `Asset` (em centavos inteiros) e gravados via `Dexie` + sincronização com `Supabase`.

---

## 3. Atualização em Tempo Real da Cotação dos Ativos na Carteira — *Custo Zero*

### Contexto Atual na Base de Código
- A entidade `Asset` (`src/core/domain/asset.entity.ts`) possui `currentPriceInCents: number` preenchido manualmente.

### Arquitetura Proposta (Fontes Abertas + Cache no Supabase)
Criar uma porta de saída (`MarketQuotePort`) e uma **Supabase Edge Function (`fetch-market-quotes`)** que consulta provedores gratuitos e compartilha o cache no banco.

- **Evolução da Entidade `Asset`:**
  - `quoteMode: 'auto' | 'manual'` (permite manter ativos sem ticker público em cotação manual).
  - `lastQuoteUpdatedAt?: string` e `dailyChangePercent?: number`.
  - `currency?: 'BRL' | 'USD'` (conversão automática pela PTAX/USD-BRL em tempo real).
- **Provedores 100% Gratuitos por Classe de Ativo (`MarketQuoteAdapter`):**
  - **Ações BR, FIIs, ETFs e BDRs (`acoes_br`, `fiis`):**
    - **Primário (Grátis):** **Yahoo Finance API** via Edge Function (adicionando sufixo `.SA` automaticamente para ativos da B3, ex: `PETR4.SA`, `HGLG11.SA`).
    - **Fallback (Grátis):** **Brapi.dev (Free Tier)**.
  - **Internacional (`internacional`):** Cotação USD do ativo no Yahoo Finance combinada com taxa de câmbio `USDBRL=X` ao vivo.
  - **Criptoativos (`cripto`):** API pública gratuita da **Binance** (`BTCBRL`, `ETHBRL`) ou **CoinGecko**.
  - **Renda Fixa & Reserva (`renda_fixa`, `reserva_emergencia`):** Curva diária via API oficial e gratuita do **Banco Central (SGS BCB)** para CDI (Série 12), Selic (Série 11) e IPCA (Série 433), atualizando também os indicadores de `src/shared/constants/benchmarks.ts`.
- **Cache Inteligente:**
  - Tabela `market_quotes_cache` no Supabase (TTL de 5 a 15 min durante o pregão) para resposta rápida e sem risco de bloqueio por rate-limit.

---

## 4. Balanceamento Recomendado de Carteira

### Contexto Atual na Base de Código
- O caso de uso `calculatePortfolioRebalance` (`src/core/use-cases/rebalance-portfolio.use-case.ts`) distribui aportes nas classes com `gapPercent > 0`, mas depende de metas 100% manuais e atua apenas no nível macro (classes).

### Arquitetura Proposta
Expandir o balanceamento para sugerir metas inteligentes conforme a **Fase Patrimonial** (`Construção`, `Transição`, `Manutenção`) e desdobrar o balanceamento em dois níveis:

- **1. Presets Recomendados por Fase Patrimonial (`RecommendAllocationUseCase`):**
  - **Construção:** Foco em acumulação e valorização de longo prazo, condicionado à conclusão prévia da Reserva de Emergência.
  - **Transição:** Balanceamento equilibrado entre crescimento e proteção contra inflação (IPCA+ / FIIs / Dividendos).
  - **Manutenção:** Foco em preservação de patrimônio, baixa volatilidade e geração de renda passiva mensal.
- **2. Rebalanceamento Macro (Classes) e Micro (Ativos dentro da Classe):**
  - Após calcular quanto cada classe sub-alocada deve receber, distribuir o valor entre os ativos daquela classe conforme a meta individual (`targetPercent`) de cada ativo.
- **3. Bandas de Tolerância:**
  - Sinalizador visual quando uma classe desviar além de um limite seguro (ex: `±5%` da meta).

---

## 5. Recomendação de Compra / Investimento

### Contexto Atual na Base de Código
- O Trajecta calcula o valor em R$ a aportar por classe, mas não transforma esse valor em uma **lista prática de ordens de compra** (quais ativos comprar e quantas cotas/ações adquirir).

### Arquitetura Proposta
Criar o caso de uso `GenerateInvestmentRecommendationsUseCase` (`src/core/use-cases/recommend-investments.use-case.ts`) integrando o Rebalanceador (Feature 4) com a Cotação em Tempo Real (Feature 3).

- **Regras do Motor de Recomendação:**
  1. **Prioridade Zero — Reserva de Emergência:** Enquanto a reserva estiver abaixo da meta de segurança do usuário, direciona o aporte prioritariamente para liquidez diária.
  2. **Seleção e Ranking de Ativos Sub-Alocados:** Dentro das classes com gap positivo, prioriza ativos com maior defasagem percentual em relação à meta e melhor relação `currentPriceInCents <= averagePriceInCents` (ou preço-teto definido pelo usuário).
  3. **Cálculo de Quantidade Inteira de Cotas/Ações:**
     - Divide o aporte sugerido pelo `currentPriceInCents` em tempo real para recomendar a quantidade exata de unidades (ex: *"Comprar 15 cotas de KNCR11 + 8 ações de ITUB4"*), reaproveitando a sobra financeira (troco de lote) no próximo ativo da fila.

---

## 6. Leitor de Nota Fiscal para Preenchimento Automático de Lançamento — *Custo Zero*

### Contexto Atual na Base de Código
- Atualmente, `src/adapters/in/ui/components/AddTransactionModal.vue` requer preenchimento manual de todos os campos.

### Arquitetura Proposta
Permitir escanear o **QR Code da NFC-e / Cupom Fiscal** (câmera do dispositivo) ou enviar foto/PDF da nota fiscal para pré-preencher o modal de novo lançamento.

- **Modos de Captura Gratuitos no `AddTransactionModal.vue`:**
  1. **Leitura de QR Code de NFC-e (Caminho Rápido e Custo Zero):**
     - Uso de `BarcodeDetector` nativo (com fallback open-source para `html5-qrcode`/`jsQR`).
     - Envio da URL pública da NFC-e para uma **Supabase Edge Function (`parse-nfce`)** que extrai da página da SEFAZ a Razão Social/Nome Fantasia, CNPJ, Data de Emissão, Valor Total em centavos e Forma de Pagamento.
  2. **OCR / Visão Computacional de Cupom ou Comprovante (Fallback Gratuito):**
     - Para cupons térmicos sem QR Code legível ou comprovantes de maquininha, extração via `Tesseract.js` (local) ou chamada à API gratuita do **Google Gemini Flash (Free Tier)** via Edge Function, retornando payload validado pelo `transaction.schema.ts`.
- **Auto-Categorização e Revisão:**
  - Sugestão automática de `categoryId` com base no estabelecimento (ex: Supermercado ➔ Alimentação, Posto ➔ Transporte) preenchendo os campos reativos do `AddTransactionModal.vue` para o usuário conferir antes de salvar.

---

## 7. Sincronização com Instituições Financeiras (Open Finance & Alternativa Custo Zero)

### Contexto Atual na Base de Código
- `CanonicalTransactionInput` (`src/core/domain/canonical-ingestion.contract.ts`) já inclui `'open_finance'` e `'b3'` no campo `source`, além de `externalId?: string`.

### Arquitetura em 2 Camadas (Desacoplada por Porta de Domínio)
Como os agregadores homologados do Open Finance Brasil (**Pluggy**, **Belvo**) possuem custo mensal para uso comercial em produção, a ingestão bancária é dividida em duas camadas que alimentam o **mesmo contrato canônico**:

- **Camada 1 — Sincronização Semi-Automática "Custo Zero" (Padrão Imediato):**
  - Importação de arquivos **`.ofx`** (extrato universal gratuito de todos os bancos brasileiros), **`.csv` / `.pdf`** de faturas de cartão e planilha **`.xlsx` da Área do Investidor B3**.
  - Deduplicação automática via `FITID` (`externalId`) e `generateTransactionDedupHash` (`src/shared/utils/hash.ts`) + **Etapa de Verificação Visual (Feature 2)**.
- **Camada 2 — Conector Open Finance via Agregador (`OpenFinanceAdapter` — Pluggy / Belvo):**
  - Integração via **Supabase Edge Functions** compatível com o **Sandbox Gratuito** da Pluggy/Belvo para desenvolvimento e demonstração, podendo receber chave de produção no futuro sem alterar uma única linha do domínio ou da interface de revisão.
