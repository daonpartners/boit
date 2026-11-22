-- 보잇 · 문서 보관함 (2026-11-23 대표 결정: 제안서·리포트 7일 보관, 삭제 전 다운로드 알림)
-- 파일: Storage 버킷 boit-docs (비공개), 경로 = {회원 id}/{문서 id}.{pdf|docx}
-- 목록: 표 boit_docs (회원 본인만 보기·넣기·지우기)
-- 삭제: 매일 Edge Function 'docs-purge'가 만료(7일)된 파일과 목록을 지움 + 회원 화면이 로그인할 때 자기 만료분을 지움(보조)

create table if not exists public.boit_docs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  path text not null,
  filename text not null,
  kind text not null default '',
  cust_name text not null default '',
  cust_id text not null default '',
  size int not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);
create index if not exists boit_docs_user on public.boit_docs(user_id, created_at desc);
create index if not exists boit_docs_exp on public.boit_docs(expires_at);
alter table public.boit_docs enable row level security;
drop policy if exists boit_docs_sel on public.boit_docs;
drop policy if exists boit_docs_ins on public.boit_docs;
drop policy if exists boit_docs_del on public.boit_docs;
create policy boit_docs_sel on public.boit_docs for select to authenticated using (user_id = auth.uid());
create policy boit_docs_ins on public.boit_docs for insert to authenticated
  with check (user_id = auth.uid() and expires_at <= now() + interval '7 days 10 minutes' and path like auth.uid()::text || '/%');
create policy boit_docs_del on public.boit_docs for delete to authenticated using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('boit-docs', 'boit-docs', false, 20971520,
  array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists boit_docs_obj_sel on storage.objects;
drop policy if exists boit_docs_obj_ins on storage.objects;
drop policy if exists boit_docs_obj_del on storage.objects;
create policy boit_docs_obj_sel on storage.objects for select to authenticated
  using (bucket_id = 'boit-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy boit_docs_obj_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'boit-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy boit_docs_obj_del on storage.objects for delete to authenticated
  using (bucket_id = 'boit-docs' and (storage.foldername(name))[1] = auth.uid()::text);

-- 매일 새벽 4시 37분(UTC) 만료분 삭제 — docs-purge 함수 배포 후 동작
select cron.schedule('boit-docs-purge', '37 4 * * *', $$
  select net.http_post(url:='https://lobdowpxujgiadrtxklb.supabase.co/functions/v1/docs-purge',
    headers:=jsonb_build_object('Content-Type','application/json','x-watch-key',(select v from public.boit_config where k='watch_key')),
    body:='{}'::jsonb, timeout_milliseconds:=60000)
$$);
