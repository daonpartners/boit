-- 보잇 · 고객 청구 링크 (2026-11-23 대표 지시)
-- 설계사가 링크 문자 발송 → 고객이 boit.ai.kr/c.html?t=토큰 에서 이름·주민번호·휴대폰·주소·서명·서류 사진을 보냄
-- → 담당 설계사 보잇 '고객 청구 접수' 목록에 뜸 → 누르면 보상청구 화면이 채워지고 설계사가 확인 후 팩스 발송
-- 개인정보: 이름·주민번호·휴대폰·주소·메모는 서버 비밀키로 암호화(enc). 서명·사진은 비공개 버킷 boit-claim.
-- 파기: 설계사가 팩스 발송(done)하면 즉시, 미제출 링크는 7일, 제출 건도 접수 7일 뒤 자동 삭제 (claim-link 함수 purge, 매일)

create table if not exists public.boit_claim_req (
  token text primary key,
  owner uuid not null references auth.users(id) on delete cascade,  -- 담당 설계사
  planner text not null default '',        -- 고객 화면에 보일 설계사 이름
  planner_phone text not null default '',  -- 고객 화면 안내용
  hint_name text not null default '',      -- 설계사가 링크 보낼 때 적은 고객 이름 (목록 표시용)
  status text not null default 'sent',     -- sent(보냄) · upload(사진 올리는 중) · submitted(접수) · opened(설계사가 열어 봄)
  enc text not null default '',            -- 고객 입력값 암호문
  files jsonb not null default '[]'::jsonb,-- 버킷 경로 목록 (서명 포함)
  tries int not null default 0,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days'
);
create index if not exists boit_claim_req_owner on public.boit_claim_req(owner, status, created_at desc);
create index if not exists boit_claim_req_exp on public.boit_claim_req(expires_at);
alter table public.boit_claim_req enable row level security;  -- 정책 없음: 서버 기능(claim-link)만 읽고 씀

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('boit-claim', 'boit-claim', false, 10485760, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- storage.objects 정책 없음: 고객은 서버가 만든 1회용 업로드 주소로만 올리고, 설계사는 서버가 만든 5분짜리 주소로만 받음

-- 매일 새벽 4시 47분(UTC) 만료분 삭제 — claim-link 함수 배포 후 동작
select cron.schedule('boit-claim-purge', '47 4 * * *', $$
  select net.http_post(url:='https://lobdowpxujgiadrtxklb.supabase.co/functions/v1/claim-link?purge=1',
    headers:=jsonb_build_object('Content-Type','application/json','x-watch-key',(select v from public.boit_config where k='watch_key')),
    body:='{}'::jsonb, timeout_milliseconds:=60000)
$$);
