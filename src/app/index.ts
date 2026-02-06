import "dotenv/config";
import { Hono } from "hono";
import prReviewRoute from "@src/features/pr/route/pr.route";
import { verifyGitHubWebhook } from "@src/shared/api/middleware/webhook-middleware";

const app = new Hono();

app.use("/webhook/*", verifyGitHubWebhook);
app.route("/webhook/pr", prReviewRoute);

export default app;