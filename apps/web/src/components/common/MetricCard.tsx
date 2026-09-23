import { Badge, Text } from '@cloudflare/kumo';
import { TrendDown, TrendUp } from '@phosphor-icons/react';
import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: string;
  isPositive?: boolean;
  icon: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  change,
  isPositive = true,
  icon,
}) => {
  return (
    <div className="rounded-md border border-kumo-hairline bg-kumo-base p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-kumo-subtle">{title}</p>
        <span className="text-kumo-subtle shrink-0 [&>svg]:w-4 [&>svg]:h-4">{icon}</span>
      </div>

      <p className="mt-2.5 text-3xl font-semibold tracking-tight text-kumo-strong tabular-nums">
        {value}
      </p>

      <div className="mt-2.5 flex items-center gap-2">
        {change && (
          <Badge
            variant={isPositive ? 'success' : 'error'}
            icon={isPositive ? <TrendUp /> : <TrendDown />}
          >
            {change}
          </Badge>
        )}
        {subtitle && (
          <Text variant="secondary" size="xs" truncate>
            {subtitle}
          </Text>
        )}
      </div>
    </div>
  );
};
