// Vercel serverless function: POST /api/review
import { handleReview } from "../lib/http.js";

export const config = { maxDuration: 120 };

export default function handler(req, res) {
  return handleReview(req, res);
}
