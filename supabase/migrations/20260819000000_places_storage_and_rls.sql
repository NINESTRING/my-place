-- Storage 버킷. public read 이며 애플리케이션 검증을 버킷 수준에서 한 번 더 받친다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('places', 'places', true, 10485760, '{image/jpeg,image/png,image/webp}')
on conflict (id) do nothing;

-- 정책은 만들지 않는다. Prisma 는 테이블 소유자 롤로 접속해 RLS 를 우회하고,
-- anon/authenticated 롤은 접근이 완전히 차단된다. 인증이 없는 현재 상태에
-- 맞는 설정이며, Supabase Auth 를 붙일 때 소유권 기반 정책을 이 위에 추가한다.
alter table public.places enable row level security;
