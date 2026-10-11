/**
 * Formats API errors into user-friendly strings.
 * Handles FastAPI string detail, array detail (validation errors),
 * network errors, and HTML-guard errors.
 *
 * @param {any} err - The error caught from an API call
 * @param {string} [fallback='An unexpected error occurred.'] - Fallback message
 * @returns {string} User-facing error message
 */
export function formatApiError(err, fallback = 'An unexpected error occurred.') {
  if (!err) {
    return fallback;
  }

  // Already a string
  if (typeof err === 'string') {
    return err;
  }

  // Guard: HTML response error from API client
  if (err.isHtmlResponse || (typeof err.message === 'string' && err.message.includes('HTML instead of JSON'))) {
    return 'API unreachable: received HTML instead of JSON. Check VITE_API_BASE_URL.';
  }

  // Axios response error
  if (err.response) {
    const data = err.response.data;

    // Direct string response
    if (typeof data === 'string') {
      if (data.trim().startsWith('<!DOCTYPE') || data.trim().startsWith('<html')) {
        return 'API unreachable: received HTML instead of JSON. Check VITE_API_BASE_URL.';
      }
      return data;
    }

    if (data && typeof data === 'object') {
      // FastAPI string detail
      if (typeof data.detail === 'string') {
        return data.detail;
      }

      // FastAPI validation error array (422 Unprocessable Entity)
      if (Array.isArray(data.detail)) {
        const messages = data.detail
          .map((item) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') {
              if (item.msg) return item.msg;
              if (item.message) return item.message;
            }
            return null;
          })
          .filter(Boolean);

        if (messages.length > 0) {
          return messages.join(', ');
        }
      }

      // Other possible backend message fields
      if (typeof data.message === 'string') {
        return data.message;
      }
      if (typeof data.error === 'string') {
        return data.error;
      }
    }
  }

  // Network error (no response received or network down)
  if (err.request && !err.response) {
    return 'Cannot reach server. Please check your network connection or server status.';
  }

  if (typeof err.message === 'string') {
    if (err.message.includes('Network Error')) {
      return 'Cannot reach server. Please check your network connection or server status.';
    }
    return err.message;
  }

  return fallback;
}
