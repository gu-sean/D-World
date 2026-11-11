import { Injectable, Logger } from '@nestjs/common';

/**
 * 미션의 "유효한 승인 여부"가 바뀔 때 알려 주는 훅
 * 스트릭 모듈이 생기면 onModuleInit에서 register()로 리스너를 등록한다(없으면 아무 일도 하지 않음).
 * 리스너는 판정 반영과 같은 트랜잭션(tx)에서 호출 → 실패 시 판정도 롤백
 *   listener(tx, { userId, missionId, scheduledDate, hasValidApproval })
 */
@Injectable()
export class MissionOutcomeNotifier {
  logger = new Logger(MissionOutcomeNotifier.name);
  listeners = [];

  register(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  async notify(tx, event) {
    for (const listener of this.listeners) await listener(tx, event);
  }
}
