"""인증이 안 됐을 때 '다시 할 때 이렇게 해 보세요' 코칭 문장 (2~4개).

Gemini에는 영상이 아니라 분석 수치만 보낸다 (동작마다 가장 깊은 각도·걸린 시간, 감지 비율 등).
Gemini가 꺼져 있거나 실패하면 운동·판정 코드별 규칙 문장으로 대신한다. 절대 예외를 내지 않는다.
"""

import logging
import os

log = logging.getLogger(__name__)

MAX_TIPS = 4
MAX_TIP_LENGTH = 140

# 운동별 기준 (counter 파일의 값과 같게 유지) — Gemini가 "몇 도까지"를 정확히 말하게 넘긴다
CRITERIA = {
    "push_up": "팔꿈치 각도 106° 이하까지 내려가고 115° 이상으로 올라오면 1회. 몸은 옆에서 봤을 때 엎드린 수평 자세여야 함",
    "squat": "무릎 각도 105° 이하까지 앉았다가 155° 이상으로 일어서면 1회",
    "lunge": "앞 무릎 각도 110° 이하까지 굽혔다가 155° 이상으로 펴면 1회",
    "burpee": "서기 → 엎드려 다리 뒤로 뻗기(플랭크) → 서기 를 모두 거쳐야 1회",
    "plank": "어깨·엉덩이·발목이 일자(몸 각도 160° 이상)인 시간만 버틴 시간으로 셈",
}
NAMES = {"push_up": "푸쉬업", "squat": "스쿼트", "lunge": "런지", "burpee": "버피", "plank": "플랭크"}

INSTRUCTIONS = """너는 홈트레이닝 앱의 운동 코치야. 사용자가 찍은 운동 인증 영상을 자세 인식으로 분석한
수치(입력 JSON)를 보고, 다음에 다시 찍을 때 무엇을 고치면 인증될지 한국어로 알려 줘.

규칙
- tips는 2~4개. 한 개는 1~2문장, 120자 이내. 존댓말(~해 주세요, ~예요).
- 입력 수치에 근거해서 구체적으로: 몇 번째 동작·몇 초쯤·몇 도였는지, 기준(criteria)까지 얼마나 더 가야 하는지.
- cycles는 동작 하나씩: counted=false면 기준에 못 미쳐 세지 않은 동작, minAngle은 가장 깊이 굽혔을 때 각도,
  seconds는 내려갔다 올라오는 데 걸린 시간. 너무 빠르면(0.6초 미만) 천천히 하라고 해도 좋아.
- 감지 비율(detectionRatio)이 낮으면 촬영 위치(옆에서, 2~3m, 전신이 보이게, 폰 고정)를 먼저 말해.
- flags: below_target(횟수 부족), near_target(거의 채움), person_not_detected, low_detection(몸이 자주 가려짐),
  recorded_before_start(인증 시작 전에 찍은 영상), duplicate_media(이미 낸 영상), no_frames(영상을 못 읽음).
  recorded_before_start·duplicate_media면 자세 말고 '인증 시작 후 새로 찍기'를 알려 줘.
- 입력에 없는 사실(통증, 체중, 질병)은 지어내지 마. 의학적 진단은 하지 마.
- 출력은 JSON 하나: {"tips": ["...", "..."]}"""


def _enabled() -> bool:
    return os.getenv("VISION_AI_COACHING", "true").lower() == "true"


def _payload(exercise: str, target_value: float, target_unit: str, result: dict, decision: str,
             reason: str, flags: list[str]) -> dict:
    return {
        "exercise": NAMES.get(exercise, exercise),
        "criteria": CRITERIA.get(exercise),
        "target": f"{target_value:g}{'초' if target_unit == 'seconds' else '회'}",
        "decision": decision,
        "reason": reason,
        "flags": [f for f in flags if f not in ("algorithm_unverified", "form_feedback")],
        "countedReps": result.get("repCount"),
        "holdSeconds": result.get("holdSeconds"),
        "attempts": result.get("attempts"),
        "videoSeconds": result.get("durationSeconds"),
        "detectionRatio": result.get("detectionRatio"),
        "cycles": (result.get("cycles") or [])[:40],
        "postureEvents": [
            {k: e.get(k) for k in ("code", "time", "end", "attempt", "value") if e.get(k) is not None}
            for e in (result.get("events") or [])[:20]
        ],
    }


def _clean(tips) -> list[str]:
    if not isinstance(tips, list):
        return []
    out = []
    for tip in tips:
        if isinstance(tip, str) and tip.strip():
            out.append(tip.strip()[:MAX_TIP_LENGTH])
    return out[:MAX_TIPS]


# ---- 규칙 문장 (Gemini를 못 쓸 때) ----
EXERCISE_TIPS = {
    "push_up": [
        "가슴이 바닥에 가까워질 때까지(팔꿈치 90° 정도) 내려갔다가 올라와 주세요.",
        "몸 옆쪽에서 찍어야 팔꿈치 각도가 정확히 보여요. 폰을 바닥에 세워 2~3m 떨어뜨려 주세요.",
    ],
    "squat": [
        "허벅지가 바닥과 거의 평행해질 때까지 앉았다가 무릎을 끝까지 펴며 일어나 주세요.",
        "옆에서 무릎과 발목이 모두 보이게 찍어 주세요.",
    ],
    "lunge": [
        "앞 무릎이 90° 정도가 될 때까지 몸을 내렸다가 다리를 펴며 올라와 주세요.",
        "옆에서 두 다리가 모두 보이게 찍어 주세요.",
    ],
    "burpee": [
        "매번 다리를 뒤로 쭉 뻗어 엎드린 자세(플랭크)를 거친 뒤 일어나 주세요.",
        "엎드렸을 때도 머리부터 발끝까지 화면에 들어오게 멀리서 찍어 주세요.",
    ],
    "plank": [
        "어깨·엉덩이·발목이 일자가 되도록 배에 힘을 주고 버텨 주세요. 엉덩이가 처지거나 솟으면 시간이 멈춰요.",
        "옆에서 몸 전체가 보이게 찍어 주세요.",
    ],
}
FLAG_TIPS = {
    "person_not_detected": "몸이 화면에 잘 안 보였어요. 폰을 2~3m 떨어진 곳에 세우고 전신이 들어오는지 먼저 확인해 주세요.",
    "low_detection": "몸이 자주 화면 밖으로 나가거나 가려졌어요. 조금 더 멀리, 밝은 곳에서 찍어 주세요.",
    "recorded_before_start": "인증 시작 버튼을 누른 뒤에 새로 찍은 영상만 인정돼요.",
    "duplicate_media": "이미 낸 영상은 다시 쓸 수 없어요. 새로 찍어 주세요.",
    "no_frames": "영상을 읽지 못했어요. 앱에서 바로 다시 찍어 주세요.",
}


def rule_tips(exercise: str, target_value: float, target_unit: str, result: dict,
              flags: list[str]) -> list[str]:
    tips = [FLAG_TIPS[f] for f in flags if f in FLAG_TIPS]
    if any(f in flags for f in ("recorded_before_start", "duplicate_media", "no_frames")):
        return tips[:MAX_TIPS]
    cycles = result.get("cycles") or []
    missed = [c for c in cycles if not c.get("counted")]
    if missed:
        worst = min(missed, key=lambda c: c.get("minAngle", 999))
        tips.append(
            f"{worst['attempt']}번째 동작은 가장 낮을 때 {worst['minAngle']}°여서 세지 않았어요. "
            "조금만 더 깊이 내려가 주세요."
        )
    fast = [c for c in cycles if 0 < c.get("seconds", 1) < 0.6]
    if len(fast) >= 3:
        tips.append("동작이 너무 빨라 정확히 보기 어려워요. 1회에 1~2초씩 천천히 해 주세요.")
    if "below_target" in flags and target_unit != "seconds":
        done = result.get("repCount") or 0
        tips.append(f"목표 {target_value:g}회 중 {done}회가 인정됐어요. 목표를 채운 뒤에 촬영을 멈춰 주세요.")
    tips += EXERCISE_TIPS.get(exercise, [])
    return list(dict.fromkeys(tips))[:MAX_TIPS]


def coaching_tips(exercise: str, target_value: float, target_unit: str, result: dict,
                  decision: str, reason: str, flags: list[str]) -> tuple[list[str], str]:
    """(tips, source). source는 'gemini' 또는 'rule'. 승인된 인증은 ([], 'none')."""
    if decision == "approved":
        return [], "none"
    if _enabled() and not any(f in flags for f in ("duplicate_media", "recorded_before_start")):
        try:
            from app.llm.gemini import generate_json

            data = generate_json(
                INSTRUCTIONS,
                _payload(exercise, target_value, target_unit, result, decision, reason, flags),
                max_wait=30.0,
            )
            tips = _clean(data.get("tips"))
            if len(tips) >= 1:
                return tips, "gemini"
        except Exception as exc:  # noqa: BLE001 - 코칭이 실패해도 판정은 그대로 보낸다
            log.warning("AI coaching failed, using rule tips: %s", type(exc).__name__)
    return rule_tips(exercise, target_value, target_unit, result, flags), "rule"
