import * as core from "@actions/core";
import { DEFAULT_MODEL, getConfig, openai } from "@src/shared";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod/v4";

/** HTTP/API errors that expose a status code. */
interface ErrorWithStatus extends Error {
  /** The HTTP status code of the error. */
  status: number;
}

/** The maximum number of times to retry a failed API call. */
const MAX_RETRIES = 3;
/** The initial delay in milliseconds before the first retry. */
const INITIAL_RETRY_DELAY_MS = 1000;
/** A set of HTTP status codes that indicate a transient, retryable error. */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/**
 * Checks if an error is a retryable API error.
 * Retryable errors are typically transient network issues or server-side problems.
 * @param error - The error to check.
 * @returns `true` if the error is an `ErrorWithStatus` and its status code is in `RETRYABLE_STATUS_CODES`.
 */
function isRetryableError(error: unknown): error is ErrorWithStatus {
  return (
    error instanceof Error &&
    "status" in error &&
    RETRYABLE_STATUS_CODES.has((error as ErrorWithStatus).status)
  );
}

/**
 * Pauses execution for a specified number of milliseconds.
 * @param ms - The number of milliseconds to sleep.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calls the OpenAI API with a structured response schema and automatic retries.
 * This function handles transient errors by implementing an exponential backoff strategy.
 *
 * @template T The expected type of the parsed response.
 * @param systemPrompt - The system prompt to guide the LLM's behavior.
 * @param userMessage - The user's message or query.
 * @param schema - The Zod schema to validate and parse the LLM's response.
 * @param schemaName - The name of the schema, used for formatting the request.
 * @returns A promise that resolves with the parsed response data.
 * @throws An error if the request fails after all retry attempts.
 */
export async function callWithRetry<T>(
  systemPrompt: string,
  userMessage: string,
  schema: z.ZodType<T>,
  schemaName: string
): Promise<T> {
  const model = getConfig().review?.model || DEFAULT_MODEL;
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await openai.responses.parse({
        input: [
          {
            content: systemPrompt,
            role: "system",
          },
          {
            content: userMessage,
            role: "user",
          },
        ],
        model,
        text: {
          format: zodTextFormat(schema, schemaName),
        },
      });
      if (!response.output_parsed) {
        throw new Error("Received an empty structured response from the LLM.");
      }
      return response.output_parsed;
    } catch (error) {
      lastError = error;
      const shouldRetry = isRetryableError(error) && attempt < MAX_RETRIES;
      if (!shouldRetry) {
        throw new Error(`LLM request failed after ${attempt} attempt(s).`, {
          cause: error,
        });
      }
      const delay = INITIAL_RETRY_DELAY_MS * 2 ** (attempt - 1);
      core.warning(
        `LLM request failed (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${delay}ms.`
      );
      await sleep(delay);
    }
  }
  throw new Error(`LLM request failed after ${MAX_RETRIES} attempts.`, {
    cause: lastError,
  });
}
