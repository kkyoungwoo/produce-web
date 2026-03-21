export function buildNewsPrompt(topic: string, sourceText: string) {
  return `
# Task: Generate a cinematic movie-style storyboard for "${topic}"

## Core direction
- Use immersive, emotional, movie-like visuals.
- Think in opening shot, tension shot, reveal shot, confrontation shot, ending shot.
- One paragraph becomes one scene.
- Keep the flow visual, dramatic, and coherent.
- Prefer character-driven framing, dramatic lighting, meaningful props, and environmental storytelling.

## Scene rules
- Input paragraph count = output scene count
- narration must copy each original paragraph exactly
- preserve emotional escalation across scenes
- avoid flat explainer visuals unless the paragraph itself explicitly requires them

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
