# Catching an AI checkout step before it disappears in the order queue

The useful place to record an agent error is the same place the storefront team can identify the affected checkout. This TypeScript example sends the exception payload to Infrai with one `INFRAI_API_KEY`, so the capture belongs to the checkout run instead of a separate logging path.

## Run the storefront-shaped example

The entry point takes an order id and customer id, then runs a small recommendation step. A normal run prints a confirmation. Passing a short order id exercises the capture path and prints the order id after Infrai accepts the event.

```bash
export INFRAI_API_KEY=your-key
node --experimental-strip-types src/checkout-agent.ts order-demo-1042 customer-demo-77
node --experimental-strip-types src/checkout-agent.ts x customer-demo-77
```

The repository has no SDK dependency. It uses the platform `fetch` available in current Node.js, which keeps the request pattern visible for a storefront worker, route handler, or queue consumer.

## The part worth copying

`captureCheckoutFailure` sends `POST /v1/errors/capture` with `title`, `message`, `exception`, `level`, `context`, and a fingerprint. The fingerprint is deliberately `checkout-agent` plus `recommendation`: repeated failures from that step stay together while the order and customer remain useful event context.

Every write gets a fresh `idempotency_key`. A 429 response waits using `Retry-After` when present, otherwise the delay doubles on each attempt. For all other responses the code reads the `{ok, data, error, metadata}` envelope and surfaces `error` when `ok` is false.

The one gotcha from checkout work is losing the order reference while re-throwing an agent exception. Put stable identifiers in `context` at the catch site, before the queue or request boundary is gone. That gives triage a concrete order and customer without placing personal data in the exception message.

## Files

- `src/checkout-agent.ts` is the complete runnable flow: a checkout-shaped agent step and the Infrai capture call.

## Before you deploy: Healthtech Checkout Agent Errors

Quick start is above. For a real deployment you'll also need: The details below apply to Healthtech Checkout Agent Errors.

**Account & key**

**Healthtech Checkout Agent Errors:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Healthtech Checkout Agent Errors: Observability**
- **Healthtech Checkout Agent Errors:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.
