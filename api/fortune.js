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

아래 JSON 형식으로만 응답하세요. 마크다운, 설명, 코드블록 없이 JSON 객체만 출력하세요.
점수는 1에서 5 사이의 숫자입니다.

{"summary":"종합운세 3문장","love":{"score":3,"text":"애정운 한줄"},"money":{"score":3,"text":"금전운 한줄"},"health":{"score":3,"text":"건강운 한줄"},"career":{"score":3,"text":"직업운 한줄"},"advice":"조언 2문장","luckyColor":"색상","luckyNumber":"숫자"}`;

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
            temperature: 0.9,
            maxOutputTokens: 3000,
            responseMimeType: 'application/json'
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

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON을 찾을 수 없습니다.');

    const parsed = JSON.parse(match[0]);
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
