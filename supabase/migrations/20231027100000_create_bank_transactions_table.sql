CREATE TABLE bank_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id TEXT REFERENCES saved_analyses(id),
  old_status TEXT,
  new_status TEXT,
  bet_amount NUMERIC,
  potential_return NUMERIC,
  bank_difference NUMERIC,
  old_bank NUMERIC,
  new_bank NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
);