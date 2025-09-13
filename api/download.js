const axios = require('axios');
const ytdl = require('ytdl-core');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { videoId } = req.query;

  if (!videoId) {
    return res.status(400).json({ error: 'Video ID is required' });
  }

  try {
    // Validate YouTube video ID
    if (!ytdl.validateID(videoId) && !ytdl.validateURL(`https://www.youtube.com/watch?v=${videoId}`)) {
      return res.status(400).json({ error: 'Invalid YouTube video ID' });
    }

    // Get video info
    const info = await ytdl.getInfo(videoId);
    
    // Find the best video format with 720p quality and no audio
    const format = ytdl.chooseFormat(info.formats, {
      quality: '136', // 720p without audio
      filter: format => format.qualityLabel === '720p' && !format.hasAudio
    });

    // If 720p without audio is not available, try to get the best video-only format
    if (!format) {
      const videoFormats = ytdl.filterFormats(info.formats, 'videoonly');
      if (videoFormats.length === 0) {
        return res.status(404).json({ error: 'No suitable video format found' });
      }
      
      // Sort by quality and select the best available
      videoFormats.sort((a, b) => {
        const aHeight = a.height || 0;
        const bHeight = b.height || 0;
        return bHeight - aHeight;
      });
      
      format = videoFormats[0];
    }

    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="darkzone-yt-${videoId}.mp4"`);
    res.setHeader('Content-Type', 'video/mp4');

    // Stream the video
    ytdl(`https://www.youtube.com/watch?v=${videoId}`, { format })
      .on('error', (error) => {
        console.error('Download error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Download failed' });
        }
      })
      .pipe(res);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
