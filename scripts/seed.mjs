// Seeds invented demo people so the three surfaces have something on them
// out of the box. Nobody here is a real person — names, companies and
// one-liners are made up for development only.
//
// The data is chosen to exercise the matcher rather than to look busy:
// there is at least one clean one-way match (someone raising, someone who
// invests), at least one two-way trade (each has what the other asked
// for), one symmetric pair, and people in all three visibility modes so
// `exact`, `base` and `off` all render.
//
// Refuses to run against anything that isn't obviously a local database
// unless you pass --i-mean-it, so pulling prod env vars into a local shell
// by accident can't seed fake accounts into a real database.

import pg from "pg";

const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("No DATABASE_URL/POSTGRES_URL set.");
  process.exit(1);
}

const isLocal = /localhost|127\.0\.0\.1/.test(url);
if (!isLocal && !process.argv.includes("--i-mean-it")) {
  console.error(
    `Refusing to seed a non-local database (${url.replace(/:[^:@]+@/, ":***@")}).\n` +
      `Pass --i-mean-it if you really mean to.`
  );
  process.exit(1);
}

/** Real coordinates, so the map looks like a city rather than a grid. */
const PLACES = {
  hitec: { label: "HITEC City, Hyderabad", lat: 17.4435, lng: 78.3772 },
  banjara: { label: "Banjara Hills, Hyderabad", lat: 17.4126, lng: 78.4071 },
  gachibowli: { label: "Gachibowli, Hyderabad", lat: 17.4401, lng: 78.3489 },
  jubilee: { label: "Jubilee Hills, Hyderabad", lat: 17.4239, lng: 78.4738 },
  madhapur: { label: "Madhapur, Hyderabad", lat: 17.4486, lng: 78.3908 },
  kondapur: { label: "Kondapur, Hyderabad", lat: 17.4615, lng: 78.3677 },
  begumpet: { label: "Begumpet, Hyderabad", lat: 17.4399, lng: 78.4983 },
  koramangala: { label: "Koramangala, Bengaluru", lat: 12.9352, lng: 77.6245 },
  indiranagar: { label: "Indiranagar, Bengaluru", lat: 12.9719, lng: 77.6412 },
};

const CITIES = {
  hyderabad: { label: "Hyderabad", lat: 17.4065, lng: 78.4772 },
  bengaluru: { label: "Bengaluru", lat: 12.9716, lng: 77.5946 },
  mumbai: { label: "Mumbai", lat: 19.076, lng: 72.8777 },
};

const PEOPLE = [
  {
    email: "meera@example.com",
    interests: ['fintech','saas'],
    stage: "founder",
    name: "Meera Raghavan",
    headline: "Founder, cross-border payments",
    company: "Talu",
    workingOn: "Taking our India payments stack into the UAE before March",
    lookingFor: ["funding", "market"],
    canHelpWith: ["product", "technical"],
    at: PLACES.hitec,
    visibility: "exact",
  },
  {
    // The clean counterpart to Meera: she's raising, he invests.
    email: "arjun@example.com",
    interests: ['fintech','ai'],
    stage: "investor",
    name: "Arjun Desai",
    headline: "Angel investor, ex-operator",
    company: "Independent",
    workingOn: "Writing six to eight cheques a year into pre-seed fintech",
    lookingFor: ["product"],
    canHelpWith: ["funding", "gtm"],
    at: PLACES.banjara,
    visibility: "exact",
  },
  {
    email: "priya@example.com",
    interests: ['saas','ai'],
    stage: "operator",
    name: "Priya Nair",
    headline: "Engineering lead, platform",
    company: "Northwind",
    workingOn: "Hiring three backend engineers and failing to find them",
    lookingFor: ["hiring"],
    canHelpWith: ["technical", "advice"],
    at: PLACES.gachibowli,
    visibility: "exact",
  },
  {
    // Priya needs hiring help; Rohan recruits. And Rohan wants career
    // advice, which Priya offers — a genuine two-way trade.
    email: "rohan@example.com",
    interests: ['saas','consumer'],
    stage: "operator",
    name: "Rohan Mehta",
    headline: "Technical recruiter",
    company: "Seedling Talent",
    workingOn: "Placing senior backend people in Hyderabad product companies",
    lookingFor: ["advice"],
    canHelpWith: ["hiring", "role"],
    at: PLACES.madhapur,
    visibility: "exact",
  },
  {
    email: "divya@example.com",
    interests: ['consumer','design'],
    stage: "exploring",
    name: "Divya Krishnan",
    headline: "Senior PM, marketplaces",
    company: "Looking",
    workingOn: "Six years in marketplaces, looking for the next thing",
    lookingFor: ["role", "advice"],
    canHelpWith: ["product", "gtm"],
    at: PLACES.jubilee,
    visibility: "exact",
  },
  {
    email: "sameer@example.com",
    interests: ['consumer','media'],
    stage: "operator",
    name: "Sameer Qureshi",
    headline: "Head of growth",
    company: "Brightline",
    workingOn: "Paid acquisition that stops working above ten lakh a month",
    lookingFor: ["technical"],
    canHelpWith: ["growth", "gtm"],
    at: PLACES.kondapur,
    visibility: "exact",
  },
  {
    email: "ananya@example.com",
    interests: ['design','media'],
    stage: "freelance",
    name: "Ananya Iyer",
    headline: "Design lead",
    company: "Studio Kaleido",
    workingOn: "A design system for three products that disagree with each other",
    lookingFor: ["cofounder"],
    canHelpWith: ["product"],
    at: PLACES.begumpet,
    visibility: "exact",
  },
  {
    // Symmetric pair with Ananya — both want a co-founder.
    email: "vikram@example.com",
    interests: ['saas','deeptech'],
    stage: "exploring",
    name: "Vikram Shetty",
    headline: "Backend engineer, ex-Flipkart",
    company: "Between things",
    workingOn: "Prototyping a logistics tool, need someone who can sell",
    lookingFor: ["cofounder", "gtm"],
    canHelpWith: ["technical"],
    at: PLACES.hitec,
    visibility: "exact",
  },
  // City-only: discoverable, not locatable. These render as a circle.
  {
    email: "lakshmi@example.com",
    interests: ['saas','health'],
    stage: "exec",
    name: "Lakshmi Venkatesh",
    headline: "VP Product",
    company: "Corelane",
    workingOn: "Moving a twelve-year-old enterprise product onto a new stack",
    lookingFor: ["hiring"],
    canHelpWith: ["advice", "product"],
    city: CITIES.hyderabad,
    visibility: "base",
  },
  {
    email: "nikhil@example.com",
    interests: ['climate','deeptech'],
    stage: "founder",
    name: "Nikhil Rao",
    headline: "Founder, climate hardware",
    company: "Verdant",
    workingOn: "Cold chain for vaccines that works without reliable power",
    lookingFor: ["funding", "technical"],
    canHelpWith: ["market"],
    city: CITIES.bengaluru,
    visibility: "base",
  },
  {
    email: "fatima@example.com",
    interests: ['fintech','saas'],
    stage: "investor",
    name: "Fatima Sheikh",
    headline: "Partner, early stage fund",
    company: "Mallow Capital",
    workingOn: "Seed cheques into Indian SaaS and fintech",
    lookingFor: ["peers"],
    canHelpWith: ["funding", "advice"],
    city: CITIES.mumbai,
    visibility: "base",
  },
  {
    email: "aditya@example.com",
    interests: ['saas','ai'],
    stage: "operator",
    name: "Aditya Varma",
    headline: "Sales lead, enterprise SaaS",
    company: "Pierpoint",
    workingOn: "First ten enterprise deals for a developer tools company",
    lookingFor: ["peers"],
    canHelpWith: ["gtm", "role"],
    at: PLACES.koramangala,
    visibility: "exact",
  },
  // Off the map entirely. Still a board member, still matchable — the
  // single most important asymmetry in the product, and it needs a row
  // to prove it.
  {
    email: "zoya@example.com",
    interests: ['ai','health'],
    stage: "operator",
    name: "Zoya Kapoor",
    headline: "Data scientist",
    company: "Northwind",
    workingOn: "Forecasting models for retail demand",
    lookingFor: ["role"],
    canHelpWith: ["technical"],
    city: CITIES.hyderabad,
    visibility: "off",
  },
  {
    email: "karthik@example.com",
    interests: ['ai','saas'],
    stage: "founder",
    name: "Karthik Subramanian",
    headline: "Founder, devtools",
    company: "Parsely",
    workingOn: "An open-source CLI with four thousand stars and no revenue",
    lookingFor: ["gtm", "funding"],
    canHelpWith: ["technical", "product"],
    at: PLACES.indiranagar,
    visibility: "exact",
  },
];

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  await client.query("begin");

  const ids = {};
  for (const p of PEOPLE) {
    const exact = p.at ?? null;
    const city = p.city ?? null;
    const { rows } = await client.query(
      `insert into users
         (email, name, headline, company, working_on, looking_for, can_help_with,
          lat, lng, location_label, base_lat, base_lng, base_label, visibility,
          linkedin_url, interests, stage, last_active_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17, now())
       on conflict (email) do update set
         name = excluded.name,
         headline = excluded.headline,
         company = excluded.company,
         working_on = excluded.working_on,
         looking_for = excluded.looking_for,
         can_help_with = excluded.can_help_with,
         lat = excluded.lat,
         lng = excluded.lng,
         location_label = excluded.location_label,
         base_lat = excluded.base_lat,
         base_lng = excluded.base_lng,
         base_label = excluded.base_label,
         visibility = excluded.visibility,
         linkedin_url = excluded.linkedin_url,
         interests = excluded.interests,
         stage = excluded.stage,
         last_active_at = now()
       returning id`,
      [
        p.email,
        p.name,
        p.headline,
        p.company,
        p.workingOn,
        p.lookingFor,
        p.canHelpWith,
        exact?.lat ?? null,
        exact?.lng ?? null,
        exact?.label ?? null,
        // Everyone gets a base city, including the `exact` people: it is
        // the fallback they'd land on if they ever downgrade, and leaving
        // it null would make that switch silently fail closed.
        (city ?? CITIES.hyderabad).lat,
        (city ?? CITIES.hyderabad).lng,
        (city ?? CITIES.hyderabad).label,
        p.visibility,
        `https://linkedin.com/in/${p.email.split("@")[0]}`,
        p.interests ?? [],
        p.stage ?? null,
      ]
    );
    ids[p.email] = rows[0].id;
  }

  // One event and one community, so both board types are walkable without
  // creating anything by hand.
  const boards = [
    {
      slug: "hyderabad-product-demo",
      type: "event",
      name: "Hyderabad Product Meetup #12",
      blurb: "Two talks, then an hour of actual mingling.",
      place: "T-Hub, Hyderabad",
      lat: 17.4456,
      lng: 78.3497,
      // Starts an hour ago and runs for five, so `isLive` is true and the
      // "here now" affordance is reachable the moment you seed.
      startsAt: new Date(Date.now() - 3600_000),
      endsAt: new Date(Date.now() + 4 * 3600_000),
      host: "priya@example.com",
      members: PEOPLE.map((p) => p.email),
      here: ["meera@example.com", "arjun@example.com", "rohan@example.com", "vikram@example.com", "zoya@example.com"],
    },
    {
      slug: "isb-pgp-2019-demo",
      type: "community",
      name: "ISB PGP — Class of 2019",
      blurb: "Where our batch actually keeps in touch.",
      place: "Everywhere",
      lat: null,
      lng: null,
      startsAt: null,
      endsAt: null,
      host: "lakshmi@example.com",
      members: [
        "lakshmi@example.com",
        "meera@example.com",
        "divya@example.com",
        "nikhil@example.com",
        "fatima@example.com",
        "aditya@example.com",
        "karthik@example.com",
        "zoya@example.com",
      ],
      here: [],
    },
  ];

  for (const b of boards) {
    const { rows } = await client.query(
      `insert into boards (slug, type, name, blurb, place, lat, lng, starts_at, ends_at, host_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (slug) do update set
         name = excluded.name, blurb = excluded.blurb, place = excluded.place,
         starts_at = excluded.starts_at, ends_at = excluded.ends_at
       returning id`,
      [b.slug, b.type, b.name, b.blurb, b.place, b.lat, b.lng, b.startsAt, b.endsAt, ids[b.host]]
    );
    const boardId = rows[0].id;

    for (const email of b.members) {
      await client.query(
        `insert into memberships (board_id, user_id, role, checked_in_at)
         values ($1,$2,$3,$4)
         on conflict (board_id, user_id) do update set checked_in_at = excluded.checked_in_at`,
        [boardId, ids[email], email === b.host ? "host" : "member", b.here.includes(email) ? new Date() : null]
      );
    }
    console.log(`board ${b.slug}: ${b.members.length} members`);
  }

  await client.query("commit");
  console.log(`seeded ${PEOPLE.length} people`);
  console.log("walk it: /b/hyderabad-product-demo and /b/isb-pgp-2019-demo");
} catch (err) {
  await client.query("rollback");
  throw err;
} finally {
  await client.end();
}
