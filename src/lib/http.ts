export function withBearer(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
  };
}

export async function readResponseJson(response: Response) {
  return response.json().catch(() => ({}));
}
