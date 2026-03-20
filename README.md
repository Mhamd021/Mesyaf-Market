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

# E-Commerce Delivery Backend

A production-ready backend system for multi-vendor e-commerce with real-time delivery tracking. Built with NestJS, PostgreSQL, and WebSockets — designed around event-driven architecture and a clear domain model.

> **Status:** In active development · Deployment in progress

---

## What This System Does

This backend powers a delivery platform where **vendors** receive and prepare orders, **deliverers** pick up and complete deliveries, and **customers** track everything in real time. An **admin** oversees the entire operation.

The system handles the full order lifecycle — from creation and vendor eligibility checks, through intelligent batch grouping of nearby orders, to deliverer assignment and live GPS tracking.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Clients: Customer · Vendor · Deliverer · Admin          │
└──────────────┬──────────────────┬───────────────────────┘
               │  REST            │  WebSocket
               ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│  NestJS API Gateway                                      │
│  JWT Auth Guards · Role-based Access Control             │
└──────┬────────────┬─────────────┬────────────┬──────────┘
       │            │             │            │
       ▼            ▼             ▼            ▼
  OrderService  DelivererJob  WS Gateways  AuthService
  BatchEngine   Service       (3 roles)    JWT + Roles
       │            │             │
       └────────────┴─────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │  PostgreSQL + Prisma  │
        │  Event Log (append-   │
        │  only audit trail)    │
        └───────────────────────┘
```

---

## Key Technical Decisions

### 1. Event Log as Audit Trail

Every state change in the system — order created, vendor marked ready, job started, drop-off completed — is recorded as an immutable event. This gives us:

- Full timeline reconstruction for any order or delivery job
- Debugging without needing to reproduce state
- Foundation for future analytics or replay

```typescript
// Every significant action appends an event
await this.eventLogService.record({
  type: EventType.ORDER_CREATED,
  actorId: vendor.id,
  resourceId: order.id,
  metadata: { batchId, productCategories },
});
```

### 2. Batch Engine

Orders aren't assigned to deliverers one by one. The system groups nearby orders into batches before assignment, reducing delivery trips and increasing efficiency.

A batch closes when any of these conditions are met:
- Time window exceeded (configurable)
- Maximum batch size reached
- Delay threshold triggered

```
New order arrives
      │
      ▼
Is there an open batch for this area/vendor?
      │
   ┌──┴──┐
  Yes    No
   │      └──► Create new batch
   │
   ▼
Add to existing batch
      │
      ▼
Close conditions met? ──► Trigger deliverer assignment
```

### 3. Role-Separated WebSocket Gateways

Instead of one monolithic gateway, each role has its own gateway with its own authentication and room logic:

| Gateway | Namespace | Rooms |
|---|---|---|
| `VendorGateway` | `/vendor` | `vendor:{id}` |
| `CustomerGateway` | `/customer` | `order:{id}` |
| `DelivererGateway` | `/deliverer` | `deliverer:{id}` |

Each gateway validates the JWT and role on connection — a customer token cannot connect to the vendor namespace.

### 4. Deliverer Job as State Machine

A delivery job moves through explicit states. Invalid transitions are rejected at the service level, not just the controller.

```
PENDING ──► ASSIGNED ──► IN_PROGRESS ──► COMPLETED
                              │
                         (per stop)
                         completeDropOff()
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | NestJS (TypeScript) | Dependency injection, modular architecture, built-in WebSocket support |
| Database | PostgreSQL 16 | Relational integrity for order/job relationships, JSONB for event metadata |
| ORM | Prisma | Type-safe queries, migration management, schema-as-source-of-truth |
| Real-time | Socket.IO via NestJS | Role-based namespaces, reconnection handling, event replay |
| Auth | JWT + Passport | Stateless, role claims in payload, guard-based protection |
| Containerization | Docker + Docker Compose | Reproducible environments, Nginx reverse proxy, PostgreSQL with persistent volume |

---

## Domain Model

```
User (role: CUSTOMER | VENDOR | DELIVERER | ADMIN)
  │
  ├── Order
  │     ├── OrderItem → Product → Category (FOOD | GROCERY)
  │     ├── EventLog (append-only)
  │     └── Batch → DeliveryJob
  │
  └── DeliveryJob
        ├── JobStop (one per order in batch)
        └── EventLog
```

The `Category` type on products drives the batch detection logic — FOOD and GROCERY orders follow different batching rules.

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
| Event | Direction | Payload |
|---|---|---|
| `job:start` | Client → Server | `{ jobId }` |
| `job:started` | Server → Client | `{ job, stops }` |
| `dropoff:complete` | Client → Server | `{ jobId, stopId }` |
| `delivery:completed` | Server → Client | `{ jobId, completedAt }` |
| `location:update` | Client → Server | `{ lat, lng }` |

---

## Running Locally

**Requirements:** Docker and Docker Compose

```bash
# Clone the repository
git clone https://github.com/Mhamd021/your-backend-repo.git
cd your-backend-repo

# Copy environment variables
cp .env.example .env

# Start everything (app + postgres + nginx)
docker compose up -d --build

# Run database migrations
docker compose exec app npx prisma migrate deploy

# The API is now available at http://localhost:3000
```

**Environment variables (`.env.example`):**

```env
DATABASE_URL="postgresql://user:password@db:5432/delivery_db"
JWT_SECRET="your-secret-here"
NODE_ENV=development
PORT=3000
```

---

## Project Structure

```
src/
├── auth/               # JWT strategy, guards, role decorator
├── orders/             # OrderService, OrderController, BatchEngine
├── delivery-jobs/      # DelivererJobService, job state transitions
├── gateways/
│   ├── vendor.gateway.ts
│   ├── customer.gateway.ts
│   └── deliverer.gateway.ts
├── event-log/          # Append-only event recording
├── users/              # User management, role assignment
├── prisma/             # PrismaService, schema
└── common/             # Guards, decorators, interceptors
```

---

## What I Would Improve Next

- **Testing:** Unit tests for `OrderService` and `DelivererJobService` (business rules and state transitions). E2E tests for the 5 critical flows.
- **Queue-based assignment:** Move deliverer assignment from synchronous to a job queue (Bull/BullMQ) to handle high load gracefully.
- **Rate limiting:** Per-role rate limiting on the WebSocket gateways.
- **Observability:** Structured logging with correlation IDs across the order lifecycle.

---

## Related

- [3D T-shirt Design Tool](https://github.com/Mhamd021/3d-tshirt-tool) — NestJS + Three.js + Blender
- [Portfolio](https://mhamd021.github.io)