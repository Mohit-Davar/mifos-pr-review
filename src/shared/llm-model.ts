import * as core from "@actions/core";
import { encodingForModel } from "js-tiktoken";
import OpenAI from "openai";

/** The default LLM model to use for all API calls. */
export const DEFAULT_MODEL = "gpt-5-mini";

/** An instance of the OpenAI client, configured with the API key from GitHub Actions inputs. */
export const openai = new OpenAI({
  apiKey: core.getInput("openai-api-key"),
});

/** A tokenizer instance used for counting tokens in strings, configured for the default model. */
export const tokenizer = encodingForModel(DEFAULT_MODEL);
