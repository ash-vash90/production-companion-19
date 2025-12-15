/**
 * Instruction Media Service
 *
 * Handles uploading images and videos for work instructions
 * to Supabase Storage.
 */

import { supabase } from '@/integrations/supabase/client';
import { nanoid } from 'nanoid';

const BUCKET_NAME = 'instruction-media';

/**
 * Upload an image file for work instructions
 * Returns the public URL of the uploaded image
 */
export async function uploadInstructionImage(
  file: File,
  instructionId?: string
): Promise<string> {
  // Validate file type
  if (!file.type.startsWith('image/')) {
    throw new Error('File must be an image');
  }

  // Validate file size (max 10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error('Image must be smaller than 10MB');
  }

  // Generate unique filename
  const ext = file.name.split('.').pop() || 'jpg';
  const folder = instructionId || 'general';
  const filename = `${folder}/${nanoid()}.${ext}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filename, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error('Upload error:', uploadError);
    throw new Error(`Failed to upload image: ${uploadError.message}`);
  }

  // Get public URL
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filename);

  return data.publicUrl;
}

/**
 * Upload a video file for work instructions
 * Returns the public URL of the uploaded video
 */
export async function uploadInstructionVideo(
  file: File,
  instructionId?: string
): Promise<string> {
  // Validate file type
  if (!file.type.startsWith('video/')) {
    throw new Error('File must be a video');
  }

  // Validate file size (max 100MB)
  const maxSize = 100 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error('Video must be smaller than 100MB');
  }

  // Generate unique filename
  const ext = file.name.split('.').pop() || 'mp4';
  const folder = instructionId || 'general';
  const filename = `${folder}/videos/${nanoid()}.${ext}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filename, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error('Upload error:', uploadError);
    throw new Error(`Failed to upload video: ${uploadError.message}`);
  }

  // Get public URL
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filename);

  return data.publicUrl;
}

/**
 * Delete a media file from storage
 */
export async function deleteInstructionMedia(url: string): Promise<void> {
  // Extract the path from the URL
  const urlObj = new URL(url);
  const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/instruction-media\/(.+)/);

  if (!pathMatch) {
    console.warn('Could not parse media URL for deletion:', url);
    return;
  }

  const filePath = pathMatch[1];

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([filePath]);

  if (error) {
    console.error('Delete error:', error);
    throw new Error(`Failed to delete media: ${error.message}`);
  }
}

/**
 * Get a signed URL for private media (if bucket is private)
 */
export async function getSignedUrl(
  path: string,
  expiresIn: number = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, expiresIn);

  if (error) {
    throw new Error(`Failed to get signed URL: ${error.message}`);
  }

  return data.signedUrl;
}
