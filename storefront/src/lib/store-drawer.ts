/**
 * Puente para abrir el panel flotante (carrito / favoritos)
 * desde cualquier página o componente.
 */
export function openStoreDrawer(tab: 'cart' | 'wishlist' = 'cart') {
  window.dispatchEvent(new CustomEvent('store:open', { detail: { tab } }));
}
