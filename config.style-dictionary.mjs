function rewriteTokenReferences(value) {
  if (typeof value === 'string') {
    return value.replace(/\{(color|font)\./g, '{global.$1.');
  }

  if (Array.isArray(value)) {
    return value.map(rewriteTokenReferences);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, childValue]) => [key, rewriteTokenReferences(childValue)]),
    );
  }

  return value;
}

export default {
  source: ['tokens.json'],
  preprocessors: ['tokens-studio-reference-paths'],
  hooks: {
    preprocessors: {
      'tokens-studio-reference-paths': rewriteTokenReferences,
    },
  },
  platforms: {
    'ios-swift': {
      transformGroup: 'ios-swift',
      buildPath: 'build/ios/',
      files: [
        {
          destination: 'DesignToken.swift',
          format: 'ios-swift/class.swift',
        },
      ],
    },
  },
};
