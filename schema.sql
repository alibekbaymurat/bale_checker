CREATE TABLE IF NOT EXISTS bale_groups (
  id TEXT PRIMARY KEY,
  mowing_date TEXT NOT NULL,
  baling_date TEXT NOT NULL,
  moisture_min_percent REAL NOT NULL,
  moisture_max_percent REAL NOT NULL,
  cut_number_this_year INTEGER NOT NULL,
  cut_number_total INTEGER NOT NULL,
  crop_type TEXT NOT NULL,
  field_name TEXT NOT NULL,
  bales_count INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bale_groups_baling_date
ON bale_groups (baling_date);

CREATE INDEX IF NOT EXISTS idx_bale_groups_field_name
ON bale_groups (field_name);
