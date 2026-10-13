#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { parseHarContent } from './domain/harParser.js';
import { clusterPathname } from './domain/urlPatternMatcher.js';
import { inferValueType, unifyTypes } from './domain/schemaInference.js';
import { EndpointDefinition, InferredApiSpec } from './domain/types.js';
import { generateTypeScriptSdk } from './domain/sdkGenerator.js';
import { generateMockServerScript } from './domain/mockGenerator.js';
import { runMcpServer } from './mcp/server.js';

const program = new Command();

program
  .name('tea')
  .description('Traffic & Protocol Engineering Anything: Deconstruct network captures into typed SDKs & mocks.')
  .version('1.0.0');

function processHar(harPath: string): InferredApiSpec {
  const content = fs.readFileSync(harPath, 'utf8');
  const entries = parseHarContent(content);

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

  return {
    title: path.basename(harPath, path.extname(harPath)),
    baseUrls: Array.from(baseUrls),
    endpoints: Array.from(endpointMap.values()),
    totalEntriesProcessed: entries.length,
  };
}

program
  .command('inspect <harFile>')
  .description('Inspect HAR file and summarize detected endpoints and network activity')
  .action((harFile) => {
    const spec = processHar(harFile);
    console.log(`\n☕ TEA Traffic Overview: ${harFile}`);
    console.log(`=============================================`);
    console.log(`Total Requests Processed: ${spec.totalEntriesProcessed}`);
    console.log(`Detected Base URLs:       ${spec.baseUrls.join(', ') || 'N/A'}`);
    console.log(`Unique Endpoints Found:   ${spec.endpoints.length}\n`);

    for (const ep of spec.endpoints) {
      console.log(`  [${ep.method.padEnd(6)}] ${ep.routePattern} (${ep.sampleCount} observations) -> Statuses: [${ep.responseStatuses.join(', ')}]`);
    }
    console.log();
  });

program
  .command('sdk <harFile>')
  .description('Synthesize a clean-room typed TypeScript SDK from the HAR file')
  .option('-o, --output <path>', 'Output file path', 'sdk.ts')
  .option('-n, --name <name>', 'Client class name', 'ApiClient')
  .action((harFile, options) => {
    const spec = processHar(harFile);
    const code = generateTypeScriptSdk(spec, options.name);
    fs.writeFileSync(options.output, code, 'utf8');
    console.log(`✅ Strongly-typed SDK successfully generated at: ${options.output}`);
  });

program
  .command('mock <harFile>')
  .description('Generate an executable mock server matching recorded traffic')
  .option('-o, --output <path>', 'Output file path', 'mockServer.mjs')
  .option('-p, --port <port>', 'Server port', '8080')
  .action((harFile, options) => {
    const spec = processHar(harFile);
    const code = generateMockServerScript(spec, parseInt(options.port, 10));
    fs.writeFileSync(options.output, code, 'utf8');
    console.log(`✅ Standalone Mock Server successfully generated at: ${options.output}`);
  });

program
  .command('mcp')
  .description('Start TEA Model Context Protocol (MCP) server over stdio')
  .action(() => {
    runMcpServer();
  });

program.parse(process.argv);
