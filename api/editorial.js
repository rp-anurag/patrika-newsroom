/**
 * GET /api/editorial?date=YYYY-MM-DD&state=&month=YYYY-MM
 *
 * Returns:
 *   topNews       — Today's editor-submitted top stories (top_news table)
 *   storyMix      — Yesterday's story-type breakdown
 *   targetVsActual— Yesterday actual vs daily_target_ecms for Reporter profile
 *   deskReview    — Latest desk-person editing stats
 *   planning      — Recent editorial planning entries
 *   anniversaries — Stories filed exactly 1 year ago today (story-anniversary engine)
 *   rndIdeas      — Recent R&D ideas from states
 *   coverageGaps  — Branches with zero reporter visits in last 7 days
 *   prominentDays — Important days for the requested month
 */
const { query }       = require('./_lib/mysql');
const { requireRole } = require('./_lib/auth');
const { setCors, handleOptions } = require('./_lib/cors');

// ── Prominent days ────────────────────────────────────────────────────────────
// Recurring (MM-DD) + specific 2026 (YYYY-MM-DD)
// type: national | festival | state | media | health | environment | sports | social

const RECURRING = [
  { md:'01-12', label:'National Youth Day (Vivekananda Jayanti)', type:'national', color:'#d71920', angle:'Youth programs, Vivekananda quotes, youth achievers in your district' },
  { md:'01-15', label:'Army Day', type:'national', color:'#d71920', angle:'Veterans stories, local soldiers, defence exhibitions, canteen prices' },
  { md:'01-26', label:'Republic Day 🇮🇳', type:'national', color:'#d71920', angle:'Flag hoisting, parade coverage, CM speech, state tableau, security story' },
  { md:'02-04', label:'World Cancer Day', type:'health', color:'#7c3aed', angle:'Local cancer hospital capacity, survivor stories, screening camps' },
  { md:'02-14', label:"Valentine's Day", type:'social', color:'#e8843a', angle:'Youth celebrations, flower markets, anti-Valentine protests, police action' },
  { md:'02-28', label:'National Science Day', type:'national', color:'#3b82f6', angle:'Science exhibitions, school innovations, research institute visit' },
  { md:'03-08', label:"International Women's Day", type:'national', color:'#d71920', angle:'Women achievers, gender pay gap, female workforce data, violence stats' },
  { md:'03-22', label:'World Water Day', type:'environment', color:'#3b82f6', angle:'Water crisis, dam levels, drinking water access, Rajasthan drought' },
  { md:'03-23', label:'Bhagat Singh Martyrdom Day', type:'national', color:'#d71920', angle:'Patriot tributes, local events, youth remembrance, history feature' },
  { md:'03-30', label:'Rajasthan Foundation Day', type:'state', color:'#C9A227', angle:'State achievements, development data, cultural events, historical feature' },
  { md:'04-07', label:'World Health Day', type:'health', color:'#16a34a', angle:'Healthcare access, local hospital capacity, doctor-to-population ratio' },
  { md:'04-14', label:'Dr. Ambedkar Jayanti', type:'national', color:'#d71920', angle:'Dalit empowerment, reservations, govt schemes, community tributes' },
  { md:'04-22', label:'Earth Day', type:'environment', color:'#16a34a', angle:'Pollution, green initiatives, river status, plastic ban compliance' },
  { md:'04-23', label:'World Book Day', type:'social', color:'#3b82f6', angle:'Library visits, reading habits, book fairs, local author profile' },
  { md:'05-01', label:'International Labour Day', type:'national', color:'#d71920', angle:'Worker rights, wage stories, labour laws, MNREGA, migrant workers' },
  { md:'05-03', label:'World Press Freedom Day', type:'media', color:'#C9A227', angle:'Journalist safety index, press freedom, local media landscape story' },
  { md:'05-11', label:'National Technology Day', type:'national', color:'#3b82f6', angle:'Pokhran anniversary, tech innovations, local startups, digital India' },
  { md:'05-31', label:'World No Tobacco Day', type:'health', color:'#7c3aed', angle:'Tobacco use stats, anti-tobacco campaigns, local health impact' },
  { md:'06-05', label:'World Environment Day', type:'environment', color:'#16a34a', angle:'Local environmental issues, tree plantation drives, pollution data' },
  { md:'06-21', label:'International Yoga Day', type:'national', color:'#16a34a', angle:'Mass yoga events, health benefits, govt programs, celebrity yoga' },
  { md:'07-01', label:"Doctors' Day / GST Anniversary", type:'national', color:'#3b82f6', angle:'Doctor shortfall data, healthcare access, GST impact on traders' },
  { md:'07-26', label:'Kargil Vijay Diwas', type:'national', color:'#d71920', angle:'War veterans, local Kargil heroes, families, army tributes, widows' },
  { md:'08-09', label:'Quit India Movement Day', type:'national', color:'#d71920', angle:'Freedom struggle stories, local historical events, school programs' },
  { md:'08-12', label:'International Youth Day', type:'social', color:'#3b82f6', angle:'Youth unemployment, education gaps, skill development, brain drain' },
  { md:'08-15', label:'Independence Day 🇮🇳', type:'national', color:'#d71920', angle:'Flag hoisting, CM speech, development milestones, security, freebies' },
  { md:'09-05', label:"Teacher's Day", type:'national', color:'#C9A227', angle:'Best teacher stories, education quality, govt school condition' },
  { md:'09-14', label:'Hindi Diwas', type:'national', color:'#d71920', angle:'Hindi language events, literary programs, Hindi medium school quality' },
  { md:'09-16', label:'World Ozone Day', type:'environment', color:'#16a34a', angle:'Air quality, pollution levels, climate change local impact' },
  { md:'09-29', label:'World Heart Day', type:'health', color:'#d71920', angle:'Heart disease stats, local cardiologists, lifestyle, stress in cities' },
  { md:'10-02', label:'Gandhi Jayanti / Swachh Bharat', type:'national', color:'#d71920', angle:'Cleanliness drives, Swachh Bharat status, ODF villages, peace events' },
  { md:'10-16', label:'World Food Day', type:'social', color:'#C9A227', angle:'Food security, PDS, malnutrition data, farmer income, food inflation' },
  { md:'10-31', label:'Sardar Patel Jayanti (Rashtriya Ekta Diwas)', type:'national', color:'#d71920', angle:'Unity run, integration events, Statue of Unity, national integrity' },
  { md:'11-01', label:'MP & CG Foundation Day', type:'state', color:'#C9A227', angle:'State development achievements, cultural programs, CM events, data story' },
  { md:'11-14', label:"Children's Day", type:'national', color:'#3b82f6', angle:'Child welfare, education access, child labour data, school events' },
  { md:'11-16', label:'National Press Day', type:'media', color:'#C9A227', angle:'Journalist awards, press freedom, local media landscape, DAVP' },
  { md:'11-26', label:'Constitution Day', type:'national', color:'#d71920', angle:'Constitutional rights, legal awareness, bar events, fundamental rights' },
  { md:'12-01', label:'World AIDS Day', type:'health', color:'#d71920', angle:'HIV awareness, local health dept data, testing camps, stigma story' },
  { md:'12-04', label:'Navy Day', type:'national', color:'#3b82f6', angle:'Navy events, maritime security, INS visits, coast guard' },
  { md:'12-10', label:'Human Rights Day', type:'national', color:'#7c3aed', angle:'Rights violations, local cases, NHRC data, NGO work, prisoners' },
  { md:'12-16', label:'Vijay Diwas (1971 War)', type:'national', color:'#d71920', angle:'Veterans, Bangladesh liberation, local 1971 heroes, war widows' },
  { md:'12-22', label:'National Mathematics Day', type:'social', color:'#3b82f6', angle:'Ramanujan legacy, math olympiad winners, student innovations' },
  { md:'12-25', label:'Christmas', type:'festival', color:'#16a34a', angle:'Celebrations, church events, Christian community stories, carol services' },

  // ── Hyperlocal: Rajasthan ──────────────────────────────────────────────────
  { md:'03-30', label:'Rajasthan Diwas — State Special', type:'local_raj', region:'RAJ', color:'#f97316', angle:'Special state edition: 75 years of Rajasthan — development report card, water crisis, desert economy, tourism numbers, border district stories, cultural identity' },
  { md:'08-09', label:'Kajali Teej (approx)', type:'local_raj', region:'RAJ', color:'#16a34a', angle:'Women\'s sawan festival — mehendi markets, traditional songs, Jaipur jhankis, social angle on women\'s fasting traditions; contrast rural vs urban celebrations' },
  { md:'10-15', label:'Shekhawati Festival (approx)', type:'local_raj', region:'RAJ', color:'#f97316', angle:'Shekhawati haveli paintings, fresco art revival, heritage walks in Mandawa/Nawalgarh/Jhunjhunu; tourism potential story' },
  { md:'01-14', label:'Uttarayan / Makar Sankranti (Rajasthan)', type:'local_raj', region:'RAJ', color:'#C9A227', angle:'Jaipur International Kite Festival — tourism revenue, kite market economy, Patang bazaar, foreign tourists, accident data; Makar Mela at Pushkar' },

  // ── Hyperlocal: Madhya Pradesh ────────────────────────────────────────────
  { md:'12-02', label:'Bhopal Gas Tragedy Remembrance', type:'local_mp', region:'MP', color:'#374151', angle:'Dec 2–3, 1984 tragedy — survivors condition today, compensation pending cases, UCIL site contamination, health impact on next generation, govt accountability, Dow Chemical legal status' },
  { md:'12-03', label:'Bhopal Gas Tragedy — Vigil Night', type:'local_mp', region:'MP', color:'#374151', angle:'Candle march, survivor testimonies, medical facilities at Bhopal gas victims hospital, SC case status, environmental remediation progress in Bhopal' },
  { md:'11-01', label:'MP Foundation Day — State Special', type:'local_mp', region:'MP', color:'#8b5cf6', angle:'MP statehood since 1956 — growth data, infrastructure gaps, Narmada projects, industrial development, tribal belt stories, famous sons/daughters' },
  { md:'06-21', label:'Yoga Day — Mahakal Connection', type:'local_mp', region:'MP', color:'#16a34a', angle:'Ujjain Mahakaleshwar as Yoga capital pitch; mass yoga at Ramghat, Omkareshwar, Bhima Betka; Patanjali impact, spiritual tourism numbers in MP' },

  // ── Hyperlocal: Chhattisgarh ──────────────────────────────────────────────
  { md:'11-01', label:'CG Foundation Day — State Special', type:'local_cg', region:'CG', color:'#0891b2', angle:'Chhattisgarh since 2000 — 25 years of statehood; mineral wealth vs tribal displacement, Naxal area development, rice bowl of India, state identity and culture' },
  { md:'11-09', label:'Goncha Festival — Bastar (approx)', type:'local_cg', region:'CG', color:'#0891b2', angle:'Unique Bastar chariot festival unlike Puri — tribal traditions, wood chariot, folk deity procession; rare cultural angle for national readership' },

  // ── Hyperlocal: MP + CG (both states) ────────────────────────────────────
  { md:'11-15', label:'Janjatiya Gaurav Diwas', type:'local_mpcg', region:'MPCG', color:'#C9A227', angle:'Birsa Munda birth anniversary — tribal welfare schemes, Van Adhikar Patta, PESA act implementation, forest rights, displaced tribal families, literacy data in MP/CG tribal belt' },
  { md:'10-02', label:'Gandhi Jayanti / Tribal Link (MP-CG)', type:'local_mpcg', region:'MPCG', color:'#d71920', angle:'Gram Swaraj in tribal MP/CG -- Mahatma\'s vision vs ground reality; MNREGA in Adivasi districts, village self-governance under PESA, forest produce economy' },
];

// Fixed dates in 2026 Gregorian calendar
const SPECIFIC_2026 = [
  { date:'2026-01-13', label:'Lohri', type:'festival', color:'#e8843a', angle:'Bonfire events, Punjabi community, winter harvest stories' },
  { date:'2026-01-14', label:'Makar Sankranti / Pongal / Uttarayan', type:'festival', color:'#C9A227', angle:'Kite festival (Jaipur), harvest celebrations, mela, river dip' },
  { date:'2026-02-03', label:'Vasant Panchami / Saraswati Puja', type:'festival', color:'#C9A227', angle:'Yellow theme, Saraswati temples, school celebrations, spring story' },
  { date:'2026-02-26', label:'Maha Shivratri', type:'festival', color:'#7c3aed', angle:'Temple rush, midnight puja, Mahakal Ujjain, devotee crowd, traffic' },
  { date:'2026-03-02', label:'Holi (Holika Dahan)', type:'festival', color:'#e8843a', angle:'Bonfire events, safety, colour markets, water conservation angle' },
  { date:'2026-03-03', label:'Holi', type:'festival', color:'#e8843a', angle:'Colour celebrations, public events, social angle, tourism, prices' },
  { date:'2026-03-29', label:'Ram Navami', type:'festival', color:'#d71920', angle:'Processions, temple events, Ayodhya, shobha yatra, security' },
  { date:'2026-04-02', label:'Good Friday', type:'festival', color:'#7c3aed', angle:'Church events, Christian community, prayer services' },
  { date:'2026-04-04', label:'Easter', type:'festival', color:'#16a34a', angle:'Easter celebrations, church events, community stories' },
  { date:'2026-04-14', label:'Baisakhi', type:'festival', color:'#C9A227', angle:'Harvest festival, Sikh community events, Amritsar Golden Temple' },
  { date:'2026-05-08', label:'Buddha Purnima', type:'festival', color:'#C9A227', angle:'Buddhist celebrations, Bodh Gaya, peace events, monastery visit' },
  { date:'2026-06-20', label:'Eid ul-Adha / Bakrid (tentative)', type:'festival', color:'#16a34a', angle:'Community celebrations, livestock market, social harmony angle' },
  { date:'2026-07-07', label:'Muharram (tentative)', type:'festival', color:'#7c3aed', angle:'Processions, Tazia, community events, interfaith harmony' },
  { date:'2026-08-05', label:'Raksha Bandhan', type:'festival', color:'#e8843a', angle:'Rakhi market, sibling stories, online rakhi, economic angle' },
  { date:'2026-08-19', label:'Janmashtami', type:'festival', color:'#d71920', angle:'Mathura-Vrindavan, dahi handi, temple rush, midnight celebrations' },
  { date:'2026-09-10', label:'Ganesh Chaturthi', type:'festival', color:'#e8843a', angle:'Pandal visits, idol market, eco-friendly Ganesh, visarjan day' },
  { date:'2026-09-14', label:'Eid Milad-un-Nabi (tentative)', type:'festival', color:'#16a34a', angle:'Julus, community celebrations, peace messages, procession story' },
  { date:'2026-10-03', label:'Navratri begins', type:'festival', color:'#d71920', angle:'Garba venues, Devi melas, crowd management, cultural events' },
  { date:'2026-10-12', label:'Dussehra', type:'festival', color:'#d71920', angle:'Ravana dahan, Ramlila, mela, security, effigies market' },
  { date:'2026-10-19', label:'Karva Chauth', type:'festival', color:'#e8843a', angle:'Women celebrations, moonrise time, market, social angle' },
  { date:'2026-10-31', label:'Diwali', type:'festival', color:'#C9A227', angle:'Fireworks safety, market, Lakshmi puja, pollution, sales data' },
  { date:'2026-11-01', label:'Govardhan Puja / Annakut', type:'festival', color:'#d71920', angle:'Temple events, community feast, Braj region' },
  { date:'2026-11-07', label:'Chhath Puja', type:'festival', color:'#C9A227', angle:'Ghats, sunrise arghya, UP/Bihar community, river cleanup, crowd' },
  { date:'2026-11-19', label:'Guru Nanak Jayanti', type:'festival', color:'#16a34a', angle:'Gurdwara events, langar, Sikh community, procession, kirtan' },
  // Sports
  { date:'2026-03-15', label:'IPL 2026 (approx start)', type:'sports', color:'#3b82f6', angle:'Team previews, local players, ticket sales, fan zone economy' },
  { date:'2026-06-11', label:'FIFA World Cup 2026 begins', type:'sports', color:'#3b82f6', angle:'Watch parties, fan zones, local football clubs, India angle' },
  { date:'2026-08-01', label:'Commonwealth Games 2026 (approx)', type:'sports', color:'#3b82f6', angle:'Indian athletes, local champions, medal hope stories' },

  // ── Hyperlocal 2026: Rajasthan ────────────────────────────────────────────
  { date:'2026-01-29', label:'Jaipur Literature Festival 2026 (JLF)', type:'local_raj', region:'RAJ', color:'#f97316', angle:'India\'s biggest lit fest — author lineup, book launches, Rajasthan tourism boost, hotel occupancy, volunteer stories; debate panels angle; ticket prices; international authors visiting' },
  { date:'2026-02-11', label:'Desert Festival, Jaisalmer 2026', type:'local_raj', region:'RAJ', color:'#f97316', angle:'3-day Magha Purnima festival — camel races, turban-tying, folk music, Mr. Desert contest, tourism impact, hotel revenue in western Rajasthan, foreign tourist angle' },
  { date:'2026-03-25', label:'Gangaur / Mewar Festival 2026', type:'local_raj', region:'RAJ', color:'#f97316', angle:'Udaipur procession of Isar-Gangaur idols on Lake Pichola — women\'s traditions, local crafts, tourism, comparing Jaipur vs Udaipur Gangaur; suhag symbol story' },
  { date:'2026-05-22', label:'Maharana Pratap Jayanti 2026', type:'local_raj', region:'RAJ', color:'#f97316', angle:'State holiday — Haldighati battle legacy, Mewar royalty, Chetak story, Udaipur events, comparative history feature, school programs, BJP vs Congress angle on celebrations' },
  { date:'2026-07-21', label:'Hariyali Teej 2026', type:'local_raj', region:'RAJ', color:'#16a34a', angle:'Sawan women\'s festival — mehendi bazaar economy, swing decorations, green sari market, traditional songs, Jaipur state fair; contrast urban mall celebrations vs rural traditions; women\'s health angle' },
  { date:'2026-08-19', label:'Kajali Teej (Badi Teej) 2026', type:'local_raj', region:'RAJ', color:'#16a34a', angle:'Udaipur, Bundi, Bikaner processions — married women fasting traditions, local fair economy, social media vs tradition angle; Bundi Kajali Teej is most famous in Rajasthan' },
  { date:'2026-10-27', label:'Pushkar Camel Fair 2026 (Kartik Purnima)', type:'local_raj', region:'RAJ', color:'#f97316', angle:'World\'s largest camel fair — livestock trade volume, foreign tourists, tent city economy, holy dip at Pushkar Lake, Brahma temple; traders from Rajasthan, Haryana, Gujarat; animal welfare angle' },
  { date:'2026-11-01', label:'Ranthambore Wildlife Week', type:'local_raj', region:'RAJ', color:'#16a34a', angle:'Tiger census results, tourism numbers, human-wildlife conflict in buffer zones, tribal displacement for tiger reserve expansion, Project Tiger success story' },

  // ── Hyperlocal 2026: Madhya Pradesh ──────────────────────────────────────
  { date:'2026-02-20', label:'Khajuraho Dance Festival 2026', type:'local_mp', region:'MP', color:'#8b5cf6', angle:'6-day Khajuraho festival — classical dance forms against UNESCO heritage temple backdrop; tourism boost, hotel revenue, artist profiles, local economy, international performers' },
  { date:'2026-02-27', label:'Orchha Festival 2026', type:'local_mp', region:'MP', color:'#8b5cf6', angle:'Heritage fest at Orchha — Bundela architecture, Ram Raja temple unique story (Ram worshipped as king), light & sound show, local guide economy, MP tourism data' },
  { date:'2026-07-16', label:'Ustad Alauddin Khan Samaroh, Maihar', type:'local_mp', region:'MP', color:'#8b5cf6', angle:'Annual music festival at Maihar Rewa — Ravi Shankar\'s guru tribute, Maihar gharana, classical music revival, women musicians, Maihar town profile' },
  { date:'2026-11-28', label:'Tansen Samaroh 2026, Gwalior', type:'local_mp', region:'MP', color:'#8b5cf6', angle:'Akbar\'s legendary court singer Tansen\'s birth festival — Gwalior fort setting, classical music, Dhrupad tradition, Gwalior gharana story; tourism angle; UNESCO intangible heritage push' },
  { date:'2026-12-02', label:'Bhopal Gas Tragedy 42nd Year', type:'local_mp', region:'MP', color:'#374151', angle:'42 years since Dec 2, 1984 — gas victims still waiting for justice; contaminated water in Bhopal; health data of next generation; SC case status; Dow Chemical, UCC compensation story' },

  // ── Hyperlocal 2026: Chhattisgarh ─────────────────────────────────────────
  { date:'2026-02-12', label:'Rajim Kumbh Mela 2026 begins', type:'local_cg', region:'CG', color:'#0891b2', angle:'CG\'s own Kumbh at Triveni Sangam (Mahanadi-Pairi-Sondur), Rajim — bathing ghat rush, sadhus, trade fair, pilgrims from CG-Odisha-MP border; Rajim temple history story' },
  { date:'2026-09-15', label:'Chakradhar Samaroh, Raigarh', type:'local_cg', region:'CG', color:'#0891b2', angle:'Annual classical music/dance festival named after Raigarh king — patronage of arts story, gharana revival, CG tribal dance influence on classical forms; tourist profile of Raigarh' },
  { date:'2026-10-12', label:'Bastar Dussehra Special (75-day festival)', type:'local_cg', region:'CG', color:'#0891b2', angle:'World\'s longest Dussehra — 75 days starting Shravan Amavasya; no Ravana burning, unique tribal Maa Danteshwari rituals; Jagdalpur story; contrast with national Dussehra; security in Bastar' },
  { date:'2026-12-28', label:'National Tribal Dance Festival, Raipur', type:'local_cg', region:'CG', color:'#0891b2', angle:'Annual tribal dance festival — 27+ states participate; Chhattisgarh as tribal culture hub; Adivasi identity, tradition vs modernization, costumes, drumming; govt tourism promotion data' },
  { date:'2026-11-20', label:'Chhattisgarh Rajyotsav (CG Day) Celebration', type:'local_cg', region:'CG', color:'#0891b2', angle:'Chhattisgarh\'s statehood month peak — 25 years of separate state; rice bowl economy, mineral royalty debate, Adivasi land rights, Naxal area development, state identity pride story' },

  // ── Hyperlocal 2026: MP + CG shared ──────────────────────────────────────
  { date:'2026-03-08', label:'Narmada Jayanti 2026', type:'local_mpcg', region:'MPCG', color:'#C9A227', angle:'River\'s birth anniversary at Amarkantak — Narmada Parikrama pilgrims, river pollution data, dam displacement still unresolved, sand mining crisis, drinking water status in MP towns along Narmada' },
  { date:'2026-11-15', label:'Janjatiya Gaurav Diwas 2026', type:'local_mpcg', region:'MPCG', color:'#C9A227', angle:'Birsa Munda 150th birth year — government\'s flagship tribal events in MP-CG; Van Adhikar Patta pending vs sanctioned; forest rights rejection data; tribal literacy gaps; self-help group stories' },
];

/**
 * Return prominent days for a given YYYY-MM month string.
 * regionFilter: 'RAJ' | 'MP' | 'CG' | 'MPCG' | '' (empty = all)
 */
function getProminentDays(monthStr, regionFilter) {
  const [yr, mo] = monthStr.split('-').map(Number);
  const days = [];

  // Helper: should this event be included for the requested region?
  const matchRegion = (e) => {
    if (!regionFilter) return true;                        // no filter → show all
    if (!e.region)   return true;                          // national event → always show
    if (e.region === 'ALL') return true;
    if (e.region === regionFilter) return true;
    // MPCG events visible to both MP and CG
    if (e.region === 'MPCG' && (regionFilter === 'MP' || regionFilter === 'CG')) return true;
    return false;
  };

  // Recurring (MM-DD) events in this month
  RECURRING.forEach(e => {
    const [em, ed] = e.md.split('-').map(Number);
    if (em === mo && matchRegion(e)) {
      days.push({ date: `${yr}-${String(mo).padStart(2,'0')}-${String(ed).padStart(2,'0')}`, ...e });
    }
  });

  // Specific 2026 events in this month
  SPECIFIC_2026.forEach(e => {
    if (e.date.startsWith(`${yr}-${String(mo).padStart(2,'0')}-`) && matchRegion(e)) {
      days.push(e);
    }
  });

  return days.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const yday    = () => new Date(Date.now() - 864e5).toISOString().slice(0, 10);
const daysAgo = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

function safeArr(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  return [];
}

// ── Main handler ──────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { authError, user } = requireRole(req, ['Admin', 'State Head', 'Regional Editor', 'HR', 'Management', 'Legal']);
  if (authError) return res.status(authError.status).json({ error: authError.message });

  // Role-locked state / branch
  let filterState  = req.query.state || '';
  let filterBranch = '';
  if (user.role === 'State Head'      && user.state)  filterState  = user.state;
  if (user.role === 'Regional Editor' && user.state)  filterState  = user.state;
  if (user.role === 'Regional Editor' && user.branch) filterBranch = user.branch;
  if (filterState === 'All') filterState = '';

  const date      = req.query.date  || yday();
  const monthStr  = req.query.month || date.slice(0, 7);
  // Region filter for prominent days: RAJ | MP | CG | MPCG | '' (all)
  const regionFilter = req.query.region || '';
  const yesterday = yday();
  const sevenAgo  = daysAgo(7);

  try {
    const [
      topNewsRows,
      storyMixRows,
      targetRows,
      deskRows,
      planningRows,
      anniversaryRows,
      rndRows,
      visitedBranches,
      allBranches,
    ] = await Promise.all([

      // 1. Today's top news (or last available day)
      query(`SELECT id, news_date, time_slot, state, branch_bureau, top_news
             FROM top_news
             WHERE news_date >= ? ${filterState ? 'AND state = ?' : ''}
             ORDER BY news_date DESC, id DESC LIMIT 20`,
             filterState ? [sevenAgo, filterState] : [sevenAgo]).catch(() => []),

      // 2. Yesterday's story type mix
      query(`SELECT
               SUM(e.Exclusive)       AS exclusive,
               SUM(e.Human_angle)     AS human_angle,
               SUM(e.Datastory)       AS datastory,
               SUM(e.Expose_khulasa)  AS expose,
               SUM(e.Impact_Story)    AS impact,
               SUM(e.Interviews)      AS interviews,
               SUM(e.News_Campaign)   AS campaign,
               SUM(e.Routine_News)    AS routine,
               SUM(e.Spotlight)       AS spotlight,
               SUM(e.Sting_Operation) AS sting,
               SUM(e.No_Story)        AS total,
               SUM(e.No_Photo)        AS photos,
               SUM(e.No_Words)        AS words,
               COUNT(DISTINCT e.Pan_no) AS reporters
             FROM daily_achievment_count_ecms e
             ${filterState || filterBranch ? 'JOIN `user` u ON e.Pan_no = u.pan_no' : ''}
             WHERE DATE(e.entrydate) = ?
             ${filterState  ? 'AND u.State = ?'  : ''}
             ${filterBranch ? 'AND u.Branch = ?' : ''}`,
             [yesterday, filterState, filterBranch].filter(Boolean)).catch(() => [{}]),

      // 3. Reporter targets
      query("SELECT * FROM daily_target_ecms WHERE Story_Type = 'Reporter' LIMIT 1").catch(() => [{}]),

      // 4. Desk review (last 30 days)
      query(`SELECT dr.fromdate, dr.todate, dr.total_edited_news, dr.ai_edited_news, dr.ai_heading_no,
                    u.EMPNAME AS name, u.Branch AS branch
             FROM desk_person_review dr
             LEFT JOIN \`user\` u ON dr.inserted_by = u.id
             WHERE dr.fromdate >= ?
             ORDER BY dr.fromdate DESC LIMIT 20`, [sevenAgo]).catch(() => []),

      // 5. Editorial planning (current + recent 45 days)
      query(`SELECT state, branch, date_from, date_to, editors_story, event, campaign, digital_uv
             FROM planning
             WHERE date_to >= ? ${filterState ? 'AND state = ?' : ''}
             ORDER BY date_from DESC LIMIT 15`,
             filterState ? [daysAgo(45), filterState] : [daysAgo(45)]).catch(() => []),

      // 6. Story anniversaries — same date last year
      query(`SELECT u.pan_no, u.EMPNAME AS name, u.State AS state, u.Branch AS branch,
                    SUM(e.No_Story) AS stories, SUM(e.Exclusive) AS exclusive,
                    SUM(e.Expose_khulasa) AS expose, SUM(e.Impact_Story) AS impact
             FROM daily_achievment_count_ecms e
             JOIN \`user\` u ON e.Pan_no = u.pan_no
             WHERE DATE(e.entrydate) = DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
             ${filterState  ? 'AND u.State = ?'  : ''}
             ${filterBranch ? 'AND u.Branch = ?' : ''}
             GROUP BY u.pan_no, u.EMPNAME, u.State, u.Branch
             ORDER BY stories DESC LIMIT 15`,
             [filterState, filterBranch].filter(Boolean)).catch(() => []),

      // 7. R&D ideas (last 90 days)
      query(`SELECT ri.entry_date, ri.state, ri.branch, ri.idea_float,
                    u.EMPNAME AS submitted_by
             FROM rnd_idea_float ri
             LEFT JOIN \`user\` u ON ri.inserted_by = u.id
             WHERE ri.entry_date >= ?
             ORDER BY ri.entry_date DESC LIMIT 10`, [daysAgo(90)]).catch(() => []),

      // 8. Branches that had visits in last 7 days
      query(`SELECT DISTINCT u.Branch AS branch
             FROM visit_report v
             JOIN \`user\` u ON v.pan_no = u.pan_no
             WHERE DATE(v.visit_date) >= ? AND u.Branch IS NOT NULL AND u.Branch != ''
             ${filterState ? 'AND u.State = ?' : ''}`,
             filterState ? [sevenAgo, filterState] : [sevenAgo]).catch(() => []),

      // 9. All active branches
      query(`SELECT DISTINCT Branch AS branch ${filterState ? ', State AS state' : ''}
             FROM \`user\`
             WHERE (is_emp_working = 1 OR Status IN ('Working','Active'))
               AND Branch IS NOT NULL AND Branch != ''
               ${filterState ? 'AND State = ?' : ''}
             ORDER BY Branch`, filterState ? [filterState] : []).catch(() => []),
    ]);

    // ── Build top news (zip branch_bureau + top_news arrays) ─────────────────
    const topNews = topNewsRows.map(r => {
      const bureaus  = safeArr(r.branch_bureau);
      const stories  = safeArr(r.top_news);
      return {
        id:       r.id,
        date:     r.news_date,
        timeSlot: r.time_slot,
        state:    r.state,
        items: stories.map((s, i) => ({ bureau: bureaus[i] || '', story: s }))
                      .filter(x => x.story),
      };
    });

    // ── Story mix ─────────────────────────────────────────────────────────────
    const mx = storyMixRows[0] || {};
    const storyMix = [
      { name: 'Exclusive',    value: Number(mx.exclusive    || 0), color: '#d71920' },
      { name: 'Human Angle',  value: Number(mx.human_angle  || 0), color: '#C9A227' },
      { name: 'Datastory',    value: Number(mx.datastory    || 0), color: '#3b82f6' },
      { name: 'Exposé',       value: Number(mx.expose       || 0), color: '#8c0a0e' },
      { name: 'Impact',       value: Number(mx.impact       || 0), color: '#16a34a' },
      { name: 'Interview',    value: Number(mx.interviews   || 0), color: '#7c3aed' },
      { name: 'Campaign',     value: Number(mx.campaign     || 0), color: '#0891b2' },
      { name: 'Spotlight',    value: Number(mx.spotlight    || 0), color: '#e8843a' },
      { name: 'Sting',        value: Number(mx.sting        || 0), color: '#dc2626' },
      { name: 'Routine',      value: Number(mx.routine      || 0), color: '#6b7280' },
    ].filter(x => x.value > 0).sort((a, b) => b.value - a.value);

    // ── Target vs actual ──────────────────────────────────────────────────────
    const tgt = targetRows[0] || {};
    const targetVsActual = [
      { name: 'Exclusive',   actual: Number(mx.exclusive   || 0), target: Number(tgt.Exclusive    || 0) },
      { name: 'Datastory',   actual: Number(mx.datastory   || 0), target: Number(tgt.Datastory    || 0) },
      { name: 'Impact',      actual: Number(mx.impact      || 0), target: Number(tgt.Impact_Story || 0) },
      { name: 'Interview',   actual: Number(mx.interviews  || 0), target: Number(tgt.Interviews   || 0) },
      { name: 'Campaign',    actual: Number(mx.campaign    || 0), target: Number(tgt.News_Campaign|| 0) },
      { name: 'Field Visit', actual: 0,                           target: Number(tgt.visit        || 0) },
    ].filter(x => x.target > 0);

    // ── Coverage gaps ─────────────────────────────────────────────────────────
    const visitedSet = new Set(visitedBranches.map(r => r.branch));
    const coverageGaps = allBranches
      .filter(r => !visitedSet.has(r.branch))
      .map(r => r.branch)
      .slice(0, 30);

    // ── Planning ──────────────────────────────────────────────────────────────
    const planning = planningRows.map(r => ({
      state:        r.state || '',
      branch:       r.branch || '',
      dateFrom:     r.date_from ? String(r.date_from).slice(0, 10) : '',
      dateTo:       r.date_to   ? String(r.date_to).slice(0, 10)   : '',
      editorsStory: r.editors_story || '',
      event:        r.event        || '',
      campaign:     r.campaign     || '',
      digitalUv:    r.digital_uv  || 0,
    }));

    // ── Desk review ───────────────────────────────────────────────────────────
    const deskReview = deskRows.map(r => ({
      name:        r.name    || 'Unknown',
      branch:      r.branch  || '',
      from:        r.fromdate ? String(r.fromdate).slice(0, 10) : '',
      to:          r.todate   ? String(r.todate).slice(0, 10)   : '',
      totalEdited: Number(r.total_edited_news || 0),
      aiEdited:    Number(r.ai_edited_news    || 0),
      aiHeadings:  Number(r.ai_heading_no     || 0),
      aiPct:       r.total_edited_news > 0
                     ? Math.round((r.ai_edited_news / r.total_edited_news) * 100)
                     : 0,
    }));

    // ── Anniversaries ─────────────────────────────────────────────────────────
    const anniversaries = anniversaryRows.map(r => ({
      name:    r.name    || '',
      state:   r.state   || '',
      branch:  r.branch  || '',
      stories: Number(r.stories  || 0),
      excl:    Number(r.exclusive || 0),
      expose:  Number(r.expose   || 0),
      impact:  Number(r.impact   || 0),
    }));

    // ── R&D ideas ─────────────────────────────────────────────────────────────
    const rndIdeas = rndRows.map(r => ({
      date:        r.entry_date ? String(r.entry_date).slice(0, 10) : '',
      state:       r.state  || '',
      branches:    safeArr(r.branch),
      idea:        r.idea_float    || '',
      submittedBy: r.submitted_by || '',
    }));

    // ── Summary (yesterday) ───────────────────────────────────────────────────
    const summary = {
      date:      yesterday,
      reporters: Number(mx.reporters || 0),
      stories:   Number(mx.total     || 0),
      photos:    Number(mx.photos    || 0),
      words:     Number(mx.words     || 0),
    };

    return res.json({
      summary,
      topNews,
      storyMix,
      targetVsActual,
      deskReview,
      planning,
      anniversaries,
      rndIdeas,
      coverageGaps,
      prominentDays: getProminentDays(monthStr, regionFilter),
    });

  } catch (err) {
    console.error('[editorial]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
