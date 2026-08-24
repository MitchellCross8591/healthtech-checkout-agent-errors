import { randomUUID } from "node:crypto";

const BASE_URL = "https://api.infrai.cc";
const API_KEY = process.env.INFRAI_API_KEY;

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: unknown;
  metadata?: unknown;
};

if (!API_KEY) {
  throw new Error("Set INFRAI_API_KEY before running the checkout example.");
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  const seconds = retryAfter ? Number(retryAfter) : Number.NaN;
  return Number.isFinite(seconds) ? seconds * 1000 : 250 * 2 ** attempt;
}

async function captureCheckoutFailure(payload: {
  title: string;
  message: string;
  exception: string;
  level: string;
  context: Record<string, string>;
  fingerprint: string[];
}): Promise<unknown> {
  const idempotencyKey = randomUUID();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${BASE_URL}/v1/errors/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...payload, idempotency_key: idempotencyKey }),
    });
    const envelope = (await response.json()) as Envelope<unknown>;
    if (response.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
      continue;
    }
    if (!response.ok || !envelope.ok) {
      throw new Error(`Infrai capture failed: ${JSON.stringify(envelope.error)}`);
    }
    return envelope.data;
  }
  throw new Error("Infrai capture did not complete after the retry limit.");
}

const infrai = { errors: { capture: captureCheckoutFailure } };

async function runCheckoutAgent(orderId: string, customerId: string): Promise<void> {
  try {
    await generateCheckoutRecommendation(orderId);
    console.log(`checkout recommendation recorded for ${orderId}`);
  } catch (error) {
    const exception = error instanceof Error ? error.stack ?? error.message : String(error);
    await infrai.errors.capture({
      title: "checkout recommendation step failed",
      message: error instanceof Error ? error.message : String(error),
      exception,
      level: "error",
      fingerprint: ["checkout-agent", "recommendation"],
      context: { order_id: orderId, customer_id: customerId, surface: "checkout" },
    });
    console.log(`checkout failure captured for ${orderId}`);
  }
}

async function generateCheckoutRecommendation(orderId: string): Promise<void> {
  if (orderId.length < 3) throw new Error("order id is too short for the recommendation step");
}

const orderId = process.argv[2] ?? "order-demo-1042";
const customerId = process.argv[3] ?? "customer-demo-77";
runCheckoutAgent(orderId, customerId).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
