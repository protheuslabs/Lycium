# ADR 0008: Curriculum benchmarks anchor generation

## Status

Accepted

## Context

Lycium's original product thesis was not merely that AI can generate courses. The stronger thesis is that the internet already contains enough learning material, while the missing layer is organization into coherent education paths. Real university catalogs, syllabi, certification outlines, and employer skill profiles provide durable curriculum skeletons that can be used to decide what is required, optional, remedial, alternate, or enrichment material.

If Lycium generates courses directly from a topic prompt, the output can become plausible but weak: the structure may reflect model priors, source availability, or generic outline habits instead of real educational requirements. This weakens course credibility and makes it difficult to explain why a learner should trust the path.

## Decision

Lycium will treat curriculum benchmarks as first-class contract artifacts.

A benchmark records a real or representative institutional source, extracted requirements, topics, learning outcomes, confidence, and evidence references. Program and course requirements may attach requirement-origin metadata so Lycium can explain why a requirement exists.

Generation should prefer this order:

1. Collect curriculum benchmarks.
2. Extract requirements, outcomes, topics, and prerequisites.
3. Compare similar benchmarks to identify common required material and optional or alternate material.
4. Build program, cluster, course, and assessment structures from those requirements.
5. Map required concepts to high-quality free or open sources.
6. Preserve fallback source slots for required concepts.
7. Require portfolio artifacts for serious career-path or degree-equivalent programs unless explicitly waived.

## Consequences

- Lycium can claim parity against real educational structures instead of relying on generic generated outlines.
- The generation workflow becomes more inspectable because requirements have origins and evidence.
- Course variants can satisfy the same requirement group while serving different modalities, pacing profiles, or learner goals.
- Source retrieval can improve over time without rewriting the curriculum skeleton.
- Additional ingestion work is required for university catalogs, syllabi, certification outlines, and employer profiles.

## Non-goals

- Lycium does not claim formal accreditation or credit transfer from parity metadata.
- Lycium does not hide learning content behind due dates or monetary penalties.
- Lycium does not need a crypto or token economy to support contribution reputation.
