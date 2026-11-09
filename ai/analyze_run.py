"""Local running evaluator for a provisional I02 sensor file format."""

import argparse
import gzip
import json
from math import asin, cos, radians, sin, sqrt
from pathlib import Path
from typing import Literal

from pydantic import Field, ValidationError, model_validator

from app.schemas.contracts import ApiModel, SensorEvaluationResponse, VerificationMetrics


class RunPoint(ApiModel):
    elapsed_seconds: float = Field(ge=0, le=86400)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy_meters: float = Field(ge=0, allow_inf_nan=False)
    steps_total: int | None = Field(default=None, ge=0)
    activity: Literal["running", "walking", "cycling", "vehicle", "still", "unknown"] = "unknown"
    mock_location: bool | None = None


class RunRecording(ApiModel):
    points: list[RunPoint] = Field(min_length=2, max_length=30_000)

    @model_validator(mode="after")
    def check_time_order(self):
        if any(a.elapsed_seconds >= b.elapsed_seconds for a, b in zip(self.points, self.points[1:])):
            raise ValueError("측정 시각은 중복 없이 증가해야 합니다.")
        return self


def gps_distance(a: RunPoint, b: RunPoint) -> float:
    lat_a, lat_b = radians(a.latitude), radians(b.latitude)
    half_lat = sin((lat_b - lat_a) / 2)
    half_lon = sin(radians(b.longitude - a.longitude) / 2)
    chord = half_lat**2 + cos(lat_a) * cos(lat_b) * half_lon**2
    return 2 * 6_371_000 * asin(sqrt(max(0.0, min(1.0, chord))))


def evaluate(recording: RunRecording, ingest_key: str) -> SensorEvaluationResponse:
    # Development defaults. Calibrate against labeled phone recordings before release.
    max_accuracy_meters = 25
    max_gap_seconds = 10
    max_running_speed_mps = 8
    distance = active_seconds = 0.0
    steps = 0
    flags = set()
    points = recording.points
    for a, b in zip(points, points[1:]):
        seconds = b.elapsed_seconds - a.elapsed_seconds
        if a.mock_location or b.mock_location:
            flags.add("mock_location")
            continue
        activities = {a.activity, b.activity}
        if activities & {"cycling", "vehicle"}:
            flags.add("non_running_transport")
            continue
        if max(a.accuracy_meters, b.accuracy_meters) > max_accuracy_meters:
            flags.add("poor_gps_accuracy")
            continue
        if seconds > max_gap_seconds:
            flags.add("gps_gap")
            continue
        meters = gps_distance(a, b)
        if meters / seconds > max_running_speed_mps:
            flags.add("implausible_running_speed")
            continue
        if activities & {"walking", "still"}:
            continue
        if activities != {"running"} or a.steps_total is None or b.steps_total is None:
            flags.add("insufficient_running_evidence")
            continue
        step_delta = b.steps_total - a.steps_total
        if step_delta < 0:
            flags.add("step_counter_reset")
            continue
        if step_delta == 0 or meters == 0:
            flags.add("missing_movement_evidence")
            continue
        if step_delta / seconds > 5:
            flags.add("implausible_step_rate")
            continue
        distance += meters
        active_seconds += seconds
        steps += step_delta

    if not active_seconds:
        flags.add("no_verified_running_interval")
    mock_values = [p.mock_location for p in points]
    mock_detected = True if any(mock_values) else False if all(v is False for v in mock_values) else None
    return SensorEvaluationResponse(
        ingest_key=ingest_key,
        decision="review_required",
        confidence=0,  # The contract requires a value. No calibrated score is available yet.
        reason="개발용 규칙으로 계산한 결과입니다. 실제 러닝 데이터로 검증이 필요합니다.",
        engine_version="sensor-run-dev@0.1.0",
        metrics=VerificationMetrics(
            exercise_code="running",
            distance_meters=round(distance, 2),
            active_seconds=round(active_seconds, 2),
            duration_seconds=round(points[-1].elapsed_seconds - points[0].elapsed_seconds, 2),
            avg_pace_seconds_per_km=round(active_seconds * 1000 / distance, 2) if distance else None,
            steps=steps if active_seconds else None,
            avg_cadence_spm=round(steps * 60 / active_seconds, 2) if active_seconds else None,
            valid_point_ratio=round(
                sum(p.accuracy_meters <= max_accuracy_meters and not p.mock_location for p in points)
                / len(points),
                3,
            ),
            mock_location_detected=mock_detected,
            flags=sorted(flags),
        ),
    )


def demo_recording() -> RunRecording:
    # Synthetic route with 15 seconds of running followed by a vehicle segment.
    return RunRecording(points=[
        RunPoint(elapsed_seconds=seconds, latitude=37.5 + offset, longitude=127.0,
                 accuracy_meters=5, steps_total=steps, activity=activity)
        for seconds, offset, steps, activity in [
            (0, 0, 0, "running"), (5, 0.00012, 14, "running"),
            (10, 0.00024, 28, "running"), (15, 0.00036, 42, "running"),
            (20, 0.00070, 42, "vehicle"), (25, 0.00110, 42, "vehicle"),
        ]
    ])


def main() -> None:
    parser = argparse.ArgumentParser(description="개발용 러닝 센서 기록 분석")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--demo", action="store_true")
    source.add_argument("--file", type=Path, help="로컬 센서 기록 JSON 또는 .json.gz")
    args = parser.parse_args()
    try:
        if args.demo:
            recording = demo_recording()
        else:
            opener = gzip.open if args.file.suffix.lower() == ".gz" else open
            with opener(args.file, "rb") as stream:
                limit = 8 * 1024 * 1024
                content = stream.read(limit + 1)
            if len(content) > limit:
                raise ValueError("센서 기록은 압축 해제 후 8MB 이하여야 합니다.")
            recording = RunRecording.model_validate_json(content)
    except (OSError, EOFError, ValidationError, ValueError) as error:
        parser.error(str(error))
    result = evaluate(recording, "sensor:00000000-0000-0000-0000-000000000000:dev")
    print(json.dumps(result.model_dump(mode="json", by_alias=True, exclude_none=True),
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
