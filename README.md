# VIPizza — Static Storefront & Kitchen Dashboard

A clean, modern, **serverless** web application for a local homemade pizza business.
Built with plain HTML5, CSS3, and vanilla JavaScript (ES modules), powered by
**Supabase** (PostgreSQL + Row Level Security + Auth + Realtime).

No Node.js/Express server is required — the entire site is static and can be
hosted on **GitHub Pages** (or any static host).

```
site/
├── index.html        # Storefront (menu, cart, checkout)
├── admin.html        # Kitchen / staff dashboard (auth + realtime)
├── schema.sql        # Complete database setup (tables, RLS, indexes, seed)
├── css/
│   ├── base.css      # Shared styles (buttons, forms, modals, toasts, lang)
│   ├── storefront.css# Storefront-specific styles
│   └── admin.css     # Dashboard-specific styles
├── js/
│   ├── config.js     # Supabase client initialization (URL + anon key)
│   ├── i18n.js       # Internationalization (en/it/es) + language switcher
│   ├── utils.js      # Shared helpers (formatting, statuses, chime, toasts)
│   ├── storefront.js # Menu rendering, cart (localStorage), checkout
│   └── admin.js      # Auth, realtime feed, order/slot/inventory/menu mgmt
└── assets/           # Images / static assets
```

---

## Languages

The site supports **English (default)**, **Italian**, and **Spanish**. A language
switcher (🇬🇧 / 🇮🇹 / 🇪🇸) appears in the top-right corner of the storefront and
in the admin dashboard (both on the login screen and the header).

- The chosen language is saved in `localStorage` (`vipizza_lang`) and persists
  across visits.
- All static text is translated via `data-i18n` attributes in the HTML.
- Dynamic content (menu, cart, orders, slots, inventory) re-renders on language
  change via the `vipizza:langchange` event.
- To add a new language, add a new key to the `translations` object in
  `js/i18n.js` and add its flag to the `FLAGS` map.

---

## 1. Set up Supabase

### Option A — Hosted (recommended for production)

1. Create a free project at <https://supabase.com>.
2. Open **SQL Editor** → **New query**.
3. Paste the entire contents of [`schema.sql`](schema.sql) and run it.
4. Note your project credentials from **Settings → API**:
   - **Project URL** (e.g. `https://abcdefgh.supabase.co`)
   - **anon public key**
5. Enable Realtime for the `orders`, `slots`, and `inventory` tables:
   **Database → Replication → enable those tables** (or run
   `alter publication supabase_realtime add table public.orders;` and the
   equivalent for `slots` and `inventory`).

For an existing project that already has the original schema, do not rerun the
seed script just to add recipe support. Run
[`migrations/20261017_recipe_aware_menu_items.sql`](migrations/20261017_recipe_aware_menu_items.sql)
in the Supabase SQL Editor. It preserves menu items and adds the recipe table,
stock deduction trigger, and public JPEG photo bucket. Existing items start
without recipe amounts or photos; staff add those by editing each item.

To track ingredient costs, run
[`migrations/20261017_inventory_unit_cost.sql`](migrations/20261017_inventory_unit_cost.sql)
in the Supabase SQL Editor. Existing inventory values default to €0.00 until
their unit costs are entered in the staff dashboard.

For menu pricing based on recipe cost plus gain, first apply the recipe
migration above, then run
[`migrations/20261017_menu_item_gain_pricing.sql`](migrations/20261017_menu_item_gain_pricing.sql).
It backfills existing pizzas, changes the staff save function, and recalculates
pizza prices if a linked inventory unit cost changes. It also snapshots menu
ingredient cost and gain onto new order lines for weekly reporting.

The Analytics tab shows the last 12 weeks of non-cancelled pizza quantities,
ingredient costs, and gains. Earlier orders without saved cost snapshots use
current menu values as estimates.

To enable the staff dashboard's multilingual Site content editor, also run
[`migrations/20261017_site_content.sql`](migrations/20261017_site_content.sql)
in the Supabase SQL Editor. The storefront reads the published copy on page
load, using a local cache and built-in translations as fallbacks.
If you already ran this migration before the partial-save fix, run the updated
migration again so Supabase replaces the old save function.

To enable staff editing of public promotional text, also run
[`migrations/20261017_site_content.sql`](migrations/20261017_site_content.sql)
in the SQL Editor. It adds public read access to the approved content fields and
restricts content publishing to authenticated staff. The storefront uses its
built-in translations if Supabase is unavailable.

For checkout to reserve preparation capacity and create orders without
exposing order records to public reads, run
[`migrations/20261017_submit_order_atomically.sql`](migrations/20261017_submit_order_atomically.sql)
in the Supabase SQL Editor. It atomically reserves slot capacity, creates the
order and its items, and returns only the tracking code.

### Option B — Local development (Supabase CLI + Docker)

1. Make sure Docker is running.
2. From the repo root, start the local stack:
   ```bash
   npx supabase start
   ```
3. Apply the schema and seed data:
   ```bash
   npx supabase db reset
   ```
4. Get your local credentials:
   ```bash
   npx supabase status
   ```
   Use the **API URL** (`http://127.0.0.1:54321`) and the **anon key**.

---

## 2. Configure the site

Open [`js/config.js`](js/config.js) and replace the Supabase placeholders:

```js
const SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
```

To enable delivery address suggestions, create a Geoapify account and set
`GEOAPIFY_API_KEY` in the same file to an API key from your project dashboard.
This key is used by the browser and is therefore public; do not use a
private/service key. Without it, customers can still enter their address
manually. Geoapify account plans may have usage limits; see the
[current plan details](https://www.geoapify.com/pricing/).

For local development:

```js
const SUPABASE_URL = "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = "<anon key from supabase status>";
```

> **Security note:** The **anon key** is public by design and safe to expose in
> the browser. **Never** put the `service_role` key in the frontend — it bypasses
> RLS. All access control is enforced by the Row Level Security policies in
> `schema.sql`.

---

## 3. Create a staff account

1. Open the **admin dashboard** (`admin.html`) — it will show the login screen.
2. In the Supabase Dashboard go to **Authentication → Users → Add user** and
   create an account for your staff (email + password).
3. Optionally promote that user to `admin` role in the SQL Editor:
   ```sql
   update public.profiles
   set role = 'admin'
   where id = '<the user's auth.uid()>';
   ```
   (The dashboard currently treats any authenticated user as staff; the `role`
   column is ready for future fine-grained permissions.)

---

## 4. Deploy to GitHub Pages

1. Create a GitHub repository and push this `site/` folder to it.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Select the branch and set the folder to `/` (root) or `/site` depending on
   where you placed the files.
5. Save. GitHub Pages will publish the site at
   `https://<your-username>.github.io/<repo>/`.

### Keeping credentials safe on GitHub Pages

The anon key is public, so it can live in `config.js`. To keep it tidy and
avoid committing secrets:

- Add a `.gitignore` entry for any local override file, or
- Use a small build step that injects the values from GitHub **Secrets** into
  `config.js` at deploy time (e.g. a GitHub Actions workflow).

Example minimal GitHub Actions workflow (`.github/workflows/deploy.yml`):

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: site
      - uses: actions/deploy-pages@v4
```

---

## 5. How it works

### Storefront (`index.html`)
- Fetches `categories` and `menu_items` from Supabase (public RLS allows reads).
- Cart state is kept in `localStorage` (quantities, totals).
- At checkout, customers select a required **preparation time** for every
  order, whether pickup or delivery.
- Delivery uses separate street, optional apartment/floor, city, state/region,
  postal code, and country fields. Geoapify suggestions start after three
  characters and are not restricted to a country or service area. Manual entry
  remains available if there is no match. The formatted address is stored in
  the existing `orders.address` field. Suggestions are geocoding results, not
  postal deliverability verification.
- Checkout reserves slot capacity via the `check_and_reserve_slot` RPC, then
  inserts into `orders` and `order_items` (public RLS allows inserts).
- A confirmation screen shows the unique `tracking_id`.

### Kitchen dashboard (`admin.html`)
Four tabs, all behind **Supabase Auth** (email/password):

1. **Ordini (Orders)** — realtime feed of new orders (chime + toast), with
   single-click status advancement:
   `pending → preparing → in_oven → out_for_delivery → completed` (or cancel).
2. **Orari (Slots)** — manage preparation time slots: add, edit, toggle active,
   delete, and see live capacity (reserved / max pizzas).
3. **Magazzino (Inventory)** — track stock levels with low-stock warnings.
   Stock is decremented automatically when orders are placed (DB trigger).
4. **Menu** — add, edit, hide/show, and delete menu items and their categories.

### Database & security (`schema.sql`)
- Tables: `categories`, `menu_items`, `orders`, `order_items`, `profiles`,
  `slots`, `inventory`.
- **RLS policies:**
  - Public (anon): `SELECT` active menu data & active slots; `INSERT` orders &
    order items.
  - Staff (authenticated): full `SELECT`/`UPDATE`/`DELETE` on orders, menu,
    slots, and inventory.
- **Functions & triggers:**
  - `check_and_reserve_slot()` — atomically reserves slot capacity.
  - `decrement_inventory()` — trigger that reduces stock when order items are
    inserted.
- Foreign keys link `order_items → orders`, `order_items → menu_items`, and
  `orders → slots`.
- Indexes on `created_at`, `status`, `tracking_id`, `slot_id`, and foreign keys.

---

## Local preview

Because the site uses ES modules and fetches from Supabase, serve it over HTTP
(not `file://`):

```bash
cd site
python3 -m http.server 8080
# open http://localhost:8080
```