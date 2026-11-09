import json
import logging


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        # 비밀값·원본 사용자 정보는 로그에 남기지 않는다.
        return json.dumps({"level": record.levelname, "event": record.getMessage()},
                          ensure_ascii=False)


def configure_logging() -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    logging.basicConfig(level=logging.INFO, handlers=[handler], force=True)
