export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, gender, birth, hour } = req.body;
  if (!birth) return res.status(400).json({ error: '생년월일이 필요합니다.' });

  const today = new Date();
  const todayStr = `${today.getFullYear()}년 ${today.getMonth()+1}월 ${today.getDate()}일`;
  const [y, m, d] = birth.split('-').map(Number);

  const prompt = `당신은 한국 전통 명리학(사주팔자) 전문 상담사입니다.

의뢰인 정보:
- 이름: ${name || '의뢰인'}
- 성별: ${gender}
- 생년월일: ${y}년 ${m}월 ${d}일
- 태어난 시간: ${hour}
- 오늘 날짜: ${todayStr}

다음 JSON 형식으로만 응답하세요 (마크다운 없이, 순수 JSON):
{
  "summary": "오늘 전반적인 운세 요약 (3~4문장, 따뜻하고 희망적인 어조)",
  "love":   { "score": 1~5 정수, "text": "애정운 한 줄" },
  "money":  { "score": 1~5 정수, "text": "금전운 한 줄" },
  "health": { "score": 1~5 정수, "text": "건강운 한 줄" },
  "career": { "score": 1~5 정수, "text": "직업/학업운 한 줄" },
  "advice": "오늘 주의할 점 또는 행운을 부르는 조언 (2~3문장)",
  "luckyColor": "오늘의 행운 색상",
  "luckyNumber": "오늘의 행운 숫자"
}`;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 1000 }
        })
      }
    );

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || 'API 오류' });
    }

    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
