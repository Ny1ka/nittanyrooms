import buildings from '../../../data/buildings.json';
import policies from '../../../data/policies.json';
import providers from '../../../data/providers.json';
import rooms from '../../../data/rooms.json';
import sources from '../../../data/sources.json';
import { Dataset } from './schema.js';

/** Raw dataset as stored in /data (unvalidated). */
export const rawDataset = { sources, providers, policies, buildings, rooms };

/** Parsed, schema-checked dataset. Throws if /data is malformed — CI catches this first. */
export function loadDataset(): Dataset {
  return Dataset.parse(rawDataset);
}
