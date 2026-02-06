import { Hono } from "hono";
import { handleReview } from "@src/features/pr/controller/pr.controller";

const prReviewRoute = new Hono();

prReviewRoute.post("/review", handleReview);

export default prReviewRoute;