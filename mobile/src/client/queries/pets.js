/**
 * 펫 훅 (A80~A85).
 */
import { useQuery } from '@tanstack/react-query';

import queryKeys from './keys.js';
import { useAppMutation } from './mutation.js';
import * as petsApi from '../api/petsApi.js';
import { afterPetChanged } from './invalidate.js';

/** A80 내 펫 (`Pet[]`, 대표 펫 먼저) */
export function useMyPets() {
  return useQuery({ queryKey: queryKeys.myPets, queryFn: petsApi.getMyPets });
}

/**
 * A81 펫 종류 목록 (`PetSpecies[]`).
 * @param {{categoryCode?: string}} [params]
 */
export function usePetSpecies(params = {}) {
  return useQuery({
    queryKey: queryKeys.petSpecies(params),
    queryFn: () => petsApi.getPetSpecies(params),
  });
}

/** A82 펫 종류 상세 (`PetSpecies`) */
export function usePetSpeciesDetail(speciesId) {
  return useQuery({
    queryKey: queryKeys.petSpeciesDetail(speciesId),
    queryFn: () => petsApi.getPetSpeciesDetail(speciesId),
    enabled: Boolean(speciesId),
  });
}

/** A83 대표 펫 설정. 입력 `{petId}` */
export function useSetRepresentativePet() {
  return useAppMutation({
    mutationFn: petsApi.setRepresentativePet,
    onDone: afterPetChanged,
  });
}

/** A84 펫 부화 (멱등). 입력 `{speciesId, nickname}` */
export function useHatchPet() {
  return useAppMutation({
    idempotent: true,
    // 새로 고른 알은 바로 키우는 펫(대표)이 된다
    mutationFn: (input) => petsApi.hatchPet({ makeRepresentative: true, ...input }),
    onDone: afterPetChanged,
  });
}

/**
 * A85 펫 진화 기록 (`PetEvolution[]`).
 * @param {string} petId
 * @param {string} [after] 앱이 마지막으로 본 시각 (ISO datetime)
 */
export function usePetEvolutionEvents(petId, after) {
  return useQuery({
    queryKey: queryKeys.petEvolutionEvents(petId, after),
    queryFn: () => petsApi.getPetEvolutionEvents(petId, after),
    enabled: Boolean(petId),
  });
}

/** 펫 경험치 지갑 */
export function usePetXpWallet() {
  return useQuery({ queryKey: queryKeys.petXpWallet, queryFn: petsApi.getPetXpWallet });
}

/** 경험치 주기 (10씩). 입력 `{petId}` */
export function useFeedPet() {
  return useAppMutation({
    idempotent: true,
    mutationFn: petsApi.feedPet,
    onDone: afterPetChanged,
  });
}

export default {
  useMyPets,
  usePetXpWallet,
  useFeedPet,
  usePetSpecies,
  usePetSpeciesDetail,
  useSetRepresentativePet,
  useHatchPet,
  usePetEvolutionEvents,
};
