import 'dotenv/config';

import { Hono } from 'hono';

import { verifyGitHubWebhook } from '@src/github/middleware';
import { handlePullRequest } from '@src/github/pr';

const app = new Hono();

app.post("/webhook", verifyGitHubWebhook, async (c) => {
    const event = c.req.header("X-GitHub-Event");
    if (event === "pull_request") {
        const payload = await c.req.json();
        await handlePullRequest(payload);
    }
    c.status(200)
    return c.text("OK")
});

app.post("/health", (c) => {
    return c.text("OK");
});

export default app;
