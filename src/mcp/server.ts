import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fs from 'node:fs';
import { parseHarContent } from '../domain/harParser.js';
import { clusterPathname } from '../domain/urlPatternMatcher.js';
import { inferValueType, unifyTypes } from '../domain/schemaInference.js';
import { EndpointDefinition, InferredApiSpec } from '../domain/types.js';
import { generateTypeScriptSdk } from '../domain/sdkGenerator.js';
import { generateMockServerScript } from '../domain/mockGenerator.js';

export function runMcpServer() {
  const server = new Server(
    {
      name: 'tea-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'inspect_network_traffic',
          description: 'Parses a HAR file or raw network JSON capture and provides structured route inventory and statistics.',
          inputSchema: {
            type: 'object',
            properties: {
              harPath: { type: 'string', description: 'Absolute or relative path to the .har file' },
            },
            required: ['harPath'],
          },
        },
        {
          name: 'infer_api_schema',
          description: 'Infers parameterized REST routes, TypeScript schemas, and request/response models across all observed requests.',
          inputSchema: {
            type: 'object',
            properties: {
              harPath: { type: 'string', description: 'Path to the .har file' },
            },
            required: ['harPath'],
          },
        },
        {
          name: 'synthesize_typed_sdk',
          description: 'Generates an unencumbered, 100% strongly-typed TypeScript SDK from observed traffic.',
          inputSchema: {
            type: 'object',
            properties: {
              harPath: { type: 'string', description: 'Path to the .har file' },
              clientName: { type: 'string', description: 'Name of the TypeScript client class (e.g. AcmeClient)' },
            },
            required: ['harPath'],
          },
        },
        {
          name: 'generate_mock_server',
          description: 'Produces a standalone, executable Node.js mock server script that mirrors recorded endpoints and sample responses.',
          inputSchema: {
            type: 'object',
            properties: {
              harPath: { type: 'string', description: 'Path to the .har file' },
              port: { type: 'number', description: 'Port number for the mock server' },
            },
            required: ['harPath'],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (!args || typeof args.harPath !== 'string') {
      throw new Error('Missing required argument: harPath');
    }

    const harContent = fs.readFileSync(args.harPath, 'utf8');
    const entries = parseHarContent(harContent);

    // Group by route pattern + method
    const endpointMap = new Map<string, EndpointDefinition>();
    const baseUrls = new Set<string>();

    for (const entry of entries) {
      try {
        const urlObj = new URL(entry.request.url);
        baseUrls.add(`${urlObj.protocol}//${urlObj.host}`);
      } catch {}

      const { routePattern, pathParams } = clusterPathname(entry.request.pathname);
      const key = `${entry.request.method} ${routePattern}`;

      if (!endpointMap.has(key)) {
        endpointMap.set(key, {
          routePattern,
          pathParameters: pathParams,
          method: entry.request.method,
          sampleCount: 1,
          queryParameters: {},
          requestHeaders: entry.request.headers.map((h) => h.name),
          responseStatuses: [entry.response.status],
          responseBodySchemas: {},
          sampleExamples: [
            {
              requestSample: entry.request.postData?.parsedJson,
              responseSample: entry.response.parsedJson,
              statusCode: entry.response.status,
            },
          ],
        });
      } else {
        const ep = endpointMap.get(key)!;
        ep.sampleCount++;
        if (!ep.responseStatuses.includes(entry.response.status)) {
          ep.responseStatuses.push(entry.response.status);
        }
      }

      const ep = endpointMap.get(key)!;
      if (entry.request.postData?.parsedJson) {
        const incoming = inferValueType(entry.request.postData.parsedJson);
        ep.requestBodySchema = ep.requestBodySchema ? unifyTypes(ep.requestBodySchema, incoming) : incoming;
      }

      if (entry.response.parsedJson) {
        const incoming = inferValueType(entry.response.parsedJson);
        const curr = ep.responseBodySchemas[entry.response.status];
        ep.responseBodySchemas[entry.response.status] = curr ? unifyTypes(curr, incoming) : incoming;
      }
    }

    const spec: InferredApiSpec = {
      title: 'Inferred Protocol Specification',
      baseUrls: Array.from(baseUrls),
      endpoints: Array.from(endpointMap.values()),
      totalEntriesProcessed: entries.length,
    };

    switch (name) {
      case 'inspect_network_traffic':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  totalEntries: entries.length,
                  uniqueEndpoints: spec.endpoints.length,
                  baseUrls: spec.baseUrls,
                  endpoints: spec.endpoints.map((e) => `${e.method} ${e.routePattern} (${e.sampleCount} calls)`),
                },
                null,
                2
              ),
            },
          ],
        };

      case 'infer_api_schema':
        return {
          content: [{ type: 'text', text: JSON.stringify(spec, null, 2) }],
        };

      case 'synthesize_typed_sdk': {
        const clientName = typeof args.clientName === 'string' ? args.clientName : 'ApiClient';
        const code = generateTypeScriptSdk(spec, clientName);
        return {
          content: [{ type: 'text', text: code }],
        };
      }

      case 'generate_mock_server': {
        const port = typeof args.port === 'number' ? args.port : 8080;
        const code = generateMockServerScript(spec, port);
        return {
          content: [{ type: 'text', text: code }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  const transport = new StdioServerTransport();
  server.connect(transport);
}
