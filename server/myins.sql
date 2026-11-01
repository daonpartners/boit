-- 보잇 · 고객 '내 보험 불러오기' 링크 (boit.ai.kr/myins/?a=설계사코드)
-- 고객이 자기 휴대폰에서 내보험다보여(신용정보원) 아이디·비밀번호를 직접 입력 → CODEF 계약정보 조회
-- → 결과만 서버 비밀키로 암호화해 담당 설계사 앞으로 보관 (아이디·비밀번호·주민번호는 저장하지 않음)
-- 설계사 보잇이 가져가면 바로 삭제, 안 가져가도 30일 뒤 자동 삭제
create table if not exists public.boit_myins(
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,  -- 담당 설계사
  name text not null,                     -- 고객 이름 (고객이 입력)
  phone text not null default '',         -- 고객 휴대폰 (고객이 입력)
  n_contracts int not null default 0,     -- 계약 수 (목록 표시용)
  enc text not null, iv text not null,    -- 조회 결과(계약·담보·실손 지급내역) AES-GCM 암호문
  agreed_at timestamptz not null default now(),
  created_at timestamptz not null default now());
create index if not exists boit_myins_user on public.boit_myins(user_id, created_at desc);
alter table public.boit_myins enable row level security;  -- 정책 없음: 서버 기능(myins)만 읽고 씀

-- 조회 시도 기록 (CODEF 비용·남용 방지 횟수 제한용, 개인정보 없음)
create table if not exists public.boit_myins_try(
  id bigint generated always as identity primary key,
  user_id uuid not null, ip text not null default '', created_at timestamptz not null default now());
create index if not exists boit_myins_try_ip on public.boit_myins_try(ip, created_at desc);
create index if not exists boit_myins_try_user on public.boit_myins_try(user_id, created_at desc);
alter table public.boit_myins_try enable row level security;

-- 매일 정리: 결과 30일, 시도 기록 2일
select cron.schedule('boit-myins-clean', '17 4 * * *', $$
  delete from public.boit_myins where created_at < now() - interval '30 days';
  delete from public.boit_myins_try where created_at < now() - interval '2 days';
$$);
