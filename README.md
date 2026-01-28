# Emarath CRM

Production-grade Leads Management & Operations system for Emarath. Replaces legacy Airtable CRM with a scalable, multi-user, role-based, auditable, WhatsApp-native solution.

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + TanStack Query
- **Backend**: NestJS + TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Realtime**: Socket.IO WebSockets
- **Queue/Jobs**: BullMQ + Redis
- **Auth**: JWT + RBAC (role-based access control)
- **Observability**: Sentry + structured logging

## Project Structure

```
emarath-crm/
├── apps/
│   ├── api/                 # NestJS backend
│   │   └── src/
│   │       ├── auth/        # JWT auth + RBAC guards
│   │       ├── leads/       # Lead management + conversion
│   │       ├── orders/      # Order pipeline
│   │       ├── whatsapp/    # WhatsApp webhook + messaging
│   │       ├── calls/       # 3CX click-to-call
│   │       ├── complaints/  # Customer complaints
│   │       ├── feedback/    # Customer feedback
│   │       ├── delivery/    # Delivery followups
│   │       ├── staff/       # Staff management
│   │       ├── products/    # Product catalog
│   │       ├── customers/   # Customer management
│   │       ├── settings/    # EM series config
│   │       ├── audit/       # Audit logging
│   │       ├── queue/       # BullMQ job processing
│   │       └── realtime/    # WebSocket gateway
│   └── web/                 # Next.js frontend
│       └── src/
│           ├── app/         # App Router pages
│           ├── components/  # UI components
│           └── lib/         # Utilities
├── packages/
│   └── database/            # Prisma schema + migrations
└── scripts/
    └── import-csv.ts        # Airtable data migration
```

## Roles & Permissions

| Role     | Access                                                                 |
|----------|------------------------------------------------------------------------|
| Admin    | Full access, staff management, settings, reassignment, exports         |
| Agent    | Assigned leads + their WhatsApp conversations, can convert leads       |
| CS       | Complaints, customer feedback, CS remarks, view orders/leads           |
| Delivery | Delivery followups, assigned deliveries, limited order view            |

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 6+
- pnpm (recommended) or npm

### 1. Clone & Install

```bash
git clone https://github.com/your-org/emarath-crm.git
cd emarath-crm
pnpm install
```

### 2. Environment Setup

Copy the example env files and configure:

```bash
# API
cp apps/api/.env.example apps/api/.env

# Database
cp packages/database/.env.example packages/database/.env

# Web
cp apps/web/.env.example apps/web/.env
```

#### Required Environment Variables

**Database (`packages/database/.env`)**
```env
DATABASE_URL="postgresql://user:password@localhost:5432/emarath?schema=public"
```

**API (`apps/api/.env`)**
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/emarath?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# Auth
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"

# WhatsApp (Meta Cloud API)
WHATSAPP_VERIFY_TOKEN="your-webhook-verify-token"
WHATSAPP_ACCESS_TOKEN="your-whatsapp-access-token"
WHATSAPP_PHONE_NUMBER_ID="your-phone-number-id"
WHATSAPP_APP_SECRET="your-app-secret"

# 3CX
CX3_BASE_URL="https://your-3cx-pbx.com/api"
CX3_AUTH_TOKEN="your-3cx-api-token"

# Optional
PORT=3001
NODE_ENV=development
SENTRY_DSN=""
```

**Web (`apps/web/.env`)**
```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_WS_URL="http://localhost:3001"
```

### 3. Database Setup

```bash
# Generate Prisma client
cd packages/database
pnpm prisma generate

# Run migrations
pnpm prisma migrate dev

# (Optional) Seed initial data
pnpm prisma db seed
```

### 4. Start Development

```bash
# From root directory
pnpm dev
```

This starts:
- API at `http://localhost:3001`
- Web at `http://localhost:3000`

### 5. Import Legacy Data (Optional)

Export your Airtable data as CSV files, then run:

```bash
# Import in order (dependencies first)
npx ts-node scripts/import-csv.ts --type=staff --file=./data/staff.csv
npx ts-node scripts/import-csv.ts --type=products --file=./data/products.csv
npx ts-node scripts/import-csv.ts --type=customers --file=./data/customers.csv
npx ts-node scripts/import-csv.ts --type=leads --file=./data/leads.csv
npx ts-node scripts/import-csv.ts --type=orders --file=./data/orders.csv
npx ts-node scripts/import-csv.ts --type=em-series --file=./data/em-series.csv
```

## WhatsApp Integration

### Webhook Setup

1. Create a Meta Developer App with WhatsApp Business API
2. Configure webhook URL: `https://your-api.com/webhooks/whatsapp`
3. Set verify token matching `WHATSAPP_VERIFY_TOKEN`
4. Subscribe to `messages` webhook field

### Message Flow

1. Inbound message → webhook receives
2. System normalizes phone → E.164 format
3. Find/create conversation & customer
4. Find open lead or create new (status=New)
5. Assign agent via round-robin (by country)
6. Store message & push realtime update
7. Agent sees message in inbox instantly

## 3CX Click-to-Call

### Setup

1. Configure 3CX API credentials in env
2. Ensure staff have `cx3Extension` set
3. Agent clicks Call button → API triggers call
4. 3CX dials agent extension first, then customer

## EM Number Generation

Order numbers are generated atomically per country:

- Format: `{prefix}{padded_counter}` (e.g., `EMUAE0001`)
- Configure in Settings → EM Number Series
- Uses `SELECT FOR UPDATE` for concurrency safety

## Deployment

### Vercel (Web)

```bash
cd apps/web
vercel --prod
```

### Render/Fly.io (API)

```bash
# Build
cd apps/api
pnpm build

# Deploy via Render/Fly dashboard
# Set environment variables in dashboard
```

### Database

Use managed PostgreSQL:
- Render PostgreSQL
- Supabase
- Neon
- PlanetScale (MySQL mode not recommended)

### Redis

Use managed Redis:
- Upstash (serverless)
- Render Redis
- Redis Cloud

## API Endpoints

### Auth
- `POST /auth/login` - Login with email/password
- `POST /auth/register` - Register new user (admin only)
- `GET /auth/me` - Get current user

### Leads
- `GET /leads` - List leads (filtered by role)
- `GET /leads/:id` - Get lead details
- `POST /leads` - Create lead
- `PUT /leads/:id` - Update lead
- `POST /leads/:id/convert` - Convert lead to order

### Orders
- `GET /orders` - List orders
- `GET /orders/:orderKey` - Get order details
- `PUT /orders/:orderKey` - Update order
- `PUT /orders/:orderKey/cancel` - Cancel order (requires reason)

### WhatsApp
- `GET /webhooks/whatsapp` - Webhook verification
- `POST /webhooks/whatsapp` - Receive messages
- `POST /whatsapp/send` - Send outbound message
- `GET /whatsapp/conversations` - List conversations

### Calls
- `POST /calls/initiate` - Initiate 3CX call

### Staff, Products, Customers, Complaints, Feedback, Delivery
Standard CRUD endpoints for each module.

## Development

### Code Style

```bash
pnpm lint        # ESLint
pnpm format      # Prettier
```

### Testing

```bash
pnpm test        # Unit tests
pnpm test:e2e    # E2E tests
```

### Database

```bash
cd packages/database
pnpm prisma studio      # Visual database browser
pnpm prisma migrate dev # Create migration
```

## License

Private - Emarath © 2024
