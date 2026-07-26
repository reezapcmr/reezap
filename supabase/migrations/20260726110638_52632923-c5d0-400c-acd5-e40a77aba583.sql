
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_listing_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

INSERT INTO public.categories (slug, name, name_fr, emoji, sort_order) VALUES
 ('food','Food & Produce','Nourriture','🍲',1),
 ('fashion','Fashion & Clothing','Mode','👗',2),
 ('beauty','Beauty & Hair','Beauté','💇',3),
 ('electronics','Electronics & Phones','Électronique','📱',4),
 ('home','Home & Furniture','Maison','🛋️',5),
 ('services','Services & Repairs','Services','🔧',6),
 ('tailoring','Tailoring','Couture','🧵',7),
 ('drinks','Drinks & Snacks','Boissons','🥤',8),
 ('farm','Farm & Livestock','Ferme','🐓',9),
 ('other','Other','Autre','✨',10);

WITH t AS (
  INSERT INTO public.towns (division, name, sort_order) VALUES
   ('Fako','Buea',1),('Fako','Limbe',2),('Fako','Tiko',3),('Fako','Muyuka',4),('Fako','West Coast',5),
   ('Meme','Kumba',6),('Meme','Konye',7),('Meme','Mbonge',8),
   ('Kupe-Muanenguba','Bangem',9),('Kupe-Muanenguba','Tombel',10),
   ('Ndian','Mundemba',11),('Ndian','Ekondo-Titi',12),('Ndian','Isangele',13),('Ndian','Toko',14),
   ('Manyu','Mamfe',15),('Manyu','Eyumojock',16),('Manyu','Akwaya',17),('Manyu','Upper Bayang',18)
  RETURNING id, name
)
INSERT INTO public.neighborhoods (town_id, name)
SELECT t.id, n.name FROM t JOIN (VALUES
 ('Buea','Molyko'),('Buea','Great Soppo'),('Buea','Buea Town'),('Buea','Bokwoango'),('Buea','Mile 16'),('Buea','Mile 17'),('Buea','Muea'),('Buea','Bomaka'),('Buea','GRA'),
 ('Limbe','Down Beach'),('Limbe','Mile 4'),('Limbe','Middle Farms'),('Limbe','Bota'),('Limbe','Church Street'),('Limbe','Unity Quarters'),('Limbe','New Town'),
 ('Tiko','Tiko Town'),('Tiko','Likomba'),('Tiko','Mudeka'),
 ('Muyuka','Muyuka Town'),('Muyuka','Ediki'),
 ('Kumba','Fiango'),('Kumba','Kumba Town'),('Kumba','Middle Farms'),('Kumba','Buea Road'),('Kumba','Mbeng'),
 ('Mamfe','Mamfe Central'),('Mamfe','Mfuni')
) AS n(town, name) ON n.town = t.name;
