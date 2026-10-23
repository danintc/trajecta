# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Profissionais em ascensão (áreas de tecnologia, finanças, gestão e executivos) que desejam planejar sua trajetória financeira de longo prazo conectando o crescimento da sua renda ativa (carreira e remuneração total) à evolução do patrimônio líquido e independência financeira.

## Product Purpose

O Trajecta existe para fechar a lacuna entre o gerenciamento de carreira e o planejamento patrimonial. Em vez de ser apenas mais um gestor de despesas diárias (orçamento doméstico tradicional), o Trajecta permite que o usuário enxergue como cada avanço salarial, bônus, equity ou aporte acelera sua transição entre as fases de riqueza (Construção, Transição e Manutenção). Sucesso significa clareza absoluta sobre a alavanca principal da fase atual e previsibilidade do horizonte patrimonial.

## Positioning

"Da Carreira ao Patrimônio". Diferente de rastreadores de gastos operacionais ou plataformas puras de corretora, o Trajecta modela a renda profissional composta (Total Cash: base, bônus, PLR, equity) como motor direto da construção patrimonial e simula cenários dinâmicos de parada de aportes e renda passiva projetada.

## Operating Context

- Acessado via navegador web (desktop e mobile) em rotinas mensais de fechamento financeiro, planejamento de carreira e revisão anual de patrimônio.
- Integração com planilhas existentes (ingestão e importação Excel/XLSX) e acompanhamento de ativos de renda fixa, multimercado, renda variável e previdência.
- Uso de modo privacidade para navegação confortável em ambientes compartilhados ou públicos.

## Capabilities and Constraints

- **Arquitetura Cloud-First & Sincronização:** Sincronização em tempo real multi-dispositivo com Supabase como backend principal, mantendo resiliência e suporte local via Dexie (IndexedDB).
- **Precisão Financeira:** Valores monetários armazenados estritamente como números inteiros em centavos (BRL), evitando erros de arredondamento de ponto flutuante.
- **Estrutura Hexagonal / DDD:** Separação estrita entre domínio (`core/domain`), casos de uso (`core/use-cases`), adaptadores de entrada (`adapters/in/ui`) e adaptadores de persistência/nuvem (`adapters/out`).
- **Fases Patrimoniais Formais:**
  - *Construção:* Foco em aumentar aportes e evolução de renda ativa.
  - *Transição:* Equilíbrio entre aportes e rentabilidade da carteira.
  - *Manutenção:* Foco em desfrute, preservação de capital e renda passiva.

## Brand Commitments

- **Nome:** Trajecta
- **Tagline:** Da Carreira ao Patrimônio
- **Identidade:** Tom técnico, refinado, analítico e pragmático. Foco em clareza de dados de alta densidade sem poluição visual.

## Evidence on Hand

- Código-fonte operacional em Vue 3, Vite, TypeScript e Tailwind CSS.
- Casos de uso de cálculo implementados: `calculate-installments`, `calculate-total-cash`, `calculate-wealth-phase-simulation`, `calculate-weighted-average`, `net-worth-engine`, `rebalance-portfolio`.
- Adaptador de ingestão de planilhas XLSX e mock populated database em `src/adapters/out/storage/dexie-db.ts`.

## Product Principles

1. **A Carreira é a Maior Alavanca:** No início da jornada patrimonial, a renda ativa e os aportes superam os juros compostos; a interface deve evidenciar essa correlação.
2. **Alta Densidade com Máxima Clareza:** Exibir métricas críticas (KPIs de patrimônio, evolução e alocação) com clareza matemática e visual, sem ornamentos desnecessários.
3. **Privacidade e Confiança em Primeiro Lugar:** Dados financeiros são sensíveis; modo privacidade nativo e consistência estrita de sincronização.
4. **Decisões Orientadas a Fases:** As recomendações e o comportamento visual da aplicação se adaptam à fase atual do usuário (Construção vs Manutenção).
