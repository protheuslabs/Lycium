from __future__ import annotations

from app.course_generation_status import course_generation_workflow_status, workflow_key_for_generation_stage


def test_generation_workflow_status_messages_are_stage_backed() -> None:
    assert course_generation_workflow_status(stage="queued")["message"] == "Queued for course generation..."
    assert course_generation_workflow_status(stage="course_plan")["message"] == "Creating course template..."
    assert course_generation_workflow_status(stage="course_module_outline_generation")["message"] == "Creating modules..."
    assert course_generation_workflow_status(stage="module_section_plan_generation")["message"] == "Creating sections..."
    assert course_generation_workflow_status(stage="module_2_lesson_1")["message"] == "Writing section content..."
    assert course_generation_workflow_status(stage="module_assessment_planning")["message"] == "Planning module assessment..."
    assert course_generation_workflow_status(stage="needs_revision")["message"] == "Course generated; review gates need attention."


def test_generation_workflow_status_keeps_progress_and_trace_summary() -> None:
    status = course_generation_workflow_status(
        stage="section_fill_generation",
        progress=0.183333,
        trace={"stage_workflows": [{"stage": "course_module_outline_generation"}]},
    )

    assert status["contractVersion"] == "course-generation-workflow-status-v1"
    assert status["workflow"] == "section_content"
    assert status["progress"] == 0.1833
    assert status["stageWorkflowCount"] == 1
    assert workflow_key_for_generation_stage("module_project_assessment_generation") == "section_content"
    assert workflow_key_for_generation_stage("pending") == "queued"
    assert workflow_key_for_generation_stage("ready_for_review") == "complete"
