-- Esquema PostgreSQL · Sistema de cobro de agua potable (idempotente)
CREATE TABLE IF NOT EXISTS config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nombre text NOT NULL DEFAULT 'Comité de Agua Potable',
  logo_url text, moneda text NOT NULL DEFAULT 'Bs',
  vencimiento_dia int NOT NULL DEFAULT 15,
  qr_activo boolean NOT NULL DEFAULT false,
  qr_sandbox boolean NOT NULL DEFAULT true,
  qr_proveedor text NOT NULL DEFAULT 'Vendis',
  qr_url_base text, qr_api_key text,
  qr_webhook_secret text NOT NULL DEFAULT 'cambia-este-secreto'
);
CREATE TABLE IF NOT EXISTS zonas (
  id serial PRIMARY KEY, nombre text NOT NULL UNIQUE, descripcion text
);
CREATE TABLE IF NOT EXISTS socios (
  id serial PRIMARY KEY,
  nombres text NOT NULL, apellidos text NOT NULL,
  ci text NOT NULL, complemento text,
  zona_id int NOT NULL REFERENCES zonas(id),
  direccion text NOT NULL, numero text, celular text,
  tipo text NOT NULL DEFAULT 'NATURAL' CHECK (tipo IN ('NATURAL','JURIDICA')),
  activo boolean NOT NULL DEFAULT true,
  creado timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS socios_ci_idx ON socios(ci);
CREATE TABLE IF NOT EXISTS usuarios (
  id serial PRIMARY KEY, nombre text NOT NULL, email text NOT NULL UNIQUE,
  password text NOT NULL,
  rol text NOT NULL CHECK (rol IN ('ADMIN','GERENTE','LECTOR','CAJERO','SOCIO')),
  activo boolean NOT NULL DEFAULT true,
  zona_id int REFERENCES zonas(id), socio_id int UNIQUE REFERENCES socios(id),
  creado timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tarifarios (
  id serial PRIMARY KEY, nombre text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('FIJA','CONSUMO')),
  cargo_minimo numeric(10,2) NOT NULL, m3_minimos int NOT NULL DEFAULT 0,
  tramos jsonb NOT NULL DEFAULT '[]', activo boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS medidores (
  id serial PRIMARY KEY, numero text NOT NULL UNIQUE,
  socio_id int NOT NULL REFERENCES socios(id),
  tarifario_id int NOT NULL REFERENCES tarifarios(id),
  ubicacion text, lectura_inicial int NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','SUSPENDIDO','BAJA'))
);
CREATE TABLE IF NOT EXISTS lecturas (
  id serial PRIMARY KEY, medidor_id int NOT NULL REFERENCES medidores(id),
  periodo char(7) NOT NULL, anterior int NOT NULL, actual int NOT NULL, consumo int NOT NULL,
  fecha timestamptz NOT NULL DEFAULT now(), lector_id int REFERENCES usuarios(id), observacion text,
  modificaciones int NOT NULL DEFAULT 0,
  UNIQUE (medidor_id, periodo), CHECK (actual >= anterior)
);
ALTER TABLE lecturas ADD COLUMN IF NOT EXISTS modificaciones int NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS pagos (
  id serial PRIMARY KEY, socio_id int NOT NULL REFERENCES socios(id),
  total numeric(10,2) NOT NULL,
  metodo text NOT NULL CHECK (metodo IN ('EFECTIVO','QR','TRANSFERENCIA')),
  cajero_id int REFERENCES usuarios(id), fecha timestamptz NOT NULL DEFAULT now(),
  anulado boolean NOT NULL DEFAULT false, motivo_anulacion text, qr_tx_id int UNIQUE
);
CREATE TABLE IF NOT EXISTS cargos (
  id serial PRIMARY KEY, medidor_id int NOT NULL REFERENCES medidores(id),
  socio_id int NOT NULL REFERENCES socios(id), periodo char(7) NOT NULL,
  consumo int NOT NULL DEFAULT 0, base numeric(10,2) NOT NULL,
  exceso numeric(10,2) NOT NULL DEFAULT 0, total numeric(10,2) NOT NULL,
  estado text NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','PAGADO')),
  pago_id int REFERENCES pagos(id),
  UNIQUE (medidor_id, periodo)
);
CREATE INDEX IF NOT EXISTS cargos_socio_idx ON cargos(socio_id, estado);
CREATE TABLE IF NOT EXISTS proformas (
  id serial PRIMARY KEY, socio_id int NOT NULL REFERENCES socios(id),
  cargo_ids int[] NOT NULL, total numeric(10,2) NOT NULL,
  fecha timestamptz NOT NULL DEFAULT now(), vigente_hasta date NOT NULL, usuario text NOT NULL
);
CREATE TABLE IF NOT EXISTS qr_transacciones (
  id serial PRIMARY KEY, socio_id int NOT NULL REFERENCES socios(id),
  periodos text[] NOT NULL, monto numeric(10,2) NOT NULL,
  estado text NOT NULL DEFAULT 'PENDIENTE', referencia text NOT NULL, qr_payload text NOT NULL,
  cajero_id int, creado timestamptz NOT NULL DEFAULT now(), pago_id int
);
CREATE TABLE IF NOT EXISTS auditoria (
  id serial PRIMARY KEY, usuario text, accion text NOT NULL, detalle text,
  fecha timestamptz NOT NULL DEFAULT now()
);
INSERT INTO config (id) VALUES (1) ON CONFLICT DO NOTHING;
