// Fotografías proporcionadas por el salón. Conservamos los archivos originales.
const servicePhotos = [
  'unas-francesas-flores',
  'unas-flores-amarillas',
  'unas-mariposas',
  'unas-flores-doradas',
  'unas-vinotinto',
];

export function servicePhoto(id) {
  const index = Math.max(0, (Number(id) || 1) - 1) % servicePhotos.length;
  return '/assets/' + servicePhotos[index] + '.png';
}
