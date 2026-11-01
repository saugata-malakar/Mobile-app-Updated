import {API_BASE_URL} from '../config/api';

export type SkinOptions = {
  body_parts: string[];
  descriptors: string[];
};

export type SkinPredictionResponse = {
  predicted_class: string;
  model_score: number;
  class_scores: Record<string, number>;
  disclaimer: string;
};

export async function getSkinOptions(): Promise<SkinOptions> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/skin/options`,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load skin options (${response.status}): ${await response.text()}`,
    );
  }

  return response.json();
}

export async function predictSkin(
  imageUri: string,
  bodyPart: string,
  descriptors: string[],
): Promise<SkinPredictionResponse> {
  const form = new FormData();

  form.append(
    'image',
    {
      uri: imageUri,
      name: `skin-${Date.now()}.jpg`,
      type: 'image/jpeg',
    } as any,
  );

  form.append('body_part', bodyPart);
  form.append('descriptors_json', JSON.stringify(descriptors));

  const response = await fetch(
    `${API_BASE_URL}/api/v1/skin/predict`,
    {
      method: 'POST',
      body: form,
    },
  );

  if (!response.ok) {
    let message = `Prediction failed (${response.status})`;

    try {
      const data = await response.json();
      message = data.detail || message;
    } catch {
      // Keep the original error message.
    }

    throw new Error(message);
  }

  return response.json();
}
