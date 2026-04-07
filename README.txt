HELVETIA DOORS PWA - v2.6.0
============================

What's new in 2.6.0
-------------------
- Schema rebuilt for delivery + installation tracking (no measurement workflow)
- 6-component installation checklist per door:
    Frame, Shutter, Architraves, Hinges, Lock & handle, Door stopper
- Status auto-derives from checklist:
    PENDING -> DELIVERED -> IN_PROGRESS -> INSTALLED  (+ SNAGGED)
- Dashboard with status counts + per-floor progress bars
- Doors list with filters: floor / apt / type / status / search
- Inline door detail with one-tap toggles
- seed.sql with all 1740 doors and 12 type presets pre-generated
  from DOOR_TABLE_FOR_APP.xlsx

Setup
-----
1) Paste your Supabase anon key:
     src/config.js  ->  SUPABASE_ANON_KEY

2) Create tables + load doors in Supabase:
     Dashboard -> SQL Editor -> New query -> paste schema.sql -> Run
     New query -> paste seed.sql -> Run
     (RLS is disabled by schema.sql for testing.)

3) Run locally:
     npm install
     npm run dev
     -> http://localhost:5173

4) Build for deploy:
     npm run build
     -> drag the 'dist' folder to Netlify

Notes
-----
- QR scanner, photo upload, and signature pad are not in 2.6.0.
  The DB tables (door_photos, door_signoffs) exist for the next iteration.
- Floor is stored as int (Ground=0, Floor 01=1, ...) plus a floor_label
  text column with the original "Floor 01" string for display.
- Apt numbers are stored as text (one non-numeric apt: "Watchman Room").
