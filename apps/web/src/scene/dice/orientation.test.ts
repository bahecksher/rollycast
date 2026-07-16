import { Euler, Quaternion } from 'three';
import { describe, expect, it } from 'vitest';
import { SUPPORTED_DIE_TYPES, getDieDefinition } from './dieDefinitions';
import { targetQuaternionForResult, upFaceValue } from './orientation';

// A spread of arbitrary starting orientations to reconcile from.
const START_ORIENTATIONS: Array<[number, number, number]> = [
  [0, 0, 0],
  [0.3, 1.1, -0.7],
  [2.1, -0.9, 1.5],
  [Math.PI, Math.PI / 2, 0],
  [-1.2, 0.4, 2.9],
];

describe('die face → orientation mapping', () => {
  for (const type of SUPPORTED_DIE_TYPES) {
    const def = getDieDefinition(type);

    it(`${type} exposes exactly ${def.sides} unique faces valued 1..${def.sides}`, () => {
      const values = def.faces.map((f) => f.value).sort((a, b) => a - b);
      expect(values).toEqual(Array.from({ length: def.sides }, (_, i) => i + 1));
    });

    it(`every ${type} result reconciles so that result faces up`, () => {
      for (const face of def.faces) {
        for (const euler of START_ORIENTATIONS) {
          const current = new Quaternion().setFromEuler(new Euler(...euler));
          const target = targetQuaternionForResult(current, def.faces, face.value);
          expect(upFaceValue(target, def.faces)).toBe(face.value);
        }
      }
    });
  }

  it('throws for a result the die cannot show', () => {
    const def = getDieDefinition('d6');
    expect(() => targetQuaternionForResult(new Quaternion(), def.faces, 99)).toThrow();
  });
});
