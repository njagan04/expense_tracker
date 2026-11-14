-- Amounts are stored in paise (integer) to avoid float rounding. Safe to re-run.

create table if not exists accounts (
  id serial primary key,
  name text not null unique,
  opening_balance bigint not null default 0
);
-- Accounts are created and named by you in the app.

create table if not exists categories (
  id serial primary key,
  name text not null unique
);
-- Defaults only on first setup, so categories you delete never come back.
insert into categories (name)
select name from (values
  ('Food'), ('Groceries'), ('Transport'), ('Bills'), ('Rent'),
  ('Shopping'), ('Health'), ('Entertainment'), ('Other')
) as d(name)
where not exists (select 1 from categories);

-- Names are encrypted; name_hash (HMAC) lets us find the same person again.
create table if not exists people (
  id serial primary key,
  name_hash text not null unique,
  name_enc text not null
);

create table if not exists entries (
  id serial primary key,
  date date not null,
  type text not null check (type in ('expense', 'income', 'transfer', 'lend', 'repay')),
  amount bigint not null check (amount > 0),
  account_id int not null references accounts(id),
  to_account_id int references accounts(id),
  category_id int references categories(id) on delete set null,
  person_id int references people(id),
  note_enc text,
  created_at timestamptz not null default now(),
  check ((type = 'transfer') = (to_account_id is not null)),
  check (to_account_id is distinct from account_id)
);
create index if not exists entries_date on entries (date);

-- A person can be tagged on any entry except transfers; lend/repay always need one.
alter table entries drop constraint if exists entries_check2;
alter table entries drop constraint if exists entries_person_check;
alter table entries add constraint entries_person_check check (
  case type when 'transfer' then person_id is null
            when 'lend' then person_id is not null
            when 'repay' then person_id is not null
            else true end
);

create table if not exists push_tokens (
  token text primary key,
  created_at timestamptz not null default now()
);

create table if not exists login_attempts (
  at timestamptz not null default now(),
  ok boolean not null
);
