export interface TTSRequest {
  text: string;
  apiKey: string;
}

export async function generateSpeech({ text, apiKey }: TTSRequest): Promise<Blob> {
  const response = await fetch('https://aihubmix.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      input: text,
      voice: "coral"
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${response.status} ${errorText}`);
  }

  return response.blob();
}
