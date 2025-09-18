import React from 'react';
import styled, { css, keyframes } from 'styled-components';

interface StatusIndicatorProps {
  status: 'active' | 'inactive' | 'loading' | 'error';
  size?: 'small' | 'medium' | 'large';
  tooltip?: string;
}

const pulse = keyframes`
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
`;

const statusColors = {
  active: css`
    background: var(--lokus-success-background, #22c55e);
  `,
  inactive: css`
    background: var(--lokus-secondary-background, #6b7280);
  `,
  loading: css`
    background: var(--lokus-warning-background, #f59e0b);
    animation: ${pulse} 1.5s ease-in-out infinite;
  `,
  error: css`
    background: var(--lokus-error-background, #ef4444);
  `
};

const statusSizes = {
  small: css`
    width: 8px;
    height: 8px;
  `,
  medium: css`
    width: 12px;
    height: 12px;
  `,
  large: css`
    width: 16px;
    height: 16px;
  `
};

const Container = styled.div<{ tooltip?: string }>`
  position: relative;
  display: inline-flex;
  align-items: center;
  
  ${props => props.tooltip && css`
    &:hover::after {
      content: '${props.tooltip}';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      background: var(--lokus-tooltip-background, #1f2937);
      color: var(--lokus-tooltip-foreground, #ffffff);
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      white-space: nowrap;
      z-index: 1000;
      margin-top: 4px;
      pointer-events: none;
    }
    
    &:hover::before {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-bottom: 4px solid var(--lokus-tooltip-background, #1f2937);
      z-index: 1000;
      margin-top: 1px;
      pointer-events: none;
    }
  `}
`;

const Indicator = styled.div<StatusIndicatorProps>`
  border-radius: 50%;
  ${props => statusColors[props.status]}
  ${props => statusSizes[props.size || 'medium']}
`;

const Label = styled.span<{ size?: string }>`
  margin-left: 6px;
  font-size: ${props => props.size === 'small' ? '11px' : props.size === 'large' ? '14px' : '12px'};
  color: var(--lokus-secondary-foreground);
  text-transform: capitalize;
`;

export const StatusIndicator: React.FC<StatusIndicatorProps & { 
  showLabel?: boolean;
}> = ({
  status,
  size = 'medium',
  tooltip,
  showLabel = false
}) => {
  return (
    <Container tooltip={tooltip}>
      <Indicator status={status} size={size} />
      {showLabel && <Label size={size}>{status}</Label>}
    </Container>
  );
};