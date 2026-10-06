import type { Pos } from '../core/types';

export type Mode = 'move' | 'snap' | 'aimed' | 'throw' | 'door' | 'stab' | 'heal' | 'turn';

export interface UiState {
  selectedId: string | null;
  mode: Mode;
  hover: Pos | null;
  preview: Pos[];
  previewCost: number | null;
  /** On touch, the tile whose path is being previewed: a second tap on it moves there. */
  pendingTile: Pos | null;
  message: string;
  messageUntil: number;
  busy: boolean;
}

export function createUiState(selectedId: string | null): UiState {
  return {
    selectedId,
    mode: 'move',
    hover: null,
    preview: [],
    previewCost: null,
    pendingTile: null,
    message: '',
    messageUntil: 0,
    busy: false,
  };
}
