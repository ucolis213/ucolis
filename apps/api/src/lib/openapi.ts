// Documentation OpenAPI 3.1 générée depuis les routes Express et les schémas zod de validate().
// Publiée en développement sur /api/v1/docs.

import type { Router } from 'express';
import { z } from 'zod';
import type { ValidatingHandler } from './validate';

interface Layer {
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: ValidatingHandler }[] };
  name?: string;
  handle?: { stack?: Layer[] };
}

const toOpenApiPath = (p: string) => p.replace(/:(\w+)/g, '{$1}');

function jsonSchema(schema: z.ZodType) {
  try {
    return z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
  } catch {
    return { type: 'object' };
  }
}

function collect(stack: Layer[], prefix: string, paths: Record<string, Record<string, unknown>>) {
  for (const layer of stack) {
    if (layer.route) {
      const path = toOpenApiPath(prefix + layer.route.path);
      for (const method of Object.keys(layer.route.methods)) {
        const op: Record<string, unknown> = { responses: { '200': { description: 'Succès' } } };
        const params = [...path.matchAll(/\{(\w+)\}/g)].map((m) => ({ name: m[1], in: 'path', required: true, schema: { type: 'string' } }));
        for (const { handle } of layer.route.stack) {
          if (!handle.schema) continue;
          if (handle.source === 'body') {
            op.requestBody = { required: true, content: { 'application/json': { schema: jsonSchema(handle.schema) } } };
          } else if (handle.source === 'query') {
            const props = (jsonSchema(handle.schema) as { properties?: Record<string, unknown> }).properties ?? {};
            params.push(...Object.entries(props).map(([name, schema]) => ({ name, in: 'query', required: false, schema: schema as never })));
          }
        }
        if (params.length) op.parameters = params;
        paths[path] = { ...paths[path], [method]: op };
      }
    } else if (layer.handle?.stack) {
      collect(layer.handle.stack, prefix, paths);
    }
  }
}

export function openApiDocument(routers: { prefix: string; router: Router }[]) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const { prefix, router } of routers) collect((router as unknown as { stack: Layer[] }).stack, prefix, paths);
  return {
    openapi: '3.1.0',
    info: { title: 'API UCOLIS', version: '1.0.0' },
    components: {
      securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    },
    security: [{ bearer: [] }],
    paths,
  };
}
