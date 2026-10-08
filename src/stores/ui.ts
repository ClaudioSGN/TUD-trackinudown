import { create } from 'zustand'

export type Route = { page: 'dashboard' | 'all' | 'condo' | 'reminders' | 'preferences'; condominioId?: number }
interface UiState {
  route: Route; drawerId: number | 'new' | null; condoModal: number | 'new' | null; quickOpen: boolean
  navigate(route: Route): void; openDrawer(id?: number): void; closeDrawer(): void
  openCondo(id?: number): void; closeCondo(): void; setQuick(open: boolean): void
}
export const useUi = create<UiState>(set => ({
  route: { page: 'dashboard' }, drawerId: null, condoModal: null, quickOpen: false,
  navigate: route => set({ route }), openDrawer: id => set({ drawerId: id || 'new' }), closeDrawer: () => set({ drawerId: null }),
  openCondo: id => set({ condoModal: id || 'new' }), closeCondo: () => set({ condoModal: null }), setQuick: quickOpen => set({ quickOpen })
}))
