/**
 * Debug mode detection utility for the AI Generator extension
 */

declare const __DEBUG_MODE__: boolean;
declare const __DEBUG_FORCE_DISABLE__: boolean;

/**
 * Checks if debug mode should be enabled based on:
 * 1. Force disable flag (always takes precedence)
 * 2. URL parameter "autopicturaDebug=true" (enables debug)
 * 3. URL parameter "autopicturaDebug=false" (disables debug in dev)
 * 4. Build-time environment (development builds have debug by default)
 */
export function isDebugMode(): boolean {
  // Check for force disable flag first (highest priority)
  if (typeof __DEBUG_FORCE_DISABLE__ !== 'undefined' && __DEBUG_FORCE_DISABLE__) {
    return false;
  }

  // Check URL parameters for explicit control
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const debugParam = urlParams.get('autopicturaDebug');
    
    // Explicit enable via URL (works in any environment)
    if (debugParam === 'true') {
      return true;
    }
    
    // Explicit disable via URL (overrides development default)
    if (debugParam === 'false') {
      return false;
    }
  }

  // Default to development environment setting
  if (typeof __DEBUG_MODE__ !== 'undefined' && __DEBUG_MODE__) {
    return true;
  }

  return false;
}

/**
 * Conditional console logging that only logs in debug mode
 */
export function debugLog(...args: any[]): void {
  if (isDebugMode()) {
    console.log(...args);
  }
}

/**
 * Conditional console error logging that only logs in debug mode
 */
export function debugError(...args: any[]): void {
  if (isDebugMode()) {
    console.error(...args);
  }
}

/**
 * Conditional console warning logging that only logs in debug mode
 */
export function debugWarn(...args: any[]): void {
  if (isDebugMode()) {
    console.warn(...args);
  }
}