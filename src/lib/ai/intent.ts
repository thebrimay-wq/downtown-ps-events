import { TRI_VALLEY_CITIES } from "../knowledge/render";

// ---------------------------------------------------------------------------
// Reads a question about local events and turns it into search filters. No
// model involved: dates, towns, kinds of event, "free", and "for kids" are
// matched with patterns, and whatever words are left over become the keyword
// query ("jazz", "Firehouse Arts Center"). Pure, so it is easy to test.
// ---------------------------------------------------------------------------

export interface Intent {
  // Inclusive calendar days, YYYY-MM-DD in Pleasanton's timezone.
  from: string | null;
  to: string | null;
  // How to say the range back: "this weekend", "on Saturday, September 12".
  when: string | null;
  // Only events starting late afternoon or later ("tonight", "Friday night").
  evening: boolean;
  city: string | null;
  category: string | null;
  free: boolean;
  family: boolean;
  query: string | null;
  kind: "events" | "greeting" | "thanks" | "help";
  // "More", "what else": the same search, shown at greater length.
  more: boolean;
}

const EMPTY: Intent = {
  from: null,
  to: null,
  when: null,
  evening: false,
  city: null,
  category: null,
  free: false,
  family: false,
  query: null,
  kind: "events",
  more: false,
};

// --- Calendar arithmetic (on UTC dates that stand for local days) ----------

function toDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toKey(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

function monthEnd(year: number, month0: number): Date {
  return new Date(Date.UTC(year, month0 + 1, 0));
}

const dayFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

const shortFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

export function dayLabel(key: string): string {
  return dayFmt.format(toDate(key));
}

function shortLabel(key: string): string {
  return shortFmt.format(toDate(key));
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WEEKDAY_RE =
  "(sunday|sun|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thu|friday|fri|saturday|sat)";
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
// "may" is left out of the bare month list: it is usually a verb.
const MONTH_RE =
  "(january|jan|february|feb|march|mar|april|apr|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)";
const MONTH_WITH_MAY_RE = MONTH_RE.replace("(", "(may|");

function weekdayIndex(word: string): number {
  return WEEKDAYS.findIndex((w) => w.startsWith(word.slice(0, 3)));
}

function monthName(month0: number): string {
  const m = MONTHS[month0];
  return m[0].toUpperCase() + m.slice(1);
}

function monthIndex(word: string): number {
  return MONTHS.findIndex((m) => m.startsWith(word.slice(0, 3)));
}

// The nth weekday of a month (1-based), or the last when n is -1.
function nthWeekday(year: number, month0: number, weekday: number, n: number): Date {
  if (n < 0) {
    const last = monthEnd(year, month0);
    return addDays(last, -((last.getUTCDay() - weekday + 7) % 7));
  }
  const first = new Date(Date.UTC(year, month0, 1));
  return addDays(first, ((weekday - first.getUTCDay() + 7) % 7) + 7 * (n - 1));
}

interface Range {
  from: string;
  to: string;
  when: string;
  evening?: boolean;
}

// --- Date phrases -----------------------------------------------------------

// Each matcher returns the range it found and removes the phrase from the
// text. Order matters: "next weekend" must go before "weekend", months before
// bare numbers, and so on.
type Matcher = (s: string, today: Date) => { s: string; range: Range } | null;

function strip(s: string, re: RegExp): string {
  return s.replace(re, " ");
}

const TIME_OF_DAY = "(?:\\s+(night|evening|morning|afternoon))?";

const matchers: Matcher[] = [
  // tonight, today, this evening
  (s, today) => {
    const re = /\b(tonight|this evening|this afternoon|this morning|today|later today)\b/;
    const m = s.match(re);
    if (!m) return null;
    const evening = /tonight|evening/.test(m[1]);
    const key = toKey(today);
    return { s: strip(s, re), range: { from: key, to: key, when: evening ? "tonight" : "today", evening } };
  },
  // tomorrow (night)
  (s, today) => {
    const re = new RegExp(`\\btomorrow${TIME_OF_DAY}\\b`);
    const m = s.match(re);
    if (!m) return null;
    const key = toKey(addDays(today, 1));
    const evening = m[1] === "night" || m[1] === "evening";
    return {
      s: strip(s, re),
      range: { from: key, to: key, when: evening ? "tomorrow night" : "tomorrow", evening },
    };
  },
  // next weekend
  (s, today) => {
    const re = /\b(next|the following) weekend\b/;
    if (!re.test(s)) return null;
    const wd = today.getUTCDay();
    const thisFriday = wd === 6 ? addDays(today, -1) : wd === 0 ? addDays(today, -2) : addDays(today, 5 - wd);
    const from = addDays(thisFriday, 7);
    return {
      s: strip(s, re),
      range: { from: toKey(from), to: toKey(addDays(from, 2)), when: "next weekend" },
    };
  },
  // this weekend, the weekend, weekend
  (s, today) => {
    const re = /\b(?:(?:this|the|over the|for the|on the|coming|upcoming|long)\s+)?weekend\b/;
    if (!re.test(s)) return null;
    const wd = today.getUTCDay();
    const from = wd === 6 || wd === 0 ? today : addDays(today, (5 - wd + 7) % 7);
    const to = addDays(today, (7 - wd) % 7);
    return { s: strip(s, re), range: { from: toKey(from), to: toKey(to), when: "this weekend" } };
  },
  // next week
  (s, today) => {
    const re = /\bnext week\b/;
    if (!re.test(s)) return null;
    const wd = today.getUTCDay();
    const monday = addDays(today, ((8 - wd) % 7) || 7);
    return {
      s: strip(s, re),
      range: { from: toKey(monday), to: toKey(addDays(monday, 6)), when: "next week" },
    };
  },
  // this week, rest of the week
  (s, today) => {
    const re = /\b(?:this week|the rest of the week|the rest of this week|later this week)\b/;
    if (!re.test(s)) return null;
    const wd = today.getUTCDay();
    return {
      s: strip(s, re),
      range: { from: toKey(today), to: toKey(addDays(today, (7 - wd) % 7)), when: "this week" },
    };
  },
  // next month
  (s, today) => {
    const re = /\bnext month\b/;
    if (!re.test(s)) return null;
    const y = today.getUTCFullYear();
    const m = today.getUTCMonth() + 1;
    const from = new Date(Date.UTC(y, m, 1));
    return {
      s: strip(s, re),
      range: { from: toKey(from), to: toKey(monthEnd(y, m)), when: `in ${monthName(from.getUTCMonth())}` },
    };
  },
  // this month, rest of the month
  (s, today) => {
    const re = /\b(?:this month|the rest of the month|the rest of this month|later this month)\b/;
    if (!re.test(s)) return null;
    return {
      s: strip(s, re),
      range: {
        from: toKey(today),
        to: toKey(monthEnd(today.getUTCFullYear(), today.getUTCMonth())),
        when: "this month",
      },
    };
  },
  // next 3 days, next two weeks
  (s, today) => {
    const re = /\b(?:in the |over the |for the )?next (\d+|two|three|four|five|six|seven|couple of|few) (days?|weeks?)\b/;
    const m = s.match(re);
    if (!m) return null;
    const words: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, "couple of": 2, few: 3 };
    const n = words[m[1]] ?? Number(m[1]);
    const days = m[2].startsWith("week") ? n * 7 : n;
    return {
      s: strip(s, re),
      range: {
        from: toKey(today),
        to: toKey(addDays(today, Math.max(days - 1, 0))),
        when: `over the next ${m[1]} ${m[2]}`,
      },
    };
  },
  // coming up, soon
  (s, today) => {
    const re = /\b(coming up|upcoming|soon|these days|right now|currently|at the moment)\b/;
    if (!re.test(s)) return null;
    return {
      s: strip(s, re),
      range: { from: toKey(today), to: toKey(addDays(today, 13)), when: "over the next couple of weeks" },
    };
  },
  // Holidays with a fixed or rule-based date.
  (s, today) => {
    const holidays: [RegExp, (y: number) => Date, string][] = [
      [/\bhalloween\b/, (y) => new Date(Date.UTC(y, 9, 31)), "on Halloween"],
      [/\bthanksgiving\b/, (y) => nthWeekday(y, 10, 4, 4), "on Thanksgiving"],
      [/\bchristmas eve\b/, (y) => new Date(Date.UTC(y, 11, 24)), "on Christmas Eve"],
      [/\bchristmas\b/, (y) => new Date(Date.UTC(y, 11, 25)), "on Christmas"],
      [/\bnew year'?s? eve\b/, (y) => new Date(Date.UTC(y, 11, 31)), "on New Year's Eve"],
      [/\bnew year'?s?( day)?\b/, (y) => new Date(Date.UTC(y, 0, 1)), "on New Year's Day"],
      [/\bvalentine'?s?( day)?\b/, (y) => new Date(Date.UTC(y, 1, 14)), "on Valentine's Day"],
      [/\bst\.? patrick'?s?( day)?\b/, (y) => new Date(Date.UTC(y, 2, 17)), "on St. Patrick's Day"],
      [/\bmother'?s? day\b/, (y) => nthWeekday(y, 4, 0, 2), "on Mother's Day"],
      [/\bfather'?s? day\b/, (y) => nthWeekday(y, 5, 0, 3), "on Father's Day"],
      [/\bmemorial day\b/, (y) => nthWeekday(y, 4, 1, -1), "on Memorial Day"],
      [/\blabor day\b/, (y) => nthWeekday(y, 8, 1, 1), "on Labor Day"],
      [/\b(?:fourth|4th) of july\b/, (y) => new Date(Date.UTC(y, 6, 4)), "on the Fourth of July"],
    ];
    for (const [re, on, when] of holidays) {
      if (!re.test(s)) continue;
      let d = on(today.getUTCFullYear());
      if (d < today) d = on(today.getUTCFullYear() + 1);
      const key = toKey(d);
      return { s: strip(s, re), range: { from: key, to: key, when } };
    }
    return null;
  },
  // 10/3, 10/3/2026
  (s, today) => {
    const re = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;
    const m = s.match(re);
    if (!m) return null;
    const month0 = Number(m[1]) - 1;
    const day = Number(m[2]);
    if (month0 < 0 || month0 > 11 || day < 1 || day > 31) return null;
    let year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : today.getUTCFullYear();
    let d = new Date(Date.UTC(year, month0, day));
    if (!m[3] && d < today) d = new Date(Date.UTC(++year, month0, day));
    const key = toKey(d);
    return { s: strip(s, re), range: { from: key, to: key, when: `on ${dayLabel(key)}` } };
  },
  // October 3, Oct 3rd, October 3-5, the 3rd of October
  (s, today) => {
    const re = new RegExp(
      `\\b(?:the )?(?:${MONTH_WITH_MAY_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*(?:-|–|to|through|thru|and)\\s*(\\d{1,2})(?:st|nd|rd|th)?)?|(\\d{1,2})(?:st|nd|rd|th)? of ${MONTH_WITH_MAY_RE})\\b`,
    );
    const m = s.match(re);
    if (!m) return null;
    const month0 = monthIndex(m[1] ?? m[5]);
    const day = Number(m[2] ?? m[4]);
    const last = m[3] ? Number(m[3]) : null;
    if (day < 1 || day > 31) return null;
    let year = today.getUTCFullYear();
    let d = new Date(Date.UTC(year, month0, day));
    if (d < today) d = new Date(Date.UTC(++year, month0, day));
    const from = toKey(d);
    if (last && last > day) {
      const to = toKey(new Date(Date.UTC(year, month0, last)));
      return {
        s: strip(s, re),
        range: { from, to, when: `${shortLabel(from)} to ${shortLabel(to)}` },
      };
    }
    return { s: strip(s, re), range: { from, to: from, when: `on ${dayLabel(from)}` } };
  },
  // in October, this October, October 2027, October (bare); "may" only
  // with a lead-in
  (s, today) => {
    const re = new RegExp(
      `\\b(?:(in|during|this|for|throughout|all of|next)\\s+)?${MONTH_RE}(?:\\s+(20\\d\\d))?\\b|\\b(in|during|this|for|throughout|all of|next)\\s+(may)(?:\\s+(20\\d\\d))?\\b`,
    );
    const m = s.match(re);
    if (!m) return null;
    const word = m[2] ?? m[5];
    const given = m[3] ?? m[6];
    const month0 = monthIndex(word);
    let year = given ? Number(given) : today.getUTCFullYear();
    if (!given && month0 < today.getUTCMonth()) year += 1;
    const first = new Date(Date.UTC(year, month0, 1));
    const from = first < today ? today : first;
    const to = monthEnd(year, month0);
    return {
      s: strip(s, re),
      range: {
        from: toKey(from),
        to: toKey(to < today ? today : to),
        when: given ? `in ${monthName(month0)} ${year}` : `in ${monthName(month0)}`,
      },
    };
  },
  // in 2027, the whole year
  (s, today) => {
    const re = /\b(?:in|during|for|throughout|all of)?\s*(20\d\d)\b/;
    const m = s.match(re);
    if (!m) return null;
    const year = Number(m[1]);
    const first = new Date(Date.UTC(year, 0, 1));
    const last = new Date(Date.UTC(year, 11, 31));
    return {
      s: strip(s, re),
      range: { from: toKey(first < today ? today : first), to: toKey(last < today ? today : last), when: `in ${year}` },
    };
  },
  // Saturday, this Saturday, next Saturday, Friday night
  (s, today) => {
    const re = new RegExp(`\\b(?:(this|next|on|coming|this coming)\\s+)?${WEEKDAY_RE}${TIME_OF_DAY}\\b`);
    const m = s.match(re);
    if (!m) return null;
    const target = weekdayIndex(m[2]);
    const wd = today.getUTCDay();
    let d = addDays(today, (target - wd + 7) % 7);
    // "Next Saturday" is the one in next week, not the one coming up.
    if (m[1] === "next") {
      const sunday = addDays(today, (7 - wd) % 7);
      if (d <= sunday) d = addDays(d, 7);
    }
    const key = toKey(d);
    const evening = m[3] === "night" || m[3] === "evening";
    const when = key === toKey(today) ? (evening ? "tonight" : "today") : `on ${dayLabel(key)}`;
    return { s: strip(s, re), range: { from: key, to: key, when, evening } };
  },
];

// --- Everything that is not a date -----------------------------------------

const CITY_RE = new RegExp(`\\b(${TRI_VALLEY_CITIES.map((c) => c.toLowerCase()).join("|")})\\b`);

const CATEGORY_RES: [string, RegExp][] = [
  ["music", /\b(live music|concerts?|gigs?|music)\b/],
  ["market", /\b(farmers'? markets?|craft fairs?|flea markets?|swap meets?|markets?)\b/],
  ["festival", /\b(festivals?|fests?|parades?|carnivals?)\b/],
  ["arts", /\b(art shows?|art walks?|galler(?:y|ies)|museums?|exhibits?|exhibitions?|arts (?:and|&) culture|art)\b/],
  ["food-drink", /\b(food (?:and|&) drink|food trucks?|food|dining|brunch|eat|eats)\b/],
  ["sports", /\b(sports?|fitness|athletics?|workouts?)\b/],
  ["education", /\b(classes|class|workshops?|lectures?|lessons?|seminars?|courses?|talks)\b/],
  ["community", /\b(community)\b/],
];

const FAMILY_RE = /\b(kids?|kiddos?|children|child|toddlers?|babies|baby|families|family|little ones|preschoolers?|youth|teens?|teenagers?)\b/;
const FREE_RE = /\b(free|no cost|free of charge)\b/;
const NEARBY_RE = /\b(tri-?valley|the valley|nearby|near me|near here|around here|in the area|in town|around town|locally|local)\b/;

// Words that carry no search meaning. Removed before the leftover becomes
// the keyword query.
const FILLER = [
  /\bwhat(?:'s| is| are) (?:happening|going on|on|up|there)\b/,
  /\b(?:is|are) there (?:anything|something|any|some)?\b/,
  /\bthings? to do\b/,
  /\bstuff to do\b/,
  /\bto do\b/,
  /\b(?:can|could|would|will) you\b/,
  /\bdo you (?:know|have)\b/,
  /\bi(?:'m| am) looking for\b/,
  /\blooking for\b/,
  /\bi(?:'d| would) (?:like|love)\b/,
  /\bi want\b/,
  /\b(?:tell|show|give) me\b/,
  /\bwhat about\b/,
  /\bhow about\b/,
  /\bgoing on\b/,
  /\bhappening\b/,
  /\bplease\b/,
  /\bevents?\b/,
  /\bactivities\b/,
  /\bactivity\b/,
  /\blistings?\b/,
  /\bideas?\b/,
  /\bplans?\b/,
  /\boptions?\b/,
  /\brecommend(?:ations?)?\b/,
  /\bsuggest(?:ions?)?\b/,
];

const STOP = new Set(
  "a an and are as at be but by can do does for from get go good have how i if in into is it its me my of on or our some something anything that the their there these this those to up us we what when where which who with you your fun nice cool interesting great any all else just only also so too very really kind sort type of".split(
    " ",
  ),
);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9'\/\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function leftoverQuery(s: string): string | null {
  const words = s
    .replace(/[\/\-]/g, " ")
    .replace(/\b(\w+)'s\b/g, "$1")
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ""))
    .filter((w) => w && !STOP.has(w));
  return words.length ? words.join(" ") : null;
}

// Which fields a single turn set on its own (as opposed to inherited).
interface Parsed {
  intent: Intent;
  set: { date: boolean; city: boolean; topic: boolean };
  followUp: boolean;
}

function parseOne(text: string, today: Date): Parsed {
  const original = normalize(text);
  let s = original;
  const intent: Intent = { ...EMPTY };
  const set = { date: false, city: false, topic: false };
  const followUp =
    /^(?:what|how) about\b/.test(s) ||
    /^(?:and|also|or|but|only|just|plus|then|ok|okay|anything else|something else|what else)\b/.test(s) ||
    /\b(?:instead|as well|too)$/.test(s) ||
    s.split(" ").length <= 3;

  if (/^(?:hi|hello|hey|hiya|howdy|yo|good (?:morning|afternoon|evening))\b[\s!.]*(?:there|claude)?[\s!.]*$/.test(s)) {
    return { intent: { ...intent, kind: "greeting" }, set, followUp: false };
  }
  if (/^(?:thanks|thank you|thx|ty|cheers|perfect|awesome|great|got it|nice|cool|ok|okay)\b[\s!.]*(?:so much|a lot|thanks)?[\s!.]*$/.test(s)) {
    return { intent: { ...intent, kind: "thanks" }, set, followUp: false };
  }
  if (/^(?:help|what can you do|what do you know|how does this work|what can i ask)\b[\s?!.]*$/.test(s)) {
    return { intent: { ...intent, kind: "help" }, set, followUp: false };
  }
  if (/^(?:more|show (?:me )?more|what else|anything else|the rest|keep going|others?)\b[\s?!.]*$/.test(s)) {
    return { intent: { ...intent, more: true }, set, followUp: true };
  }

  for (const match of matchers) {
    const hit = match(s, today);
    if (!hit) continue;
    s = hit.s;
    intent.from = hit.range.from;
    intent.to = hit.range.to;
    intent.when = hit.range.when;
    intent.evening = Boolean(hit.range.evening);
    set.date = true;
    break;
  }

  const city = s.match(CITY_RE);
  if (city) {
    intent.city = TRI_VALLEY_CITIES.find((c) => c.toLowerCase() === city[1]) ?? null;
    set.city = true;
    s = strip(s, CITY_RE);
  }
  s = strip(s, NEARBY_RE);

  if (FAMILY_RE.test(s)) {
    intent.family = true;
    set.topic = true;
    s = strip(s, FAMILY_RE);
  }
  if (FREE_RE.test(s)) {
    intent.free = true;
    set.topic = true;
    s = strip(s, FREE_RE);
  }
  for (const [category, re] of CATEGORY_RES) {
    if (!re.test(s)) continue;
    intent.category = category;
    set.topic = true;
    s = strip(s, re);
    break;
  }

  for (const re of FILLER) s = strip(s, re);
  intent.query = leftoverQuery(s);
  if (intent.query) set.topic = true;

  return { intent, set, followUp };
}

// --- Public -----------------------------------------------------------------

// A follow-up keeps whatever the earlier turn set that the new one did not:
// "what about Sunday" keeps the kind of event, "anything free?" keeps the day.
function merge(prior: Intent, next: Intent, set: { date: boolean; city: boolean; topic: boolean }): Intent {
  const out: Intent = { ...prior, more: false };
  if (set.date) {
    out.from = next.from;
    out.to = next.to;
    out.when = next.when;
    out.evening = next.evening;
  }
  if (set.city) out.city = next.city;
  if (set.topic) {
    const keepsTopic = Boolean(next.query) || next.free || next.family;
    out.category = next.category ?? (keepsTopic ? prior.category : null);
    out.free = next.free || prior.free;
    out.family = next.family || prior.family;
    out.query = next.query ?? (next.category ? null : prior.query);
  }
  return out;
}

// Parses the last question in a conversation, carrying filters forward from
// earlier turns when the new one reads as a follow-up ("what about Sunday",
// "anything free?"). `today` is a YYYY-MM-DD key in Pleasanton's timezone.
export function parseConversation(questions: string[], today: string): Intent {
  const day = toDate(today);
  let prior = null as Intent | null;
  for (const q of questions) {
    const { intent, set, followUp } = parseOne(q, day);
    if (intent.kind !== "events") {
      // Small talk does not disturb what the person was asking about.
      if (q === questions[questions.length - 1]) return intent;
      continue;
    }
    if (intent.more && prior) {
      prior = { ...prior, more: true };
      continue;
    }
    prior = followUp && prior ? merge(prior, intent, set) : intent;
  }
  return prior ?? { ...EMPTY };
}

export function parseQuestion(text: string, today: string): Intent {
  return parseConversation([text], today);
}
