import * as core from "@actions/core";

/**
 * Logs an error message and sets the GitHub Action to a failed state.
 * This function ensures that the action terminates with a clear failure message.
 *
 * @param contextMessage - A message describing the context in which the error occurred.
 * @param error - The error that was thrown. Can be of any type.
 */
export function exitFailedAction(contextMessage: string, error: unknown): void {
  let details: string;
  if (error instanceof Error) {
    details = error.message;
    if (error.cause) {
      let causeMessage: string;
      if (error.cause instanceof Error) {
        causeMessage = error.cause.message;
      } else {
        causeMessage = String(error.cause);
      }
      details += `\nCause: ${causeMessage}`;
    }
    if (error.stack) {
      core.debug(error.stack);
    }
  } else {
    details = String(error);
  }
  const message = `${contextMessage}: ${details}`;

  core.error(message);
  core.setFailed(message);
}
