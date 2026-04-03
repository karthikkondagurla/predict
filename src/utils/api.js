// API utility for fetching cricket match data from cricketdata.org (cricapi.com)

const BACKEND_URL = '/api';

/**
 * Fetch today's IPL matches from the local backend (which checks Redis)
 */
export async function fetchCurrentMatches() {
  try {
    const response = await fetch(`${BACKEND_URL}/matches`);
    const data = await response.json();

    if (data.status !== "success") {
      throw new Error(data.reason || "Failed to fetch matches from local backend");
    }

    return { data: data.data || [], source: data.source };
  } catch (error) {
    console.error("fetchCurrentMatches error:", error);
    throw error;
  }
}
