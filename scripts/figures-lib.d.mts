export const SIDES: readonly ['squad', 'enemy'];
export const VIEWS: readonly ['n', 'ne', 'e', 'se', 's'];
export interface FigureSideData { palette: string[]; views: Record<'n' | 'ne' | 'e' | 'se' | 's', string[]> }
export interface FigureData { width: number; height: number; sides: Record<'squad' | 'enemy', FigureSideData> }
export function decodePng(bytes: Uint8Array): { width: number; height: number; rgba: Uint8Array };
export function buildFigureData(dir: string): FigureData;
export function renderModule(data: FigureData): string;
export const IMAGE_NAMES: readonly [
  'floor_a', 'floor_b', 'floor_c', 'wall', 'door_closed', 'door_open',
  'item_rifle', 'item_pistol', 'item_grenade', 'item_shotgun', 'item_smg', 'item_sniper', 'corpse_player', 'corpse_enemy',
  'prop_supply_crate', 'prop_oil_drum', 'prop_wood_crate', 'prop_barrel', 'prop_machine', 'prop_tank', 'prop_boulder', 'prop_rocks', 'prop_pillar', 'prop_urn',
  'prop_sandbags', 'prop_crate_stack', 'prop_barrier', 'prop_tyres',
  'prop_plank_stack', 'prop_hay_bale', 'prop_workbench', 'prop_cask',
  'prop_server_rack', 'prop_generator', 'prop_pipe_run', 'prop_console',
  'prop_stalagmite', 'prop_crystals', 'prop_bone_pile', 'prop_mushrooms',
  'prop_statue', 'prop_brazier', 'prop_sarcophagus', 'prop_broken_column',
  'decal_stain', 'decal_cracks', 'decal_debris', 'decal_straw', 'decal_scrap', 'decal_grate', 'decal_cable',
  'decal_pebbles', 'decal_puddle', 'decal_moss', 'decal_rubble', 'decal_chips', 'decal_rune',
];
export interface ImageEntry { palette: string[]; rows: string[] }
export interface ImageData { width: 16; height: 16; images: Record<(typeof IMAGE_NAMES)[number], ImageEntry> }
export function buildImageData(dir: string): ImageData;
export function renderImagesModule(data: ImageData): string;
