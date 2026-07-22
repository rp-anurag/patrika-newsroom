/**
 * GET /api/digital/youtube
 *
 * Fetches Rajasthan Patrika TV YouTube channel analytics.
 * Uses:
 *  1. YouTube InnerTube API  → all videos from /videos tab with duration, title, views
 *  2. YouTube RSS feed       → 15 most recent videos with exact ISO timestamps
 *  3. Channel page scrape    → subscribers, avatar
 *
 * Returns: channel meta, today_videos (with duration), all_videos (30), stats, watch_time
 * Cache: 10 minutes
 */
const https    = require('https');
const fetch    = require('node-fetch');
const { getUser }              = require('../_lib/auth');
const { setCors, handleOptions } = require('../_lib/cors');

// ── Constants ─────────────────────────────────────────────────────────────────
const CHANNEL_HANDLE  = '@rajasthanpatrikatv';
const CHANNEL_ID      = 'UCWk-7Yosyvzln9ZzJg8BvVg';
const CHANNEL_URL     = `https://www.youtube.com/${CHANNEL_HANDLE}`;
const VIDEOS_PARAMS   = 'EgZ2aWRlb3PyBgQKAjoA'; // InnerTube "Videos" tab filter
const SHORTS_PARAMS   = 'EgZzaG9ydHMy';          // InnerTube "Shorts" tab filter

const SSL_AGENT  = new https.Agent({ rejectUnauthorized: false });
const HTML_OPTS  = {
  agent: SSL_AGENT, timeout: 15000, redirect: 'follow',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
  },
};
const API_OPTS = {
  agent: SSL_AGENT, timeout: 15000,
  headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
};
const INNERTUBE_CONTEXT = {
  client: { clientName: 'WEB', clientVersion: '2.20240227.06.00', hl: 'en', gl: 'IN' },
};

// ── Cache ─────────────────────────────────────────────────────────────────────
let cache = null, cacheTs = 0;
const CACHE_TTL = 10 * 60 * 1000;

// ── Duration helpers ──────────────────────────────────────────────────────────
function parseDuration(str) {
  if (!str) return 0;
  const parts = str.trim().split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parseInt(str) || 0;
}

function fmtDuration(sec) {
  if (!sec) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function fmtWatchTime(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

function classifyVideo(durationSec) {
  if (!durationSec) return 'unknown';
  if (durationSec < 180)  return 'short';  // < 3 min
  if (durationSec < 1200) return 'medium'; // 3–20 min
  return 'long';                            // > 20 min
}

// ── Relative-time today detection ─────────────────────────────────────────────
function isRelativeToday(text) {
  if (!text) return false;
  const m = text.match(/^(\d+)\s+(second|minute|hour)s?\s+ago$/i);
  if (!m) return false;
  const [, n, unit] = m;
  const minutes = unit.toLowerCase() === 'second' ? parseInt(n) / 60
                : unit.toLowerCase() === 'minute' ? parseInt(n)
                : parseInt(n) * 60;
  return minutes < 1440; // within 24 hours
}

// ── XML helpers (for RSS) ─────────────────────────────────────────────────────
function decodeXml(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
function xmlAttr(xml, tag, attr) {
  const m = xml.match(new RegExp(`<${tag}[^>]+${attr}="([^"]*)"`));
  return m ? decodeXml(m[1]) : '';
}
function xmlTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return m ? decodeXml(m[1].trim()) : '';
}

// ── RSS feed → 15 most recent videos (exact timestamps, views) ────────────────
async function fetchRSS() {
  const res = await fetch(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`, HTML_OPTS
  );
  if (!res.ok) throw new Error(`RSS ${res.status}`);
  const xml  = await res.text();
  const videos = [];
  for (const chunk of xml.split('<entry>').slice(1)) {
    const entry    = chunk.split('</entry>')[0];
    const videoId  = xmlTag(entry, 'yt:videoId');
    if (!videoId) continue;
    const title    = xmlTag(entry, 'media:title') || xmlTag(entry, 'title');
    const published= xmlTag(entry, 'published');
    const desc     = xmlTag(entry, 'media:description');
    const thumb    = xmlAttr(entry, 'media:thumbnail', 'url');
    const views    = parseInt(xmlAttr(entry, 'media:statistics', 'views') || '0', 10);
    videos.push({
      id: videoId,
      title,
      published,    // exact ISO timestamp
      description: desc.slice(0, 250),
      thumbnail:  thumb || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      url:        `https://www.youtube.com/watch?v=${videoId}`,
      views,
      source: 'rss',
    });
  }
  return videos;
}

// ── InnerTube browse → up to 30 videos (duration, relative publish time) ──────
async function fetchInnerTube(params) {
  const res = await fetch('https://www.youtube.com/youtubei/v1/browse?prettyPrint=false', {
    ...API_OPTS,
    method: 'POST',
    body: JSON.stringify({ context: INNERTUBE_CONTEXT, browseId: CHANNEL_ID, params }),
  });
  if (!res.ok) throw new Error(`InnerTube ${res.status}`);
  return res.json();
}

function parseLockupViewModel(lvm) {
  if (!lvm) return null;
  const videoId = lvm.contentId;
  if (!videoId) return null;

  // Duration: inside thumbnail overlay badge
  let durationStr = '';
  const overlays = lvm.contentImage?.thumbnailViewModel?.overlays || [];
  for (const o of overlays) {
    const badge = o?.thumbnailBottomOverlayViewModel?.badges?.[0]?.thumbnailBadgeViewModel;
    if (badge?.text && /\d:\d/.test(badge.text)) { durationStr = badge.text; break; }
  }

  // Title
  const title = lvm.metadata?.lockupMetadataViewModel?.title?.content || '';

  // metadataRows → views + publishedAgo
  let views = '';
  let publishedAgo = '';
  const rows = lvm.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows || [];
  for (const row of rows) {
    for (const part of (row.metadataParts || [])) {
      const c = part.text?.content || '';
      if (/view/i.test(c)) views = c;
      else if (/ago/i.test(c)) publishedAgo = c;
    }
  }

  // Thumbnail
  const thumb = lvm.contentImage?.thumbnailViewModel?.image?.sources?.slice(-1)[0]?.url
             || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  const durationSec = parseDuration(durationStr);
  const isShort     = lvm.contentType === 'LOCKUP_CONTENT_TYPE_SHORT' || durationSec <= 60;

  return {
    id:          videoId,
    title,
    durationStr: durationStr || (isShort ? 'Short' : ''),
    durationSec,
    isShort,
    type:        classifyVideo(durationSec),
    views:       parseInt((views.replace(/[^0-9.KMBkmb]/gi, '') || '0'), 10) || 0,
    viewsText:   views,
    publishedAgo,
    todayVideo:  isRelativeToday(publishedAgo),
    thumbnail:   thumb.split('?')[0], // strip query params
    url:         `https://www.youtube.com/watch?v=${videoId}`,
    source:      'innertube',
  };
}

function extractLockupVideos(data) {
  const videos = [];
  const tabs   = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
  for (const tab of tabs) {
    const contents = tab?.tabRenderer?.content?.richGridRenderer?.contents || [];
    for (const item of contents) {
      const lvm = item?.richItemRenderer?.content?.lockupViewModel;
      if (!lvm) continue;
      const v = parseLockupViewModel(lvm);
      if (v) videos.push(v);
    }
    if (videos.length) break; // found the active tab
  }
  return videos;
}

// ── Scrape channel page → avatar, subscribers ─────────────────────────────────
async function scrapeChannelMeta() {
  const res  = await fetch(CHANNEL_URL + '/videos', HTML_OPTS);
  if (!res.ok) return {};
  const html = await res.text();

  let channelId = CHANNEL_ID;
  for (const p of [/"externalId"\s*:\s*"(UC[^"]+)"/, /"browseId"\s*:\s*"(UC[^"]+)"/]) {
    const m = html.match(p); if (m) { channelId = m[1]; break; }
  }

  let subscribers = '';
  for (const p of [/([\d.]+[MKBmkb])\s*subscribers/i, /([\d,]+)\s*subscribers/i]) {
    const m = html.match(p); if (m) { subscribers = m[1]; break; }
  }

  const avatar = (html.match(/"avatar"\s*:\s*\{"thumbnails"\s*:\s*\[\{"url"\s*:\s*"([^"]+)"/) || [])[1] || '';

  let channelName = 'Rajasthan Patrika TV';
  const nm = html.match(/"channelMetadataRenderer"\s*:\s*\{[^}]*"title"\s*:\s*"([^"]+)"/);
  if (nm) channelName = nm[1];

  return { channelId, channelName, subscribers, avatar };
}

// ── Derive stats ───────────────────────────────────────────────────────────────
function buildStats(allVideos, todayVideos) {
  const todaySec   = todayVideos.reduce((s, v) => s + (v.durationSec || 0), 0);
  const byType     = { short: 0, medium: 0, long: 0, unknown: 0 };
  for (const v of todayVideos) byType[v.type || 'unknown']++;

  const now   = Date.now();
  const vWith = allVideos.filter(v => v.published);
  const r7    = vWith.filter(v => (now - new Date(v.published)) < 7 * 86400000);
  const r30   = vWith.filter(v => (now - new Date(v.published)) < 30 * 86400000);

  const topByViews = [...allVideos].sort((a, b) => (b.views||0) - (a.views||0))[0];

  const byHour = {}, byDay = { 0:0,1:0,2:0,3:0,4:0,5:0,6:0 };
  for (const v of allVideos.filter(x => x.published)) {
    const d = new Date(v.published);
    const h = d.getHours(); byHour[h] = (byHour[h]||0) + 1;
    byDay[d.getDay()]++;
  }

  return {
    totalToday:   todayVideos.length,
    watchTimeSec: todaySec,
    watchTimeStr: fmtWatchTime(todaySec),
    byType,
    last7Days:    r7.length,
    last30Days:   r30.length,
    total:        allVideos.length,
    topVideo:     topByViews ? { id: topByViews.id, title: topByViews.title, views: topByViews.views } : null,
    byHour,
    byDay,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  const user = getUser(req);
  if (!user) return res.status(403).json({ error: 'Auth required' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const force = req.query.refresh === '1';
  const now   = Date.now();
  if (!force && cache && (now - cacheTs) < CACHE_TTL) return res.json(cache);

  try {
    // Fetch all three in parallel
    const [rssVideos, innerTubeData, channelMeta] = await Promise.allSettled([
      fetchRSS(),
      fetchInnerTube(VIDEOS_PARAMS),
      scrapeChannelMeta(),
    ]);

    const rss  = rssVideos.status === 'fulfilled' ? rssVideos.value : [];
    const itData = innerTubeData.status === 'fulfilled' ? innerTubeData.value : null;
    const meta   = channelMeta.status === 'fulfilled' ? channelMeta.value : {};

    // InnerTube videos (up to 30, with duration)
    const itVideos = itData ? extractLockupVideos(itData) : [];

    // Build a map from InnerTube videoId → video (for duration lookup)
    const itMap = {};
    for (const v of itVideos) itMap[v.id] = v;

    // Merge RSS → add duration from InnerTube
    const mergedRSS = rss.map(v => {
      const it = itMap[v.id];
      return {
        ...v,
        durationStr: it?.durationStr || '',
        durationSec: it?.durationSec || 0,
        type:        classifyVideo(it?.durationSec || 0),
        viewsText:   it?.viewsText || (v.views ? `${v.views.toLocaleString('en-IN')} views` : ''),
      };
    });

    // Today's videos = InnerTube videos where publishedAgo is within 24h
    // Plus RSS videos where publish date matches today IST
    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    const todayFromIT = itVideos.filter(v => v.todayVideo);
    const seenIT      = new Set(todayFromIT.map(v => v.id));

    // Also include RSS videos published today that aren't already in IT list
    const todayFromRSS = mergedRSS.filter(v => {
      if (seenIT.has(v.id)) return false;
      if (!v.published) return false;
      return new Date(v.published).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === todayIST;
    });

    // Merge today list: InnerTube first (has duration), then RSS-only
    const todayVideos = [
      ...todayFromIT.map(v => {
        const rssV = rss.find(r => r.id === v.id);
        return { ...v, published: rssV?.published || null, description: rssV?.description || '' };
      }),
      ...todayFromRSS,
    ].sort((a, b) => {
      // Sort by published time desc (exact timestamps first, then "X minutes ago")
      const tA = a.published ? new Date(a.published).getTime() : 0;
      const tB = b.published ? new Date(b.published).getTime() : 0;
      return tB - tA;
    });

    const stats = buildStats([...new Map([...mergedRSS, ...itVideos].map(v => [v.id, v])).values()], todayVideos);

    const result = {
      channel: {
        handle:      CHANNEL_HANDLE,
        name:        meta.channelName || 'Rajasthan Patrika TV',
        id:          CHANNEL_ID,
        subscribers: meta.subscribers || '',
        avatar:      meta.avatar || '',
        url:         CHANNEL_URL,
      },
      today_videos: todayVideos,
      videos:       mergedRSS,       // RSS with duration merged in
      all_videos:   itVideos,        // InnerTube full list (30)
      stats,
      fetched_at:   new Date().toISOString(),
    };

    cache   = result;
    cacheTs = now;
    return res.json(result);

  } catch (err) {
    console.error('[youtube] handler error:', err);
    if (cache) return res.json({ ...cache, stale: true });
    return res.status(500).json({ error: err.message });
  }
};
