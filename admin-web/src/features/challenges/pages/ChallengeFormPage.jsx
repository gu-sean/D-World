// ADM-19 Official challenge create / edit
import { useParams } from 'react-router';
import { QueryBoundary } from '../../../components/QueryBoundary.jsx';
import { useCategories, useChallenge, useDifficultyLevels } from '../queries.js';
import { PageHeader } from '../../../components/PageHeader.jsx';
import { ChallengeForm } from '../components/ChallengeForm.jsx';
import { t } from '../../../i18n/index.js';

export default function ChallengeFormPage() {
  const { challengeId } = useParams();
  const categories = useCategories();
  const difficulties = useDifficultyLevels();
  const challenge = useChallenge(challengeId);

  return (
    <>
      <PageHeader title={challengeId ? t('공식 챌린지 수정') : t('공식 챌린지 등록')} />
      <QueryBoundary query={categories}>
        {(categoryList) => (
          <QueryBoundary query={difficulties}>
            {(difficultyList) =>
              challengeId ? (
                <QueryBoundary query={challenge}>
                  {(data) => (
                    <ChallengeForm
                      challenge={data}
                      categories={categoryList}
                      difficulties={difficultyList}
                    />
                  )}
                </QueryBoundary>
              ) : (
                <ChallengeForm categories={categoryList} difficulties={difficultyList} />
              )
            }
          </QueryBoundary>
        )}
      </QueryBoundary>
    </>
  );
}
