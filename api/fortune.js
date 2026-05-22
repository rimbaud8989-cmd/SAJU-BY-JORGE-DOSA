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

  const prompt = `사주 전문가로서 아래 의뢰인의 오늘 운세를 JSON으로 답하세요.

의뢰인: ${name || '의뢰인'} / ${gender} / ${y}.${m}.${d}생 / ${hour} / 오늘: ${todayStr}

규칙:
- 반드시 JSON 한 줄만 출력 (설명 금지)
- 각 텍스트는 20자 이내로 간결하게
- score는 1~5 숫자

형식: {"summary":"20자이내요약","love":{"score":4,"text":"10자이내"},"money":{"score":3,"text":"10자이내"},"health":{"score":4,"text":"10자이내"},"career":{"score":3,"text":"10자이내"},"advice":"20자이내조언","luckyColor":"색","luckyNumber":"숫자"}`;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 1000 }
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

    // 코드블록 제거 후 줄바꿈 정리
    raw = raw.replace(/```json|```/g, '').replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();

    const match = raw.match(/\{.*\}/);
    if (!match) return res.status(500).json({ error: '응답 파싱 실패: ' + raw.slice(0, 200) });

    const parsed = JSON.parse(match[0]);
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
