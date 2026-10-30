-- Default CMS content. Every value here is editable from Admin → Website (CMS).
-- The organization name is a placeholder brand: replace it with the legal name
-- of the actual issuing organization before going live.

insert into public.site_settings (
  id, org_name_en, org_name_bn, short_name, tagline_en, tagline_bn,
  email, phone, address_en, address_bn, office_hours_en, office_hours_bn,
  footer_text_en, footer_text_bn, disclaimer_en, disclaimer_bn,
  seo_title_en, seo_title_bn, seo_description_en, seo_description_bn
) values (
  1,
  'Sarathi Technical Training Network',
  'সারথি টেকনিক্যাল ট্রেনিং নেটওয়ার্ক',
  'STTN',
  'Practical skills. Verified results. Trusted certificates.',
  'বাস্তবমুখী দক্ষতা। যাচাইযোগ্য ফলাফল। বিশ্বাসযোগ্য সনদ।',
  'info@example.org',
  '+880 1000-000000',
  'House 00, Road 00, Dhaka, Bangladesh',
  'বাড়ি ০০, রোড ০০, ঢাকা, বাংলাদেশ',
  'Sunday–Thursday, 9:00 AM – 5:00 PM',
  'রবিবার–বৃহস্পতিবার, সকাল ৯টা – বিকাল ৫টা',
  'A network of independent technical training institutes.',
  'স্বতন্ত্র কারিগরি প্রশিক্ষণ প্রতিষ্ঠানসমূহের একটি নেটওয়ার্ক।',
  'This is a private, non-government training network. Results and certificates on this website are issued by the network named above and do not imply government accreditation.',
  'এটি একটি বেসরকারি প্রশিক্ষণ নেটওয়ার্ক। এই ওয়েবসাইটের ফলাফল ও সনদ উপরোক্ত নেটওয়ার্ক কর্তৃক প্রদত্ত এবং এটি কোনো সরকারি স্বীকৃতি নির্দেশ করে না।',
  'Sarathi Technical Training Network',
  'সারথি টেকনিক্যাল ট্রেনিং নেটওয়ার্ক',
  'Technical and vocational training courses, verified partner institutes, online results and certificate verification.',
  'কারিগরি ও বৃত্তিমূলক প্রশিক্ষণ কোর্স, যাচাইকৃত অংশীদার প্রতিষ্ঠান, অনলাইন ফলাফল ও সনদ যাচাই।'
);

insert into public.pages (slug, is_system, title_en, title_bn, body_en, body_bn, seo_description_en, seo_description_bn) values
('home', true, 'Home', 'হোম',
 E'We coordinate a network of independent technical training institutes, set common course standards, conduct examinations and publish verifiable results.',
 E'আমরা স্বতন্ত্র কারিগরি প্রশিক্ষণ প্রতিষ্ঠানসমূহের একটি নেটওয়ার্ক পরিচালনা করি, অভিন্ন কোর্স মান নির্ধারণ করি, পরীক্ষা গ্রহণ করি এবং যাচাইযোগ্য ফলাফল প্রকাশ করি।',
 null, null),
('about', true, 'About Us', 'আমাদের সম্পর্কে',
 E'## Who we are\n\nWe are a private network that brings technical training institutes under one quality framework.\n\n## What we do\n\n- Define course curricula and assessment standards\n- Approve and monitor partner institutes\n- Conduct examinations and publish results\n- Issue certificates that anyone can verify online\n\n## Our commitment\n\nEvery published result and certificate can be checked on this website.',
 E'## আমরা কারা\n\nআমরা একটি বেসরকারি নেটওয়ার্ক যা কারিগরি প্রশিক্ষণ প্রতিষ্ঠানসমূহকে একটি মানসম্মত কাঠামোর আওতায় নিয়ে আসে।\n\n## আমরা যা করি\n\n- কোর্স কারিকুলাম ও মূল্যায়ন মান নির্ধারণ\n- অংশীদার প্রতিষ্ঠান অনুমোদন ও তদারকি\n- পরীক্ষা গ্রহণ ও ফলাফল প্রকাশ\n- অনলাইনে যাচাইযোগ্য সনদ প্রদান\n\n## আমাদের অঙ্গীকার\n\nপ্রকাশিত প্রতিটি ফলাফল ও সনদ এই ওয়েবসাইটে যাচাই করা যায়।',
 'About the network, its mission and quality framework.', 'নেটওয়ার্ক, এর লক্ষ্য ও মান কাঠামো সম্পর্কে।'),
('courses', true, 'Courses', 'কোর্সসমূহ',
 E'Browse the technical and vocational courses offered through our partner institutes.',
 E'আমাদের অংশীদার প্রতিষ্ঠানসমূহের মাধ্যমে পরিচালিত কারিগরি ও বৃত্তিমূলক কোর্সগুলো দেখুন।',
 'Technical and vocational training courses.', 'কারিগরি ও বৃত্তিমূলক প্রশিক্ষণ কোর্স।'),
('notices', true, 'Notices', 'নোটিশ',
 E'Official announcements, exam schedules and result notices.',
 E'অফিসিয়াল ঘোষণা, পরীক্ষার সময়সূচি ও ফলাফল সংক্রান্ত নোটিশ।',
 'Official notices and announcements.', 'অফিসিয়াল নোটিশ ও ঘোষণা।'),
('contact', true, 'Contact Us', 'যোগাযোগ',
 E'Send us a message and our office will respond during office hours.',
 E'আমাদের বার্তা পাঠান, অফিস সময়ে আমরা উত্তর দেব।',
 'Contact the central office.', 'কেন্দ্রীয় অফিসের সাথে যোগাযোগ করুন।'),
('institutes', true, 'Verified Institutes', 'যাচাইকৃত প্রতিষ্ঠান',
 E'Only institutes listed here are approved partners of the network. Check an institute before you enrol.',
 E'এখানে তালিকাভুক্ত প্রতিষ্ঠানগুলোই নেটওয়ার্কের অনুমোদিত অংশীদার। ভর্তির আগে প্রতিষ্ঠান যাচাই করুন।',
 'Directory of approved partner institutes.', 'অনুমোদিত অংশীদার প্রতিষ্ঠানের তালিকা।'),
('results', true, 'Result Search', 'ফলাফল অনুসন্ধান',
 E'Enter your roll number and registration number exactly as printed on your admit card.',
 E'আপনার প্রবেশপত্রে মুদ্রিত রোল নম্বর ও রেজিস্ট্রেশন নম্বর হুবহু লিখুন।',
 'Search published examination results.', 'প্রকাশিত পরীক্ষার ফলাফল অনুসন্ধান করুন।'),
('verify', true, 'Certificate Verification', 'সনদ যাচাই',
 E'Enter the certificate number printed on the certificate, or scan its QR code.',
 E'সনদে মুদ্রিত সনদ নম্বর লিখুন অথবা এর QR কোড স্ক্যান করুন।',
 'Verify the authenticity of a certificate.', 'সনদের সত্যতা যাচাই করুন।'),
('privacy', false, 'Privacy Policy', 'গোপনীয়তা নীতি',
 E'We publish only the minimum information needed to verify results and certificates: name, roll and registration number, institute, course and grade. Personal identity documents and contact details are never shown publicly.',
 E'ফলাফল ও সনদ যাচাইয়ের জন্য প্রয়োজনীয় ন্যূনতম তথ্যই আমরা প্রকাশ করি: নাম, রোল ও রেজিস্ট্রেশন নম্বর, প্রতিষ্ঠান, কোর্স ও গ্রেড। ব্যক্তিগত পরিচয়পত্র ও যোগাযোগের তথ্য কখনো প্রকাশ্যে দেখানো হয় না।',
 'How we handle personal data.', 'আমরা কীভাবে ব্যক্তিগত তথ্য পরিচালনা করি।');

insert into public.menu_items (location, label_en, label_bn, href, sort_order) values
('header', 'Home', 'হোম', '/', 10),
('header', 'About', 'আমাদের সম্পর্কে', '/about', 20),
('header', 'Courses', 'কোর্স', '/courses', 30),
('header', 'Institutes', 'প্রতিষ্ঠান', '/institutes', 40),
('header', 'Notices', 'নোটিশ', '/notices', 50),
('header', 'Results', 'ফলাফল', '/results', 60),
('header', 'Verify Certificate', 'সনদ যাচাই', '/verify', 70),
('header', 'Contact', 'যোগাযোগ', '/contact', 80),
('footer', 'Privacy Policy', 'গোপনীয়তা নীতি', '/p/privacy', 10),
('footer', 'Result Search', 'ফলাফল অনুসন্ধান', '/results', 20),
('footer', 'Verified Institutes', 'যাচাইকৃত প্রতিষ্ঠান', '/institutes', 30);

insert into public.banners (title_en, title_bn, subtitle_en, subtitle_bn, link_url, link_label_en, link_label_bn, sort_order) values
('Skills that build careers', 'ক্যারিয়ার গড়ার দক্ষতা',
 'Hands-on technical courses delivered by approved institutes across the country.',
 'দেশজুড়ে অনুমোদিত প্রতিষ্ঠানের মাধ্যমে হাতে-কলমে কারিগরি কোর্স।',
 '/courses', 'Explore courses', 'কোর্স দেখুন', 10),
('Results and certificates you can verify', 'যাচাইযোগ্য ফলাফল ও সনদ',
 'Search your result with roll and registration number, or verify a certificate instantly.',
 'রোল ও রেজিস্ট্রেশন নম্বর দিয়ে ফলাফল দেখুন অথবা তাৎক্ষণিক সনদ যাচাই করুন।',
 '/results', 'Search result', 'ফলাফল দেখুন', 20);
