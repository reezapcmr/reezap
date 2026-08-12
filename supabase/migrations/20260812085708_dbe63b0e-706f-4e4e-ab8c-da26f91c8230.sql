
ALTER TABLE public.listings DISABLE TRIGGER USER;

WITH vend AS (
  SELECT id, town_id, neighborhood_id, row_number() OVER (ORDER BY username) rn, count(*) OVER () n
  FROM public.profiles WHERE is_vendor AND town_id IS NOT NULL
), cat AS (
  SELECT id, name, row_number() OVER (ORDER BY name) rn, count(*) OVER () n FROM public.categories
), items AS (
  SELECT * FROM (VALUES
    ('Fresh plantains bunch','Sweet ripe plantains harvested this morning from our farm. Perfect for frying or roasting.',2500,'/seed/produce.jpg'),
    ('Garden eggs basket','Crunchy garden eggs, freshly picked. Sold per small basket, delivery around town.',1500,'/seed/produce.jpg'),
    ('Bunch of sweet bananas','Naturally ripened bananas, no chemicals. Great for kids snack and smoothies.',1000,'/seed/produce.jpg'),
    ('Fresh tilapia fish','Caught this morning at the beach. Cleaned and ready for pepper soup or grill.',3500,'/seed/fish.jpg'),
    ('Grilled fish plate','Hot grilled fish with plantain and pepper sauce. Order now, ready in 20 minutes.',4000,'/seed/fish.jpg'),
    ('Smoked bonga fish','Well smoked and dry, keeps for weeks. Sold in bundles of ten pieces.',5000,'/seed/fish.jpg'),
    ('Ankara two-piece set','Custom sewn Ankara top and skirt. Bright wax print, all sizes available.',15000,'/seed/fashion.jpg'),
    ('Men senator wear','Clean senator style in quality material. Sewn to your measurement in three days.',20000,'/seed/fashion.jpg'),
    ('Ladies office gown','Elegant gown for work or church. Comes in navy, black and wine colours.',18000,'/seed/fashion.jpg'),
    ('Knotless braids','Neat knotless braids done in my salon or at your house. Extensions included.',8000,'/seed/hair.jpg'),
    ('Weave-on installation','Professional weave installation with frontal closure. Book a slot for this week.',12000,'/seed/hair.jpg'),
    ('Kids hair styling','Cute styles for children, gentle handling and free hair treatment after.',3000,'/seed/hair.jpg'),
    ('Phone screen replacement','Original screens for iPhone, Tecno, Infinix and Samsung. Fixed while you wait.',25000,'/seed/phones.jpg'),
    ('Used Tecno Camon clean','Neatly used phone, battery still strong, no scratch. Charger included.',60000,'/seed/phones.jpg'),
    ('Laptop and phone charging accessories','Cables, adapters and power banks at friendly prices. Quality guaranteed.',5000,'/seed/phones.jpg'),
    ('Tailoring and repairs','Trouser hems, zippers and full outfits. Fast service, quality finishing.',3000,'/seed/tailor.jpg'),
    ('School uniform sewing','Uniforms sewn for all schools around. Bulk orders for parents welcome.',7000,'/seed/tailor.jpg'),
    ('Wedding outfit sewing','Complete traditional wedding attire for groom and bride family. Book early.',45000,'/seed/tailor.jpg')
  ) t(title, descr, price, img)
), n AS (SELECT generate_series(1,300) i)
INSERT INTO public.listings
  (vendor_id, title, description, price, category_id, town_id, neighborhood_id,
   media_url, media_urls, status, view_count, whatsapp_click_count, created_at, updated_at, expires_at)
SELECT
  v.id,
  it.title,
  it.descr,
  round(it.price * (0.8 + ((n.i * 7) % 9) / 10.0) / 100.0) * 100,
  c.id,
  v.town_id,
  v.neighborhood_id,
  it.img,
  ARRAY[it.img],
  CASE WHEN n.i % 11 = 0 THEN 'sold_out_today'::listing_status ELSE 'in_stock'::listing_status END,
  (n.i * 13) % 240,
  (n.i * 5) % 40,
  now() - ((n.i % 40) * interval '1 hour') - ((n.i % 7) * interval '3 minutes'),
  now(),
  now() + interval '48 hours' - ((n.i % 40) * interval '1 hour')
FROM n
JOIN vend v ON v.rn = (n.i % v.n) + 1
JOIN cat c ON c.rn = (n.i % c.n) + 1
JOIN items it ON true
WHERE (n.i % 18) + 1 = (SELECT count(*) FROM items i2 WHERE i2.title <= it.title);

ALTER TABLE public.listings ENABLE TRIGGER USER;
