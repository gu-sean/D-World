/**
 * 탭 밖 화면(미션 완료·인증 결과·러닝 측정 등 RootNavigator에 바로 놓인 화면)에서 홈으로 돌아간다.
 *
 * 홈 탭(`HOME_TAB`)은 탭 묶음(`MAIN`) 안에 있어서, 탭 밖에서 `navigate(Routes.HOME_TAB)`만
 * 부르면 React Navigation 7은 그 이름을 찾지 못해 아무 일도 하지 않는다.
 * 그래서 `MAIN`까지 되돌아가며(`popTo`) 그 안의 홈 탭 첫 화면을 고른다. 되돌아가는 것이므로
 * 홈에서 뒤로 가기를 눌러도 방금 본 완료·결과 화면이 다시 나오지 않는다.
 *
 * @param {object} navigation 화면이 받은 `navigation`
 */
import Routes from './routes';

export default function goHome(navigation) {
  navigation.popTo(Routes.MAIN, {
    screen: Routes.HOME_TAB,
    params: { screen: Routes.HOME },
  });
}
