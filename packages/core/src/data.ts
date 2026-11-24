import buildings from '../../../data/buildings.json';
import policies from '../../../data/policies.json';
import providers from '../../../data/providers.json';
import rooms from '../../../data/rooms.json';
import sources from '../../../data/sources.json';
import footprintsRaw from '../../../data/footprints.json';
import openSpacesRaw from '../../../data/open-spaces.json';
import buildingHoursRaw from '../../../data/building-hours.json';
import { BuildingHoursEntry } from './buildingHours.js';
import { z } from 'zod';
import { OpenSpace } from './openSpaces.js';
import { Dataset } from './schema.js';
import { FootprintCollection } from './validate/footprints.js';

/** Raw building footprints (OSM, ODbL). */
export const rawFootprints: unknown = footprintsRaw;

/** Walk-in study spaces (not reservable). */
export const rawOpenSpaces: unknown = openSpacesRaw;
export function loadOpenSpaces(): OpenSpace[] {
  return z.array(OpenSpace).parse(openSpacesRaw);
}

/** Manually maintained building hours (sourced). */
export const rawBuildingHours: unknown = buildingHoursRaw;
export function loadBuildingHours(): BuildingHoursEntry[] {
  return z.array(BuildingHoursEntry).parse(buildingHoursRaw);
}

export function loadFootprints(): FootprintCollection {
  return FootprintCollection.parse(footprintsRaw);
}

/** Raw dataset as stored in /data (unvalidated). */
export const rawDataset = { sources, providers, policies, buildings, rooms };

/** Parsed, schema-checked dataset. Throws if /data is malformed — CI catches this first. */
export function loadDataset(): Dataset {
  return Dataset.parse(rawDataset);
}
