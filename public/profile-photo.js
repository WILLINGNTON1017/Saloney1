// Recorta una foto cuadrada y limita su tamaño antes de enviarla al servidor.
export async function prepareProfilePhoto(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Selecciona una imagen JPG, PNG o WebP.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Selecciona una imagen de hasta 10 MB.');
  const url = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer la foto.'));
    reader.readAsDataURL(file);
  });
  try {
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new Error(
        'No pudimos abrir esta imagen. Prueba con otra foto en formato JPG, PNG o WebP.',
      );
    }
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 256, 256);
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    ctx.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      256,
      256,
    );
    for (const quality of [0.85, 0.7, 0.5, 0.3]) {
      const data = canvas.toDataURL('image/jpeg', quality);
      if (data.length <= 60000) return data;
    }
    throw new Error('La imagen es demasiado compleja. Prueba con otra foto.');
  } finally {
    // La imagen se leyó en memoria; no hay direcciones de archivo persistentes.
  }
}
