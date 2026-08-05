import { describe, it, expect } from 'vitest';
import { courses, getCourseById } from '../js/config/courses.data.js';

describe('courses data', () => {
  it('contains 6 courses', () => {
    expect(courses).toHaveLength(6);
  });

  it('each course carries all required fields with valid values', () => {
    const required = [
      'id', 'title', 'difficulty', 'difficultyLabel',
      'weeks', 'lessons', 'icon', 'iconColor',
      'gradientFrom', 'gradientTo', 'summary',
    ];
    const validDifficulties = ['beginner', 'intermediate', 'advanced'];

    courses.forEach((c) => {
      required.forEach((key) => expect(c, `course ${c.id} missing ${key}`).toHaveProperty(key));
      expect(validDifficulties).toContain(c.difficulty);
      expect(typeof c.weeks).toBe('number');
      expect(typeof c.lessons).toBe('number');
      expect(c.summary.length).toBeGreaterThan(10);
    });
  });

  it('course ids are unique', () => {
    const ids = courses.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('getCourseById returns the matching course', () => {
    const course = getCourseById('ai-basics');
    expect(course).not.toBeNull();
    expect(course.title).toContain('AI 基础入门');
  });

  it('getCourseById returns null for unknown or empty id', () => {
    expect(getCourseById('does-not-exist')).toBeNull();
    expect(getCourseById('')).toBeNull();
    expect(getCourseById()).toBeNull();
  });
});
