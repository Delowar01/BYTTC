import type { AppRole } from "@/lib/roles";
import { ALL_STAFF, CENTRAL, CMS_EDITORS, PUBLISHERS, USER_MANAGERS } from "@/lib/roles";

export type NavItem = { href: string; label: string; icon: string; group: string; roles: AppRole[] };

export const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "LayoutDashboard", group: "Overview", roles: ALL_STAFF },
  { href: "/admin/students", label: "Student list", icon: "Users", group: "Students", roles: ALL_STAFF },
  { href: "/admin/students/new", label: "Add student", icon: "UserPlus", group: "Students", roles: ALL_STAFF },
  { href: "/admin/students/import", label: "Import students", icon: "Upload", group: "Students", roles: ALL_STAFF },
  { href: "/admin/institutes", label: "Institutes", icon: "Building2", group: "Academic", roles: CENTRAL },
  { href: "/admin/courses", label: "Courses", icon: "BookOpen", group: "Academic", roles: CENTRAL },
  { href: "/admin/sessions", label: "Sessions", icon: "CalendarRange", group: "Academic", roles: CENTRAL },
  { href: "/admin/exams", label: "Exams", icon: "ClipboardList", group: "Academic", roles: CENTRAL },
  { href: "/admin/results", label: "All results", icon: "GraduationCap", group: "Results", roles: ALL_STAFF },
  { href: "/admin/results/new", label: "Add single result", icon: "Plus", group: "Results", roles: ALL_STAFF },
  { href: "/admin/results/entry", label: "Marks entry", icon: "PenLine", group: "Results", roles: ALL_STAFF },
  { href: "/admin/results/import", label: "Bulk result upload", icon: "Upload", group: "Results", roles: ALL_STAFF },
  { href: "/admin/imports", label: "Import history", icon: "History", group: "Results", roles: ALL_STAFF },
  { href: "/admin/results?status=published", label: "Published results", icon: "BadgeCheck", group: "Results", roles: ALL_STAFF },
  { href: "/admin/results?corrected=1", label: "Result corrections", icon: "FilePen", group: "Results", roles: ALL_STAFF },
  { href: "/admin/certificates", label: "Certificates", icon: "Award", group: "Academic documents", roles: ALL_STAFF },
  { href: "/admin/marksheets", label: "Marksheets", icon: "FileSpreadsheet", group: "Academic documents", roles: ALL_STAFF },
  { href: "/admin/admit-cards", label: "Admit cards", icon: "IdCard", group: "Academic documents", roles: ALL_STAFF },
  { href: "/admin/registration-cards", label: "Registration cards", icon: "BookUser", group: "Academic documents", roles: ALL_STAFF },
  { href: "/admin/templates", label: "Document templates", icon: "LayoutTemplate", group: "Academic documents", roles: PUBLISHERS },
  { href: "/admin/reports", label: "Reports", icon: "BarChart3", group: "Results", roles: ALL_STAFF },
  { href: "/admin/grading", label: "Grading scales", icon: "Sigma", group: "Results", roles: PUBLISHERS },
  { href: "/admin/cms/settings", label: "Site settings", icon: "Settings", group: "Website (CMS)", roles: CMS_EDITORS },
  { href: "/admin/cms/pages", label: "Pages & SEO", icon: "FileText", group: "Website (CMS)", roles: CMS_EDITORS },
  { href: "/admin/cms/banners", label: "Banners", icon: "Image", group: "Website (CMS)", roles: CMS_EDITORS },
  { href: "/admin/cms/menus", label: "Menus", icon: "Menu", group: "Website (CMS)", roles: CMS_EDITORS },
  { href: "/admin/cms/notices", label: "Notices", icon: "Megaphone", group: "Website (CMS)", roles: CMS_EDITORS },
  { href: "/admin/cms/media", label: "Media library", icon: "Images", group: "Website (CMS)", roles: CMS_EDITORS },
  { href: "/admin/messages", label: "Contact messages", icon: "Inbox", group: "Website (CMS)", roles: CENTRAL },
  { href: "/admin/audit", label: "Audit log", icon: "ScrollText", group: "System", roles: PUBLISHERS },
  { href: "/admin/users", label: "Users", icon: "UserCog", group: "System", roles: USER_MANAGERS },
  { href: "/admin/account", label: "My account", icon: "KeyRound", group: "System", roles: ALL_STAFF },
];
