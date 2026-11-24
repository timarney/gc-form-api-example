import { createPrivateKey } from "node:crypto";
import { SignJWT } from "jose";
import type { PrivateApiKey } from "../types.js";
import { fetchWithRetry } from "../api/retry.js";

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
}

export class AccessTokenManager {
  private cachedToken: string | undefined;
  private expiresAt = 0;
  private pending: Promise<string> | undefined;

  public constructor(
    private readonly identityProviderUrl: string,
    private readonly projectId: string,
    private readonly apiKey: PrivateApiKey,
  ) {}

  public async getToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh && this.cachedToken && Date.now() < this.expiresAt - 60_000) {
      return this.cachedToken;
    }
    if (!this.pending) {
      this.pending = this.createToken().finally(() => {
        this.pending = undefined;
      });
    }
    this.cachedToken = await this.pending;
    return this.cachedToken;
  }

  private async createToken(): Promise<string> {
    const key = createPrivateKey({ key: this.apiKey.key });
    const assertion = await new SignJWT()
      .setProtectedHeader({ alg: "RS256", kid: this.apiKey.keyId })
      .setIssuedAt()
      .setIssuer(this.apiKey.userId)
      .setSubject(this.apiKey.userId)
      .setAudience(this.identityProviderUrl)
      .setExpirationTime("1 minute")
      .sign(key);

    const response = await fetchWithRetry(
      `${this.identityProviderUrl}/oauth/v2/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion,
          scope: `openid profile urn:zitadel:iam:org:project:id:${this.projectId}:aud`,
        }),
      },
      { attempts: 4 },
    );
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Identity provider returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
    }
    const data = (await response.json()) as TokenResponse;
    if (!data.access_token) throw new Error("Identity provider returned no access token");
    this.expiresAt = Date.now() + (data.expires_in ?? 1800) * 1000;
    return data.access_token;
  }
}
