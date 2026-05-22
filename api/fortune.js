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

의뢰인: ${name || '의뢰인'}, ${gender}, ${y}년 ${m}월 ${d}일생, 태어난 시간: ${hour}, 오늘: ${todayStr}

반드시 아래 JSON 형식 그대로만 응답하세요. 줄바꿈 없이 한 줄로 출력하세요.

{"summary":"운세요약","love":{"score":4,"text":"애정운"},"money":{"score":3,"text":"금전운"},"health":{"score":4,"text":"건강운"},"career":{"score":3,"text":"직업운"},"advice":"조언","luckyColor":"색상","luckyNumber":"7"}`;

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
            maxOutputTokens: 3000
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
    let raw = parts.map(p => p.text || '').join('').trim();

    console.log('Gemini raw response:', raw.slice(0, 300));

    // 코드블록 제거
    raw = raw.replace(/```json|```/g, '').trim();

    // JSON 블록 추출
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      return res.status(500).json({ error: '응답 파싱 실패. 원본: ' + raw.slice(0, 200) });
    }

    raw = match[0].replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ');
    const parsed = JSON.parse(raw);
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
