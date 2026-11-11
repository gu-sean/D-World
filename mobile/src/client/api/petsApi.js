/**
 * 08 §10 펫 (A80~A85).
 */
import { request } from '../http/httpClient.js';

/**
 * A80 내 펫 (대표 펫 먼저).
 * @returns {Promise<object[]>} `Pet[]`
 */
export function getMyPets() {
  return request({ method: 'GET', path: '/me/pets' });
}

/**
 * A81 펫 종류 목록 (`status='public'`).
 * @param {{categoryCode?: string}} [query]
 * @returns {Promise<object[]>} `PetSpecies[]`
 */
export function getPetSpecies(query) {
  return request({ method: 'GET', path: '/pet-species', query });
}

/**
 * A82 펫 종류 상세.
 * @param {string} speciesId
 * @returns {Promise<object>} `PetSpecies`
 */
export function getPetSpeciesDetail(speciesId) {
  return request({ method: 'GET', path: `/pet-species/${encodeURIComponent(speciesId)}` });
}

/**
 * A83 대표 펫 설정. 보류 XP가 있으면 이 펫이 받는다.
 * @param {{petId: string}} input
 * @returns {Promise<object>} `Pet`
 */
export function setRepresentativePet({ petId }) {
  return request({ method: 'PUT', path: '/me/representative-pet', body: { petId } });
}

/**
 * A84 펫 부화 (멱등 필수).
 * @param {{speciesId: string, nickname: string, idempotencyKey: string}} input
 * @returns {Promise<object>} `Pet`
 */
export function hatchPet({ idempotencyKey, ...body }) {
  return request({ method: 'POST', path: '/me/pets', body, idempotent: true, idempotencyKey });
}

/**
 * A85 펫 진화 기록 (앱이 마지막으로 본 시각 이후).
 * @param {string} petId
 * @param {string} [after] ISO datetime
 * @returns {Promise<object[]>} `PetEvolution[]`
 */
export function getPetEvolutionEvents(petId, after) {
  return request({
    method: 'GET',
    path: `/me/pets/${encodeURIComponent(petId)}/evolution-events`,
    query: { after },
  });
}

export default {
  getMyPets,
  getPetSpecies,
  getPetSpeciesDetail,
  setRepresentativePet,
  hatchPet,
  getPetEvolutionEvents,
};
