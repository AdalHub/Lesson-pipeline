import type { FilePart } from 'ai';

const DATA_URL = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+=*)$/i;

/**
 * Turn a base64 image data URL into an AI SDK file part. (The older
 * `{ type: 'image' }` part is deprecated in AI SDK 7.)
 */
export function imageFilePart(dataUrl: string): FilePart {
  const match = DATA_URL.exec(dataUrl);
  if (!match) {
    throw new Error('Expected a base64 image data URL');
  }
  return {
    type: 'file',
    mediaType: match[1]!.toLowerCase(),
    data: match[2]!,
  };
}
