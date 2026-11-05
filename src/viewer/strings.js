// Viewer texts in one place. The viewer is the team's tool and speaks English.

export const STRINGS = Object.freeze({
  customColor: 'Custom color',
  filterAll: 'All',
  filterDesigns: 'Designs',
  empty: 'There are no shirts in the catalog.',
  notRecommended: 'Not recommended in this color',
  draft: 'Draft: not in the store',
  textTooLong: 'Text too long',
  problemsTitle: 'Problems in catalog.json',
  imageNotFound: (path) => `Image not found: ${path}`,
  fontNotLoaded: (file) => `Could not load the font: ${file}`,
  catalogNotLoaded: (reason) => `Could not read catalog.json: ${reason}`,
  baseNotLoaded: (path) => `Could not load the base shirt: ${path}`,
  downloadFailed: (reason) => `Could not download the PNG: ${reason}`,
  unexpectedError: (reason) => `Unexpected error while preparing the shirts: ${reason}`,
});
