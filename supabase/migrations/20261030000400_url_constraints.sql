-- Defense in depth: URLs rendered on public pages must be web URLs or site
-- paths (no javascript:/data: links), even when written directly via the API.
create or replace function public.is_safe_url(u text) returns boolean
language sql immutable set search_path = '' as $$
  select u is null or u ~* '^(https?://[^\s]+|/([^/\s][^\s]*)?)$';
$$;

alter table public.courses       add constraint courses_image_url_safe   check (public.is_safe_url(image_url));
alter table public.banners       add constraint banners_image_url_safe   check (public.is_safe_url(image_url));
alter table public.banners       add constraint banners_link_url_safe    check (public.is_safe_url(link_url));
alter table public.notices       add constraint notices_attachment_safe  check (public.is_safe_url(attachment_url));
alter table public.pages         add constraint pages_og_image_safe      check (public.is_safe_url(og_image_url));
alter table public.menu_items    drop constraint menu_items_href_check;
alter table public.menu_items    add constraint menu_items_href_safe     check (href is not null and public.is_safe_url(href));
alter table public.site_settings add constraint settings_urls_safe check (
  public.is_safe_url(logo_url) and public.is_safe_url(og_image_url) and public.is_safe_url(facebook_url)
  and public.is_safe_url(youtube_url)
  and (map_embed_url is null or map_embed_url like 'https://www.google.com/maps/embed%')
);

grant execute on function public.is_safe_url(text) to anon, authenticated;
