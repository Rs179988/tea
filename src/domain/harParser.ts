import { TrafficEntry, ParsedRequest, ParsedResponse, HttpMethod } from './types.js';

export function parseHarContent(rawHarJson: string | object): TrafficEntry[] {
  const data = typeof rawHarJson === 'string' ? JSON.parse(rawHarJson) : rawHarJson;

  if (!data || !data.log || !Array.isArray(data.log.entries)) {
    throw new Error('Invalid HAR format: Missing log.entries array.');
  }

  const entries: TrafficEntry[] = [];

  for (let i = 0; i < data.log.entries.length; i++) {
    const rawEntry = data.log.entries[i];
    if (!rawEntry.request || !rawEntry.response) continue;

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawEntry.request.url);
    } catch {
      continue;
    }

    let parsedReqJson: any = undefined;
    if (rawEntry.request.postData && rawEntry.request.postData.text) {
      if (
        rawEntry.request.postData.mimeType?.includes('json') ||
        rawEntry.request.postData.text.trim().startsWith('{') ||
        rawEntry.request.postData.text.trim().startsWith('[')
      ) {
        try {
          parsedReqJson = JSON.parse(rawEntry.request.postData.text);
        } catch {
          // keep as raw text
        }
      }
    }

    let parsedResJson: any = undefined;
    if (rawEntry.response.content && rawEntry.response.content.text) {
      if (
        rawEntry.response.content.mimeType?.includes('json') ||
        rawEntry.response.content.text.trim().startsWith('{') ||
        rawEntry.response.content.text.trim().startsWith('[')
      ) {
        try {
          parsedResJson = JSON.parse(rawEntry.response.content.text);
        } catch {
          // keep as raw text
        }
      }
    }

    const request: ParsedRequest = {
      method: (rawEntry.request.method.toUpperCase() as HttpMethod) || 'GET',
      url: rawEntry.request.url,
      pathname: parsedUrl.pathname,
      queryParams: (rawEntry.request.queryString || []).map((q: any) => ({
        name: q.name,
        value: q.value,
      })),
      headers: (rawEntry.request.headers || []).map((h: any) => ({
        name: h.name,
        value: h.value,
      })),
      postData: rawEntry.request.postData
        ? {
            mimeType: rawEntry.request.postData.mimeType || 'text/plain',
            text: rawEntry.request.postData.text || '',
            parsedJson: parsedReqJson,
          }
        : undefined,
    };

    const response: ParsedResponse = {
      status: rawEntry.response.status,
      statusText: rawEntry.response.statusText || '',
      headers: (rawEntry.response.headers || []).map((h: any) => ({
        name: h.name,
        value: h.value,
      })),
      mimeType: rawEntry.response.content?.mimeType || 'text/plain',
      text: rawEntry.response.content?.text,
      parsedJson: parsedResJson,
    };

    entries.push({
      id: `entry-${i + 1}`,
      startedDateTime: rawEntry.startedDateTime || new Date().toISOString(),
      timeMs: rawEntry.time || 0,
      request,
      response,
    });
  }

  return entries;
}
