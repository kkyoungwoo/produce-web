export function buildNewsPrompt(topic: string, sourceText: string) {
  return `
# Task: Generate a news-style storyboard for "${topic}"

## Core direction
- Use clean, trustworthy, explanatory visuals.
- Think in anchor shot, evidence shot, chart or data shot, context shot, closing shot.
- One paragraph becomes one scene.
- Keep tone clear, structured, and easy to understand.
- Prefer neutral framing, graphic overlays, screens, newsroom, urban b-roll, documents, or charts when relevant.

## Scene rules
- Input paragraph count = output scene count
- narration must copy each original paragraph exactly
- if the paragraph mentions numbers, systems, or institutions, visualise them clearly
- avoid over-dramatizing unless the paragraph itself is dramatic

## Output JSON
{
  "scenes": [{
    "sceneNumber": 1,
    "narration": "copy original paragraph exactly",
    "visual_keywords": "short hook words if useful",
    "analysis": {
      "sentiment": "POSITIVE or NEGATIVE or NEUTRAL",
      "composition_type": "MICRO or STANDARD or MACRO or NO_CHAR"
    },
    "image_prompt_english": "detailed scene prompt"
  }]
}

[INPUT]
${sourceText}
`.trim();
}
