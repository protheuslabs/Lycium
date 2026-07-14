from __future__ import annotations

from app.curriculum_assembly_policy import (
    cluster_generation_threshold_report,
    curriculum_assembly_threshold_policy,
    program_generation_threshold_report,
)


def test_cluster_generation_threshold_requires_three_courses_and_recommends_four() -> None:
    below = cluster_generation_threshold_report(2)
    minimum = cluster_generation_threshold_report(3)
    recommended = cluster_generation_threshold_report(4)

    assert below["status"] == "below_threshold"
    assert below["canGenerate"] is False
    assert below["minimumShortfall"] == 1
    assert minimum["status"] == "meets_minimum"
    assert minimum["canGenerate"] is True
    assert minimum["recommendedToGenerate"] is False
    assert recommended["status"] == "recommended"
    assert recommended["recommendedToGenerate"] is True


def test_program_generation_threshold_requires_two_clusters_and_recommends_three() -> None:
    below = program_generation_threshold_report(1)
    minimum = program_generation_threshold_report(2)
    recommended = program_generation_threshold_report(3)

    assert below["status"] == "below_threshold"
    assert below["canGenerate"] is False
    assert below["minimumShortfall"] == 1
    assert minimum["status"] == "meets_minimum"
    assert minimum["canGenerate"] is True
    assert minimum["recommendedToGenerate"] is False
    assert recommended["status"] == "recommended"
    assert recommended["recommendedToGenerate"] is True


def test_curriculum_assembly_threshold_policy_exposes_shared_numbers() -> None:
    policy = curriculum_assembly_threshold_policy()

    assert policy["contractVersion"] == "curriculum-assembly-policy-v1"
    assert policy["thresholds"]["clusterFromCourses"] == {
        "memberType": "course",
        "minimumRequired": 3,
        "recommendedMinimum": 4,
    }
    assert policy["thresholds"]["programFromClusters"] == {
        "memberType": "cluster",
        "minimumRequired": 2,
        "recommendedMinimum": 3,
    }
