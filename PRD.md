# Product Requirements Document (PRD)

**Project Name:** Social Content Automation Scheduler
**Version:** 1.0
**Target Audience (For this PRD):** AI Development Agents / Junior Fullstack Developers
**Project Category:** Fullstack Web Application (Intermediate+)

## 1. Executive Summary

This project aims to build a SaaS-style scheduling dashboard where users can compose rich-text social media posts, attach media, and schedule them for future publication. The core engineering challenge and focus is demonstrating mastery over asynchronous backend workflows (queues, workers, retries) and maintaining synchronized state on the frontend.

This is not a simple CRUD app. It is an Identity and Access Management (IAM) secured platform with Role-Based Access Control (RBAC) and Attribute-Based Access Control (ABAC), utilizing a background worker architecture.

## 2. Technology Stack (Strict Requirements)

### Infrastructure & Monorepo Setup:
* **Monorepo:** Both frontend and backend must reside in a single repository.
* **Docker:** `docker-compose.yml` required at the root for provisioning all services (Next.js, NestJS, MongoDB, and Redis) simultaneously.
* **CI/CD:** GitHub Actions configured for automated linting and build validation on push/PR.

### Backend (`/backend`):
* **Framework:** NestJS (Strict TypeScript).
* **Primary Database:** MongoDB (via `@nestjs/mongoose`). Chosen for flexible schema payloads (text, images, carousels).
* **Message Broker / Cache:** Redis (via `ioredis`).
* **Queue System:** BullMQ (via `@nestjs/bullmq`).
* **Authentication:** JWT (JSON Web Tokens) with short-lived Access Tokens and long-lived Refresh Tokens.
* **Media Storage:** Local file system (initially, via NestJS built-in Multer interceptors) within `/backend/uploads`.

### Frontend (`/frontend`):
* **Framework:** Next.js (App Router, Strict TypeScript). No `any` types allowed.
* **Styling:** Tailwind CSS + shadcn/ui.
* **Form Management & Validation:** React Hook Form + Zod.
* **Server State (Data Fetching):** TanStack Query (`@tanstack/react-query`).
* **Client State (Global):** Zustand.

## 3. Core Features & MVP Requirements

### 3.1. Authentication & Security
* **User Management:** Email/password registration and login. Passwords must be hashed using bcrypt or argon2.
* **Session Management:** Implement a `/refresh` endpoint. Store only the hash of the refresh token in a `Sessions` MongoDB collection.
* **Workspaces & Invitations:** Users must be able to create a Workspace. The creator becomes the 'owner'. Include an invitation flow to add other users to the workspace.
* **Data Security (Encryption at Rest):** OAuth tokens (even mock ones) and sensitive connected account secrets must be encrypted at rest in MongoDB using AES-256-CBC to demonstrate enterprise security mindset.

### 3.2. Authorization (RBAC & ABAC)
* **Workspace Roles (RBAC):** Users belong to workspaces with roles: `owner`, `editor`, or `viewer`.
* **Resource Ownership (ABAC):** An editor can only modify or delete a post if their `userId` matches the post's `authorId`, OR if the business logic explicitly allows editors global modification rights within that workspace. (Strictly implement ABAC guards in NestJS).
* **UI Constraints:** The frontend must disable editing controls (buttons, form fields) if the active user's role is `viewer`.

### 3.3. Content Composition & Media
* **Post Creation:** Users can compose posts containing text and media.
* **Mock OAuth:** Implement a mock flow connecting to a simulated social provider.
* **Media Upload & Progress:** Provide an endpoint to upload images. Validate file types. The frontend must display upload progress.

### 3.4. The Scheduling Engine (The Core Feature)
* **Scheduling:** Users set a date, time, and timezone for publication.
* **Queueing:** When a post is scheduled, the backend must update the MongoDB document status to `scheduled` and push a job to the BullMQ Redis queue with a calculated delay.
* **Worker Process:** A separate NestJS processor (`@Processor`) listens to the queue.
* **Simulated Execution & Backoff:** When the job runs, simulate a 20% failure rate using `Math.random()`.
  * **If success:** Update MongoDB status to `published`.
  * **If failure:** Throw an error. BullMQ must be configured to automatically retry (e.g., 3 attempts) using an exponential backoff strategy. Update MongoDB status to `failed` only after all retries are exhausted.

### 3.5. Dashboard & Real-time State
* **List View:** Display all posts categorized by status (`draft`, `scheduled`, `published`, `failed`).
* **Polling/Real-time:** The frontend must use TanStack Query with a `refetchInterval` (e.g., every 3-5 seconds) to poll the backend. When the background worker changes a post's status in MongoDB, the UI must update automatically without a manual page refresh.
* **Optimistic UI:** When a user clicks "Schedule", the UI should immediately reflect the "Scheduled" state while the backend request is in flight.

### 3.6. Portfolio Plus (Bonus Features)
* **Drag-and-Drop Calendar:** Reschedule posts via a drag-and-drop calendar interface.
* **Dead-letter Queue View:** A dedicated view for jobs that permanently failed after all retries.
* **Webhook Callbacks:** Handle webhook callbacks from the mock social platform.
* **Multi-image Carousels:** Support for scheduling multi-image carousel posts.
* **Analytics Charts:** Mock analytics charts for each post.
* **AI Captions (Optional):** AI-assisted caption generation.
* **Rich Audit Trails:** Context-aware activity logs (e.g., "User A scheduled this post for tomorrow").
* **DevOps Ready:** `docker-compose up` runs the entire stack, accompanied by a CI pipeline.

## 4. Data Modeling (MongoDB Schemas)

AI Agents must use these baseline schemas when generating Mongoose models:

### 1. User Collection:
* `_id`: ObjectId
* `email`: String (Unique)
* `passwordHash`: String
* `createdAt`: Date

### 2. Session Collection:
* `_id`: ObjectId
* `userId`: ObjectId (Ref 'User')
* `refreshTokenHash`: String
* `expiresAt`: Date

### 3. Workspace Collection:
* `_id`: ObjectId
* `name`: String
* `members`: Array of Objects `[{ userId: ObjectId, role: Enum['owner', 'editor', 'viewer'] }]`

### 4. Post Collection:
* `_id`: ObjectId
* `workspaceId`: ObjectId (Ref 'Workspace')
* `authorId`: ObjectId (Ref 'User')
* `content`: String (Optional)
* `mediaUrls`: Array of Strings
* `status`: Enum `['draft', 'scheduled', 'published', 'failed']` (Default: 'draft')
* `scheduledAt`: Date (Optional)
* `retryCount`: Number (Default: 0)

### 5. AuditLog Collection:
* `_id`: ObjectId
* `postId`: ObjectId (Ref 'Post')
* `action`: String (e.g., 'publish_attempt', 'publish_success', 'publish_failed')
* `timestamp`: Date
* `details`: String

## 5. Development Phases & AI Agent Prompts

Agents must execute these phases sequentially. Do not proceed to the next phase until the Acceptance Criteria (AC) of the current phase are met.

### Phase 1: Infrastructure & NestJS Initialization
* **Goal:** Setup Docker (Mongo+Redis) and initialize the NestJS backend monorepo folder.
* **AC:** `docker-compose.yml` runs successfully. NestJS app boots on port 5000 and connects to Mongo and Redis without errors.

### Phase 2: Auth, Sessions, and Guards
* **Goal:** Implement JWT rotation and NestJS Guards for RBAC/ABAC.
* **AC:** `/auth/login` returns short-lived Access and long-lived Refresh tokens. `RolesGuard` and `OwnershipGuard` are created and testable.

### Phase 3: Post CRUD & Media Upload
* **Goal:** Build endpoints to manage posts and upload files via Multer.
* **AC:** `POST /posts/upload` saves files locally. `POST /posts` creates a draft. Endpoints are protected by Guards from Phase 2.

### Phase 4: BullMQ Scheduler & Worker
* **Goal:** Implement the asynchronous queue and simulated publishing logic.
* **AC:** `POST /posts/:id/schedule` adds a job to BullMQ with a delay. The processor simulates API calls, handles 20% failure rates, applies exponential backoff, and updates MongoDB statuses accordingly.

### Phase 5: Next.js Dashboard & TanStack Query Polling
* **Goal:** Build the strict-TypeScript frontend.
* **AC:** Forms use Zod validation. The dashboard fetches posts and uses `refetchInterval` to auto-update statuses visually (using distinct colored badges for draft/scheduled/published/failed) as the backend worker processes them.

## 6. Testing Requirements (Backend)
* **Unit Tests:** Jest specs required for `AuthService` (validating error handling on bad credentials) and Custom Guards (validating ABAC logic).
* **E2E Tests:** Supertest script to validate the flow: Register -> Login -> Create Post -> Attempt Unauthorized Edit -> Schedule Post.

## 7. Technical Responsibilities (Proving Mastery)
* **Backend Responsibilities:** Manage JWT token rotation, implement workspace-level RBAC, validate media uploads and storage keys, queue tasks using Redis/BullMQ, perform retries with exponential backoff, track publishing attempts in audit logs, rate-limit activity, separate API and worker processes, and expose API for status checks.
* **Frontend Responsibilities:** Build authenticated dashboard layouts, clearly render status badges, display list and calendar views, utilize Optimistic UI when scheduling posts, show upload progress, disable edit controls for Viewer roles, and handle real-time status updates without page refreshes.

## 8. Value Proposition for Recruiters
Building this system proves to recruiters that the candidate can build a real product workflow where frontend state and asynchronous backend tasks must remain consistent. This project goes beyond a cliché dashboard, combining UI workflows with heavy backend responsibilities.