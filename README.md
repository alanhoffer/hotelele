# Hotel PMS

Sistema hotelero nuevo inspirado por los procesos relevados en CQR, sin copiar sus pantallas.

## Primer objetivo

Primer sprint funcional:

```txt
login -> dashboard -> habitaciones -> cambio de estado -> auditoria
```

## Requisitos

- Node.js 22+
- npm 10+
- Docker Desktop para PostgreSQL, Redis y MinIO

## Setup local

```bash
cp .env.example .env
npm install
docker compose -f infra/docker/docker-compose.local.yml up -d
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
npm run dev:api
npm run dev:web
```

URLs:

- Web: http://localhost:3000
- API: http://localhost:4000

Usuarios demo:

- Admin: `admin@hotel.local` / `admin123`
- Recepcion: `recepcion@hotel.local` / `recepcion123`
- Housekeeping: `housekeeping@hotel.local` / `housekeeping123`

## Principio de producto

CQR es referencia operativa, no diseño a copiar. La app se organiza por flujos reales del hotel.
