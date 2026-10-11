# E-Commerce Delivery Backend

Backend for a multi-vendor delivery platform with four roles: customer, vendor, deliverer and admin. Orders are grouped into delivery batches, assigned to the nearest available deliverer, and tracked in real time over WebSockets. Built with NestJS, PostgreSQL (Prisma), Redis and Socket.IO.

> **Status:** backend only. Runs under Docker Compose (Nginx → NestJS → PostgreSQL + Redis). Deployment is in progress.

The focus of this project is correctness under failure: what happens when two requests race, when a worker crashes halfway, or when a deliverer loses signal. The decisions below are written with their trade-offs, and the limitations are listed openly at the end.

---

## How an order moves through the system

1. **Create.** A customer creates an order. The vendor must be active and verified. The order, its event and its timeline row are written in one transaction, then the vendor is notified over WebSocket.
2. **Ready.** The vendor marks the order ready. A conditional update claims the order (a double click gets a `409`), then the order joins a pending batch or opens a new one. The batching step runs under a Postgres advisory lock. All of this commits together with the event.
3. **Batch closes** when it reaches its size limit or its time window ends. A delayed BullMQ job closes each batch on time, and a one-minute sweep closes any batch whose timer was lost.
4. **Assignment.** A BullMQ worker picks the nearest deliverer who is available, online and recently seen, using the live position from Redis with a database fallback. It claims the batch and the deliverer atomically, creates the job and its drop-offs, and records `JOB_ASSIGNED` in the same transaction.
5. **Delivery.** The deliverer connects to the `/deliverer` namespace and receives a context snapshot plus any missed events. They start the job and complete stops. Completing the last stop finishes the stop, the job, the batch and the deliverer's availability in one transaction.
6. **Recovery.** Unstarted jobs held by a deliverer who went offline return to the pool. Started jobs are escalated for manual intervention instead of being reassigned. Batches that are stuck without a deliverer are requeued when someone becomes free, and by a periodic sweep.

---

## Architecture

```
  Customer · Vendor · Deliverer · Admin
        │ REST            │ WebSocket (3 namespaces)
        ▼                 ▼
  ┌──────────────────────────────────┐
  │ Nginx (TLS, WebSocket upgrade)   │
  └───────────────┬──────────────────┘
                  ▼
  ┌──────────────────────────────────────────────────────┐
  │ NestJS                                               │
  │  JWT + roles · global validation · rate limiting     │
  │  OrderService (batching) · DelivererJobService       │
  │  DelivererAssignmentService · Recovery sweeps        │
  │  EventLogService → timeline projections              │
  └──────┬───────────────────────────────┬───────────────┘
         ▼                               ▼
  PostgreSQL (Prisma)                  Redis
  orders, batches, jobs, stops,        BullMQ queues, live locations,
  event log, timelines                 rate-limit counters
```

---

## Key engineering decisions

### State changes and their events commit together
Every state change records an event, and both are written in one Prisma transaction. `EventLogService.recordEvent` and the projection services accept an optional transaction client, so the event and its timeline row join the caller's transaction. A service called inside `$transaction` does not join it automatically; only queries made through the `tx` client do. If any step fails, nothing is committed.

### Event log with replayable projections (not full event sourcing)
Current state lives on the order, job and batch rows. The immutable event log and the `OrderTimeline` and `JobTimeline` projections run alongside it for auditability and cheap history reads. This is event logging with CQRS-style read models, not event sourcing. Each timeline row carries a unique `sourceEventId`, and projection uses `ON CONFLICT DO NOTHING`, so projecting the same event twice is harmless and the timelines can be rebuilt from the log.

### Concurrency control without long locks
- **Claims:** job start, batch claim and deliverer claim are single conditional `updateMany` calls whose `WHERE` clause is the check. A count of zero means someone else won.
- **Batching:** a transaction-scoped advisory lock serializes "find an open batch or create one", so simultaneous ready orders cannot create duplicate batches.
- **Drop-offs:** a row lock on the job serializes stop completions, so two stops finishing at the same moment cannot each see the other as pending. The stop's `jobId` is part of the `WHERE` clause, so a deliverer cannot complete a stop that belongs to another job.

### Queues are an optimization, the database is the truth
Assignment and batch timeouts run on BullMQ with retries and exponential backoff. Because a queue and a database cannot share a transaction, every queue step has a sweep behind it: expired pending batches are closed, and batches stuck without a deliverer are requeued. A lost Redis job delays dispatch but cannot strand an order. Work that happens after a commit is wrapped so a failure there is logged and never reported as a failed request.

### Reconnect with snapshot and replay
On connect, a deliverer receives `session.context` (active job and stops) and `events.replay` (events since they were last seen). Replay is computed before the presence update, because marking the user online overwrites the timestamp replay depends on. Presence comes from a heartbeat. Assignment only considers deliverers who are online and seen within two minutes.

### Location data: Redis first, Postgres behind
Live positions are written to Redis with a 30-second TTL on every update. They are persisted to Postgres on disconnect, when a job completes, and every five minutes. Reads are cache-aside: Redis first, database as the fallback. Assignment ranks deliverers by the freshest available position.

### Rate limiting
Redis-backed throttler storage using an atomic `INCR`, so a burst of requests is counted exactly. A read-then-write counter undercounts under the bursts it exists to stop. The tracker verifies the JWT signature before using the user id, and falls back to the IP address. Defaults are 10 requests per minute, and 5 login attempts per 15 minutes.

### Role-separated WebSocket gateways
Customer, vendor and deliverer each have their own namespace with JWT verification on the handshake and a role check, so a customer token cannot connect to the deliverer namespace.

### Batching rules
Window length, maximum batch size (smaller for food) and the allowed extra delay come from `CITY_TYPE` (`SMALL`, `MEDIUM`, `LARGE`). Batches are single-vendor by default. Multi-vendor batching exists behind `ALLOW_MULTI_VENDOR_BATCHING` and is off until pickup stops are modelled (see below).

---

## Tech stack

| Layer | Technology | Role |
|---|---|---|
| Framework | NestJS (TypeScript) | Modules, dependency injection, guards, gateways |
| Database | PostgreSQL + Prisma | State, event log, projections |
| Queue and cache | Redis + BullMQ | Jobs, live locations, rate-limit counters |
| Real-time | Socket.IO | Role namespaces, replay, live tracking |
| Auth | JWT + Passport | Role claims, handshake auth |
| Infra | Docker Compose + Nginx | Reproducible environment, TLS, reverse proxy |

---

## API

### HTTP
| Method | Path | Access |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | Public |
| POST | `/order/:vendorId` | Customer |
| PATCH | `/order/markeReady/:orderId` | Vendor (own orders) |
| GET | `/deliverer/me` | Deliverer |
| PATCH | `/deliverer/me` | Deliverer |
| GET | `/deliverer/jobs?status=` | Deliverer |
| GET | `/deliverer/:userId` | Admin |

### WebSocket, `/deliverer` namespace
| Event | Direction | Purpose |
|---|---|---|
| `session.context` | server → client | Active job and stops on connect |
| `events.replay` | server → client | Events missed while offline |
| `job:assigned` | server → client | A job was assigned |
| `job:start` / `job:started` | client → server / reply | Start an assigned job |
| `dropoff:complete` / `dropoff:completed` | client → server / reply | Complete a stop |
| `delivery:started`, `delivery:completed` | server → job room | Progress for customers tracking the job |
| `location:update` | client → server | Live position |
| `session.heartbeat` | client → server | Presence |
| `job:error`, `dropoff:error` | server → client | Failure reason |

---

## Running locally

Requirements: Docker and Docker Compose.

```bash
git clone https://github.com/Mhamd021/Mesyaf-Market.git
cd Mesyaf-Market
cp .env.example .env          # fill in the values
docker compose up -d --build
npx prisma migrate deploy     # run from your host, see the note below
npx prisma db seed            # optional test data
```

**Two database URLs.** The hostname `postgres` only exists inside Docker's network. Prisma commands you run on your machine need `localhost`; the app inside the container needs `postgres`. Keep `.env` (host) and `.env.docker` (container) separate, and point the `server` service at `.env.docker` in `docker-compose.yml`.

The code runs from the compiled `dist` folder inside the container. After changing code, rebuild with `docker compose up -d --build`.

HTTPS locally uses a self-signed certificate. Accept the browser warning once.

**Manual test client.** `tools/deliverer-socket-tester.html` is a single-file page for the deliverer namespace. It connects with a deliverer token and lets you start jobs, complete stops, drop the connection and watch replay.

### Environment variables
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mydb   # "postgres" instead of localhost in .env.docker
JWT_SECRET=change_me
PORT=3000
CITY_TYPE=MEDIUM                      # SMALL | MEDIUM | LARGE
ALLOW_MULTI_VENDOR_BATCHING=false
REDIS_HOST=localhost                  # "redis" inside Docker
REDIS_PORT=6379
```

---

## Verified so far

Checked by hand against the running stack:

- Full lifecycle: order, ready, batch, assignment, start, stops, completion
- Reconnect with context snapshot and event replay
- A deliverer who comes back receives the batch that was waiting for one
- An unstarted job held by an offline deliverer returns to the pool
- A forced failure inside a transaction rolls back every step

There are no automated tests yet. The concurrency safeguards above (claims, advisory lock, row lock) are covered by design and by manual runs, not by a test suite.

---

## Known limitations and planned work

- **Multi-vendor batches need pickup stops.** A job currently has drop-offs only, so batches are single-vendor by default. Planned: a `DeliveryPickup` row per vendor in a job, ordered nearest-first, with drop-offs unlocked once every pickup is complete.
- **Drop-off order is the order orders joined the batch,** not an optimized route.
- **Assignment has no accept timeout.** A deliverer who stays connected but never starts a job keeps it, and recovery only reacts to going offline. Fixing this properly needs a per-batch exclusion list so the job does not return to the same deliverer.
- **A started job is never reassigned automatically.** It is escalated for a human to decide, because the deliverer may already be carrying the goods.
- **WebSockets run on a single instance.** Scaling out needs the Socket.IO Redis adapter so events reach clients connected to other instances.
- **JWT claims go stale when a role changes** (for example promoting a user to deliverer). The user has to log in again.
- **No automated test suite** (see above). First targets: concurrent mark-ready, double start, and concurrent last-stop completion.

---

## Related

- [Waitless](https://github.com/Mhamd021/waitless): real-time queue management with BullMQ, MongoDB event log and capability-URL tokens
- [3D T-shirt design tool](https://github.com/Mhamd021/3d-tshirt-tool): NestJS, Three.js and provider-abstracted AI suggestions
- [Portfolio](https://mhamd021.github.io)