-- Catálogo base: si la BD nunca recibió `prisma db seed`, las categorías quedan vacías y el front no puede crear productos.
-- Idempotente: ON CONFLICT DO NOTHING por slug único.

INSERT INTO "ProductCategory" ("name", "slug")
VALUES
  ('Paneles fotovoltaicos', 'paneles-fotovoltaicos'),
  ('Inversores on-grid', 'inversores-on-grid'),
  ('Inversores híbridos', 'inversores-hibridos'),
  ('Inversores off-grid', 'inversores-off-grid'),
  ('Baterías', 'baterias'),
  ('Estructuras', 'estructuras'),
  ('Protecciones AC', 'protecciones-ac'),
  ('Protecciones DC', 'protecciones-dc'),
  ('Cables', 'cables'),
  ('Conectores', 'conectores'),
  ('Tableros', 'tableros'),
  ('Monitoreo', 'monitoreo'),
  ('Mano de obra', 'mano-de-obra'),
  ('Ingeniería', 'ingenieria'),
  ('Transporte', 'transporte'),
  ('Obras civiles', 'obras-civiles'),
  ('Permisos', 'permisos'),
  ('Otros', 'otros')
ON CONFLICT ("slug") DO NOTHING;
