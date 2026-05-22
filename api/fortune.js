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

  // 정확한 사주팔자 계산
  const solar = Solar.fromYmd(y, m, d);
  const lunar = solar.getLunar();
  const bazi = lunar.getEightChar();

  const todaySolar = Solar.fromYmd(today.getFullYear(), today.getMonth()+1, today.getDate());
  const todayBazi = todaySolar.getLunar().getEightChar();

  const pillars = {
    year:  { gan: bazi.getYearGan(),     ji: bazi.getYearZhi()     },
    month: { gan: bazi.getMonthGan(),    ji: bazi.getMonthZhi()    },
    day:   { gan: bazi.getDayGan(),      ji: bazi.getDayZhi()      },
    today: { gan: todayBazi.getDayGan(), ji: todayBazi.getDayZhi() }
  };

  // 오행 정보도 포함
  const yearGanZhi  = pillars.year.gan  + pillars.year.ji;
  const monthGanZhi = pillars.month.gan + pillars.month.ji;
  const dayGanZhi   = pillars.day.gan   + pillars.day.ji;
  const todayGanZhi = pillars.today.gan + pillars.today.ji;

  const prompt = `당신은 한국 전통 명리학(사주팔자) 전문 상담사입니다.

의뢰인 정보:
- 이름: ${name || '의뢰인'}
- 성별: ${gender}
- 생년월일: ${y}년 ${m}월 ${d}일
- 태어난 시간대: ${hour}
- 사주팔자: 연주 ${yearGanZhi} / 월주 ${monthGanZhi} / 일주 ${dayGanZhi}
- 오늘(${todayStr}) 일진: ${todayGanZhi}

위 사주를 바탕으로 오늘의 운세를 분석해주세요.
- 일주(${dayGanZhi})의 일간 특성과 오늘 일진(${todayGanZhi})과의 상생/상극 관계를 반영하세요.
- 연주/월주와 오늘 일진의 오행 관계도 고려하세요.
- 이 사람만의 고유한 특성이 드러나도록 구체적으로 작성하세요.
- 각 항목은 간결하게 한 문장으로 작성하세요.`;

  const schema = {
    type: 'object',
    properties: {
      summary:     { type: 'string', description: '이 사주 고유의 특성과 오늘 운세 2~3문장' },
      love:        { type: 'object', properties: { score: { type: 'integer' }, text: { type: 'string' } }, required: ['score','text'] },
      money:       { type: 'object', properties: { score: { type: 'integer' }, text: { type: 'string' } }, required: ['score','text'] },
      health:      { type: 'object', properties: { score: { type: 'integer' }, text: { type: 'string' } }, required: ['score','text'] },
      career:      { type: 'object', properties: { score: { type: 'integer' }, text: { type: 'string' } }, required: ['score','text'] },
      advice:      { type: 'string', description: '이 사주에 맞는 오늘의 구체적 조언' },
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
            temperature: 1.0,
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
