import { getReferences, usesReferences } from 'style-dictionary/utils';

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

function escapeSwiftString(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function formatSwiftName(token) {
  return token.name.replace(/-/g, '_');
}

function formatColorString(value) {
  const rgba = value.match(
    /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(0|1|0?\.\d+)\s*\)$/i,
  );

  if (rgba) {
    const hexColor = [rgba[1], rgba[2], rgba[3]]
      .map((channel) => Number(channel).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();

    return `UIColor(hexColor: "#${hexColor}").withAlphaComponent(${rgba[4]})`;
  }

  return `UIColor(hexColor: "${value.toUpperCase()}")`;
}

function referenceName(value, dictionary) {
  if (!usesReferences(value)) {
    return undefined;
  }

  const refs = getReferences(value, dictionary.tokens);
  if (refs.length !== 1 || value.trim() !== `{${refs[0].ref.join('.')}}`) {
    return undefined;
  }

  return formatSwiftName(refs[0]);
}

function formatSwiftValue(value, token, dictionary) {
  const referencedName = typeof value === 'string' ? referenceName(value, dictionary) : undefined;
  if (referencedName) {
    return referencedName;
  }

  if (token.type === 'color' && typeof value === 'string') {
    return formatColorString(value);
  }

  if ((token.type === 'fontWeights' || token.type === 'fontSizes') && typeof value === 'string') {
    const numericValue = Number(value);
    if (Number.isInteger(numericValue)) {
      return String(numericValue);
    }
  }

  if (typeof value === 'string') {
    return `"${escapeSwiftString(value)}"`;
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : String(value);
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const properties = Object.entries(value)
      .map(([key, childValue]) => {
        const childToken = { ...token, type: undefined };
        return `"${escapeSwiftString(key)}": ${formatSwiftValue(childValue, childToken, dictionary)}`;
      })
      .join(', ');

    return `[${properties}] as [String: Any]`;
  }

  return String(value);
}

function swiftHexColorClass({ dictionary, file }) {
  const className = file.options?.className ?? 'DesignToken';
  const tokens = [...dictionary.allTokens].sort((left, right) => left.name.localeCompare(right.name));
  const lines = tokens.map((token) => {
    const value = formatSwiftValue(token.original.value, token, dictionary);
    return `    public static let ${formatSwiftName(token)} = ${value}`;
  });

  return `//
// ${file.destination}
//

// Do not edit directly, this file was auto-generated.

import UIKit

public class ${className} {
${lines.join('\n')}
}
`;
}

export default {
  source: ['tokens.json'],
  preprocessors: ['tokens-studio-reference-paths'],
  hooks: {
    preprocessors: {
      'tokens-studio-reference-paths': rewriteTokenReferences,
    },
    formats: {
      'ios-swift/hex-color-class.swift': swiftHexColorClass,
    },
  },
  platforms: {
    'ios-swift': {
      transformGroup: 'ios-swift',
      buildPath: 'build/ios/',
      files: [
        {
          destination: 'DesignToken.swift',
          format: 'ios-swift/hex-color-class.swift',
          options: {
            className: 'DesignToken',
          },
        },
      ],
    },
  },
};
