"""MediaPipe 관절 좌표를 각도·수평 판단에 쓸 수 있게 맞추는 공용 함수."""

from types import SimpleNamespace


def to_square_coords(landmarks, width: int, height: int):
    """화면 비율 보정.

    MediaPipe는 x를 영상 너비, y를 영상 높이로 각각 0~1 정규화한다.
    세로 폰 영상(예: 1080x1920)에서는 y 1칸이 x 1칸보다 1.78배 길어서
    관절 각도와 수평 판단이 틀어진다. y에 height/width를 곱해 두 축을
    같은 길이 단위(영상 너비 기준)로 맞춘다.
    """
    if width <= 0 or height <= 0:
        raise ValueError("영상 크기가 올바르지 않습니다.")
    scale = height / width
    return [
        SimpleNamespace(
            x=point.x,
            y=point.y * scale,
            visibility=getattr(point, "visibility", 1.0),
        )
        for point in landmarks
    ]


def is_horizontal(a, b, *, min_dx: float, max_slope: float) -> bool:
    """두 점을 잇는 선이 화면에서 수평에 가까운지 (to_square_coords를 거친 좌표 기준)."""
    dx = abs(a.x - b.x)
    dy = abs(a.y - b.y)
    return dx > min_dx and dy / dx < max_slope
