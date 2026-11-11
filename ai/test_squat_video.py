import argparse
import json

from analyze_video import analyze


def main():
    parser = argparse.ArgumentParser(
        description="API와 동일한 함수로 스쿼트 영상 분석"
    )
    parser.add_argument("video", help="영상 파일 경로")
    args = parser.parse_args()

    result = analyze("squat", args.video)

    print(json.dumps(
        result,
        ensure_ascii=False,
        indent=2,
    ))


if __name__ == "__main__":
    main()