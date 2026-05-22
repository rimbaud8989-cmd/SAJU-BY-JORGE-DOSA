import { Solar } from 'lunar-javascript';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, gender, birth, hour } = req.body;
  if (!birth) return res.status(400).json({ error: '생년월일이 필요합니다.' });

  const [y, m, d] = birth.split('-').map(Number);
  const today = new Date();
  const todayStr = `${today.getFullYear()}년 ${today.getMonth()+1}월 ${today.getDate()}일`;

  // 정확한 사주팔자 계산 (lunar-javascript)
  const solar = Solar.fromYmd(y, m, d);
  const lunar = solar.getLunar();
  const bazi = lunar.getEightChar();

  const todaySolar = Solar.fromYmd(today.getFullYear(), today.getMonth()+1, today.getDate());
  const todayBazi = todaySolar.getLunar().getEightChar();

  const pillars = {
    year:  { gan: bazi.getYearGan(),  ji: bazi.getYearZhi()  },
    month: { gan: bazi.getMonthGan(), ji: bazi.getMonthZhi() },
    day:   { gan: bazi.getDayGan(),   ji: bazi.getDayZhi()   },
    today: { gan: todayBazi.getDayGan(), ji: todayBazi.getDayZhi() }
  };

  const prompt = `사주 전문가로서 ${name || '의뢰인'}(${gender}, ${y}년 ${m}월 ${d}일생, ${hour}) 의 ${todayStr} 오늘 운세를 알려주세요. 각 항목은 간결하게 한 문장으로 작성하세요.`;

  const schema = {
    type: 'object',
    properties: {
      summary:     { type: 'string', description: '오늘 종합 운세 2문장' },
      love:        { type: 'object', properties: { score: { type: 'integer' }, text: { type: 'string' } }, required: ['score','text'] },
      money:       { type: 'object', properties: { score: { type: 'integer' }, text: { type: 'string' } }, required: ['score','text'] },
      health:      { type: 'object', properties: { score: { type: 'integer' }, text: { type: 'string' } }, required: ['score','text'] },
      career:      { type: 'object', properties: { score: { type: 'integer' }, text: { type: 'string' } }, required: ['score','text'] },
      advice:      { type: 'string', description: '오늘의 조언 한 문장' },
      luckyColor:  { type: 'string' },
      luckyNumber: { type: 'string' }
    },
    required: ['summary','love','money','health','career','advice','luckyColor','luckyNumber']
  };

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 1500,
            responseMimeType: 'application/json',
            responseSchema: schema
          }
        })
      }
    );

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || 'API 오류' });
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const raw = parts.map(p => p.text || '').join('').trim();
    const fortune = JSON.parse(raw);

    return res.status(200).json({ pillars, fortune });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
