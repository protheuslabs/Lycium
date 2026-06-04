export type LegalDocumentSlug = "terms" | "privacy" | "acceptable-use";

export type LegalDocumentSection = {
  heading: string;
  paragraphs: string[];
};

export type LegalDocument = {
  slug: LegalDocumentSlug;
  title: string;
  navLabel: string;
  eyebrow: string;
  summary: string;
  lastUpdated: string;
  sections: LegalDocumentSection[];
};

export const legalDocuments: LegalDocument[] = [
  {
    slug: "terms",
    title: "Terms of Service",
    navLabel: "Terms of Service",
    eyebrow: "Legal draft",
    summary:
      "These draft terms explain the basic rules for using Lycium as a local-first learning and course-generation tool.",
    lastUpdated: "June 4, 2026",
    sections: [
      {
        heading: "Draft status",
        paragraphs: [
          "These Terms of Service are a working product draft and are not a substitute for review by qualified legal counsel. They are intended to make Lycium's expected use, boundaries, and responsibilities visible while the product is still developing.",
          "If Lycium is offered as a hosted service, connected to paid providers, or used by an institution, these terms should be reviewed and updated before launch.",
        ],
      },
      {
        heading: "What Lycium is",
        paragraphs: [
          "Lycium is a learning platform that organizes courses, programs, source records, quizzes, progress data, and generated learning artifacts. The current product emphasizes local-first use, source-backed course structures, and user-controlled AI provider settings.",
          "Lycium may generate draft educational material from user prompts, source records, uploaded files, source-index records, or connected model providers. Generated material should be reviewed before it is treated as authoritative.",
        ],
      },
      {
        heading: "Educational use and no accreditation claim",
        paragraphs: [
          "Lycium is designed to support learning, practice, review, and curriculum organization. Unless a separate written agreement states otherwise, Lycium does not grant accredited academic credit, professional licensure, or institution-backed credentials.",
          "Course parity fields, program structures, college categories, and benchmark references are intended to help compare learning coverage. They do not mean that a Lycium course is officially equivalent to a university course or accepted by an employer, school, or licensing body.",
        ],
      },
      {
        heading: "User responsibilities",
        paragraphs: [
          "Users are responsible for the prompts, source links, files, API credentials, local model paths, feedback, and other content they enter into Lycium. Users should only submit material they have the right to use and should follow the rules of any third-party sites, model providers, or source publishers they connect.",
          "Users should independently verify important information before relying on it for academic, professional, medical, legal, financial, safety-critical, or other high-impact decisions.",
        ],
      },
      {
        heading: "Generated content and review",
        paragraphs: [
          "Generated courses, quizzes, summaries, source mappings, and program requirements may contain mistakes, omissions, outdated information, or mismatched citations. Lycium's workflow may include quality gates, source coverage checks, and review states, but those controls do not guarantee correctness.",
          "Draft courses, incomplete courses, source gaps, and review-needed artifacts should not be presented as complete or authoritative until they pass the applicable review and publish workflow.",
        ],
      },
      {
        heading: "Source records and public knowledge artifacts",
        paragraphs: [
          "Lycium separates public or reusable curriculum/source artifacts from private learner records. Public-style artifacts may include source metadata, source snapshots, curriculum benchmarks, requirement origins, source slots, course parity profiles, and program structures.",
          "Private learner records may include progress, bookmarks, quiz attempts, local settings, feedback, and saved provider configuration. Those records should be handled according to the Privacy Policy and any user data controls provided by the software.",
        ],
      },
      {
        heading: "Third-party services",
        paragraphs: [
          "Lycium may connect to third-party AI providers, local model servers, source websites, GitHub Pages, or other services. Those services are governed by their own terms and privacy practices.",
          "When a user connects a third-party model provider or local model path, Lycium may send prompts, source excerpts, course-generation instructions, or related context to that provider only as needed for the requested workflow.",
        ],
      },
      {
        heading: "Changes",
        paragraphs: [
          "Lycium may revise these draft terms as the product, storage model, source-index service, AI workflow, or deployment model changes. Material changes should be reflected by updating the effective date and making the revised terms available in the product.",
        ],
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    navLabel: "Privacy Policy",
    eyebrow: "Legal draft",
    summary:
      "This draft policy explains how Lycium thinks about local learner data, public source records, AI provider settings, and future cloud sync.",
    lastUpdated: "June 4, 2026",
    sections: [
      {
        heading: "Draft status",
        paragraphs: [
          "This Privacy Policy is a working product draft and should be reviewed by qualified legal counsel before Lycium is offered as a production hosted service or used in a regulated institutional setting.",
          "The current product direction is local-first. That means many records can remain on the user's machine unless the user connects a server, sync feature, external provider, or source-index workflow.",
        ],
      },
      {
        heading: "Data categories",
        paragraphs: [
          "Lycium may handle public curriculum/source data, private learner data, provider configuration, generated artifacts, and operational diagnostics. These categories should remain visibly separate in product design and storage boundaries.",
          "Public curriculum/source data may include source URLs, titles, authors, source snapshots, extracted text, curriculum benchmarks, concept records, prerequisite edges, requirement origins, course parity profiles, and source coverage records.",
          "Private learner data may include course progress, viewed/completed state, bookmarks, quiz attempts, feedback, settings, selected provider/model rows, and locally saved course interaction history.",
        ],
      },
      {
        heading: "Local storage",
        paragraphs: [
          "In local-first mode, Lycium stores user data in local files, browser storage, or local API-managed storage on the user's machine. Users should not commit local secrets, private learner progress, or machine-local data to a public repository.",
          "Local records may persist until the user deletes them through product controls, browser/storage controls, filesystem cleanup, or future data-management tools.",
        ],
      },
      {
        heading: "AI keys, local paths, and provider settings",
        paragraphs: [
          "Lycium may allow users to save provider rows containing a provider name, model choice, API key, local model URL, or local model path. The UI should mask sensitive values and should avoid sending them anywhere except the configured local API or selected provider workflow.",
          "API keys and local model paths are sensitive. Users should protect them, rotate them if exposed, and avoid entering credentials on shared or untrusted machines. Future hosted versions should use stronger secret storage, encryption, or provider-managed account connection flows.",
        ],
      },
      {
        heading: "Source submissions and source index records",
        paragraphs: [
          "When users add source links, upload source material, or run source-index workflows, Lycium may store source metadata, extracted text, relevance decisions, source packets, source gap suggestions, and benchmark extraction artifacts.",
          "Source records are intended to become reusable public knowledge infrastructure when the source material is public, lawful to process, and appropriate for the index. Private or restricted source material should be marked and handled separately.",
        ],
      },
      {
        heading: "AI processing",
        paragraphs: [
          "If a user asks Lycium to generate or evaluate course material with an external AI provider, Lycium may send the relevant prompt, source excerpts, course metadata, benchmark context, and generation instructions to that provider.",
          "External providers may process that data according to their own policies. Users should review provider terms and privacy settings before using external AI generation with sensitive material.",
        ],
      },
      {
        heading: "Future cloud sync",
        paragraphs: [
          "If Lycium later adds cloud accounts, hosted storage, collaboration, or sync, this policy should be updated before those features are enabled. The update should explain what data leaves the user's machine, why it is collected, how long it is retained, and how users can export or delete it.",
        ],
      },
      {
        heading: "User controls",
        paragraphs: [
          "Lycium should provide clear ways to review, export, delete, or reset local learner data, provider settings, source suggestions, and feedback records as the product matures.",
          "Where legally required or practically appropriate, hosted versions should support access, correction, deletion, and portability requests.",
        ],
      },
      {
        heading: "Security posture",
        paragraphs: [
          "Lycium should collect only the data needed for learning, generation, source indexing, review, and product operation. Sensitive records should be minimized, protected, and separated from public source/curriculum records.",
          "No software can guarantee perfect security. Users should avoid entering secrets or sensitive personal data unless the deployment mode and provider configuration are appropriate for that data.",
        ],
      },
    ],
  },
  {
    slug: "acceptable-use",
    title: "Acceptable Use Policy",
    navLabel: "Acceptable Use",
    eyebrow: "Legal draft",
    summary:
      "This draft policy defines responsible use for source ingestion, course generation, model access, and future indexing workflows.",
    lastUpdated: "June 4, 2026",
    sections: [
      {
        heading: "Draft status",
        paragraphs: [
          "This Acceptable Use Policy is a working product draft. It should be reviewed before Lycium is offered as a hosted service, used with shared infrastructure, or connected to broad crawling/indexing workflows.",
        ],
      },
      {
        heading: "Responsible learning use",
        paragraphs: [
          "Lycium should be used to support learning, curriculum organization, responsible research, source-backed course generation, feedback, and skill development.",
          "Users should not use Lycium to misrepresent their credentials, fabricate academic completion, submit generated work dishonestly, or bypass the rules of an institution, employer, certification provider, or learning community.",
        ],
      },
      {
        heading: "Source ingestion and crawling",
        paragraphs: [
          "Users should only add or crawl sources that are lawful to access and appropriate for educational indexing. Users should respect robots.txt, access controls, rate limits, copyright notices, license terms, and site-specific restrictions.",
          "Lycium source-index workflows should prefer public, reputable, education-relevant sources and should record provenance, source type, access metadata, and replacement/fallback information when available.",
        ],
      },
      {
        heading: "No harmful or illegal use",
        paragraphs: [
          "Users must not use Lycium to generate, organize, or distribute material that facilitates illegal activity, exploitation, harassment, abuse, malware, credential theft, evasion of security controls, or other harmful conduct.",
          "Users must not use source-index or course-generation workflows to collect private personal data, confidential information, restricted content, or non-public institutional material without authorization.",
        ],
      },
      {
        heading: "AI and automation limits",
        paragraphs: [
          "Users should not use connected AI models, local model servers, or automated workflows to overload services, bypass provider policies, evade safety controls, or generate deceptive educational records.",
          "High-impact generated content should be reviewed by a qualified person before use. This includes material related to health, law, finance, safety, employment decisions, academic placement, credentials, or other sensitive contexts.",
        ],
      },
      {
        heading: "Source quality and citation integrity",
        paragraphs: [
          "Users should not knowingly attach irrelevant, misleading, fabricated, plagiarized, or low-quality sources to make a course appear complete. Citations should connect to the concepts or sections they actually support.",
          "When sources are broken, weak, paywalled, outdated, or mismatched to a concept, users should mark the gap or add replacement candidates instead of hiding the problem.",
        ],
      },
      {
        heading: "Platform integrity",
        paragraphs: [
          "Users should not attempt to corrupt course JSON, source records, local storage, provider settings, review states, quality gates, or program requirements in a way that misleads learners or downstream systems.",
          "If Lycium later supports shared accounts, cohorts, reviews, or hosted source-index services, abuse prevention controls may restrict accounts, keys, jobs, crawls, uploads, or generated artifacts that violate this policy.",
        ],
      },
      {
        heading: "Reporting and review",
        paragraphs: [
          "Suspected source abuse, unsafe generated content, privacy issues, security problems, or misleading curriculum records should be reported to the project maintainers through the repository or the support channel provided by the deployment.",
          "Lycium may revise this policy as the product adds hosted services, account connection, broader crawling, institutional use, or Protheus ecosystem integrations.",
        ],
      },
    ],
  },
];

export function getLegalDocument(slug: LegalDocumentSlug): LegalDocument {
  const document = legalDocuments.find((candidate) => candidate.slug === slug);
  if (!document) {
    throw new Error(`Unknown legal document: ${slug}`);
  }
  return document;
}
