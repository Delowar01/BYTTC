-- Document templates and issued documents (batch 3). Templates are versioned;
-- only drafts are editable. Issued documents keep a snapshot of the layout,
-- background and data they were issued with, so later template or record
-- changes never alter them.

create type public.doc_type as enum ('certificate', 'marksheet', 'admit_card', 'registration_card');

alter table public.exams
  add column exam_time text check (exam_time is null or length(exam_time) <= 40),
  add column venue text check (venue is null or length(venue) <= 200);
alter table public.site_settings
  add column registration_card_validity_years int check (registration_card_validity_years between 1 and 30);

-- ---------------------------------------------------------------------------
-- Templates
-- ---------------------------------------------------------------------------
create table public.document_templates (
  id              uuid primary key default gen_random_uuid(),
  doc_type        public.doc_type not null,
  name            text not null check (length(name) between 2 and 120),
  family_id       uuid not null default gen_random_uuid(),
  version         int not null default 1,
  status          text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  layout          jsonb not null check (jsonb_typeof(layout -> 'fields') = 'array'),
  background_path text,
  background_type text check (background_type in ('png', 'jpeg', 'pdf')),
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  activated_at    timestamptz,
  activated_by    uuid references auth.users (id) on delete set null
);
create unique index document_templates_one_active on public.document_templates (doc_type) where status = 'active';
create trigger document_templates_updated_at before update on public.document_templates
  for each row execute function public.set_updated_at();
create trigger document_templates_audit after insert or update or delete on public.document_templates
  for each row execute function public.audit_trigger();

create or replace function public.document_templates_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then raise exception 'Only draft templates can be deleted; archive it instead'; end if;
    return old;
  end if;
  if old.status <> 'draft' and (new.layout, new.background_path, new.background_type, new.doc_type)
       is distinct from (old.layout, old.background_path, old.background_type, old.doc_type) then
    raise exception 'Only draft templates can be edited; duplicate it to create a new version';
  end if;
  return new;
end $$;
create trigger document_templates_guard before update or delete on public.document_templates
  for each row execute function public.document_templates_guard();

alter table public.document_templates enable row level security;
create policy templates_select on public.document_templates for select to authenticated using (true);
create policy templates_insert on public.document_templates for insert to authenticated with check (public.can_publish());
create policy templates_update on public.document_templates for update to authenticated using (public.can_publish()) with check (public.can_publish());
create policy templates_delete on public.document_templates for delete to authenticated using (public.can_publish());

-- Activate a template: the previously active one of that type is archived.
create or replace function public.activate_document_template(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.document_templates;
begin
  if not public.can_publish() then raise exception 'Only authorized central roles may activate templates'; end if;
  select * into t from public.document_templates where id = p_id for update;
  if not found then raise exception 'Template not found'; end if;
  update public.document_templates set status = 'archived' where doc_type = t.doc_type and status = 'active' and id <> t.id;
  update public.document_templates set status = 'active', activated_at = now(), activated_by = auth.uid() where id = t.id;
  return jsonb_build_object('ok', true);
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('document-templates', 'document-templates', false, 10485760, array['image/png', 'image/jpeg', 'application/pdf'])
on conflict (id) do nothing;
create policy "templates read" on storage.objects for select to authenticated
  using (bucket_id = 'document-templates' and public.has_role(array['super_admin', 'central_admin', 'central_staff', 'institute_admin', 'institute_staff']::public.app_role[]));
create policy "templates write" on storage.objects for insert to authenticated
  with check (bucket_id = 'document-templates' and public.can_publish());

-- Built-in starting templates (certificate stays a draft: until a certificate
-- template is activated, certificates keep the original built-in design).
insert into public.document_templates (doc_type, name, status, layout, activated_at) values
  ('marksheet', 'Standard result sheet', 'active', $layout${"orientation":"portrait","frame":"classic","accent":"#0f6666","watermark":true,"fields":[{"id":"logo-1","kind":"image","source":"logo","x":8,"y":5,"w":12,"h":8},{"id":"t-2","kind":"text","text":"{org_name}","x":18,"y":6,"w":64,"size":18,"bold":true,"align":"center","color":"#0f6666"},{"id":"t-3","kind":"text","text":"{org_name_bn}","x":18,"y":9.7,"w":64,"size":12,"align":"center","color":"#0f6666","hideIfEmpty":true},{"id":"t-4","kind":"text","text":"Registration No. {org_registration_no}","x":18,"y":12.6,"w":64,"size":9,"align":"center","color":"#5f6b6d","hideIfEmpty":true},{"id":"t-5","kind":"text","text":"RESULT SHEET","x":30,"y":15.4,"w":40,"size":12,"align":"center","color":"#ffffff","bg":"#b23b3b"},{"id":"photo","kind":"image","source":"photo","x":42.5,"y":21.5,"w":15,"h":12.5,"border":true},{"id":"t-6","kind":"text","text":"Student Name","x":7,"y":37,"w":15,"size":9,"bold":true,"color":"#33403f"},{"id":"t-7","kind":"text","text":":  {student_name}","x":22,"y":37,"w":27,"size":9,"bold":true},{"id":"t-8","kind":"text","text":"Father's Name","x":7,"y":40.3,"w":15,"size":9,"bold":true,"color":"#33403f"},{"id":"t-9","kind":"text","text":":  {father_name}","x":22,"y":40.3,"w":27,"size":9,"bold":true},{"id":"t-10","kind":"text","text":"Mother's Name","x":7,"y":43.6,"w":15,"size":9,"bold":true,"color":"#33403f"},{"id":"t-11","kind":"text","text":":  {mother_name}","x":22,"y":43.6,"w":27,"size":9,"bold":true},{"id":"t-12","kind":"text","text":"Date of Birth","x":7,"y":46.9,"w":15,"size":9,"bold":true,"color":"#33403f"},{"id":"t-13","kind":"text","text":":  {date_of_birth}","x":22,"y":46.9,"w":27,"size":9,"bold":true},{"id":"t-14","kind":"text","text":"Course Name","x":7,"y":50.2,"w":15,"size":9,"bold":true,"color":"#33403f"},{"id":"t-15","kind":"text","text":":  {course_title}","x":22,"y":50.2,"w":27,"size":9,"bold":true},{"id":"t-16","kind":"text","text":"Institute","x":7,"y":53.5,"w":15,"size":9,"bold":true,"color":"#33403f"},{"id":"t-17","kind":"text","text":":  {institute_name}","x":22,"y":53.5,"w":27,"size":9,"bold":true},{"id":"t-18","kind":"text","text":"Examination","x":7,"y":56.8,"w":15,"size":9,"bold":true,"color":"#33403f"},{"id":"t-19","kind":"text","text":":  {exam_name}","x":22,"y":56.8,"w":27,"size":9,"bold":true},{"id":"t-20","kind":"text","text":"Roll","x":52,"y":37,"w":15,"size":9,"bold":true,"color":"#33403f"},{"id":"t-21","kind":"text","text":":  {roll_no}","x":67,"y":37,"w":26,"size":9,"bold":true},{"id":"t-22","kind":"text","text":"Registration","x":52,"y":40.3,"w":15,"size":9,"bold":true,"color":"#33403f"},{"id":"t-23","kind":"text","text":":  {registration_no}","x":67,"y":40.3,"w":26,"size":9,"bold":true},{"id":"t-24","kind":"text","text":"Session","x":52,"y":43.6,"w":15,"size":9,"bold":true,"color":"#33403f"},{"id":"t-25","kind":"text","text":":  {session_name}","x":67,"y":43.6,"w":26,"size":9,"bold":true},{"id":"t-26","kind":"text","text":"Course Duration","x":52,"y":46.9,"w":15,"size":9,"bold":true,"color":"#33403f"},{"id":"t-27","kind":"text","text":":  {course_duration}","x":67,"y":46.9,"w":26,"size":9,"bold":true},{"id":"t-28","kind":"text","text":"Passing Year","x":52,"y":50.2,"w":15,"size":9,"bold":true,"color":"#33403f"},{"id":"t-29","kind":"text","text":":  {passing_year}","x":67,"y":50.2,"w":26,"size":9,"bold":true},{"id":"t-30","kind":"text","text":"Institute Code","x":52,"y":53.5,"w":15,"size":9,"bold":true,"color":"#33403f"},{"id":"t-31","kind":"text","text":":  {institute_code}","x":67,"y":53.5,"w":26,"size":9,"bold":true},{"id":"t-32","kind":"text","text":"Inst. Reg. No.","x":52,"y":56.8,"w":15,"size":9,"bold":true,"color":"#33403f"},{"id":"t-33","kind":"text","text":":  {institute_registration_no}","x":67,"y":56.8,"w":26,"size":9,"bold":true},{"id":"t-34","kind":"text","text":"Detailed Marks","x":7,"y":61.5,"w":86,"size":11,"bold":true,"align":"center","color":"#0f6666"},{"id":"marks","kind":"marks_table","x":7,"y":64.5,"w":86,"size":9.5},{"id":"t-35","kind":"text","text":"Percentage: {percentage}%    ·    {gpa_text}    ·    Result: {result_status}","x":7,"y":72.5,"w":86,"size":10.5,"bold":true,"align":"center"},{"id":"t-36","kind":"text","text":"Result published on {published_on}","x":7,"y":75.5,"w":86,"size":9,"align":"center","color":"#5f6b6d","hideIfEmpty":true},{"id":"qr","kind":"qr","x":8,"y":80,"w":13},{"id":"t-37","kind":"text","text":"Scan to verify · code {verify_code}","x":7,"y":90.5,"w":30,"size":7.5,"color":"#5f6b6d"},{"id":"line-38","kind":"line","x":60,"y":88,"w":30,"thickness":0.8,"color":"#1f2a2b"},{"id":"t-39","kind":"text","text":"{signatory_left}","x":60,"y":89.2,"w":30,"size":9,"align":"center","color":"#5f6b6d"},{"id":"t-40","kind":"text","text":"{disclaimer}","x":8,"y":94.2,"w":84,"size":6.5,"align":"center","color":"#5f6b6d","wrap":true,"hideIfEmpty":true}]}$layout$::jsonb, now()),
  ('admit_card', 'Standard admit card', 'active', $layout${"orientation":"landscape","frame":"classic","accent":"#0f6666","fields":[{"id":"logo-63","kind":"image","source":"logo","x":7,"y":5.5,"w":9,"h":13},{"id":"t-64","kind":"text","text":"{org_name}","x":18,"y":6.5,"w":64,"size":22,"bold":true,"align":"center","color":"#0f6666"},{"id":"t-65","kind":"text","text":"{org_name_bn}","x":18,"y":12,"w":64,"size":13,"align":"center","color":"#0f6666","hideIfEmpty":true},{"id":"t-66","kind":"text","text":"Registration No. {org_registration_no}","x":18,"y":16.2,"w":64,"size":9,"align":"center","color":"#5f6b6d","hideIfEmpty":true},{"id":"t-67","kind":"text","text":"ADMIT CARD","x":30,"y":20.3,"w":40,"size":13,"align":"center","color":"#ffffff","bg":"#b23b3b"},{"id":"photo","kind":"image","source":"photo","x":79,"y":27,"w":13,"h":23,"border":true},{"id":"qr","kind":"qr","x":80.5,"y":53,"w":10},{"id":"t-68","kind":"text","text":"Serial No.","x":7,"y":27,"w":19,"size":10,"bold":true,"color":"#33403f"},{"id":"t-69","kind":"text","text":":  {document_no}","x":27,"y":27,"w":49,"size":10,"bold":true},{"id":"t-70","kind":"text","text":"Institute Code","x":7,"y":30.9,"w":19,"size":10,"bold":true,"color":"#33403f"},{"id":"t-71","kind":"text","text":":  {institute_code}","x":27,"y":30.9,"w":49,"size":10,"bold":true},{"id":"t-72","kind":"text","text":"Institute Name","x":7,"y":34.8,"w":19,"size":10,"bold":true,"color":"#33403f"},{"id":"t-73","kind":"text","text":":  {institute_name}","x":27,"y":34.8,"w":49,"size":10,"bold":true},{"id":"t-74","kind":"text","text":"Name of the Examinee","x":7,"y":38.7,"w":19,"size":10,"bold":true,"color":"#33403f"},{"id":"t-75","kind":"text","text":":  {student_name}","x":27,"y":38.7,"w":49,"size":10,"bold":true},{"id":"t-76","kind":"text","text":"Father's Name","x":7,"y":42.6,"w":19,"size":10,"bold":true,"color":"#33403f"},{"id":"t-77","kind":"text","text":":  {father_name}","x":27,"y":42.6,"w":49,"size":10,"bold":true},{"id":"t-78","kind":"text","text":"Mother's Name","x":7,"y":46.5,"w":19,"size":10,"bold":true,"color":"#33403f"},{"id":"t-79","kind":"text","text":":  {mother_name}","x":27,"y":46.5,"w":49,"size":10,"bold":true},{"id":"t-80","kind":"text","text":"Roll No","x":7,"y":50.4,"w":19,"size":10,"bold":true,"color":"#33403f"},{"id":"t-81","kind":"text","text":":  {roll_no}","x":27,"y":50.4,"w":49,"size":10,"bold":true},{"id":"t-82","kind":"text","text":"Reg No","x":7,"y":54.3,"w":19,"size":10,"bold":true,"color":"#33403f"},{"id":"t-83","kind":"text","text":":  {registration_no}","x":27,"y":54.3,"w":49,"size":10,"bold":true},{"id":"t-84","kind":"text","text":"Course / Session","x":7,"y":58.2,"w":19,"size":10,"bold":true,"color":"#33403f"},{"id":"t-85","kind":"text","text":":  {course_title} · {session_name}","x":27,"y":58.2,"w":49,"size":10,"bold":true},{"id":"t-86","kind":"text","text":"Examination","x":7,"y":62.1,"w":19,"size":10,"bold":true,"color":"#33403f"},{"id":"t-87","kind":"text","text":":  {exam_name}","x":27,"y":62.1,"w":49,"size":10,"bold":true},{"id":"t-88","kind":"text","text":"Date & Time","x":7,"y":66,"w":19,"size":10,"bold":true,"color":"#33403f"},{"id":"t-89","kind":"text","text":":  {exam_date} {exam_time}","x":27,"y":66,"w":49,"size":10,"bold":true},{"id":"t-90","kind":"text","text":"Venue / Seat","x":7,"y":69.9,"w":19,"size":10,"bold":true,"color":"#33403f"},{"id":"t-91","kind":"text","text":":  {venue} · Seat {seat_no}","x":27,"y":69.9,"w":49,"size":10,"bold":true},{"id":"t-92","kind":"text","text":"Type of the Examinee","x":7,"y":73.8,"w":19,"size":10,"bold":true,"color":"#33403f"},{"id":"t-93","kind":"text","text":":  {examinee_type}","x":27,"y":73.8,"w":49,"size":10,"bold":true},{"id":"t-94","kind":"text","text":"Directions","x":7,"y":79,"w":40,"size":12,"bold":true},{"id":"t-95","kind":"text","text":"1. Bring this admit card and your registration card to the examination hall.","x":7,"y":83,"w":60,"size":8.5,"wrap":true},{"id":"t-96","kind":"text","text":"2. Sign the attendance sheet; otherwise you will be treated as absent.","x":7,"y":86.5,"w":60,"size":8.5,"wrap":true},{"id":"line-97","kind":"line","x":71,"y":86,"w":21,"thickness":0.8,"color":"#1f2a2b"},{"id":"t-98","kind":"text","text":"{signatory_left}","x":71,"y":87.2,"w":21,"size":9,"align":"center","color":"#5f6b6d"},{"id":"t-99","kind":"text","text":"{org_name}","x":71,"y":89.5,"w":21,"size":8,"align":"center","color":"#5f6b6d"}]}$layout$::jsonb, now()),
  ('registration_card', 'Standard registration card', 'active', $layout${"orientation":"portrait","frame":"classic","accent":"#0f6666","watermark":true,"fields":[{"id":"logo-100","kind":"image","source":"logo","x":8,"y":4.5,"w":12,"h":8},{"id":"t-101","kind":"text","text":"{org_name}","x":18,"y":5.5,"w":64,"size":18,"bold":true,"align":"center","color":"#0f6666"},{"id":"t-102","kind":"text","text":"{org_name_bn}","x":18,"y":9.2,"w":64,"size":12,"align":"center","color":"#0f6666","hideIfEmpty":true},{"id":"t-103","kind":"text","text":"Registration No. {org_registration_no}","x":18,"y":12.1,"w":64,"size":9,"align":"center","color":"#5f6b6d","hideIfEmpty":true},{"id":"t-104","kind":"text","text":"REGISTRATION CARD","x":30,"y":14.9,"w":40,"size":12,"align":"center","color":"#ffffff","bg":"#b23b3b"},{"id":"t-105","kind":"text","text":"Serial No.: {document_no}","x":9,"y":18,"w":40,"size":8.5,"color":"#5f6b6d"},{"id":"t-106","kind":"text","text":"{course_title}","x":9,"y":21,"w":82,"size":14,"bold":true,"align":"center"},{"id":"photo","kind":"image","source":"photo","x":72,"y":26,"w":18,"h":13.5,"border":true},{"id":"qr","kind":"qr","x":75,"y":42,"w":12},{"id":"t-107","kind":"text","text":"Registration Number","x":9,"y":27,"w":21,"size":9.5,"bold":true,"color":"#33403f"},{"id":"t-108","kind":"text","text":":  {registration_no}","x":31,"y":27,"w":39,"size":9.5,"bold":true},{"id":"t-109","kind":"text","text":"Name of Student","x":9,"y":30.35,"w":21,"size":9.5,"bold":true,"color":"#33403f"},{"id":"t-110","kind":"text","text":":  {student_name}","x":31,"y":30.35,"w":39,"size":9.5,"bold":true},{"id":"t-111","kind":"text","text":"Father's Name","x":9,"y":33.7,"w":21,"size":9.5,"bold":true,"color":"#33403f"},{"id":"t-112","kind":"text","text":":  {father_name}","x":31,"y":33.7,"w":39,"size":9.5,"bold":true},{"id":"t-113","kind":"text","text":"Mother's Name","x":9,"y":37.05,"w":21,"size":9.5,"bold":true,"color":"#33403f"},{"id":"t-114","kind":"text","text":":  {mother_name}","x":31,"y":37.05,"w":39,"size":9.5,"bold":true},{"id":"t-115","kind":"text","text":"Date of Birth","x":9,"y":40.4,"w":21,"size":9.5,"bold":true,"color":"#33403f"},{"id":"t-116","kind":"text","text":":  {date_of_birth}","x":31,"y":40.4,"w":39,"size":9.5,"bold":true},{"id":"t-117","kind":"text","text":"Gender","x":9,"y":43.75,"w":21,"size":9.5,"bold":true,"color":"#33403f"},{"id":"t-118","kind":"text","text":":  {gender}","x":31,"y":43.75,"w":39,"size":9.5,"bold":true},{"id":"t-119","kind":"text","text":"Roll Number","x":9,"y":47.1,"w":21,"size":9.5,"bold":true,"color":"#33403f"},{"id":"t-120","kind":"text","text":":  {roll_no}","x":31,"y":47.1,"w":39,"size":9.5,"bold":true},{"id":"t-121","kind":"text","text":"Institute Name","x":9,"y":50.45,"w":21,"size":9.5,"bold":true,"color":"#33403f"},{"id":"t-122","kind":"text","text":":  {institute_name}","x":31,"y":50.45,"w":39,"size":9.5,"bold":true},{"id":"t-123","kind":"text","text":"Institute Code","x":9,"y":53.8,"w":21,"size":9.5,"bold":true,"color":"#33403f"},{"id":"t-124","kind":"text","text":":  {institute_code}","x":31,"y":53.8,"w":39,"size":9.5,"bold":true},{"id":"t-125","kind":"text","text":"Address","x":9,"y":57.150000000000006,"w":21,"size":9.5,"bold":true,"color":"#33403f"},{"id":"t-126","kind":"text","text":":  {address}","x":31,"y":57.150000000000006,"w":39,"size":9.5,"bold":true},{"id":"t-127","kind":"text","text":"Student Thana","x":9,"y":60.5,"w":21,"size":9.5,"bold":true,"color":"#33403f"},{"id":"t-128","kind":"text","text":":  {thana}","x":31,"y":60.5,"w":39,"size":9.5,"bold":true},{"id":"t-129","kind":"text","text":"Student District","x":9,"y":63.85,"w":21,"size":9.5,"bold":true,"color":"#33403f"},{"id":"t-130","kind":"text","text":":  {district}","x":31,"y":63.85,"w":39,"size":9.5,"bold":true},{"id":"t-131","kind":"text","text":"Course Name","x":9,"y":67.2,"w":21,"size":9.5,"bold":true,"color":"#33403f"},{"id":"t-132","kind":"text","text":":  {course_title}","x":31,"y":67.2,"w":39,"size":9.5,"bold":true},{"id":"t-133","kind":"text","text":"Course Duration","x":9,"y":70.55000000000001,"w":21,"size":9.5,"bold":true,"color":"#33403f"},{"id":"t-134","kind":"text","text":":  {course_duration}","x":31,"y":70.55000000000001,"w":39,"size":9.5,"bold":true},{"id":"t-135","kind":"text","text":"Session","x":9,"y":73.9,"w":21,"size":9.5,"bold":true,"color":"#33403f"},{"id":"t-136","kind":"text","text":":  {session_name}","x":31,"y":73.9,"w":39,"size":9.5,"bold":true},{"id":"t-137","kind":"text","text":"Registration Date","x":9,"y":77.25,"w":21,"size":9.5,"bold":true,"color":"#33403f"},{"id":"t-138","kind":"text","text":":  {enrollment_date}","x":31,"y":77.25,"w":39,"size":9.5,"bold":true},{"id":"line-139","kind":"line","x":9,"y":85.5,"w":24,"thickness":0.8,"color":"#1f2a2b"},{"id":"t-140","kind":"text","text":"Signature of the Student","x":9,"y":86.7,"w":24,"size":9,"align":"center","color":"#5f6b6d"},{"id":"line-141","kind":"line","x":38,"y":85.5,"w":24,"thickness":0.8,"color":"#1f2a2b"},{"id":"t-142","kind":"text","text":"{signatory_right}","x":38,"y":86.7,"w":24,"size":9,"align":"center","color":"#5f6b6d"},{"id":"line-143","kind":"line","x":67,"y":85.5,"w":24,"thickness":0.8,"color":"#1f2a2b"},{"id":"t-144","kind":"text","text":"{signatory_left}","x":67,"y":86.7,"w":24,"size":9,"align":"center","color":"#5f6b6d"},{"id":"t-145","kind":"text","text":"1. This registration card is valid until {valid_until}.","x":9,"y":90,"w":82,"size":7.5,"wrap":true,"hideIfEmpty":true},{"id":"t-146","kind":"text","text":"2. Quote the institute code, registration number and session in all correspondence.","x":9,"y":92,"w":82,"size":7.5,"wrap":true},{"id":"t-147","kind":"text","text":"3. Scan the QR code to verify this card online.","x":9,"y":94,"w":82,"size":7.5,"wrap":true}]}$layout$::jsonb, now()),
  ('certificate', 'Standard certificate (template)', 'draft', $layout${"orientation":"landscape","frame":"classic","accent":"#0f6666","watermark":true,"fields":[{"id":"t-41","kind":"text","text":"{org_name}","x":10,"y":7.5,"w":80,"size":26,"bold":true,"align":"center","color":"#1f2a2b"},{"id":"t-42","kind":"text","text":"{org_name_bn}","x":10,"y":14.5,"w":80,"size":13,"align":"center","color":"#0f6666","hideIfEmpty":true},{"id":"logo","kind":"image","source":"logo","x":46,"y":18.5,"w":8,"h":10},{"id":"t-43","kind":"text","text":"Registration No. {org_registration_no}","x":10,"y":29.5,"w":80,"size":9,"align":"center","color":"#5f6b6d","hideIfEmpty":true},{"id":"t-44","kind":"text","text":"CERTIFICATE","x":10,"y":32.5,"w":80,"size":32,"bold":true,"font":"serif","align":"center","color":"#a8781f"},{"id":"t-45","kind":"text","text":"Serial No: {document_no}","x":9,"y":42,"w":40,"size":11,"font":"serif","italic":true},{"id":"t-46","kind":"text","text":"Reg. No: {registration_no}","x":51,"y":42,"w":40,"size":11,"font":"serif","italic":true,"align":"right"},{"id":"t-47","kind":"text","text":"Session: {session_name}","x":51,"y":46,"w":40,"size":11,"font":"serif","italic":true,"align":"right"},{"id":"t-48","kind":"text","text":"This is to certify that","x":10,"y":50,"w":80,"size":13,"font":"serif","italic":true,"align":"center","color":"#5f6b6d"},{"id":"t-49","kind":"text","text":"{student_name}","x":10,"y":54.5,"w":80,"size":24,"font":"serif","bold":true,"align":"center"},{"id":"t-50","kind":"text","text":"{student_name_bn}","x":10,"y":61,"w":80,"size":14,"bold":true,"align":"center","hideIfEmpty":true},{"id":"t-51","kind":"text","text":"son/daughter of {father_name} and {mother_name}","x":10,"y":65.5,"w":80,"size":12,"font":"serif","italic":true,"align":"center","hideIfEmpty":true},{"id":"t-52","kind":"text","text":"of {institute_name}, bearing Roll No. {roll_no}, duly passed the","x":10,"y":69.5,"w":80,"size":12,"font":"serif","italic":true,"align":"center"},{"id":"t-53","kind":"text","text":"{course_title}","x":10,"y":73.5,"w":80,"size":18,"font":"serif","bold":true,"align":"center","color":"#0f6666"},{"id":"t-54","kind":"text","text":"examination held in {exam_date} and secured {gpa_text} (Grade {grade}).","x":10,"y":79,"w":80,"size":12,"font":"serif","italic":true,"align":"center"},{"id":"qr","kind":"qr","x":7,"y":72,"w":9},{"id":"t-55","kind":"text","text":"Verify: {verify_url}","x":7,"y":88.2,"w":32,"size":7,"color":"#5f6b6d"},{"id":"t-56","kind":"text","text":"Result published: {published_on}","x":7,"y":91,"w":30,"size":8.5,"color":"#5f6b6d","hideIfEmpty":true},{"id":"t-57","kind":"text","text":"Date of issue: {issue_date}","x":7,"y":93.2,"w":30,"size":8.5,"color":"#5f6b6d"},{"id":"line-58","kind":"line","x":42,"y":87,"w":20,"thickness":0.8,"color":"#1f2a2b"},{"id":"t-59","kind":"text","text":"{signatory_left}","x":42,"y":88.2,"w":20,"size":9,"align":"center","color":"#5f6b6d"},{"id":"line-60","kind":"line","x":70,"y":87,"w":20,"thickness":0.8,"color":"#1f2a2b"},{"id":"t-61","kind":"text","text":"{signatory_right}","x":70,"y":88.2,"w":20,"size":9,"align":"center","color":"#5f6b6d"},{"id":"t-62","kind":"text","text":"{disclaimer}","x":40,"y":92.4,"w":52,"size":6.5,"align":"center","color":"#5f6b6d","wrap":true,"hideIfEmpty":true}]}$layout$::jsonb, null);

-- ---------------------------------------------------------------------------
-- Document data (formatted values used by templates)
-- ---------------------------------------------------------------------------
create or replace function public.fmt_date(d date) returns text
language sql immutable set search_path = '' as $$
  select case when d is null then '' else to_char(d, 'DD FMMonth YYYY') end;
$$;

create or replace function public.course_duration_text(months int, override text) returns text
language sql immutable set search_path = '' as $$
  select coalesce(nullif(btrim(override), ''),
    case when months is null then ''
         when months % 12 = 0 then (months / 12)::text || ' Year' || case when months > 12 then 's' else '' end
         else months::text || ' Month' || case when months > 1 then 's' else '' end end);
$$;

create or replace function public.org_document_data() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'org_name', org_name_en, 'org_name_bn', coalesce(org_name_bn, ''), 'org_registration_no', coalesce(org_registration_no, ''),
    'org_tagline', coalesce(tagline_en, ''), 'disclaimer', coalesce(disclaimer_en, ''),
    'signatory_left', cert_signatory_left, 'signatory_right', cert_signatory_right)
  from public.site_settings where id = 1;
$$;

create or replace function public.student_document_data(p_student uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'student_name', s.name_en, 'student_name_bn', coalesce(s.name_bn, ''),
    'father_name', coalesce(s.father_name, ''), 'mother_name', coalesce(s.mother_name, ''),
    'date_of_birth', public.fmt_date(s.date_of_birth), 'gender', initcap(coalesce(s.gender, '')),
    'roll_no', s.roll_no, 'registration_no', s.registration_no,
    'institute_name', i.name_en, 'institute_code', i.code, 'institute_registration_no', coalesce(i.registration_no, ''),
    'course_title', c.title_en, 'course_code', c.code, 'course_duration', public.course_duration_text(c.duration_months, s.course_duration_override),
    'session_name', ses.name, 'address', coalesce(s.address, ''), 'thana', coalesce(s.thana, ''), 'district', coalesce(s.district, ''),
    'enrollment_date', public.fmt_date(s.enrollment_date), 'photo_path', coalesce(s.photo_path, ''))
  from public.students s
  join public.institutes i on i.id = s.institute_id
  join public.courses c on c.id = s.course_id
  join public.academic_sessions ses on ses.id = s.session_id
  where s.id = p_student;
$$;

create or replace function public.result_document_data(p_result uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'exam_name', e.name, 'exam_code', e.code, 'exam_date', public.fmt_date(e.exam_date),
    'passing_year', coalesce(s.passing_year::text, case when r.is_pass and e.exam_date is not null then extract(year from e.exam_date)::int::text else '' end),
    'published_on', public.fmt_date(r.display_published_on),
    'theory_marks', coalesce(trim_scale(r.theory_marks)::text, ''), 'practical_marks', coalesce(trim_scale(r.practical_marks)::text, ''),
    'viva_marks', coalesce(trim_scale(r.viva_marks)::text, ''), 'total_marks', trim_scale(r.total_marks)::text,
    'full_marks', trim_scale(r.full_marks)::text, 'percentage', trim_scale(r.percentage)::text,
    'grade', r.grade, 'grade_point', to_char(r.grade_point, 'FM0.00'), 'scale_max', to_char(coalesce(g.max_point, 5), 'FM0.00'),
    'gpa_text', case when coalesce(g.max_point, 5) = 4 then 'CGPA ' else 'GPA ' end || to_char(r.grade_point, 'FM0.00') || ' on a scale of ' || to_char(coalesce(g.max_point, 5), 'FM0.00'),
    'result_status', case when r.is_pass then 'Passed' else 'Failed' end,
    'grading_text', coalesce((select string_agg((x ->> 'grade') || ' ' || trim_scale((x ->> 'min_percent')::numeric)::text || '%+', ' · ' order by (x ->> 'min_percent')::numeric desc)
                              from jsonb_array_elements(g.rules) x where (x ->> 'min_percent')::numeric > 0), ''),
    'm_theory', coalesce(trim_scale(r.theory_marks)::text, ''),
    'm_practical', case when e.practical_full_marks > 0 then coalesce(trim_scale(r.practical_marks)::text, '') else 'N/A' end,
    'm_viva', case when e.viva_full_marks > 0 then coalesce(trim_scale(r.viva_marks)::text, '') else 'N/A' end)
  from public.results r
  join public.exams e on e.id = r.exam_id
  join public.students s on s.id = r.student_id
  left join public.grade_scales g on g.id = r.grade_scale_id
  where r.id = p_result;
$$;

-- ---------------------------------------------------------------------------
-- Issued documents: admit cards and registration cards
-- ---------------------------------------------------------------------------
create table public.documents (
  id              uuid primary key default gen_random_uuid(),
  doc_type        public.doc_type not null check (doc_type in ('admit_card', 'registration_card')),
  document_no     text not null unique,
  student_id      uuid not null references public.students (id) on delete restrict,
  institute_id    uuid not null references public.institutes (id) on delete restrict,
  exam_id         uuid references public.exams (id) on delete restrict,
  template_id     uuid references public.document_templates (id) on delete restrict,
  layout          jsonb not null,
  background_path text,
  background_type text,
  data            jsonb not null,
  status          text not null default 'valid' check (status in ('valid', 'revoked')),
  valid_until     date,
  supersedes_id   uuid references public.documents (id) on delete restrict,
  issued_at       timestamptz not null default now(),
  issued_by       uuid references auth.users (id) on delete set null,
  revoked_at      timestamptz,
  revoked_by      uuid references auth.users (id) on delete set null,
  revoke_reason   text,
  updated_at      timestamptz not null default now(),
  check (doc_type <> 'admit_card' or exam_id is not null)
);
create unique index documents_one_valid_admit on public.documents (student_id, exam_id) where doc_type = 'admit_card' and status = 'valid';
create unique index documents_one_valid_registration on public.documents (student_id) where doc_type = 'registration_card' and status = 'valid';
create index documents_student_idx on public.documents (student_id);
create index documents_exam_idx on public.documents (exam_id);
create trigger documents_updated_at before update on public.documents for each row execute function public.set_updated_at();

-- Audit lifecycle without copying the full snapshot
create or replace function public.documents_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data, reason)
  values (auth.uid(), tg_op, 'documents', new.id::text,
          case when tg_op = 'UPDATE' then jsonb_build_object('status', old.status) end,
          jsonb_build_object('doc_type', new.doc_type, 'document_no', new.document_no, 'status', new.status, 'student_id', new.student_id, 'exam_id', new.exam_id),
          nullif(current_setting('app.change_reason', true), ''));
  return new;
end $$;
create trigger documents_audit after insert or update on public.documents for each row execute function public.documents_audit();

alter table public.documents enable row level security;
create policy documents_select on public.documents for select to authenticated
  using (public.is_central() or institute_id = public.current_institute_id());

create or replace function public.generate_document_no(p_kind text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  prefix text;
  v text;
begin
  select upper(regexp_replace(coalesce(nullif(short_name, ''), 'DOC'), '[^A-Za-z0-9]', '', 'g')) into prefix from public.site_settings where id = 1;
  prefix := left(coalesce(nullif(prefix, ''), 'DOC'), 8);
  loop
    v := prefix || '-' || p_kind || to_char(now(), 'YY') || '-' || public.random_code(8);
    exit when not exists (select 1 from public.documents where document_no = v)
          and not exists (select 1 from public.certificates where certificate_no = v);
  end loop;
  return v;
end $$;

-- Issue one admit card / registration card (publishers). p_extra may carry
-- seat_no, examinee_type and valid_until.
create or replace function public.issue_document_internal(p_type public.doc_type, p_student uuid, p_exam uuid, p_extra jsonb, p_supersedes uuid default null)
returns public.documents
language plpgsql security definer set search_path = '' as $$
declare
  s public.students;
  e public.exams;
  t public.document_templates;
  d public.documents;
  no text;
  valid date;
  years int;
  data jsonb;
begin
  select * into s from public.students where id = p_student;
  if not found then raise exception 'Student not found'; end if;
  if p_type = 'admit_card' then
    select * into e from public.exams where id = p_exam;
    if not found then raise exception 'Exam not found'; end if;
    if e.course_id <> s.course_id then raise exception 'Student % is not enrolled in the course of exam %', s.roll_no, e.code; end if;
  elsif p_type <> 'registration_card' then
    raise exception 'Unsupported document type %', p_type;
  end if;
  select * into t from public.document_templates where doc_type = p_type and status = 'active';
  if not found then raise exception 'No active % template', p_type; end if;

  no := public.generate_document_no(case when p_type = 'admit_card' then 'A' else 'R' end);
  if p_type = 'registration_card' then
    select registration_card_validity_years into years from public.site_settings where id = 1;
    valid := coalesce(nullif(p_extra ->> 'valid_until', '')::date, case when years is not null then (current_date + make_interval(years => years))::date end);
  end if;
  data := public.org_document_data() || public.student_document_data(p_student)
          || jsonb_build_object('document_no', no, 'issue_date', public.fmt_date(current_date), 'valid_until', public.fmt_date(valid));
  if p_type = 'admit_card' then
    data := data || jsonb_build_object(
      'exam_name', e.name, 'exam_code', e.code, 'exam_date', public.fmt_date(e.exam_date),
      'exam_time', coalesce(e.exam_time, ''), 'venue', coalesce(e.venue, ''),
      'seat_no', left(coalesce(p_extra ->> 'seat_no', ''), 20),
      'examinee_type', left(coalesce(nullif(p_extra ->> 'examinee_type', ''), 'Regular'), 30));
  end if;

  insert into public.documents (doc_type, document_no, student_id, institute_id, exam_id, template_id, layout, background_path, background_type, data, valid_until, supersedes_id, issued_by)
  values (p_type, no, s.id, s.institute_id, case when p_type = 'admit_card' then e.id end, t.id, t.layout, t.background_path, t.background_type, data, valid, p_supersedes, auth.uid())
  returning * into d;
  return d;
end $$;

create or replace function public.issue_documents(p_type public.doc_type, p_students uuid[], p_exam uuid, p_extra jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  sid uuid;
  issued int := 0;
  skipped int := 0;
  extra jsonb;
begin
  if not public.can_publish() then raise exception 'Only authorized central roles may issue documents'; end if;
  foreach sid in array p_students loop
    if exists (select 1 from public.documents where doc_type = p_type and student_id = sid and status = 'valid'
               and (p_type <> 'admit_card' or exam_id = p_exam)) then
      skipped := skipped + 1;
    else
      extra := coalesce(p_extra, '{}'::jsonb);
      if extra ->> 'seat_no' = '{roll_no}' then
        extra := extra || jsonb_build_object('seat_no', (select roll_no from public.students where id = sid));
      end if;
      perform public.issue_document_internal(p_type, sid, p_exam, extra);
      issued := issued + 1;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'issued', issued, 'skipped', skipped);
end $$;

create or replace function public.revoke_document(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d public.documents;
begin
  if not public.can_publish() then raise exception 'Only authorized central roles may revoke documents'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'A reason is required'; end if;
  perform set_config('app.change_reason', p_reason, true);
  update public.documents set status = 'revoked', revoked_at = now(), revoked_by = auth.uid(), revoke_reason = p_reason
   where id = p_id and status = 'valid' returning * into d;
  if not found then raise exception 'Document not found or already revoked'; end if;
  return jsonb_build_object('ok', true, 'document_no', d.document_no);
end $$;

-- Corrections: revoke and issue a fresh snapshot (current data and template),
-- optionally with edited seat/examinee type/validity.
create or replace function public.reissue_document(p_id uuid, p_reason text, p_extra jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  old public.documents;
  fresh public.documents;
  extra jsonb;
begin
  if not public.can_publish() then raise exception 'Only authorized central roles may reissue documents'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'A reason is required'; end if;
  select * into old from public.documents where id = p_id and status = 'valid' for update;
  if not found then raise exception 'Only valid documents can be reissued'; end if;
  perform set_config('app.change_reason', 'Reissued: ' || p_reason, true);
  update public.documents set status = 'revoked', revoked_at = now(), revoked_by = auth.uid(), revoke_reason = 'Superseded: ' || p_reason where id = old.id;
  extra := jsonb_build_object('seat_no', old.data ->> 'seat_no', 'examinee_type', old.data ->> 'examinee_type', 'valid_until', old.valid_until) || coalesce(p_extra, '{}'::jsonb);
  fresh := public.issue_document_internal(old.doc_type, old.student_id, old.exam_id, extra, old.id);
  return jsonb_build_object('ok', true, 'id', fresh.id, 'document_no', fresh.document_no);
end $$;

-- Public verification of admit/registration cards (service role only).
create or replace function public.public_verify_document(p_no text)
returns table (doc_type text, document_no text, status text, issued_at timestamptz, valid_until date, revoked_at timestamptz,
               student_name text, roll_no text, registration_no text, institute_name text, course_title text, session_name text,
               exam_name text, superseded_by text)
language sql stable security definer set search_path = '' as $$
  select d.doc_type::text, d.document_no,
         case when d.status = 'revoked' and exists (select 1 from public.documents n where n.supersedes_id = d.id) then 'superseded'
              when d.status = 'revoked' then 'revoked'
              when d.valid_until is not null and d.valid_until < current_date then 'expired'
              else 'valid' end,
         d.issued_at, d.valid_until, d.revoked_at,
         d.data ->> 'student_name', d.data ->> 'roll_no', d.data ->> 'registration_no', d.data ->> 'institute_name',
         d.data ->> 'course_title', d.data ->> 'session_name', nullif(d.data ->> 'exam_name', ''),
         (select n.document_no from public.documents n where n.supersedes_id = d.id order by n.issued_at desc limit 1)
  from public.documents d
  where d.document_no = upper(btrim(p_no));
$$;

-- ---------------------------------------------------------------------------
-- Certificates: optional template snapshot and richer issued data
-- ---------------------------------------------------------------------------
alter table public.certificates
  add column template_id uuid references public.document_templates (id) on delete restrict,
  add column layout jsonb,
  add column background_path text,
  add column background_type text;

create or replace function public.issue_certificate_internal(p_result_id uuid, p_supersedes uuid default null)
returns public.certificates
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  t public.document_templates;
  c public.certificates;
  no text;
begin
  select res.id, res.status, res.is_pass, res.grade, res.grade_point, res.total_marks, res.percentage,
         res.student_id, res.institute_id,
         s.name_en, s.name_bn, s.roll_no, s.registration_no, s.father_name,
         i.name_en as institute_name, i.code as institute_code,
         co.title_en as course_title, co.code as course_code, co.duration_months,
         ses.name as session_name, e.name as exam_name, e.code as exam_code, e.exam_date
    into r
    from public.results res
    join public.students s on s.id = res.student_id
    join public.institutes i on i.id = res.institute_id
    join public.exams e on e.id = res.exam_id
    join public.courses co on co.id = e.course_id
    join public.academic_sessions ses on ses.id = e.session_id
   where res.id = p_result_id;
  if not found then raise exception 'Result not found'; end if;
  if r.status <> 'published' then raise exception 'Certificates can only be issued for published results'; end if;
  if not r.is_pass then raise exception 'Certificates can only be issued for passing results'; end if;

  -- Without an active certificate template the original built-in design is used.
  select * into t from public.document_templates where doc_type = 'certificate' and status = 'active';
  no := public.generate_certificate_no();

  insert into public.certificates (certificate_no, result_id, student_id, institute_id, issued_by, supersedes_id, snapshot,
                                   template_id, layout, background_path, background_type)
  values (
    no, r.id, r.student_id, r.institute_id, auth.uid(), p_supersedes,
    public.org_document_data() || public.student_document_data(r.student_id) || public.result_document_data(r.id) ||
    jsonb_build_object(
      'student_name', r.name_en, 'student_name_bn', r.name_bn, 'father_name', coalesce(r.father_name, ''),
      'roll_no', r.roll_no, 'registration_no', r.registration_no,
      'institute_name', r.institute_name, 'institute_code', r.institute_code,
      'course_title', r.course_title, 'course_code', r.course_code, 'duration_months', r.duration_months,
      'session_name', r.session_name, 'exam_name', r.exam_name, 'exam_code', r.exam_code, 'exam_date_raw', r.exam_date,
      'grade', r.grade, 'grade_point', r.grade_point, 'total_marks_raw', r.total_marks, 'percentage_raw', r.percentage,
      'document_no', no, 'issue_date', public.fmt_date(current_date)
    ),
    t.id, t.layout, t.background_path, t.background_type
  )
  returning * into c;
  return c;
end $$;

-- Grants (EXECUTE is never granted to anon/PUBLIC by default; see migration 0700)
grant execute on function public.activate_document_template(uuid) to authenticated;
grant execute on function public.issue_documents(public.doc_type, uuid[], uuid, jsonb) to authenticated;
grant execute on function public.revoke_document(uuid, text) to authenticated;
grant execute on function public.reissue_document(uuid, text, jsonb) to authenticated;
grant execute on function public.fmt_date(date) to authenticated;
grant execute on function public.course_duration_text(int, text) to authenticated;
grant execute on function public.public_verify_document(text) to service_role;
