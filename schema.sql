-- Vaulta production schema. Run once in the Supabase SQL editor (enable pg_cron first: Database > Extensions).
create table public.profiles(id uuid primary key references auth.users on delete cascade,name text not null default '' check(char_length(name)<=60),timezone text not null default 'UTC',theme text not null default 'system' check(theme in('light','dark','system')),date_format text not null default 'long' check(date_format in('long','short','iso')),default_reminders int[] not null default '{30,7,1}',email_enabled boolean not null default false,created_at timestamptz not null default now());
create table public.folders(user_id uuid not null default auth.uid() references auth.users on delete cascade,id text not null check(char_length(id)<=40),name text not null check(char_length(name) between 1 and 40),created_at timestamptz not null default now(),primary key(user_id,id));
create table public.documents(id uuid primary key,user_id uuid not null default auth.uid() references auth.users on delete cascade,folder_id text not null,name text not null check(char_length(name) between 1 and 80),category text not null check(char_length(category)<=40),doc_number text check(char_length(doc_number)<=60),issue_date date,expiry_date date not null,notes text check(char_length(notes)<=500),file_path text,file_name text check(char_length(file_name)<=200),file_type text check(file_type in('application/pdf','image/jpeg','image/png')),created_at timestamptz not null default now(),check(file_path is null or file_path like user_id::text||'/%'),foreign key(user_id,folder_id) references public.folders(user_id,id));
create table public.reminders(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users on delete cascade,doc_id uuid not null references public.documents on delete cascade,days_before int check(days_before between 0 and 365),remind_at timestamptz not null,status text not null default 'scheduled' check(status in('scheduled','sent','failed','skipped')),processed_at timestamptz,error text);
create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,doc_id uuid references public.documents on delete cascade,message text not null,read boolean not null default false,dedupe_key text not null,created_at timestamptz not null default now(),unique(user_id,dedupe_key));
create table public.email_outbox(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,notification_id uuid not null references public.notifications on delete cascade,status text not null default 'pending' check(status in('pending','sent','failed')),provider_message_id text,created_at timestamptz not null default now());
create index on public.documents(user_id);create index on public.reminders(remind_at) where status='scheduled';
alter table public.profiles enable row level security;alter table public.folders enable row level security;alter table public.documents enable row level security;alter table public.reminders enable row level security;alter table public.notifications enable row level security;alter table public.email_outbox enable row level security;
create policy own_sel on public.profiles for select using(id=auth.uid());
create policy own_upd on public.profiles for update using(id=auth.uid()) with check(id=auth.uid());
create policy own on public.folders for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy own on public.documents for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy own on public.reminders for all using(user_id=auth.uid()) with check(user_id=auth.uid() and exists(select 1 from public.documents d where d.id=doc_id and d.user_id=auth.uid()));
create policy sel on public.notifications for select using(user_id=auth.uid());
create policy upd on public.notifications for update using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy del on public.notifications for delete using(user_id=auth.uid());
-- no insert policy on notifications and no policy on email_outbox: only server functions can write them
revoke update on public.notifications from authenticated;grant update(read) on public.notifications to authenticated;
revoke update on public.profiles from authenticated;grant update(name,theme,date_format,default_reminders,email_enabled) on public.profiles to authenticated;
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare t text:=coalesce(new.raw_user_meta_data->>'tz','UTC');
begin
 if not exists(select 1 from pg_timezone_names where name=t) then t:='UTC'; end if;
 insert into profiles(id,name,timezone) values(new.id,left(coalesce(new.raw_user_meta_data->>'name',''),60),t);
 insert into folders(user_id,id,name) values(new.id,'personal','Personal Documents'),(new.id,'vehicle','Vehicle Documents'),(new.id,'insurance','Insurance'),(new.id,'certs','Certificates'),(new.id,'work','Work Documents'),(new.id,'other','Other');
 return new;
end $$;
create trigger on_signup after insert on auth.users for each row execute function public.handle_new_user();
create function public.calc_remind_at() returns trigger language plpgsql as $$
declare e date;tz text;
begin
 if new.days_before is not null then
  select d.expiry_date,p.timezone into e,tz from documents d join profiles p on p.id=d.user_id where d.id=new.doc_id;
  new.remind_at:=((e-new.days_before)::timestamp+time '09:00') at time zone tz;
 end if;
 return new;
end $$;
create trigger calc before insert or update on public.reminders for each row execute function public.calc_remind_at();
create function public.process_reminders() returns int language plpgsql security definer set search_path=public as $$
declare r record;n int:=0;nid uuid;dl int;msg text;
begin
 for r in select rm.id,rm.user_id,rm.doc_id,d.name,d.expiry_date from reminders rm join documents d on d.id=rm.doc_id where rm.status='scheduled' and rm.remind_at<=now() order by rm.remind_at limit 500 for update of rm skip locked loop
  begin
   dl:=r.expiry_date-current_date;
   if dl<0 then update reminders set status='skipped',processed_at=now() where id=r.id; continue; end if;
   msg:=case when dl=0 then format('Your %s expires today.',r.name) when dl=1 then format('Your %s expires tomorrow.',r.name) else format('Your %s expires in %s days.',r.name,dl) end;
   nid:=null;
   insert into notifications(user_id,doc_id,message,dedupe_key) values(r.user_id,r.doc_id,msg,'r:'||r.id) on conflict do nothing returning id into nid;
   if nid is not null and exists(select 1 from profiles where id=r.user_id and email_enabled) then insert into email_outbox(user_id,notification_id) values(r.user_id,nid); end if;
   update reminders set status='sent',processed_at=now() where id=r.id; n:=n+1;
  exception when others then
   update reminders set status='failed',processed_at=now(),error='processing error' where id=r.id;
  end;
 end loop;
 insert into notifications(user_id,doc_id,message,dedupe_key) select user_id,id,format('Your %s has expired.',name),'x:'||id||':'||expiry_date from documents where expiry_date<current_date on conflict do nothing;
 return n;
end $$;
revoke execute on function public.process_reminders() from public,anon,authenticated;
revoke execute on function public.handle_new_user() from public,anon,authenticated;
create extension if not exists pg_cron;
select cron.schedule('process-reminders','*/5 * * * *','select public.process_reminders()');
create function public.delete_my_account() returns void language sql security definer set search_path=public,auth as $$ delete from auth.users where id=auth.uid(); $$;
revoke execute on function public.delete_my_account() from public,anon;grant execute on function public.delete_my_account() to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('docs','docs',false,10485760,array['application/pdf','image/jpeg','image/png']) on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
create policy docs_own on storage.objects for all to authenticated using(bucket_id='docs' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='docs' and (storage.foldername(name))[1]=auth.uid()::text);
