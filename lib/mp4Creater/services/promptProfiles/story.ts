export function buildStoryPrompt(topic: string, sourceText: string) {
  return `
# Task: Generate a narrative storyboard for "${topic}"

## Core direction
- Maintain story logic, emotional continuity, and character-driven scene progression.
- One paragraph becomes one scene.
- Keep cause and effect readable from scene to scene.
- Show tension, reveal, and ending tone clearly.
- Prefer cinematic story shots rather than infographic layout.

## Scene rules
- Input paragraph count = output scene count
- narration must copy each original paragraph exactly
- describe each scene in a way that keeps the same protagonist visually consistent
- if the paragraph is about thought or emotion, visualize it through environment, gesture, and props

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
