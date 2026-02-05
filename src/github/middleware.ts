import crypto from 'crypto';
import type { MiddlewareHandler } from 'hono';

import { expectError } from '@src/lib/expectError';

export const verifyGitHubWebhook: MiddlewareHandler = async (c, next) => {
  const secret = process.env['WEBHOOK_SECRET'];
  if (!secret) {
    console.error("WEBHOOK_SECRET environment variable not set.");
    return c.text("Internal Server Error", 500);
  }

  const signature = c.req.header('x-hub-signature-256');
  if (!signature) {
    console.warn('Missing webhook signature.');
    return c.text('Missing webhook signature', 401);
  }

  // Clone the request to read the body, so the original body stream is not consumed and can be read again by c.req.json() in the route handler.
  const body = await c.req.raw.clone().text();

  const hmac = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  const expectedSignature = `sha256=${hmac}`;

  const [error, valid] = await expectError(Promise.resolve().then(() =>
    crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  ));

  if (error || !valid) {
    console.warn('Invalid webhook signature detected.');
    return c.text('Invalid webhook signature', 401);
  }

  await next();
};
