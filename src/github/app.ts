import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import fs from 'fs';
import path from 'path';

// Read the private key from the .pem file
const privateKey = fs.readFileSync(path.join(process.cwd(), 'private-key.pem'), 'utf8');

export function getOctokit(installationId: number) {
    return new Octokit({
        authStrategy: createAppAuth,
        auth: {
            appId: process.env['APP_ID']!,
            privateKey,
            installationId
        }
    });
}
