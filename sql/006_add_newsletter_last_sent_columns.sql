-- Track who most recently triggered a send for each newsletter, and when,
-- so the newsletter detail page can show "Last sent by ... on ..." without
-- having to query the audit log. Full send-by-send history (every admin who
-- has ever sent this newsletter, not just the most recent) lives in
-- audit_logs (action = 'newsletter.send', target_type = 'newsletter').
ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS last_sent_by_admin_email TEXT;
ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ;
