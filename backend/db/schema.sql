-- Amounts are stored in paise (integer) to avoid float rounding. Safe to re-run.
-- Every row belongs to one user. Composite foreign keys (id, user_id) make it impossible
-- for an entry to point at another user's account, category or person.

create table if not exists users (
  id serial primary key,
  username text not null unique check (username ~ '^[a-z0-9_.]{3,20}$'),
  name text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists accounts (
  id serial primary key,
  user_id int not null references users(id) on delete cascade,
  name text not null,
  opening_balance bigint not null default 0,
  unique (user_id, name),
  unique (id, user_id)
);

create table if not exists categories (
  id serial primary key,
  user_id int not null references users(id) on delete cascade,
  name text not null,
  unique (user_id, name),
  unique (id, user_id)
);

-- Names are encrypted; name_hash (HMAC) lets us find the same person again.
create table if not exists people (
  id serial primary key,
  user_id int not null references users(id) on delete cascade,
  name_hash text not null,
  name_enc text not null,
  unique (user_id, name_hash),
  unique (id, user_id)
);

create table if not exists entries (
  id serial primary key,
  user_id int not null references users(id) on delete cascade,
  date date not null,
  type text not null check (type in ('expense', 'income', 'transfer', 'lend', 'repay')),
  amount bigint not null check (amount > 0),
  account_id int not null,
  to_account_id int,
  category_id int,
  person_id int,
  note_enc text,
  created_at timestamptz not null default now(),
  foreign key (account_id, user_id) references accounts(id, user_id),
  foreign key (to_account_id, user_id) references accounts(id, user_id),
  foreign key (category_id, user_id) references categories(id, user_id) on delete set null (category_id),
  foreign key (person_id, user_id) references people(id, user_id),
  check ((type = 'transfer') = (to_account_id is not null)),
  check (to_account_id is distinct from account_id),
  -- A person can be tagged on any entry except transfers; lend/repay always need one.
  constraint entries_person_check check (
    case type when 'transfer' then person_id is null
              when 'lend' then person_id is not null
              when 'repay' then person_id is not null
              else true end)
);
create index if not exists entries_user_date on entries (user_id, date);

-- Failed logins / sign-ups per username (or 'signup'), for rate limiting.
create table if not exists login_attempts (
  at timestamptz not null default now(),
  username text not null,
  ok boolean not null
);
