export const SIDES: readonly ['squad', 'enemy'];
export const VIEWS: readonly ['n', 'ne', 'e', 'se', 's'];
export interface FigureSideData { palette: string[]; views: Record<'n' | 'ne' | 'e' | 'se' | 's', string[]> }
export interface FigureData { width: number; height: number; sides: Record<'squad' | 'enemy', FigureSideData> }
export function decodePng(bytes: Uint8Array): { width: number; height: number; rgba: Uint8Array };
export function buildFigureData(dir: string): FigureData;
export function renderModule(data: FigureData): string;
export const IMAGE_NAMES: readonly [
  'floor_a', 'floor_b', 'floor_c', 'wall', 'door_closed', 'door_open',
  'item_rifle', 'item_pistol', 'item_grenade', 'corpse_player', 'corpse_enemy',
];
export interface ImageEntry { palette: string[]; rows: string[] }
export interface ImageData { width: 16; height: 16; images: Record<(typeof IMAGE_NAMES)[number], ImageEntry> }
export function buildImageData(dir: string): ImageData;
export function renderImagesModule(data: ImageData): string;
