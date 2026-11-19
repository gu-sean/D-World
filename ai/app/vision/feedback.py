"""동작 기록(events) → 사용자에게 보여 줄 자세 피드백 문장과 PoseIssue 목록.

예) "세지 않은 동작이 2번 있었어요. 3번째(0:42)·7번째(1:15) 동작은 팔을 덜 굽혔어요
     (가장 낮을 때 평균 124°, 106° 이하까지 굽혀야 해요)."
"""

# code → (무엇이 부족했는지, 각도 이름, 기준 각도 안내)
REP_MESSAGES = {
    "push_up_shallow": ("팔을 덜 굽혔어요", "팔꿈치", "106° 이하까지 굽혀야 해요"),
    "squat_shallow": ("덜 앉았어요", "무릎", "105° 이하까지 앉아야 해요"),
    "lunge_shallow": ("무릎을 덜 굽혔어요", "앞 무릎", "110° 이하까지 굽혀야 해요"),
    "burpee_no_plank": ("다리를 뒤로 뻗어 엎드리는 동작을 건너뛰었어요", None, None),
}
PLANK_MESSAGES = {
    "plank_sag": "엉덩이가 처졌어요",
    "plank_pike": "엉덩이가 너무 올라갔어요",
    "plank_posture": "몸이 일자에서 벗어났어요",
}
MAX_LISTED = 4


def _clock(seconds: float) -> str:
    total = round(seconds or 0)
    return f"{total // 60}:{total % 60:02d}"


def build_feedback(events: list[dict] | None) -> tuple[str, list[dict]]:
    """(피드백 문장, issues). 기록이 없으면 ("", [])."""
    if not events:
        return "", []
    sentences: list[str] = []
    issues: list[dict] = []

    rep_events = [e for e in events if e.get("code") in REP_MESSAGES]
    if rep_events:
        sentences.append(f"세지 않은 동작이 {len(rep_events)}번 있었어요.")
    for code, (what, joint, rule) in REP_MESSAGES.items():
        group = [e for e in rep_events if e["code"] == code]
        if not group:
            continue
        listed = "·".join(f"{e['attempt']}번째({_clock(e['time'])})" for e in group[:MAX_LISTED])
        more = f" 외 {len(group) - MAX_LISTED}번" if len(group) > MAX_LISTED else ""
        sentence = f"{listed}{more} 동작은 {what}"
        values = [e["value"] for e in group if isinstance(e.get("value"), (int, float))]
        if joint and values:
            average = round(sum(values) / len(values))
            sentence += f"(가장 낮을 때 {joint} 평균 {average}°, {rule})"
        sentences.append(sentence + ".")
        issues += [
            {"code": code, "startSec": e["time"], "endSec": e["time"]} for e in group
        ]

    plank_events = [e for e in events if e.get("code") in PLANK_MESSAGES]
    if plank_events:
        lost = sum(max(0.0, e["end"] - e["time"]) for e in plank_events)
        parts = [
            f"{_clock(e['time'])}~{_clock(e['end'])} {PLANK_MESSAGES[e['code']]}"
            for e in plank_events[:MAX_LISTED]
        ]
        more = f" 외 {len(plank_events) - MAX_LISTED}번" if len(plank_events) > MAX_LISTED else ""
        sentences.append(
            f"자세가 무너진 {round(lost)}초는 버틴 시간에 넣지 않았어요: {', '.join(parts)}{more}."
        )
        issues += [
            {"code": e["code"], "startSec": e["time"], "endSec": e["end"]} for e in plank_events
        ]

    return " ".join(sentences), issues
