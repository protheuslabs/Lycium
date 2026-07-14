from __future__ import annotations

from typing import Literal

CURRICULUM_ASSEMBLY_POLICY_VERSION = "curriculum-assembly-policy-v1"

CLUSTER_GENERATION_MIN_COURSE_COUNT = 3
CLUSTER_GENERATION_RECOMMENDED_COURSE_COUNT = 4
PROGRAM_GENERATION_MIN_CLUSTER_COUNT = 2
PROGRAM_GENERATION_RECOMMENDED_CLUSTER_COUNT = 3

AssemblyCandidateType = Literal["cluster", "program"]
AssemblyStatus = Literal["below_threshold", "meets_minimum", "recommended"]


def _threshold_report(
    *,
    candidate_type: AssemblyCandidateType,
    member_type: str,
    member_count: int,
    minimum_required: int,
    recommended_minimum: int,
) -> dict:
    count = max(0, int(member_count))
    if count < minimum_required:
        status: AssemblyStatus = "below_threshold"
        confidence_band = "insufficient"
    elif count < recommended_minimum:
        status = "meets_minimum"
        confidence_band = "tentative"
    else:
        status = "recommended"
        confidence_band = "strong"

    return {
        "contractVersion": CURRICULUM_ASSEMBLY_POLICY_VERSION,
        "candidateType": candidate_type,
        "memberType": member_type,
        "memberCount": count,
        "minimumRequired": minimum_required,
        "recommendedMinimum": recommended_minimum,
        "status": status,
        "canGenerate": count >= minimum_required,
        "recommendedToGenerate": count >= recommended_minimum,
        "confidenceBand": confidence_band,
        "minimumShortfall": max(0, minimum_required - count),
        "recommendedShortfall": max(0, recommended_minimum - count),
    }


def cluster_generation_threshold_report(course_count: int) -> dict:
    return _threshold_report(
        candidate_type="cluster",
        member_type="course",
        member_count=course_count,
        minimum_required=CLUSTER_GENERATION_MIN_COURSE_COUNT,
        recommended_minimum=CLUSTER_GENERATION_RECOMMENDED_COURSE_COUNT,
    )


def program_generation_threshold_report(cluster_count: int) -> dict:
    return _threshold_report(
        candidate_type="program",
        member_type="cluster",
        member_count=cluster_count,
        minimum_required=PROGRAM_GENERATION_MIN_CLUSTER_COUNT,
        recommended_minimum=PROGRAM_GENERATION_RECOMMENDED_CLUSTER_COUNT,
    )


def curriculum_assembly_threshold_policy() -> dict:
    return {
        "contractVersion": CURRICULUM_ASSEMBLY_POLICY_VERSION,
        "thresholds": {
            "clusterFromCourses": {
                "memberType": "course",
                "minimumRequired": CLUSTER_GENERATION_MIN_COURSE_COUNT,
                "recommendedMinimum": CLUSTER_GENERATION_RECOMMENDED_COURSE_COUNT,
            },
            "programFromClusters": {
                "memberType": "cluster",
                "minimumRequired": PROGRAM_GENERATION_MIN_CLUSTER_COUNT,
                "recommendedMinimum": PROGRAM_GENERATION_RECOMMENDED_CLUSTER_COUNT,
            },
        },
    }
