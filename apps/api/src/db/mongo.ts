import mongoose from 'mongoose';

mongoose.set('strictQuery', true);

export async function connectMongo(uri: string): Promise<typeof mongoose> {
  return mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
}

export async function pingMongo(): Promise<boolean> {
  try {
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) return false;
    await mongoose.connection.db.admin().ping();
    return true;
  } catch {
    return false;
  }
}

export const disconnectMongo = () => mongoose.disconnect();
