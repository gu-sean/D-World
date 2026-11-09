import {
  reasonFor,
  scoreDefinition,
} from '../../../src/recommendations/recommendations.service.js';
import {
  isOutdoorSuitable,
  mapWeather,
  timeSlotOf,
} from '../../../src/recommendations/weather.client.js';

describe('weather helpers', () => {
  it('OpenWeather 상태를 앱 날씨 코드로', () => {
    expect(mapWeather('Clear')).toBe('clear');
    expect(mapWeather('Clouds')).toBe('clouds');
    expect(mapWeather('Drizzle')).toBe('rain');
    expect(mapWeather('Thunderstorm')).toBe('rain');
    expect(mapWeather('Snow')).toBe('snow');
    expect(mapWeather('Mist')).toBe('other');
    expect(mapWeather(undefined)).toBe('other');
  });

  it('실외 적합: 맑거나 흐리고 5~30도', () => {
    expect(isOutdoorSuitable({ weather: 'clear', temperatureC: 20 })).toBe(
      true,
    );
    expect(isOutdoorSuitable({ weather: 'clouds', temperatureC: 5 })).toBe(
      true,
    );
    expect(isOutdoorSuitable({ weather: 'clear', temperatureC: 31 })).toBe(
      false,
    );
    expect(isOutdoorSuitable({ weather: 'rain', temperatureC: 20 })).toBe(
      false,
    );
    expect(isOutdoorSuitable({ weather: null, temperatureC: null })).toBe(
      false,
    );
  });

  it('KST 시간대', () => {
    // UTC 20:00 = KST 05:00
    expect(timeSlotOf(new Date('2026-11-09T20:00:00Z'))).toBe('morning');
    expect(timeSlotOf(new Date('2026-11-09T03:00:00Z'))).toBe('afternoon');
    expect(timeSlotOf(new Date('2026-11-09T10:00:00Z'))).toBe('evening');
    expect(timeSlotOf(new Date('2026-11-09T14:00:00Z'))).toBe('night');
  });
});

describe('scoreDefinition', () => {
  const run = { exercise_code: 'running', estimated_duration_seconds: 1800 };
  const squat = {
    exercise_code: 'squat',
    estimated_duration_seconds: 600,
    interest: true,
  };
  const base = {
    outdoorSuitable: true,
    isMoving: false,
    timeSlot: 'afternoon',
  };

  it('실외에 맞지 않으면 러닝은 제외', () => {
    expect(
      scoreDefinition(run, { ...base, outdoorSuitable: false }),
    ).toBeNull();
    expect(scoreDefinition(run, base)).toBe(2);
  });

  it('관심 분야와 짧은 야간 미션에 가산점', () => {
    expect(scoreDefinition(squat, base)).toBe(3);
    expect(scoreDefinition({ ...squat, interest: false }, base)).toBe(0);
    expect(
      scoreDefinition(
        { ...squat, estimated_duration_seconds: 600 },
        { ...base, timeSlot: 'night' },
      ),
    ).toBe(5);
    expect(scoreDefinition(squat, { ...base, isMoving: true })).toBe(2);
  });
});

describe('reasonFor', () => {
  it('상황에 맞는 이유', () => {
    expect(
      reasonFor({ exercise_code: 'running' }, { outdoorSuitable: true }),
    ).toContain('달리기');
    expect(reasonFor({}, { timeSlot: 'night' })).toContain('늦은 시간');
    expect(reasonFor({ interest: true }, { timeSlot: 'morning' })).toContain(
      '목표',
    );
    expect(reasonFor({}, { timeSlot: 'morning' })).toContain('오늘');
  });
});
