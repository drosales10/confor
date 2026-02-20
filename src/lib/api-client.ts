type ApiClientOptions = RequestInit & {
  token?: string;
};

async function request<T>(url: string, options: ApiClientOptions = {}) {
  const headers = new Headers(options.headers ?? {});
  headers.set("Content-Type", "application/json");
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(url, { ...options, headers });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error ?? "Request failed");
  }

  return payload as T;
}

export function apiGet<T>(url: string, options?: ApiClientOptions) {
  return request<T>(url, { ...options, method: "GET" });
}

export function apiPost<T>(url: string, body?: unknown, options?: ApiClientOptions) {
  return request<T>(url, { ...options, method: "POST", body: JSON.stringify(body ?? {}) });
}

export function apiPatch<T>(url: string, body?: unknown, options?: ApiClientOptions) {
  return request<T>(url, { ...options, method: "PATCH", body: JSON.stringify(body ?? {}) });
}

export function apiDelete<T>(url: string, options?: ApiClientOptions) {
  return request<T>(url, { ...options, method: "DELETE" });
}
