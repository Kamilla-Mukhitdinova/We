const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_QUALITY = 0.82;

function loadImageFromUrl(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Не удалось обработать изображение'));
    image.src = url;
  });
}

function calculateSize(width: number, height: number, maxDimension: number) {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }

  const scale = maxDimension / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function prepareImageForStorage(
  file: File,
  options?: { maxDimension?: number; quality?: number }
) {
  const maxDimension = options?.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = options?.quality ?? DEFAULT_QUALITY;
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageFromUrl(objectUrl);
    const nextSize = calculateSize(image.naturalWidth || image.width, image.naturalHeight || image.height, maxDimension);
    const canvas = document.createElement('canvas');
    canvas.width = nextSize.width;
    canvas.height = nextSize.height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Не удалось подготовить холст для изображения');
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (!dataUrl.startsWith('data:image/jpeg')) {
      throw new Error('Не удалось сохранить изображение в поддерживаемом формате');
    }

    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
