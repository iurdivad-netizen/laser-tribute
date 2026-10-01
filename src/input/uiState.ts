import type { Pos } from '../core/types';

export type Mode = 'move' | 'snap' | 'aimed' | 'throw' | 'door';

export interface UiState {
  selectedId: string | null;
  mode: Mode;
  hover: Pos | null;
  preview: Pos[];
  previewCost: number | null;
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
    message: '',
    messageUntil: 0,
    busy: false,
  };
}
