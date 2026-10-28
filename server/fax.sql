-- 보잇 · 팩스 발송 기록 표 (서버 기능 'fax' 만 읽고 씀)
-- 접수번호·수신 팩스번호·보험사명·장수·결과만 저장. 고객 주민번호·청구서류 내용은 저장하지 않음.
create table if not exists public.boit_fax(
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  receipt_num text,             -- 팝빌 접수번호 (18자)
  request_num text,             -- 보잇 관리번호
  insurer text,                 -- 보험사명
  receivers text[] not null,    -- 수신 팩스번호 (숫자만)
  file_cnt int,
  pages int,                    -- 전송 장수 (결과 조회 후)
  state text default 'sending', -- sending / ok / bad / cancel
  result_code text,             -- 팝빌 결과코드 원문
  test boolean default true,    -- 팝빌 테스트 환경 발송 여부
  created_at timestamptz default now(),
  updated_at timestamptz default now());
create index if not exists boit_fax_user_idx on public.boit_fax(user_id, created_at desc);
create unique index if not exists boit_fax_receipt_idx on public.boit_fax(receipt_num);
alter table public.boit_fax enable row level security;
-- 정책을 일부러 만들지 않음 → 화면에서 직접 접근 불가. 서버 기능(service_role)만 접근.
