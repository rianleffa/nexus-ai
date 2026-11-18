import { createContext, useContext } from 'react';
import type { QuickCreateTab } from './QuickCreateModal';

export const QuickCreateContext = createContext<((tab?: QuickCreateTab) => void) | null>(null);

export const useQuickCreate = () => {
  const openQuickCreate = useContext(QuickCreateContext);
  if (!openQuickCreate) throw new Error('A criação rápida precisa estar dentro do Layout.');
  return openQuickCreate;
};
