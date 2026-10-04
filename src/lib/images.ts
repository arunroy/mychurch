import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';

/**
 * Lets the person pick a photo, cropped square unless another shape (or null, for no crop) is given, and uploads it
 * to `bucket/folder/...`.
 * Returns the stored path, or null if they cancelled.
 */
export async function pickAndUploadImage(bucket: 'church-logos' | 'avatars', folder: string, aspect: [number, number] | null = [1, 1]) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    // No shape means the photo is used as it is, without a crop step.
    allowsEditing: aspect !== null,
    aspect: aspect ?? undefined,
    quality: 0.7,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  const contentType = asset.mimeType ?? 'image/jpeg';
  const extension = contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  const body = await (await fetch(asset.uri)).arrayBuffer();
  // A new name each time so phones don't keep showing a cached old picture.
  const path = `${folder}/${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType });
  if (error) throw error;
  return path;
}
