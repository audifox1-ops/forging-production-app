const APP_BASE_URL = import.meta.env.BASE_URL || '/';

export const NORMALIZED_BASE_URL = APP_BASE_URL.endsWith('/')
  ? APP_BASE_URL
  : `${APP_BASE_URL}/`;

export function withBasePath(path: string) {
  const normalizedPath = path.replace(/^\/+/, '');
  return `${NORMALIZED_BASE_URL}${normalizedPath}`;
}
