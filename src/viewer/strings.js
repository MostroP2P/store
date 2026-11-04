// UI strings in one place, ready to add more languages for the store.

export const STRINGS = Object.freeze({
  customColor: 'Color libre',
  filterAll: 'Todas',
  filterDesigns: 'Diseños',
  empty: 'No hay remeras en el catálogo.',
  notRecommended: 'No recomendado en este color',
  draft: 'Borrador: no está en la tienda',
  textTooLong: 'Texto muy largo',
  problemsTitle: 'Problemas en catalog.json',
  imageNotFound: (path) => `Imagen no encontrada: ${path}`,
  fontNotLoaded: (file) => `No se pudo cargar la fuente: ${file}`,
  catalogNotLoaded: (reason) => `No se pudo leer catalog.json: ${reason}`,
  baseNotLoaded: (path) => `No se pudo cargar la remera base: ${path}`,
  downloadFailed: (reason) => `No se pudo descargar el PNG: ${reason}`,
  unexpectedError: (reason) => `Error inesperado al preparar las remeras: ${reason}`,
});
