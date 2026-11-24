import type { FormProperties } from "@gcforms/types";
import type { AccessTokenManager } from "../auth/token-manager.js";
import type { EncryptedSubmission, NewSubmission } from "../types.js";
import { fetchWithRetry, checkedJson } from "./retry.js";

export class FormsApiClient {
  private readonly templateCache = new Map<number, Promise<FormProperties>>();

  public constructor(
    private readonly apiUrl: string,
    private readonly formId: string,
    private readonly tokenManager: AccessTokenManager,
  ) {}

  public getNewSubmissions(): Promise<NewSubmission[]> {
    return this.request(`/forms/${encodeURIComponent(this.formId)}/submission/new`);
  }

  public getSubmission(name: string): Promise<EncryptedSubmission> {
    return this.request(`/forms/${encodeURIComponent(this.formId)}/submission/${encodeURIComponent(name)}`);
  }

  public getTemplate(version: number): Promise<FormProperties> {
    let template = this.templateCache.get(version);
    if (!template) {
      template = this.request<FormProperties>(
        `/forms/${encodeURIComponent(this.formId)}/template?version=${encodeURIComponent(String(version))}`,
      );
      this.templateCache.set(version, template);
      template.catch(() => this.templateCache.delete(version));
    }
    return template;
  }

  public async confirmSubmission(name: string, confirmationCode: string): Promise<void> {
    const response = await this.requestResponse(
      `/forms/${encodeURIComponent(this.formId)}/submission/${encodeURIComponent(name)}/confirm/${encodeURIComponent(confirmationCode)}`,
      { method: "PUT" },
    );
    if (!response.ok) await checkedJson<void>(response);
  }

  private async request<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
    return checkedJson<T>(await this.requestResponse(endpoint, init));
  }

  private async requestResponse(endpoint: string, init: RequestInit = {}): Promise<Response> {
    const url = `${this.apiUrl}${endpoint}`;
    let token = await this.tokenManager.getToken();
    let response = await this.send(url, init, token);
    if (response.status === 401) {
      token = await this.tokenManager.getToken(true);
      response = await this.send(url, init, token);
    }
    return response;
  }

  private send(url: string, init: RequestInit, token: string): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return fetchWithRetry(
      url,
      {
        ...init,
        headers,
      },
      { attempts: 4 },
    );
  }
}
