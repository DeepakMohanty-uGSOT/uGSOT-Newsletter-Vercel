-- Adds an optional custom_html column to themes: when set, the newsletter
-- send/preview logic uses this raw HTML (with {{name}}, {{email}}, {{title}},
-- {{topic}}, {{description}} placeholders substituted) instead of the
-- built-in template, so a theme can fully control markup, not just colors.
ALTER TABLE themes ADD COLUMN IF NOT EXISTS custom_html TEXT;
