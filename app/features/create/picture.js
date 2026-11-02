// Pictures are kept small, inside the saved data: scaled down to fit SIDE pixels and saved as a
// JPEG data: URL (a few tens of kilobytes), so they travel with the rest and with the account.

const SIDE = 720;
const QUALITY = 0.78;

export async function shrinkPicture(file, side = SIDE) {
  const bitmap = await createImageBitmap(file);
  const k = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * k));
  canvas.height = Math.max(1, Math.round(bitmap.height * k));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // a transparent picture gets a white ground, as JPEG has no transparency
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', QUALITY);
}
