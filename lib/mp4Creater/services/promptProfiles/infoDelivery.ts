export function buildInfoDeliveryPrompt(topic: string, sourceText: string) {
  return `
# Task: Generate an information-delivery storyboard for "${topic}"

## Core direction
- Build one scene per paragraph.
- Keep the delivery clean, trustworthy, and easy to follow.
- Use explainer framing, comparison visuals, callout composition, and simple evidence cues when useful.
- Preserve the same host / narrator / presenter identity across scenes when a speaker exists.
- Maintain continuity so adjacent scenes feel like one polished video, not unrelated slides.

## Scene rules
- Input paragraph count = output scene count
- narration must copy each original paragraph exactly
- prefer readable visual hierarchy over dramatic chaos
- if a paragraph contains abstract information, visualize it through environment, props, labels, monitor screens, charts, or object comparison instead of random symbolism
- keep style consistency and topic continuity from previous to next scene

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
