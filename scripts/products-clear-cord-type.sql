-- =====================================================================
-- Clear cord_type on all products so the new fallback ("Adjustable cord,
-- 17-19"") shows on every product page where the admin hasn't set a
-- specific value.
-- =====================================================================
-- Run once in Supabase SQL editor. Safe to re-run.
--
-- After this: every product page reads cord_type as NULL → falls back
-- to the new default copy in components/ProductPageContent.js. You can
-- then set per-product values via the admin form's new "Cord / chain
-- type" input where the default isn't right.
-- =====================================================================

UPDATE products SET cord_type = NULL;
