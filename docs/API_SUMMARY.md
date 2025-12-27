# API Summary — Concise

This file lists API endpoints whose request/response shapes were changed or require frontend attention.
Keep it short and actionable.

**Error format (common)**:
- Body: `{ message: string }`
- Status codes: `400` validation, `401` unauthorized, `403` forbidden, `404` not found, `500` server error

---

**Auth**
- POST `/api/auth/login`
  - Request: `{ email, password }`
  - 200: `{ token, user: { _id, name, email, role, avatar?, designation? } }`
  - 400/401/403: `{ message }

- POST `/api/auth/change-password`
  - Request: `{ currentPassword, newPassword }` (must be >= 6)
  - 200: `{ message: 'Password updated successfully' }`

---

**Users**
- GET `/api/users?search&role&status&page&limit`
  - Response: `200 { data: [user], page, limit, total }`
  - Note: `user` objects exclude `password`. Admins may see more fields.

- GET `/api/users/:id`
  - Response: `200 user` or `404 { message }`

- POST `/api/users` (Admin)
  - Request: `{ name, email, password, role, designation, phone }`
  - 201: `{ message: 'User created successfully', user }`

- PUT `/api/users/:id`
  - 200: `{ message: 'User updated successfully', user }`

- DELETE `/api/users/:id` (soft-delete)
  - 200: `{ message: 'User deactivated successfully' }`

---

**Customers**
- GET `/api/customers?search&owner&page&limit`
  - 200: `{ data: [customer], page, limit, total }`

- GET `/api/customers/:id`
  - 200: `customer` (populated owner fields) or `403/404` errors

- POST `/api/customers` (Admin/Manager manual create)
  - 201: `{ message: 'Customer created manually', customer }`

- PUT `/api/customers/:id`
  - 200: `{ message: 'Customer updated successfully', customer }`

Notes:
- `createCustomerFromDeal` (server-side) copies lead -> customer when a deal is WON.

---

**Follow-ups**
- GET `/api/followups?status&from&to&assignedTo&page&limit`
  - 200: `{ data: [followup], page, limit, total }`
  - Important: Server may set `status: 'overdue'` in the response even if DB stores `status: 'pending'`.
    Frontend should treat `overdue` as a valid status value.

- POST `/api/leads/:leadId/followups`
  - Request: `{ type, scheduledAt, note, assignedTo? }`
  - 201: `{ message: 'Follow-up created successfully', followup: { _id, status } }`

- PATCH `/api/followups/:id/complete`
  - Request: `{ result, nextFollowup?: { scheduledAt, note, type? } }`
  - 200: `{ message: 'Follow-up updated successfully', newFollowUp?: { _id, status } }`

- GET `/api/leads/:leadId/followups`
  - 200: `[]` (array of followups for that lead)

---

**Notes & Activities**
- POST `/api/leads/:leadId/notes`
  - 201: `{ message: 'Note added successfully', note }`

- GET `/api/leads/:leadId/notes`
  - 200: `[]` (array of notes)

- GET `/api/leads/:leadId/activities`
  - 200: `[]` (array of timeline items: `{ type, message, createdAt }`)

---

**Deals**
- GET `/api/deals` (filters allowed)
  - 200: `[]` (array of deals)

- POST `/api/deals`
  - Request: `{ leadId, title, value, currency, stage?, expectedCloseDate, owner? }`
  - 201: `{ message: 'Deal created successfully', deal: { _id, stage } }`

- PATCH `/api/deals/:id/stage`
  - Request: `{ stage }` (must be valid; use `/close` to finalize)
  - 200: `{ message: 'Deal stage updated', deal: { _id, stage } }`

- PATCH `/api/deals/:id/close`
  - Request: `{ status: 'WON' | 'LOST', reason }`
  - 200: `{ message: 'Deal closed successfully', deal: { _id, stage, closedAt } }`
  - Side-effect: if `WON`, lead is converted and customer is created server-side.

---

**Reports**
- Query param support: `from=YYYY-MM-DD&to=YYYY-MM-DD` (optional). When provided, server uses them as the Current Period.

- GET `/api/reports/overview?from&to`
  - 200: `{ totalLeads, pipelineValue, newLeads, wonDeals, lostDeals, wonValue, winRate, prevWonValue, prevLeads, prevWinRate }`

- GET `/api/reports/sales-performance?from&to`
  - 200: `[{ user: {_id,name}, leadsAssigned, dealsWon, wonValue, conversionRate }, ...]`

- GET `/api/reports/conversion-rate?from&to`
  - 200: `{ totalLeadsCreated, dealsWon, dealsLost, overallConversionRate }`

- GET `/api/reports/lost-reasons?from&to`
  - 200: `[{ reason, count }, ...]`

---

**Notifications (brief)**
- GET `/api/notifications` → 200: array of notifications
- PATCH `/api/notifications/:id/read` → 200: `{ message: 'Notification marked as read' }`

---

Notes for frontend integration
- Prefer reading list endpoints from `res.body.data` (and fallback to `res.body`) to support both shapes.
- For create/update endpoints, read the new/updated resource from the wrapper fields (e.g., `res.body.user`, `res.body.deal`, `res.body.customer`). Also display `res.body.message` to the user as feedback.
- Always handle error responses by showing `res.body.message` when present.

If you want, I can:
- produce an OpenAPI (JSON) file for these endpoints, or
- generate example fetch wrappers that handle both old and new shapes.

File: `docs/API_SUMMARY.md`
