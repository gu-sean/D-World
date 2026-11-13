
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

# 식별자: 8자 영숫자(대소문자 구분). 백엔드·DB의 short_id와 같은 규칙
ShortId = Annotated[str, StringConstraints(pattern=r"^[0-9A-Za-z]{8}$")]


def to_camel(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(p.title() for p in parts[1:])


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


ExerciseCode = Literal[
    "squat", "push_up", "lunge", "plank", "burpee", "running"
]
CameraExercise = Literal[
    "squat", "push_up", "lunge", "plank", "burpee"
]
TargetUnit = Literal[
    "reps", "seconds", "times", "pages", "steps", "meters"
]
Decision = Literal["approved", "rejected", "review_required"]


# ───────────────────────────────
# 공통 데이터 모델
# ───────────────────────────────

class MediaItem(ApiModel):
    media_id: ShortId
    object_key: str = Field(min_length=1)
    mime_type: str = Field(min_length=1)
    media_kind: Literal[
        "camera_video", "camera_photo", "sensor_raw"
    ]
    size_bytes: int = Field(gt=0)
    checksum_sha256: str = Field(
        min_length=64,
        max_length=64,
        pattern=r"^[0-9a-fA-F]{64}$",
    )


class Criteria(ApiModel):
    version_id: ShortId
    rules: dict = Field(default_factory=dict)


class PoseIssue(ApiModel):
    code: str
    start_sec: float = Field(ge=0)
    end_sec: float = Field(ge=0)


class VerificationMetrics(ApiModel):
    exercise_code: str | None = None
    rep_count: int | None = None
    valid_rep_count: int | None = None
    invalid_rep_count: int | None = None
    hold_seconds: float | None = None
    accuracy: float | None = Field(default=None, ge=0, le=1)
    duration_seconds: float | None = None
    person_detected: bool | None = None
    distance_meters: float | None = None
    active_seconds: float | None = None
    avg_pace_seconds_per_km: float | None = None
    steps: int | None = None
    avg_cadence_spm: float | None = None
    valid_point_ratio: float | None = None
    mock_location_detected: bool | None = None
    media_sha256: str | None = None
    flags: list[str] = Field(default_factory=list)
    issues: list[PoseIssue] = Field(default_factory=list)


class AcceptedResponse(ApiModel):
    ingest_key: str
    status: Literal["accepted"] = "accepted"


# ───────────────────────────────
# I01: 운동 영상 및 사진 분석
# ───────────────────────────────

class VisionAnalysisRequest(ApiModel):
    ingest_key: str = Field(min_length=1)
    record_id: ShortId
    mission_id: ShortId
    submission_no: int = Field(ge=1)
    category_code: str
    exercise_code: CameraExercise | None
    target_value: float = Field(gt=0)
    target_unit: TargetUnit
    media: list[MediaItem] = Field(min_length=1, max_length=1)
    record_started_at: datetime
    submitted_at: datetime
    duplicate_of_media_id: ShortId | None
    criteria: Criteria
    callback_url: str = Field(min_length=1)

    @model_validator(mode="after")
    def check_vision(self):
        expected = f"vision:{self.record_id}:{self.submission_no}"
        if self.ingest_key != expected:
            raise ValueError("ingestKey 형식이 올바르지 않습니다.")

        kind = self.media[0].media_kind
        if kind == "sensor_raw":
            raise ValueError("영상·사진 요청에는 sensor_raw를 사용할 수 없습니다.")
        if kind == "camera_video" and self.exercise_code is None:
            raise ValueError("운동 영상에는 exerciseCode가 필요합니다.")
        if kind == "camera_photo" and self.exercise_code is not None:
            raise ValueError("사진 인증의 exerciseCode는 null이어야 합니다.")
        return self


class VisionAnalysisCallback(ApiModel):
    ingest_key: str
    record_id: ShortId
    status: Literal["completed", "failed"]
    decision: Decision | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    reason: str | None = None
    engine_version: str = Field(min_length=1, max_length=80)
    metrics: VerificationMetrics | None = None
    failure_reason: str | None = None


# ───────────────────────────────
# I02: 러닝 센서 검증
# ───────────────────────────────

class ClientMetrics(ApiModel):
    distance_meters: float | None = None
    active_seconds: float | None = None
    steps: int | None = None
    video_duration_seconds: float | None = None
    on_device_rep_count: int | None = None
    app_version: str


class SensorEvaluationRequest(ApiModel):
    ingest_key: str
    record_id: ShortId
    exercise_code: Literal["running"]
    target_value: float = Field(gt=0)
    target_unit: Literal["meters", "seconds"]
    record_started_at: datetime
    submitted_at: datetime
    media: list[MediaItem] = Field(min_length=1, max_length=1)
    client_metrics: ClientMetrics | None
    duplicate_of_media_id: ShortId | None
    criteria: Criteria

    @model_validator(mode="after")
    def check_sensor(self):
        if not self.ingest_key.startswith(
            f"sensor:{self.record_id}:"
        ):
            raise ValueError("ingestKey 형식이 올바르지 않습니다.")
        if self.media[0].media_kind != "sensor_raw":
            raise ValueError("러닝은 sensor_raw 파일이 필요합니다.")
        if self.media[0].mime_type != "application/gzip":
            raise ValueError("러닝 파일은 gzip 형식이어야 합니다.")
        return self


class SensorEvaluationResponse(ApiModel):
    ingest_key: str
    decision: Decision
    confidence: float = Field(ge=0, le=1)
    reason: str | None
    engine_version: str
    metrics: VerificationMetrics


# ───────────────────────────────
# I03: Gemini 목표 분석
# ───────────────────────────────

class GoalInfo(ApiModel):
    title: str = Field(min_length=1)
    description: str | None
    category_code: str
    difficulty_code: str
    start_date: date
    end_date: date
    target_frequency: int | None = Field(default=None, ge=1, le=7)
    daily_available_minutes: int | None = Field(default=None, gt=0)


class ExerciseType(ApiModel):
    code: ExerciseCode
    name: str
    verification_method: Literal["camera", "sensor"]
    target_unit: Literal["reps", "seconds", "meters"]
    min_target: int = Field(gt=0)
    max_target: int = Field(gt=0)


class GoalPlanRequest(ApiModel):
    ingest_key: str
    today: date
    goal: GoalInfo
    exercise_types: list[ExerciseType]
    generation_no: int = Field(ge=1)
    previous_summary: str | None

    @model_validator(mode="after")
    def check_goal(self):
        if self.goal.end_date < self.goal.start_date:
            raise ValueError("endDate는 startDate보다 빠를 수 없습니다.")
        if not self.ingest_key.startswith("goal-plan:"):
            raise ValueError("ingestKey 형식이 올바르지 않습니다.")
        return self


class PlanMission(ApiModel):
    scheduled_date: date
    title: str = Field(min_length=1, max_length=200)
    description: str | None
    category_code: str
    difficulty_code: str
    exercise_code: ExerciseCode | None
    verification_method: Literal["camera", "sensor"]
    target_value: int = Field(ge=1)
    target_unit: TargetUnit
    estimated_duration_seconds: int = Field(ge=60, le=14400)
    is_required: bool


class PlanStep(ApiModel):
    step_no: int = Field(ge=1)
    title: str = Field(min_length=1, max_length=200)
    description: str | None
    due_date: date
    missions: list[PlanMission]


class PlanProposalOutput(ApiModel):
    summary: str = Field(min_length=1, max_length=300)
    steps: list[PlanStep]


class GoalPlanResponse(ApiModel):
    ingest_key: str
    engine_version: str
    proposal: PlanProposalOutput


# ───────────────────────────────
# I04: Gemini 상황별 추천
# ───────────────────────────────

class SituationContext(ApiModel):
    weather: Literal[
        "clear", "clouds", "rain", "snow",
        "hot", "cold", "dust", "unknown"
    ]
    temperature_c: float | None
    time_slot: Literal[
        "morning", "afternoon", "evening", "night"
    ]
    is_moving: bool
    kind: Literal["location", "moving", "weather"]


class SituationProfile(ApiModel):
    active_goal_categories: list[str]
    recent_completion_rate: float | None = Field(
        default=None, ge=0, le=1
    )
    streak_days: int = Field(ge=0)
    recent_exercise_count: int = Field(ge=0)
    available_minutes: int | None = Field(default=None, ge=0)


class MissionCandidate(ApiModel):
    definition_id: ShortId
    title: str
    category_code: str
    exercise_code: str | None
    estimated_duration_seconds: int | None
    is_outdoor: bool


class SituationalRecommendationRequest(ApiModel):
    ingest_key: str
    context: SituationContext
    profile: SituationProfile
    candidates: list[MissionCandidate] = Field(
        min_length=1, max_length=20
    )
    max_results: int = Field(default=3, ge=1, le=20)


class RecommendationItem(ApiModel):
    rank_no: int = Field(ge=1)
    definition_id: ShortId
    reason: str = Field(min_length=1, max_length=200)


class SituationalRecommendationResponse(ApiModel):
    ingest_key: str
    engine_version: str
    items: list[RecommendationItem]


# ───────────────────────────────
# I05: 주간·월간 AI 리포트
# ───────────────────────────────

class CategoryProgress(ApiModel):
    category_code: str
    completed_value: float
    target_value: float
    unit: Literal["times", "seconds", "days"]
    rate: float = Field(ge=0, le=1)


class ExerciseProgress(ApiModel):
    exercise_code: str
    completed_count: int
    total_reps: int
    total_hold_seconds: float
    total_meters: float


class FailureFlag(ApiModel):
    code: str
    count: int


class ActiveGoal(ApiModel):
    title: str
    category_code: str
    progress_rate: float = Field(ge=0, le=1)


class ReportStats(ApiModel):
    planned_mission_count: int
    completed_mission_count: int
    failed_mission_count: int
    achievement_rate: float = Field(ge=0, le=1)
    previous_achievement_rate: float | None = Field(
        default=None, ge=0, le=1
    )
    streak_days: int
    categories: list[CategoryProgress]
    exercises: list[ExerciseProgress]
    top_failure_flags: list[FailureFlag]
    active_goals: list[ActiveGoal]


class ReportRequest(ApiModel):
    ingest_key: str
    run_id: ShortId
    run_type: Literal["weekly_report", "monthly_report"]
    period_start: date
    period_end: date
    stats: ReportStats
    callback_url: str


class NextGoal(ApiModel):
    text: str = Field(min_length=1, max_length=100)
    category_code: str | None


class ReportContent(ApiModel):
    highlights: list[str]


class ReportCallback(ApiModel):
    ingest_key: str
    run_id: ShortId
    status: Literal["completed", "failed"]
    engine_version: str
    title: str | None
    summary: str | None
    feedback: str | None
    next_goals: list[NextGoal]
    content: ReportContent
    failure_reason: str | None


# ───────────────────────────────
# I06: AI 목표 계획 재조정
# ───────────────────────────────

class AdjustmentStats(ApiModel):
    period_start: date
    period_end: date
    planned_count: int
    completed_count: int
    failed_count: int
    achievement_rate: float = Field(ge=0, le=1)
    consecutive_missed_days: int


class AdjustmentCause(ApiModel):
    code: Literal[
        "low_completion", "overload", "missed_days"
    ]
    value: float


class PlanAdjustmentRequest(ApiModel):
    ingest_key: str
    run_id: ShortId
    today: date
    goal: GoalInfo
    before_plan: list[PlanStep]
    stats: AdjustmentStats
    causes: list[AdjustmentCause]
    exercise_types: list[ExerciseType]
    callback_url: str


class PlanAdjustmentCallback(ApiModel):
    ingest_key: str
    run_id: ShortId
    status: Literal["completed", "failed"]
    engine_version: str
    reason: str | None
    proposed_plan: list[PlanStep] | None
    failure_reason: str | None
