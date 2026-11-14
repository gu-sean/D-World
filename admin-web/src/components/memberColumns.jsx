import { MemberCell } from './MemberCell.jsx';

/**
 * 회원 열. 목록마다 키 이름이 달라서 키를 받는다.
 * @param {{ title?: string, idKey: string, nicknameKey: string, width?: number }} options
 */
export const memberColumn = ({ title = '회원', idKey, nicknameKey, width = 300 }) => ({
  title,
  key: `member-${idKey}`,
  width,
  render: (_, row) => <MemberCell id={row[idKey]} nickname={row[nicknameKey]} />,
});

/** 모든 목록의 회원 검색칸: 백엔드 `member` 매개변수 (닉네임 부분 일치 또는 회원 ID 정확히) */
export const MEMBER_FIELD = {
  name: 'member',
  type: 'text',
  label: '닉네임 또는 회원 ID',
  width: 320,
};
