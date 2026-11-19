/**
 * 공동 순위(1, 1, 3): 점수가 같으면 같은 순위를 주고, 다음 순위는 앞선 사람 수만큼 건너뛴다.
 * - rows는 점수 내림차순으로 이미 정렬돼 있어야 한다(같은 점수 안의 줄 순서는 그대로 둔다).
 * - 줄 세우는 순서(동점 시 마지막 성공 제출 시각 → 신청 시각)와 DB에 저장되는 순위는 바꾸지 않고,
 *   화면에 보여 주는 순위 번호만 같게 한다. 보상은 순위가 아니라 완주 여부로 정해진다.
 * @param {{score: number}[]} rows
 * @returns {number[]} rows와 같은 순서의 순위 번호
 */
export function sharedRanks(rows) {
  let rank = 0;
  return rows.map((row, index) => {
    if (index === 0 || row.score !== rows[index - 1].score) rank = index + 1;
    return rank;
  });
}
