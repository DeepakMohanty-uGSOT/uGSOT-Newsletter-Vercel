-- The Themes admin UI now edits a theme's HTML directly (see
-- 003_add_theme_custom_html.sql) instead of separate color pickers, so the
-- old color columns are no longer required on new/updated themes. Relax
-- them to nullable; existing rows and their values are untouched.
ALTER TABLE themes ALTER COLUMN header_gradient_start DROP NOT NULL;
ALTER TABLE themes ALTER COLUMN header_gradient_end DROP NOT NULL;
ALTER TABLE themes ALTER COLUMN accent_color DROP NOT NULL;
ALTER TABLE themes ALTER COLUMN footer_color DROP NOT NULL;
