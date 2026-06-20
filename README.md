# Ledger — Personal Money Tracker

A single-page dashboard that reads and writes to **your own Google Sheet**.
No backend, no paid services, no third-party server ever touches your data —
it's just this HTML page talking directly to a tiny script running on your
Google account.

## What you get
- One page (`index.html`) — works on phone, laptop, tablet, anywhere
- Add expenses/income/investments/FD/interest entries
- Category breakdown bar + chart, month-over-month trend chart
- All data lives in a Google Sheet you control

---

## Setup (about 5 minutes, one time only)

### 1. Create the Google Sheet
- Go to sheets.google.com → Blank sheet.
- Name it whatever you like, e.g. "Money Ledger".
- You don't need to set up columns yourself — the script does it.

### 2. Add the backend script
- In the Sheet, go to **Extensions → Apps Script**.
- Delete any starter code in the editor.
- Open `AppsScript.gs` (included alongside this file) and paste its entire
  contents into the editor.
- Click the **disk/save icon**.

### 3. Deploy it as a web app
- Click **Deploy → New deployment**.
- Click the gear icon next to "Select type" → choose **Web app**.
- Settings:
  - **Execute as:** Me
  - **Who has access:** "Only myself" (most private — but then the page
    will ask you to log into Google each time on a new device), or
    "Anyone with the link" (no login prompt, but treat the URL like a
    password — anyone with it can read/write your sheet).
- Click **Deploy**.
- Google will ask you to authorize — click through (you'll see an
  "unverified app" warning since this is your own personal script; click
  **Advanced → Go to [project name] (unsafe)** — this is safe because you
  wrote/pasted the code yourself).
- Copy the **Web app URL** it gives you. It looks like:
  `https://script.google.com/macros/s/AKfycb.../exec`

### 4. Connect the dashboard
- Open `index.html` (either locally or once it's hosted on GitHub Pages).
- Paste the Web App URL into the box at the top labeled
  "Paste your Google Apps Script Web App URL here".
- Click **Connect**.

You're live. Add an entry from the form — it'll show up in your Google
Sheet's "Entries" tab instantly, and vice versa: typing directly into the
Sheet will show up here after you click Refresh.

---

## Hosting it free on GitHub Pages

1. Create a new GitHub repo (public or private — Pages works on both for
   free if your account supports private Pages, otherwise make it public;
   the Sheet URL is your only real secret, and the page doesn't expose it
   to anyone unless you've shared your browser's local storage).
2. Upload `index.html` to the repo (root folder is fine).
3. Go to repo **Settings → Pages**.
4. Under "Build and deployment", set **Source: Deploy from a branch**,
   branch: `main`, folder: `/ (root)`. Save.
5. Wait ~1 minute, then visit the URL GitHub gives you, something like:
   `https://yourusername.github.io/your-repo-name/`

That URL works from your phone, laptop, or tablet — bookmark it. The
Apps Script URL you pasted is remembered in that browser's local storage,
so you'll paste it once per browser/device.

---

## Importing your existing spreadsheet history

Your old data (the monthly category sheet and the FD/investment sheet) can
be copied straight into the **Entries** tab the script creates, using this
column format:

| id | date | type | category | amount | note |
|----|------|------|----------|--------|------|

- `id` — leave blank for old rows you paste manually, or generate any
  unique text
- `date` — format `YYYY-MM-DD` (e.g. `2026-01-15`)
- `type` — one of: `expense`, `income`, `investment`, `fd`, `interest`
- `category` — e.g. `Food`, `EMI`, `Gift`, `Cab/Metro`
- `amount` — plain number, no ₹ symbol
- `note` — optional

So a row from your old sheet like "Food, January, 596" becomes:
`(blank) | 2026-01-01 | expense | Food | 596 | `

You don't need exact days if you only tracked by month — the 1st of the
month works fine for monthly totals and the trend chart.

---

## Files in this folder
- `index.html` — the dashboard itself, deploy this to GitHub Pages
- `AppsScript.gs` — paste this into your Sheet's Apps Script editor
- `README.md` — this file
