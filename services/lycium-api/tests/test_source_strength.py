from __future__ import annotations

from app.source_strength import calculate_source_strength


def test_accepted_extracted_university_source_can_meet_strength_policy() -> None:
    url = "https://example.edu/catalog/epidemiology"
    strength = calculate_source_strength(
        {
            "includedSources": [{"url": url, "relevanceScore": 0.42}],
        },
        source_documents=[
            {
                "url": url,
                "text": "Epidemiology evidence covering outbreak investigation, surveillance, risk, and prevention.",
            }
        ],
        source_urls=[url],
    )

    assert strength["ready"] is True
    assert strength["score"] >= strength["minimumScore"]


def test_strength_deduplicates_artifacts_and_ignores_excluded_files() -> None:
    accepted = [
        {
            "id": "accepted-a",
            "sourceDocumentUrl": "artifact://accepted-a",
            "text": "Stoichiometry, mole ratios, and limiting reagent evidence.",
        },
        {
            "id": "accepted-b",
            "sourceDocumentUrl": "artifact://accepted-b",
            "text": "Equilibrium constants, concentration, and titration evidence.",
        },
    ]
    excluded = {
        "id": "excluded",
        "sourceDocumentUrl": "artifact://excluded",
        "text": "Unrelated campus parking information.",
    }
    strength = calculate_source_strength(
        {
            "includedSources": [
                {"url": "artifact://accepted-a", "inputArtifactId": "accepted-a", "relevanceScore": 0.42},
                {"url": "artifact://accepted-b", "inputArtifactId": "accepted-b", "relevanceScore": 0.42},
            ],
            "excludedSources": [
                {"url": "artifact://excluded", "inputArtifactId": "excluded", "relevanceScore": 0.0},
            ],
        },
        source_documents=[
            {"url": artifact["sourceDocumentUrl"], "text": artifact["text"]}
            for artifact in accepted
        ],
        input_artifacts=[*accepted, excluded],
        source_urls=[artifact["sourceDocumentUrl"] for artifact in accepted],
    )

    assert strength["ready"] is True
    assert strength["sourceEvidence"]["sourceDocumentCount"] == 2
    assert strength["sourceEvidence"]["usableInputArtifactCount"] == 3


def test_multiple_indexed_documents_receive_neutral_authority_floor() -> None:
    urls = [f"https://open.example.com/source-{index}" for index in range(3)]
    strength = calculate_source_strength(
        {
            "includedSources": [
                {"url": url, "relevanceScore": 0.42}
                for url in urls
            ],
        },
        source_documents=[
            {
                "url": url,
                "text": f"Relevant extracted course evidence from source {index}.",
                "sourceIndexRef": {"sourcePublicId": f"source-{index}"},
            }
            for index, url in enumerate(urls)
        ],
        source_urls=urls,
    )

    assert strength["dimensions"]["authority"] == 0.55
    assert strength["ready"] is True
