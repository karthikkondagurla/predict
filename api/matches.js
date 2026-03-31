const API_KEY = process.env.VITE_CRICAPI_KEY;
const BASE_URL = 'https://api.cricapi.com/v1';
const IPL_SERIES_ID = "87c62aac-bc3c-4738-ab93-19da0690488f";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!API_KEY) {
    return res.status(500).json({ status: 'error', reason: 'Missing CricAPI Key' });
  }

  try {
    const response = await fetch(`${BASE_URL}/series_info?apikey=${API_KEY}&id=${IPL_SERIES_ID}`);
    const data = await response.json();

    if (data.status !== "success") {
      throw new Error(data.reason || "Failed to fetch matches from CricAPI");
    }

    const rawMatches = data.data?.matchList || [];
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const filteredMatches = rawMatches.filter(match => {
      return match.dateTimeGMT && (match.dateTimeGMT.startsWith(todayStr) || match.dateTimeGMT.startsWith(yesterdayStr));
    });

    res.status(200).json({
      status: 'success',
      data: filteredMatches,
      source: 'api'
    });
  } catch (error) {
    console.error("API Route Error:", error);
    res.status(500).json({ status: 'error', reason: error.message });
  }
}
