-- 보잇 · 고객 상담신청 링크 (boit.ai.kr/apply/?a=코드)
-- 설계사 설정(boit_apply) · 접수된 신청(boit_leads) · 인증번호 임시표(boit_apply_otp)
create table if not exists public.boit_apply(
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique check (code ~ '^[a-z0-9]{6,12}$'),
  name text not null default '' check (length(name)<=20),
  org text not null default '' check (length(org)<=60),
  links jsonb not null default '{}'::jsonb,       -- {mz:"조직코드 또는 링크", kb:"링크", mi:"링크"}
  show text[] not null default '{}',              -- 완료 화면에 보일 원수사 (mz,kb,mi)
  active boolean not null default true,
  updated_at timestamptz not null default now());
alter table public.boit_apply enable row level security;
create policy "본인 보기" on public.boit_apply for select using ((select auth.uid())=user_id);
create policy "본인 추가" on public.boit_apply for insert with check ((select auth.uid())=user_id);
create policy "본인 수정" on public.boit_apply for update using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

create table if not exists public.boit_leads(
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, phone text not null, products text[] not null default '{}',
  agreed_at timestamptz not null default now(),
  ins text not null default '',                  -- 고객이 받은 링크의 보험사
  taken boolean not null default false,
  created_at timestamptz not null default now());
create index if not exists boit_leads_user_taken on public.boit_leads(user_id,taken);
alter table public.boit_leads enable row level security;
create policy "본인 보기" on public.boit_leads for select using ((select auth.uid())=user_id);
create policy "본인 표시" on public.boit_leads for update using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "본인 삭제" on public.boit_leads for delete using ((select auth.uid())=user_id);
-- 추가(insert)는 서버 기능(apply)만 함

create table if not exists public.boit_apply_otp(
  id bigint generated always as identity primary key,
  phone text not null, code_hash text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, products text[] not null default '{}',
  ip text not null default '', tries int not null default 0, used boolean not null default false,
  expires_at timestamptz not null, created_at timestamptz not null default now());
create index if not exists boit_apply_otp_phone on public.boit_apply_otp(phone,created_at desc);
create index if not exists boit_apply_otp_ip on public.boit_apply_otp(ip,created_at desc);
alter table public.boit_apply_otp enable row level security;   -- 정책 없음 = 서버 기능만 접근
