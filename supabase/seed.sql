-- ============================================================================
-- Seed data: categories + initial scrape sources for Pleasanton.
-- Run after schema.sql. Idempotent via ON CONFLICT.
-- ============================================================================

insert into event_categories (slug, name, icon, color, sort_order) values
  ('music',        'Live Music',      '🎵', '#d9791f', 10),
  ('arts',         'Arts & Culture',  '🎨', '#9d4a1a', 20),
  ('food-drink',   'Food & Drink',    '🍷', '#c0611a', 30),
  ('family',       'Family & Kids',   '🧸', '#e3923a', 40),
  ('market',       'Markets',         '🧺', '#7f3c1c', 50),
  ('community',    'Community',       '🤝', '#68331b', 60),
  ('sports',       'Sports & Fitness','🏃', '#d9791f', 70),
  ('festival',     'Festivals',       '🎪', '#c0611a', 80),
  ('education',    'Education',        '📚', '#9d4a1a', 90),
  ('nightlife',    'Nightlife',       '🌙', '#7f3c1c', 100),
  ('other',        'Other',           '📌', '#8e8e93', 999)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, color = excluded.color;

insert into sources (slug, name, url, website, scraper_key, strategy, notes) values
  ('pleasanton-downtown', 'Pleasanton Downtown Association',
    'https://www.pleasantondowntown.net/events',
    'https://www.pleasantondowntown.net', 'pleasanton-downtown', 'cheerio',
    'Downtown events, First Wednesday Street Party, concerts in the park.'),
  ('farmers-market', 'Pleasanton Farmers Market',
    'https://www.pcfma.org/markets/pleasanton',
    'https://www.pcfma.org', 'farmers-market', 'cheerio',
    'Weekly Saturday farmers market run by PCFMA.'),
  ('city-of-pleasanton', 'City of Pleasanton',
    'https://www.cityofpleasantonca.gov/news/events.php',
    'https://www.cityofpleasantonca.gov', 'city-of-pleasanton', 'cheerio',
    'Official city calendar: council meetings, civic events, recreation.'),
  ('hacienda', 'Hacienda Business Park',
    'https://www.hacienda.org/events',
    'https://www.hacienda.org', 'hacienda', 'cheerio',
    'Hacienda business park community event calendar.'),
  ('eventbrite-pleasanton', 'Eventbrite — Pleasanton',
    'https://www.eventbrite.com/d/ca--pleasanton/events/',
    'https://www.eventbrite.com', 'eventbrite', 'cheerio',
    'Eventbrite events listed in Pleasanton, CA.'),
  ('bandsintown-pleasanton', 'Bandsintown — Pleasanton',
    'https://www.bandsintown.com/c/pleasanton-ca',
    'https://www.bandsintown.com', 'bandsintown', 'cheerio',
    'Live music / concert listings for Pleasanton.'),
  ('pleasanton-weekly', 'Pleasanton Weekly Calendar',
    'https://www.pleasantonweekly.com/calendar/',
    'https://www.pleasantonweekly.com', 'pleasanton-weekly', 'cheerio',
    'Community calendar from the Pleasanton Weekly newspaper.')
on conflict (slug) do update set
  name = excluded.name, url = excluded.url, website = excluded.website,
  scraper_key = excluded.scraper_key, notes = excluded.notes;
