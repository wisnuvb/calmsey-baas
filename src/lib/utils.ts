import { customAlphabet } from 'nanoid';

// Generate a secure API key
export function generateApiKey(prefix: string = 'sk'): string {
  const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 32);
  return `${prefix}_${nanoid()}`;
}

// Generate a project slug from name
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
