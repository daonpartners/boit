-- 보잇 · 청구 서류·주민등록번호 3개월 보관 (2026-11-23 대표 결정: 서류+주민번호 모두 90일)
-- 회원이 팩스를 보내면 그 청구의 서류 원본(비공개 버킷 boit-claim/{회원}/keep/{gid}/)과
-- 주민등록번호·고객 이름·휴대폰(서버 비밀키 AES-GCM 암호문 enc)을 90일 보관 → 재청구·보험사 추가서류 요청 대응.
-- 90일 뒤 claim-link 함수 purge(매일)가 자동 삭제, 회원은 청구내역에서 언제든 즉시 파기.
create table if not exists public.boit_claim_keep (
  owner uuid not null references auth.users(id) on delete cascade,
  gid text not null,
  enc text not null default '',
  files jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days',
  primary key (owner, gid)
);
create index if not exists boit_claim_keep_exp on public.boit_claim_keep(expires_at);
alter table public.boit_claim_keep enable row level security;  -- 정책 없음: 서버 기능만 접근
