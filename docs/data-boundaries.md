# Lycium Data Boundaries

Lycium separates durable data by ownership boundary.

## Lycium-owned data

Lycium owns learner and learning-product state:

- learners
- local settings and secrets references
- course snapshots
- program snapshots
- quiz attempts and section progress
- portfolio artifacts
- credentials
- review/publish lifecycle records

Course and program snapshots may preserve compact source evidence for reproducibility, but they should not become the canonical internet index.

## Source Index-owned data

The Source Index owns reusable internet/source evidence:

- indexed sources
- source snapshots
- extracted text and text digests
- crawl policies
- crawl runs and worker contracts
- source corpus decisions
- future knowledge objects, claims, graph edges, and retrieval indexes

Lycium may keep transitional source tables while the service boundary matures, but long-lived references should point to Source Index `public_id` values instead of local integer IDs.

When `LYCIUM_SOURCE_INDEX_API_URL` is configured, Lycium should route source-index API calls through the standalone Source Index service. When it is not configured, the transitional internal source tables remain available for local development and offline tests.

## Stable IDs

Stable IDs are the migration seam for future real-server deployments:

- source public IDs are derived from canonical URLs
- snapshot public IDs are derived from source public IDs and content hashes
- local integer IDs remain database-local implementation details

Generated course/program traces should prefer stable source and snapshot public IDs when recording evidence.

## Future deployment shape

Expected production split:

- Lycium application database for learners, courses, programs, progress, reviews, credentials, and settings
- Source Index database for indexed sources, snapshots, crawl records, extracted evidence, and retrieval metadata
- object storage for large raw source artifacts
- optional search/vector infrastructure behind the Source Index service

This lets Lycium use the index without owning it, and lets InfRing or other Protheus systems consume the same Source Index service later.

See also:

- [Product Principles](./product-principles.md)
- [Data Use and Trust](./data-use-and-trust.md)
