// backend/db/persistence.ts
import fs from 'fs';
import path from 'path';

export interface PersistedData {
  routeConfigs: Record<string, { max?: number; authRequired?: boolean }>;
  logs: any[];
}

const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'gateway_store.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    const initialData: PersistedData = {
      routeConfigs: {},
      logs: []
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
  }
}

export function loadPersistedData(): PersistedData {
  try {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('⚠️ Could not read persistence file, falling back to default memory store.', error);
    return { routeConfigs: {}, logs: [] };
  }
}

export function savePersistedData(data: Partial<PersistedData>): void {
  try {
    ensureDataFile();
    const current = loadPersistedData();
    const updated: PersistedData = {
      routeConfigs: data.routeConfigs ? { ...current.routeConfigs, ...data.routeConfigs } : current.routeConfigs,
      logs: data.logs !== undefined ? data.logs : current.logs
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (error) {
    console.error('⚠️ Could not save persistence data:', error);
  }
}
