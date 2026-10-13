export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

export interface HeaderEntry {
  name: string;
  value: string;
}

export interface QueryParamEntry {
  name: string;
  value: string;
}

export interface ParsedRequest {
  method: HttpMethod;
  url: string;
  pathname: string;
  queryParams: QueryParamEntry[];
  headers: HeaderEntry[];
  postData?: {
    mimeType: string;
    text: string;
    parsedJson?: any;
  };
}

export interface ParsedResponse {
  status: number;
  statusText: string;
  headers: HeaderEntry[];
  mimeType: string;
  text?: string;
  parsedJson?: any;
}

export interface TrafficEntry {
  id: string;
  startedDateTime: string;
  timeMs: number;
  request: ParsedRequest;
  response: ParsedResponse;
}

export type InferredType =
  | { kind: 'string'; format?: 'date-time' | 'uuid' | 'email' | 'uri' }
  | { kind: 'number'; isInteger: boolean }
  | { kind: 'boolean' }
  | { kind: 'null' }
  | { kind: 'array'; itemType: InferredType }
  | { kind: 'object'; properties: Record<string, { type: InferredType; optional: boolean }> }
  | { kind: 'union'; types: InferredType[] }
  | { kind: 'any' };

export interface EndpointDefinition {
  routePattern: string; // e.g. "/api/v1/users/{userId}"
  pathParameters: string[];
  method: HttpMethod;
  sampleCount: number;
  queryParameters: Record<string, { type: InferredType; optional: boolean }>;
  requestHeaders: string[];
  requestBodySchema?: InferredType;
  responseStatuses: number[];
  responseBodySchemas: Record<number, InferredType>;
  sampleExamples: {
    requestSample?: any;
    responseSample?: any;
    statusCode: number;
  }[];
}

export interface InferredApiSpec {
  title: string;
  baseUrls: string[];
  endpoints: EndpointDefinition[];
  totalEntriesProcessed: number;
}
