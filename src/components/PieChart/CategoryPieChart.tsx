import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { formatYen } from '../../utils/format';
import type { ChartCategoryItem } from '../../utils/chart';
import styles from './CategoryPieChart.module.css';

export interface CategoryPieChartProps {
  data: ChartCategoryItem[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  centerContent?: React.ReactNode;
  tooltipLabel?: string;
}

/**
 * 共通円グラフコンポーネント
 * - 円の真上（12時の位置: startAngle={90}）から時計回り（endAngle={-270}）に描画
 * - アニメーションも12時の位置から時計回りに進行
 */
export function CategoryPieChart({
  data,
  height = 200,
  innerRadius = 55,
  outerRadius = 85,
  centerContent,
  tooltipLabel = '金額',
}: CategoryPieChartProps) {
  if (data.length === 0) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            startAngle={90}
            endAngle={-270}
            animationBegin={0}
            animationDuration={800}
          >
            {data.map((entry) => (
              <Cell key={entry.id} fill={entry.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: any) => [formatYen(Number(value) || 0), tooltipLabel]}
            contentStyle={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              fontSize: '14px',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {centerContent && <div className={styles.centerContainer}>{centerContent}</div>}
    </div>
  );
}
