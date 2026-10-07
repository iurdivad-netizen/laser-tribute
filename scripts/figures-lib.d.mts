export const SIDES: readonly ['squad', 'enemy'];
export const VIEWS: readonly ['n', 'ne', 'e', 'se', 's'];
export interface FigureSideData { palette: string[]; views: Record<'n' | 'ne' | 'e' | 'se' | 's', string[]> }
export interface FigureData { width: number; height: number; sides: Record<'squad' | 'enemy', FigureSideData> }
export function decodePng(bytes: Uint8Array): { width: number; height: number; rgba: Uint8Array };
export function buildFigureData(dir: string): FigureData;
export function renderModule(data: FigureData): string;
