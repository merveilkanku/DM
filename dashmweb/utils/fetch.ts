/**
 * Utility for fetching with automatic retries and exponential backoff.
 * Especially useful for users on unstable mobile networks.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL, 
  init?: RequestInit, 
  retries = 3, 
  backoff = 1000
): Promise<Response> {
  const url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url);
  
  try {
    const response = await fetch(input, init);
    
    // We only retry on 5xx errors or network failures
    if (!response.ok && response.status >= 500 && retries > 0) {
      console.warn(`Fetch to ${url} failed with status ${response.status}. Retrying in ${backoff}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoff));
      return fetchWithRetry(input, init, retries - 1, backoff * 2);
    }
    
    return response;
  } catch (error: any) {
    // Check if it's a "Failed to fetch" (network error)
    if (retries > 0 && (error.message?.includes('Failed to fetch') || error.message?.includes('network'))) {
      console.warn(`Network error fetching ${url}. Retrying in ${backoff}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, backoff));
      return fetchWithRetry(input, init, retries - 1, backoff * 2);
    }
    throw error;
  }
}
