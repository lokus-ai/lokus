import React from 'react';
import styled, { css } from 'styled-components';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

const buttonVariants = {
  primary: css`
    background: var(--lokus-button-primary-background);
    color: var(--lokus-button-primary-foreground);
    border: 1px solid var(--lokus-button-primary-background);
    
    &:hover:not(:disabled) {
      background: var(--lokus-button-primary-hover-background);
      border-color: var(--lokus-button-primary-hover-background);
    }
    
    &:active:not(:disabled) {
      background: var(--lokus-button-primary-active-background);
      border-color: var(--lokus-button-primary-active-background);
    }
  `,
  
  secondary: css`
    background: var(--lokus-button-secondary-background);
    color: var(--lokus-button-secondary-foreground);
    border: 1px solid var(--lokus-border);
    
    &:hover:not(:disabled) {
      background: var(--lokus-button-secondary-hover-background);
    }
    
    &:active:not(:disabled) {
      background: var(--lokus-button-secondary-active-background);
    }
  `,
  
  outline: css`
    background: transparent;
    color: var(--lokus-foreground);
    border: 1px solid var(--lokus-border);
    
    &:hover:not(:disabled) {
      background: var(--lokus-hover-background);
    }
    
    &:active:not(:disabled) {
      background: var(--lokus-active-background);
    }
  `,
  
  danger: css`
    background: var(--lokus-error-background);
    color: var(--lokus-error-foreground);
    border: 1px solid var(--lokus-error-background);
    
    &:hover:not(:disabled) {
      background: var(--lokus-error-hover-background);
      border-color: var(--lokus-error-hover-background);
    }
    
    &:active:not(:disabled) {
      background: var(--lokus-error-active-background);
      border-color: var(--lokus-error-active-background);
    }
  `
};

const buttonSizes = {
  small: css`
    padding: 4px 8px;
    font-size: 12px;
    height: 24px;
  `,
  
  medium: css`
    padding: 6px 12px;
    font-size: 13px;
    height: 28px;
  `,
  
  large: css`
    padding: 8px 16px;
    font-size: 14px;
    height: 32px;
  `
};

const StyledButton = styled.button<ButtonProps>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  user-select: none;
  
  ${props => buttonVariants[props.variant || 'primary']}
  ${props => buttonSizes[props.size || 'medium']}
  
  ${props => props.fullWidth && css`
    width: 100%;
  `}
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  &:focus {
    outline: 2px solid var(--lokus-focus-border);
    outline-offset: 2px;
  }
`;

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  disabled = false,
  fullWidth = false,
  children,
  onClick,
  ...props
}) => {
  return (
    <StyledButton
      variant={variant}
      size={size}
      disabled={disabled}
      fullWidth={fullWidth}
      onClick={onClick}
      {...props}
    >
      {children}
    </StyledButton>
  );
};