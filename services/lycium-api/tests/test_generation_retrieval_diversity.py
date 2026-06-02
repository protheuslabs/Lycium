from __future__ import annotations


def _install_fetch_mock(monkeypatch, mapping: dict[str, str]) -> None:
    def fake_fetch(url: str) -> tuple[str, str]:
        return mapping[url], "text/html"

    monkeypatch.setattr("app.ingestion.fetch_url", fake_fetch)


def _sample_html(title: str, body: str) -> str:
    return f"""
    <html>
      <head><title>{title}</title></head>
      <body>
        <h1>{title}</h1>
        <p>{body}</p>
        <p>This source includes explanation, example, practice activity, quiz question, and field application.</p>
      </body>
    </html>
    """


def _section_citation_titles(course: dict) -> str:
    return " ".join(
        citation.get("title", "")
        for module in course["structure"]["modules"]
        for section in module["sections"]
        for citation in section.get("citations", [])
    ).lower()


def test_course_generation_prefers_prompt_specific_sources(client, monkeypatch) -> None:
    source_urls = [
        "https://publichealth.example.edu/epi101",
        "https://publichealth.example.edu/outbreak-methods",
        "https://publichealth.example.edu/surveillance-analytics",
    ]
    _install_fetch_mock(
        monkeypatch,
        {
            source_urls[0]: _sample_html(
                "Introduction to Epidemiology",
                "Epidemiology studies population health, disease frequency, risk, exposure, and prevention.",
            ),
            source_urls[1]: _sample_html(
                "Outbreak Investigation Methods",
                "Outbreak investigation uses case definitions, epidemic curves, contact tracing, and field team coordination.",
            ),
            source_urls[2]: _sample_html(
                "Public Health Surveillance Analytics",
                "Surveillance analytics uses reporting systems, signals, dashboards, trend detection, and monitoring data.",
            ),
        },
    )
    for source_url in source_urls:
        ingested = client.post(
            "/v1/sources/ingest",
            json={"url": source_url, "source_type": "university_catalog", "license": "cc-by", "is_free": True},
        )
        assert ingested.status_code == 201, ingested.text

    outbreak = client.post(
        "/v1/courses/generate",
        json={
            "prompt": "Create an undergraduate epidemiology course on outbreak investigation methods for field teams",
            "source_policy": "balanced",
            "desired_module_count": 3,
            "expected_duration_minutes": 180,
            "source_urls": source_urls,
            "category": "public-health",
            "department": "epidemiology",
        },
    )
    assert outbreak.status_code == 201, outbreak.text
    outbreak_course = outbreak.json()

    surveillance = client.post(
        "/v1/courses/generate",
        json={
            "prompt": "Create an undergraduate epidemiology course on public health surveillance analytics",
            "source_policy": "balanced",
            "desired_module_count": 3,
            "expected_duration_minutes": 180,
            "source_urls": source_urls,
            "category": "public-health",
            "department": "epidemiology",
        },
    )
    assert surveillance.status_code == 201, surveillance.text
    surveillance_course = surveillance.json()

    outbreak_titles = " ".join(module["title"] for module in outbreak_course["structure"]["modules"]).lower()
    surveillance_titles = " ".join(module["title"] for module in surveillance_course["structure"]["modules"]).lower()
    assert "outbreak" in outbreak_titles or "outbreak" in _section_citation_titles(outbreak_course)
    assert "surveillance" in surveillance_titles or "surveillance" in _section_citation_titles(surveillance_course)
    assert outbreak_course["structure"]["department"] == "epidemiology"
    assert surveillance_course["structure"]["department"] == "epidemiology"
    assert outbreak_titles != surveillance_titles

    for generated_course in (outbreak_course, surveillance_course):
        metadata = generated_course["structure"]["metadata"]
        assert metadata["sourceSlots"]
        assert metadata["sourceCoverageTrace"]["sourceSlotCount"] == len(metadata["sourceSlots"])
        assert metadata["sourceCoverageTrace"]["sectionSourceMap"]
        assert all(slot["primarySourceId"] in generated_course["structure"]["sourceIds"] for slot in metadata["sourceSlots"])
