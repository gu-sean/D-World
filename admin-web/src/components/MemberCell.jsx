import { Typography } from 'antd';
import { Link } from 'react-router';

/**
 * 회원 한 명을 모든 목록에서 같은 모양으로 보여 준다.
 *   첫 줄: 닉네임 (누르면 회원 상세)
 *   둘째 줄: 회원 ID 전체 (자르지 않음, 복사 버튼)
 * 검색창에는 닉네임이나 이 회원 ID를 그대로 붙여 넣으면 된다 (MEMBER_FIELD).
 *
 * @param {{ id?: string|null, nickname?: string|null }} props
 */
export function MemberCell({ id, nickname }) {
  if (!id && !nickname) return '-';
  const name = nickname ?? '(닉네임 없음)';
  return (
    <div style={{ minWidth: 0 }}>
      {id ? (
        // 행 클릭(상세 열기)과 겹치지 않게 전파를 막는다
        <Link to={`/users/${id}`} onClick={(event) => event.stopPropagation()}>
          {name}
        </Link>
      ) : (
        name
      )}
      {id && (
        <Typography.Text
          type="secondary"
          copyable={{ text: id, tooltips: ['회원 ID 복사', '복사했어요'] }}
          onClick={(event) => event.stopPropagation()}
          style={{
            display: 'block',
            fontFamily: 'monospace',
            fontSize: 12,
            wordBreak: 'break-all',
          }}
        >
          {id}
        </Typography.Text>
      )}
    </div>
  );
}
