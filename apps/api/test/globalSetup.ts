import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { TestProject } from 'vitest/node';

// Un replica set partagé (transactions) ; chaque fichier de test utilise sa propre base.
let replSet: MongoMemoryReplSet;

export async function setup(project: TestProject) {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  project.provide('mongoUri', replSet.getUri());
}

export async function teardown() {
  await replSet?.stop();
}

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}
