export function buildMusicVideoPrompt(topic: string, sourceText: string) {
  return `
# Task: Generate a music-video storyboard for "${topic}"

## Core direction
- Think in rhythm, emotional repetition, visual hooks, chorus moments, and striking refrain imagery.
- Keep every paragraph as one scene.
- Preserve lyrical feeling even if the text is prose.
- Prefer symbolic visuals, performance-style shots, light motion cues, and mood continuity.
- Make scenes feel cinematic and musical, not like a lecture.

## Scene rules
- Input paragraph count = output scene count
- narration must copy each original paragraph exactly
- image_prompt_english should be vivid, visual, and suitable for image generation
- add emotional contrast between intro / build / climax / ending when possible

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
