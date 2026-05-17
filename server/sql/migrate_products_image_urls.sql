-- products: image_url (text) -> image_urls (text[])
-- Запустите целиком в SQL Editor Supabase.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_urls text[];

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'image_url'
  ) THEN
    UPDATE public.products
    SET image_urls =
      CASE
        WHEN image_url IS NOT NULL AND trim(image_url) <> '' THEN ARRAY[trim(image_url)]::text[]
        ELSE COALESCE(image_urls, ARRAY[]::text[])
      END;

    ALTER TABLE public.products DROP COLUMN image_url;
  END IF;
END $$;

UPDATE public.products
SET image_urls = ARRAY[]::text[]
WHERE image_urls IS NULL;

ALTER TABLE public.products
  ALTER COLUMN image_urls SET DEFAULT ARRAY[]::text[],
  ALTER COLUMN image_urls SET NOT NULL;
