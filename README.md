<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

# Ecommerce Delivery Backend

A production-ready backend for multi-vendor e-commerce with real-time delivery orchestration. Built with NestJS, PostgreSQL, Prisma, and Socket.IO — designed around event-driven architecture, role-separated WebSocket gateways, and an intelligent batch engine.

> **Status:** In active development · Deployment in progress

---

## What This System Does

This backend powers a delivery platform where **vendors** receive and prepare orders, **deliverers** pick up and complete deliveries, and **customers** track everything in real time. An **admin** oversees the entire operation.

The system handles the full order lifecycle — from creation and vendor eligibility checks, through intelligent batch grouping of nearby orders, to deliverer assignment and live GPS tracking.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│   Clients: Customer · Vendor · Deliverer · Admin          │
└───────────────┬──────────────────┬───────────────────────┘
                │  REST            │  WebSocket
                ▼                  ▼
┌──────────────────────────────────────────────────────────┐
│   NestJS API Gateway                                      │
│   JWT Auth Guards · Role-based Access Control (4 roles)   │
└──────┬──────────────┬──────────────┬──────────┬──────────┘
       │              │              │          │
       ▼              ▼              ▼          ▼
  OrderService  DelivererJob   WS Gateways  AuthService
  BatchEngine   Service        vendor /     JWT + Roles
                               deliverer /
                               customer
       │              │              │
       └──────────────┴──────────────┘
                       │
                       ▼
          ┌─────────────────────────┐
          │  PostgreSQL + Prisma    │
          │  Event Log (immutable   │
          │  append-only audit)     │
          └─────────────────────────┘
```

---

## Key Technical Decisions

### 1. Event Log as Immutable Audit Trail

Every state change — order created, vendor marked ready, job started, drop-off completed — is recorded as an immutable event. This gives the system:

- Full timeline reconstruction for any order or delivery job
- Debugging without needing to reproduce state
- Foundation for future analytics and replay on reconnect

```typescript
await this.eventLogService.record({
  type: EventType.ORDER_CREATED,
  actorId: vendor.id,
  resourceId: order.id,
  metadata: { batchId, productCategories },
});
```

### 2. Batch Engine for Delivery Efficiency

Orders are not assigned to deliverers one by one. The system groups nearby orders into batches before triggering assignment — reducing trips and increasing throughput.

A batch closes when any of these conditions are met:
- Time window exceeded (configurable per `CITY_TYPE`)
- Maximum batch size reached
- Delay threshold triggered

```
New order arrives
      │
      ▼
Open batch exists for this area?
      ├── Yes → Add to batch → Close conditions met? → Assign deliverer
      └── No  → Create new batch
```

### 3. Role-Separated WebSocket Gateways

Instead of one monolithic gateway, each role has its own namespace with dedicated authentication and room logic. A customer token cannot connect to the vendor namespace — the gateway rejects it on handshake.

| Gateway | Namespace | Key Events |
|---|---|---|
| `VendorGateway` | `/vendor` | `order:new`, `order:ready` |
| `CustomerGateway` | `/customer` | `order:update`, `delivery:completed` |
| `DelivererGateway` | `/deliverer` | `job:start`, `dropoff:complete`, `location:update` |

Reconnect replay is supported — clients receive missed events on reconnection via the session/replay service.

### 4. Delivery Job as a State Machine

A delivery job moves through explicit states. Invalid transitions are rejected at the service level.

```
PENDING → ASSIGNED → IN_PROGRESS → COMPLETED
                          │
                    (per stop: completeDropOff)
```

### 5. Timeline Projections

Beyond the raw event log, the system builds structured `OrderTimeline` and `JobTimeline` projections — queryable snapshots of each entity's history, useful for client-facing status views without replaying all events.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | NestJS (TypeScript) | Modular architecture, DI, built-in WebSocket + guards |
| Database | PostgreSQL 16 | Relational integrity, JSONB for event metadata |
| ORM | Prisma | Type-safe queries, schema-as-source-of-truth, migrations |
| Real-time | Socket.IO (via NestJS) | Namespaces per role, reconnect/replay support |
| Auth | JWT + Passport | Stateless, role claims in token payload |
| Infra | Docker Compose + Nginx | Reproducible deploys, reverse proxy, DB persistence |

---

## Features

- JWT-based authentication and role-aware access control
- User management for `ADMIN`, `VENDOR`, `DELIVERER`, and `CUSTOMER`
- Vendor profiles and product catalog management
- Order creation with vendor eligibility validation
- Delivery batching engine with configurable thresholds
- Deliverer job assignment and state transitions
- Real-time communication over Socket.IO (3 namespaces)
- Reconnect replay and session context on gateway reconnect
- Event log persistence and timeline projections
- Global validation, exception handling, and guards

---

## Project Structure

```
server/
  src/
    auth/               # JWT strategy, guards, role decorator
    users/              # User profile operations
    vendor/             # Vendor profile + vendor WebSocket gateway
    product/            # Product and catalog logic
    order/              # Order lifecycle, batch engine, ready flow
    deliverer/          # Job lifecycle + deliverer WebSocket gateway
    admin/              # Admin operations
    common/
      events/           # Event log recording
      timeline/         # Order and job timeline projections
      websocket/        # Reconnect, session, replay support
    prisma/             # PrismaService
  prisma/
    schema.prisma
    seed.ts
```

---

## Data Model

```
User (CUSTOMER | VENDOR | DELIVERER | ADMIN)
  ├── VendorProfile → Product
  ├── Order → OrderItem → Product
  │     ├── EventLog (append-only)
  │     ├── OrderTimeline (projection)
  │     └── DeliveryBatch → DeliveryJob
  └── DeliveryJob
        ├── DeliveryDropOff (one per order in batch)
        ├── EventLog
        └── JobTimeline (projection)
```

See `server/prisma/schema.prisma` for the full schema.

---

## API Overview

### Auth
| Method | Endpoint | Access |
|---|---|---|
| POST | `/auth/register` | Public |
| POST | `/auth/login` | Public |

### Orders
| Method | Endpoint | Access |
|---|---|---|
| POST | `/orders` | Customer |
| GET | `/orders/:id` | Customer, Vendor, Admin |
| PATCH | `/orders/:id/ready` | Vendor (own orders only) |

### Delivery Jobs
| Method | Endpoint | Access |
|---|---|---|
| POST | `/jobs/:id/start` | Deliverer (assigned only) |
| POST | `/jobs/:id/stops/:stopId/complete` | Deliverer (active job only) |
| GET | `/jobs/:id/tracking` | Customer (own order only) |

### WebSocket Events (Deliverer Gateway)

| Event | Direction | Description |
|---|---|---|
| `job:start` | Client → Server | Start an assigned job |
| `job:started` | Server → Client | Job confirmed, stops returned |
| `dropoff:complete` | Client → Server | Mark a stop as delivered |
| `delivery:completed` | Server → Client | Entire job finished |
| `location:update` | Client → Server | Live GPS coordinates |
| `session.context` | Server → Client | Replay on reconnect |

---

## Running Locally

**Requirements:** Docker and Docker Compose

```bash
# Clone
git clone https://github.com/Mhamd021/your-repo.git
cd your-repo

# Configure environment
cp server/.env.example server/.env
# Edit server/.env with your values

# Start everything
docker-compose up --build

# Run migrations
docker compose exec app npx prisma migrate deploy

# Optional: seed data
docker compose exec app npx prisma db seed
```

**Without Docker:**

```bash
cd server
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

**Minimum `.env` required:**

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mydb
JWT_SECRET=your_secret_here
PORT=3000
CITY_TYPE=MEDIUM
```

---

## Scripts

```bash
npm run start:dev     # development with hot reload
npm run build         # production build
npm run start:prod    # run production build
npm run test          # unit tests
npm run test:cov      # coverage report
npm run test:e2e      # end-to-end tests
```

---

## Testing

The project uses Jest and Supertest. Current coverage includes starter unit and E2E specs.

Highest-value areas for future coverage (in priority order):

1. `OrderService` — vendor eligibility, batching rules, deliverer assignment
2. `DelivererJobService` — state transitions, drop-off completion, job closing
3. WebSocket gateways — auth on connect, room joining, event emission
4. Auth flows — registration, login, token validation

---

## What I Would Improve Next

- **Test coverage:** Unit tests for `OrderService` and `DelivererJobService` state machines. E2E tests for the 5 critical flows (register → order → ready → job start → drop-off complete).
- **Job queue:** Move deliverer assignment from synchronous to Bull/BullMQ to handle load gracefully.
- **Rate limiting:** Per-role limits on WebSocket gateways to prevent event flooding.
- **Observability:** Structured logging with correlation IDs across the full order lifecycle.
- **API documentation:** OpenAPI/Swagger spec generated from NestJS decorators.
- **CI pipeline:** GitHub Actions for linting, tests, and Prisma schema checks on every push.

---

## Contributing

1. Create a feature branch
2. Make focused, well-scoped changes
3. Add or update tests where relevant
4. Open a pull request with a clear summary of what changed and why

---

## Related

- [3D T-shirt Design Tool](https://github.com/Mhamd021/3d-tshirt-tool) — NestJS + Three.js + Blender
- [Portfolio](https://mhamd021.github.io)