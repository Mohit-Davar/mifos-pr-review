import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";

export function getOctokit(installationId: number) {
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: process.env["APP_ID"]!,
      privateKey: process.env["GITHUB_PRIVATE_KEY"]!,
      installationId,
    },
  });
}
