"""호출 한도·작업 기록·영상 지문·부정 인증 판정·재조정 검증 테스트."""

from datetime import date

import pytest

from app.api.v1.llm_jobs import coverage_issues
from app.core.job_ledger import JobLedger
from app.llm.rate_limit import LlmQuotaExceeded, RateLimiter
from app.schemas.contracts import PlanAdjustmentRequest
from app.vision.decision import judge
from app.vision.media_registry import MediaRegistry


class FakeTime:
    def __init__(self):
        self.now = 1000.0
        self.slept = []

    def clock(self):
        return self.now

    def sleep(self, seconds):
        self.slept.append(seconds)
        self.now += seconds


# ── 호출 한도 ─────────────────────────────────────────────


def limiter(per_minute=2, per_day=5, day=date(2026, 11, 14)):
    t = FakeTime()
    today = {"value": day}
    rl = RateLimiter(per_minute, per_day, clock=t.clock, sleep=t.sleep, today=lambda: today["value"])
    return rl, t, today


def test_minute_limit_waits_for_a_free_slot():
    rl, t, _ = limiter()
    rl.acquire(0)
    rl.acquire(0)
    rl.acquire(max_wait=120)  # 세 번째는 60초를 기다린 뒤 통과
    assert t.slept and t.slept[0] == pytest.approx(60.05)


def test_minute_limit_raises_when_wait_too_long():
    rl, _, _ = limiter()
    rl.acquire(0)
    rl.acquire(0)
    with pytest.raises(LlmQuotaExceeded) as exc:
        rl.acquire(max_wait=10)
    assert exc.value.scope == "minute"


def test_day_limit_raises_and_resets_next_day():
    rl, _, today = limiter(per_minute=100, per_day=2)
    rl.acquire(0)
    rl.acquire(0)
    with pytest.raises(LlmQuotaExceeded) as exc:
        rl.acquire(0)
    assert exc.value.scope == "day"
    assert rl.snapshot()["usedToday"] == 2
    today["value"] = date(2026, 11, 15)
    rl.acquire(0)
    assert rl.snapshot()["usedToday"] == 1


# ── 작업 기록 ─────────────────────────────────────────────


def test_ledger_never_fills_up_with_finished_jobs():
    t = FakeTime()
    ledger = JobLedger(max_jobs=3, finished_ttl=3600, clock=t.clock)
    for i in range(10):
        assert ledger.has_room()
        ledger.add(f"k{i}", "fp")
        ledger.update(f"k{i}", state="delivered")
    assert len(ledger) <= 3


def test_ledger_keeps_running_jobs_and_reports_full():
    ledger = JobLedger(max_jobs=2)
    ledger.add("a", "fp")
    ledger.add("b", "fp")
    assert not ledger.has_room()  # 진행 중인 작업은 지우지 않는다
    assert ledger.get("a")["state"] == "accepted"


def test_ledger_expires_finished_jobs_after_ttl():
    t = FakeTime()
    ledger = JobLedger(max_jobs=100, finished_ttl=60, clock=t.clock)
    ledger.add("done", "fp")
    ledger.update("done", state="delivered")
    ledger.add("running", "fp")
    t.now += 61
    ledger.has_room()
    assert ledger.get("done") is None
    assert ledger.get("running") is not None


# ── 영상 지문 ─────────────────────────────────────────────


def test_registry_flags_same_video_on_another_record(tmp_path):
    reg = MediaRegistry(tmp_path / "media.sqlite3")
    assert reg.claim("AB" * 32, "rec00001") is None
    assert reg.claim("ab" * 32, "rec00001") is None  # 같은 회차 재제출은 허용
    assert reg.claim("ab" * 32, "rec00002") == "rec00001"
    # 파일에 남아서 서버를 다시 띄워도 기억한다
    assert MediaRegistry(tmp_path / "media.sqlite3").claim("ab" * 32, "rec00003") == "rec00001"


def ok_result(reps=10, duration=40.0):
    return {"repCount": reps, "detectionRatio": 0.9, "analyzedFrames": 300, "durationSeconds": duration}


def test_duplicate_video_is_rejected_even_if_reps_met():
    j = judge("push_up", 10, "reps", ok_result(), duplicate_of="rec00001")
    assert j.decision == "rejected" and "duplicate_media" in j.flags


def test_video_longer_than_session_is_rejected():
    j = judge("push_up", 10, "reps", ok_result(duration=300), elapsed_seconds=60)
    assert j.decision == "rejected" and "recorded_before_start" in j.flags


def test_video_within_session_time_is_judged_normally():
    j = judge("push_up", 10, "reps", ok_result(duration=55), elapsed_seconds=50)
    assert j.decision == "approved"


# ── 재조정 계획 검증 ──────────────────────────────────────


def mission(day, value, code="squat"):
    return {
        "scheduledDate": day, "title": f"{code} {value}", "description": None,
        "categoryCode": "exercise", "difficultyCode": "easy", "exerciseCode": code,
        "verificationMethod": "camera", "targetValue": value, "targetUnit": "reps",
        "estimatedDurationSeconds": 300, "isRequired": True,
    }


def step(missions, due="2026-12-14"):
    return {"stepNo": 1, "title": "1단계", "description": None, "dueDate": due, "missions": missions}


def adjustment_request(before_missions):
    return PlanAdjustmentRequest.model_validate({
        "ingestKey": "adjust:x", "runId": "run00001", "today": "2026-11-14",
        "goal": {"title": "스쿼트", "description": None, "categoryCode": "exercise",
                 "difficultyCode": "normal", "startDate": "2026-11-02", "endDate": "2026-12-14"},
        "beforePlan": [step(before_missions)],
        "stats": {"periodStart": "2026-11-02", "periodEnd": "2026-11-08", "plannedCount": 4,
                  "completedCount": 0, "failedCount": 4, "achievementRate": 0,
                  "consecutiveMissedDays": 10},
        "causes": [{"code": "low_completion", "value": 0}],
        "exerciseTypes": [{"code": "squat", "name": "스쿼트", "verificationMethod": "camera",
                           "targetUnit": "reps", "minTarget": 1, "maxTarget": 200}],
        "callbackUrl": "http://localhost:3000/internal/v1/ai-callbacks/plan-adjustments",
    })


def plan_steps(missions):
    from app.schemas.contracts import PlanStep

    return [PlanStep.model_validate(step(missions))]


BEFORE = [mission("2026-11-16", 20), mission("2026-12-07", 30), mission("2026-12-14", 40)]


def test_plan_that_reaches_final_and_end_passes():
    after = [mission("2026-11-16", 10), mission("2026-11-30", 25), mission("2026-12-13", 40)]
    assert coverage_issues(adjustment_request(BEFORE), plan_steps(after)) == []


def test_plan_that_stops_early_and_lowers_final_is_flagged():
    # 실제 테스트에서 나온 경우: 기존 계획이 12월까지인데 11/23에 15회로 끝남
    after = [mission("2026-11-16", 10), mission("2026-11-19", 10), mission("2026-11-23", 15)]
    issues = coverage_issues(adjustment_request(BEFORE), plan_steps(after))
    assert len(issues) == 2
    assert "2026-11-23" in issues[0]
    assert "40" in issues[1]


def test_dropped_exercise_is_flagged():
    after = [mission("2026-12-14", 40, code="lunge")]
    issues = coverage_issues(adjustment_request(BEFORE), plan_steps(after))
    assert any("squat" in issue and "빠졌" in issue for issue in issues)
