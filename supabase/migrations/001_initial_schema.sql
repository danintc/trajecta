-- ============================================================================
-- TRAJECTA — MIGRAÇÃO INICIAL SUPABASE (POSTGRESQL + RLS POR USUÁRIO)
-- Cole e execute este script no menu "SQL Editor" do painel do Supabase
-- ============================================================================

-- 1. TABELA DE CATEGORIAS PERSONALIZADAS E PADRÃO
create table if not exists public.categories (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text not null,
  type text not null check (type in ('income', 'expense')),
  is_systemDefault boolean default false,
  created_at timestamptz default now(),
  primary key (user_id, id)
);

-- 2. TABELA DE TRANSAÇÕES FINANCEIRAS
create table if not exists public.transactions (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense', 'investment_deposit', 'dividend')),
  description text not null,
  amount_in_cents bigint not null,
  date text not null,
  category_id text not null,
  account_or_card text not null,
  is_installment boolean not null default false,
  installment_group_id text,
  current_installment integer,
  total_installments integer,
  original_purchase_date text,
  dedup_hash text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (user_id, id)
);

-- 3. TABELA DE ATIVOS DE INVESTIMENTO (CUSTÓDIA)
create table if not exists public.assets (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker_or_name text not null,
  asset_class text not null check (asset_class in ('renda_fixa', 'acoes_br', 'fiis', 'internacional', 'cripto', 'reserva_emergencia')),
  institution text,
  total_quantity numeric not null default 0,
  average_price_in_cents bigint not null default 0,
  current_price_in_cents bigint not null default 0,
  target_percent numeric not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (user_id, id)
);

-- 4. TABELA DE ORDENS DE ATIVOS (COMPRA / VENDA)
create table if not exists public.asset_orders (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id text not null,
  type text not null check (type in ('buy', 'sell')),
  quantity numeric not null,
  price_in_cents bigint not null,
  total_in_cents bigint not null,
  date text not null,
  created_at timestamptz default now(),
  primary key (user_id, id)
);

-- 5. TABELA DE PROVENTOS / DIVIDENDOS
create table if not exists public.asset_dividends (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id text not null,
  type text not null check (type in ('dividendo', 'jcp', 'rendimento_fii', 'cupom')),
  amount_in_cents bigint not null,
  payment_date text not null,
  created_at timestamptz default now(),
  primary key (user_id, id)
);

-- 6. TABELA DE EVOLUÇÃO DE CARREIRA & TOTAL CASH
create table if not exists public.career_records (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  role text not null,
  start_date text not null,
  end_date text,
  gross_salary_in_cents bigint not null,
  net_salary_in_cents bigint not null,
  change_reason text not null check (change_reason in ('contratacao', 'promocao', 'merito', 'dissidio', 'transicao_empresa')),
  meal_allowance_in_cents bigint not null default 0,
  health_insurance_in_cents bigint,
  annual_bonus_estimated_in_cents bigint not null default 0,
  observations text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (user_id, id)
);

-- 7. TABELA DE SNAPSHOTS MENSAIS DE PATRIMÔNIO
create table if not exists public.snapshots (
  year_month text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  accounts_balance_in_cents bigint not null default 0,
  portfolio_value_in_cents bigint not null default 0,
  open_bills_in_cents bigint not null default 0,
  future_installments_in_cents bigint not null default 0,
  net_worth_in_cents bigint not null default 0,
  savings_rate_percent numeric not null default 0,
  cdi_accumulated_percent numeric not null default 0,
  created_at timestamptz default now(),
  primary key (user_id, year_month)
);

-- ============================================================================
-- SEGURANÇA: ROW LEVEL SECURITY (RLS) — CADA USUÁRIO SÓ VÊ SEUS PRÓPRIOS DADOS
-- ============================================================================
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.assets enable row level security;
alter table public.asset_orders enable row level security;
alter table public.asset_dividends enable row level security;
alter table public.career_records enable row level security;
alter table public.snapshots enable row level security;

-- Políticas de acesso total apenas ao dono do registro (auth.uid() = user_id)
drop policy if exists "Users manage own categories" on public.categories;
create policy "Users manage own categories" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own transactions" on public.transactions;
create policy "Users manage own transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own assets" on public.assets;
create policy "Users manage own assets" on public.assets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own asset_orders" on public.asset_orders;
create policy "Users manage own asset_orders" on public.asset_orders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own asset_dividends" on public.asset_dividends;
create policy "Users manage own asset_dividends" on public.asset_dividends
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own career_records" on public.career_records;
create policy "Users manage own career_records" on public.career_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own snapshots" on public.snapshots;
create policy "Users manage own snapshots" on public.snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
