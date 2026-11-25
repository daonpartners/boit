-- 보잇 · 공공데이터 조회 하루 사용량 (Edge Function 'pubdata' 전용, 서버 키로만 접근)
create table if not exists public.boit_pubdata_use (
  user_id uuid not null,
  day date not null,
  n int not null default 0,
  primary key (user_id, day)
);
alter table public.boit_pubdata_use enable row level security; -- 정책 없음 = 화면(회원)에서는 읽기·쓰기 불가
