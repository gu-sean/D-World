
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import require_internal_token
from app.core.settings import get_settings
from app.schemas.contracts import (
    GoalPlanRequest,
    PlanAdjustmentRequest,
    ReportRequest,
    SensorEvaluationRequest,
    SituationalRecommendationRequest,
    VisionAnalysisRequest,
)

router = APIRouter(
    prefix="/dev/schema-check",
    tags=["AI-02: 개발용 JSON 검사"],
    dependencies=[Depends(require_internal_token)],
)


def check_input(data: Any) -> dict:
    return {
        "valid": True,
        "message": "요청 JSON 형식이 올바릅니다.",
        "normalized": data.model_dump(
            by_alias=True,
            mode="json",
        ),
    }


@router.post("/vision")
def check_vision(data: VisionAnalysisRequest):
    return check_input(data)


@router.post("/sensor")
def check_sensor(data: SensorEvaluationRequest):
    return check_input(data)


@router.post("/goal-plan")
def check_goal_plan(data: GoalPlanRequest):
    return check_input(data)


@router.post("/situation")
def check_situation(data: SituationalRecommendationRequest):
    return check_input(data)


@router.post("/report")
def check_report(data: ReportRequest):
    return check_input(data)


@router.post("/plan-adjustment")
def check_plan_adjustment(data: PlanAdjustmentRequest):
    return check_input(data)
