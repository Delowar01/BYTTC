-- =============================================================================
-- SYNTHETIC DEMO DATA — local development and automated tests only.
-- All people, institutes and numbers below are fictitious.
-- Users (super admin etc.) are created by `npm run seed:users`.
-- =============================================================================

insert into public.institutes (id, code, name_en, name_bn, head_name, email, phone, address, district, established_year, status, approved_at) values
('11111111-0000-4000-8000-000000000001', 'DHK-001', 'Dhaka Model Technical Institute', 'ঢাকা মডেল টেকনিক্যাল ইনস্টিটিউট', 'Rahim Uddin', 'dmti@example.org', '+880 1700-000001', '12 Mirpur Road, Dhaka', 'Dhaka', 2012, 'approved', now()),
('11111111-0000-4000-8000-000000000002', 'CTG-001', 'Chattogram Skills Academy', 'চট্টগ্রাম স্কিলস একাডেমি', 'Nasrin Akter', 'csa@example.org', '+880 1700-000002', '45 Agrabad, Chattogram', 'Chattogram', 2015, 'approved', now()),
('11111111-0000-4000-8000-000000000003', 'RAJ-001', 'Rajshahi Technical Training Centre', 'রাজশাহী টেকনিক্যাল ট্রেনিং সেন্টার', 'Kamal Hossain', 'rttc@example.org', '+880 1700-000003', '7 Shaheb Bazar, Rajshahi', 'Rajshahi', 2018, 'approved', now()),
('11111111-0000-4000-8000-000000000004', 'SYL-001', 'Sylhet Career Institute', 'সিলেট ক্যারিয়ার ইনস্টিটিউট', 'Farhana Begum', 'sci@example.org', '+880 1700-000004', '3 Zindabazar, Sylhet', 'Sylhet', 2021, 'pending', null),
('11111111-0000-4000-8000-000000000005', 'KHL-001', 'Khulna Polytech Training Point', 'খুলনা পলিটেক ট্রেনিং পয়েন্ট', 'Jahid Hasan', 'kptp@example.org', '+880 1700-000005', '9 KDA Avenue, Khulna', 'Khulna', 2016, 'suspended', null);

insert into public.courses (id, code, title_en, title_bn, summary_en, summary_bn, description_en, description_bn, duration_months, fee, sort_order) values
('22222222-0000-4000-8000-000000000001', 'COA', 'Computer Office Application', 'কম্পিউটার অফিস অ্যাপ্লিকেশন',
 'Word processing, spreadsheets, presentations and internet basics.', 'ওয়ার্ড প্রসেসিং, স্প্রেডশিট, প্রেজেন্টেশন ও ইন্টারনেটের মৌলিক বিষয়।',
 E'Learn the everyday computer skills employers expect:\n\n- Typing (English and Bangla)\n- Word processing and spreadsheets\n- Presentations\n- Email and safe internet use', E'নিয়োগকর্তারা যে দৈনন্দিন কম্পিউটার দক্ষতা প্রত্যাশা করেন:\n\n- টাইপিং (ইংরেজি ও বাংলা)\n- ওয়ার্ড প্রসেসিং ও স্প্রেডশিট\n- প্রেজেন্টেশন\n- ইমেইল ও নিরাপদ ইন্টারনেট ব্যবহার', 6, 6000, 10),
('22222222-0000-4000-8000-000000000002', 'GD', 'Graphic Design', 'গ্রাফিক ডিজাইন',
 'Design principles, image editing and vector illustration.', 'ডিজাইনের মূলনীতি, ইমেজ এডিটিং ও ভেক্টর ইলাস্ট্রেশন।', null, null, 6, 9000, 20),
('22222222-0000-4000-8000-000000000003', 'ELW', 'Electrical House Wiring', 'ইলেকট্রিক্যাল হাউস ওয়্যারিং',
 'Safe residential wiring, fittings and fault finding.', 'নিরাপদ আবাসিক ওয়্যারিং, ফিটিংস ও ত্রুটি নির্ণয়।', null, null, 3, 5000, 30),
('22222222-0000-4000-8000-000000000004', 'WEB', 'Web Design and Development', 'ওয়েব ডিজাইন ও ডেভেলপমেন্ট',
 'HTML, CSS, JavaScript and publishing websites.', 'এইচটিএমএল, সিএসএস, জাভাস্ক্রিপ্ট ও ওয়েবসাইট প্রকাশ।', null, null, 6, 12000, 40),
('22222222-0000-4000-8000-000000000005', 'RAC', 'Refrigeration and Air Conditioning', 'রেফ্রিজারেশন ও এয়ার কন্ডিশনিং',
 'Installation and servicing of refrigerators and AC units.', 'ফ্রিজ ও এসি স্থাপন এবং সার্ভিসিং।', null, null, 4, 8000, 50),
('22222222-0000-4000-8000-000000000006', 'DM', 'Digital Marketing', 'ডিজিটাল মার্কেটিং',
 'Social media, search and content marketing fundamentals.', 'সোশ্যাল মিডিয়া, সার্চ ও কনটেন্ট মার্কেটিংয়ের মৌলিক বিষয়।', null, null, 3, 7000, 60);

insert into public.academic_sessions (id, name, start_date, end_date, is_active) values
('33333333-0000-4000-8000-000000000001', 'January–June 2026', '2026-01-01', '2026-06-30', true),
('33333333-0000-4000-8000-000000000002', 'July–December 2026', '2026-07-01', '2026-12-31', true);

insert into public.exams (id, code, name, course_id, session_id, exam_date, theory_full_marks, practical_full_marks, pass_marks) values
('44444444-0000-4000-8000-000000000001', 'COA-2026-JUN', 'Computer Office Application — Final (Jun 2026)', '22222222-0000-4000-8000-000000000001', '33333333-0000-4000-8000-000000000001', '2026-06-20', 60, 40, 40),
('44444444-0000-4000-8000-000000000002', 'GD-2026-JUN', 'Graphic Design — Final (Jun 2026)', '22222222-0000-4000-8000-000000000002', '33333333-0000-4000-8000-000000000001', '2026-06-22', 50, 50, 40),
('44444444-0000-4000-8000-000000000003', 'COA-2026-DEC', 'Computer Office Application — Final (Dec 2026)', '22222222-0000-4000-8000-000000000001', '33333333-0000-4000-8000-000000000002', '2026-12-15', 60, 40, 40),
('44444444-0000-4000-8000-000000000004', 'WEB-2026-DEC', 'Web Design — Final (Dec 2026)', '22222222-0000-4000-8000-000000000004', '33333333-0000-4000-8000-000000000002', '2026-12-18', 50, 50, 40);

-- Courses each institute may enrol students in (course codes by institute)
insert into public.institute_courses (institute_id, course_id)
select i.id, c.id
from public.institutes i
join public.courses c on c.code = any (
  case i.code
    when 'DHK-001' then array['COA', 'GD', 'WEB', 'ELW']
    when 'CTG-001' then array['COA', 'GD', 'WEB', 'DM']
    when 'RAJ-001' then array['COA', 'GD', 'WEB', 'RAC']
    else array['COA']
  end);

-- 60 synthetic students. Roll 200001.. and registration 2600000001.. are fixed
-- so tests can reference them. Courses rotate COA, GD, WEB; institutes rotate
-- across the three approved institutes.
with names as (
  select array['Arif','Sadia','Tanvir','Mitu','Rafi','Nusrat','Imran','Lamia','Sabbir','Tania','Fahim','Ruma','Hasib','Jannat','Shakil'] as first,
         array['Ahmed','Islam','Hossain','Rahman','Khan','Chowdhury','Sarkar','Das','Roy','Akter'] as last
)
insert into public.students (institute_id, course_id, session_id, roll_no, registration_no, name_en, father_name, mother_name, date_of_birth, gender, phone, status)
select
  (array['11111111-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000002','11111111-0000-4000-8000-000000000003'])[1 + (g % 3)]::uuid,
  (array['22222222-0000-4000-8000-000000000001','22222222-0000-4000-8000-000000000002','22222222-0000-4000-8000-000000000004'])[1 + ((g / 3) % 3)]::uuid,
  case when g <= 40 then '33333333-0000-4000-8000-000000000001'::uuid else '33333333-0000-4000-8000-000000000002'::uuid end,
  (200000 + g)::text,
  (2600000000 + g)::text,
  n.first[1 + (g % 15)] || ' ' || n.last[1 + (g % 10)],
  'Father ' || n.last[1 + (g % 10)],
  'Mother ' || n.last[1 + ((g + 3) % 10)],
  date '2000-01-01' + (g * 37),
  case when g % 2 = 0 then 'male' else 'female' end,
  '+880 1800-' || lpad(g::text, 6, '0'),
  'active'
from generate_series(1, 60) g, names n;

-- Published demo results for exam COA-2026-JUN (session Jan–Jun, course COA).
-- Inserted as draft (the database refuses published inserts), then published.
insert into public.results (exam_id, student_id, theory_marks, practical_marks, status)
select '44444444-0000-4000-8000-000000000001', s.id,
       least(60, 20 + (substr(s.roll_no, 4)::int * 7) % 41),
       least(40, 10 + (substr(s.roll_no, 4)::int * 5) % 31),
       'draft'
from public.students s
where s.course_id = '22222222-0000-4000-8000-000000000001'
  and s.session_id = '33333333-0000-4000-8000-000000000001';

update public.results set status = 'published'
where exam_id = '44444444-0000-4000-8000-000000000001';

insert into public.notices (title_en, title_bn, body_en, body_bn, is_pinned, published_at) values
('Final examination results for June 2026 published', 'জুন ২০২৬ চূড়ান্ত পরীক্ষার ফলাফল প্রকাশিত',
 'Results of the Computer Office Application final examination (June 2026) are now available on the Result Search page.',
 'কম্পিউটার অফিস অ্যাপ্লিকেশন চূড়ান্ত পরীক্ষার (জুন ২০২৬) ফলাফল এখন ফলাফল অনুসন্ধান পাতায় পাওয়া যাচ্ছে।', true, now() - interval '2 days'),
('Admission open for July–December 2026 session', 'জুলাই–ডিসেম্বর ২০২৬ সেশনে ভর্তি চলছে',
 'Contact any verified institute to enrol in the July–December 2026 session.',
 'জুলাই–ডিসেম্বর ২০২৬ সেশনে ভর্তির জন্য যেকোনো যাচাইকৃত প্রতিষ্ঠানে যোগাযোগ করুন।', false, now() - interval '10 days'),
('December 2026 examination schedule', 'ডিসেম্বর ২০২৬ পরীক্ষার সময়সূচি',
 'Final examinations for the July–December 2026 session begin on 15 December 2026.',
 'জুলাই–ডিসেম্বর ২০২৬ সেশনের চূড়ান্ত পরীক্ষা ১৫ ডিসেম্বর ২০২৬ থেকে শুরু।', false, now() - interval '20 days');
