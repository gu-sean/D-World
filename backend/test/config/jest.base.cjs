// ts-jest 공통 설정: 소스는 JavaScript(ESM)이므로 allowJs로 변환하고 데코레이터를 켠다
// 실행은 `node --experimental-vm-modules`(package.json scripts) 필요
module.exports = {
  rootDir: '../..',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  transform: {
    '^.+\.[jt]s$': [
      'ts-jest',
      {
        useESM: true,
        diagnostics: false,
        tsconfig: {
          allowJs: true,
          isolatedModules: true,
          checkJs: false,
          experimentalDecorators: true,
          emitDecoratorMetadata: false,
          target: 'ES2023',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          esModuleInterop: true,
        },
      },
    ],
  },
  // node_modules의 ESM 전용 패키지(jose 등)도 변환 대상
  transformIgnorePatterns: ['/node_modules/(?!(jose|nanoid)/)'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
