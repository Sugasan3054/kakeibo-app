import { describe, it, expect } from 'vitest';
import { sortByAmountDesc, type ChartCategoryItem } from '../chart';

describe('sortByAmountDesc', () => {
  it('金額の大きい順（降順）に正しく並び替える', () => {
    const input: ChartCategoryItem[] = [
      { id: '1', name: '日用品', value: 1500, color: '#333', order: 1 },
      { id: '2', name: '食費', value: 5000, color: '#f00', order: 2 },
      { id: '3', name: '交通費', value: 3000, color: '#0f0', order: 3 },
    ];

    const result = sortByAmountDesc(input);

    expect(result.map((r) => r.name)).toEqual(['食費', '交通費', '日用品']);
    expect(result.map((r) => r.value)).toEqual([5000, 3000, 1500]);
  });

  it('金額が0円または負の分類は除外する', () => {
    const input: ChartCategoryItem[] = [
      { id: '1', name: '食費', value: 4000, color: '#f00', order: 1 },
      { id: '2', name: '交際費', value: 0, color: '#aaa', order: 2 },
      { id: '3', name: '雑費', value: -500, color: '#bbb', order: 3 },
      { id: '4', name: '住居費', value: 80000, color: '#00f', order: 4 },
    ];

    const result = sortByAmountDesc(input);

    expect(result.map((r) => r.name)).toEqual(['住居費', '食費']);
    expect(result.find((r) => r.name === '交際費')).toBeUndefined();
    expect(result.find((r) => r.name === '雑費')).toBeUndefined();
  });

  it('金額が同じ分類は、分類の表示順（orderの昇順）で並び替える', () => {
    const input: ChartCategoryItem[] = [
      { id: '3', name: '趣味', value: 3000, color: '#00f', order: 5 },
      { id: '1', name: '食費', value: 3000, color: '#f00', order: 1 },
      { id: '2', name: '日用品', value: 3000, color: '#0f0', order: 2 },
      { id: '4', name: '家賃', value: 50000, color: '#333', order: 10 },
    ];

    const result = sortByAmountDesc(input);

    expect(result.map((r) => r.name)).toEqual(['家賃', '食費', '日用品', '趣味']);
  });

  it('空配列の場合は空配列を返す', () => {
    expect(sortByAmountDesc([])).toEqual([]);
  });
});
