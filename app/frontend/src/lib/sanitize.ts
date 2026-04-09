import DOMPurify from 'dompurify'

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Returns a props object suitable for dangerouslySetInnerHTML.
 */
export function sanitizedHtml(html: string | undefined | null): { __html: string } {
  return { __html: DOMPurify.sanitize(html || '') }
}
