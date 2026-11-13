import PropTypes from 'prop-types';
import { forwardRef } from 'react';

const VARIANT_CLASSES = Object.freeze({
  primary:
    'border-transparent bg-sab-600 text-white shadow-card hover:bg-sab-700 active:bg-sab-800',
  secondary:
    'border-sab-200 bg-sab-50 text-sab-800 hover:border-sab-300 hover:bg-sab-100 active:bg-sab-200',
  outline:
    'border-sab-600 bg-white text-sab-700 hover:bg-sab-50 active:bg-sab-100',
  ghost:
    'border-transparent bg-transparent text-sab-700 hover:bg-sab-50 active:bg-sab-100',
  destructive:
    'border-transparent bg-danger text-white shadow-card hover:bg-red-700 active:bg-red-800',
  danger:
    'border-transparent bg-danger text-white shadow-card hover:bg-red-700 active:bg-red-800',
});

const SIZE_CLASSES = Object.freeze({
  small: 'min-h-touch px-3 py-2 text-sm',
  medium: 'min-h-touch px-4 py-2.5 text-sm',
  large: 'min-h-touch px-5 py-3 text-base',
  icon: 'h-11 w-11 p-2.5',
});

/**
 * Creates the class list for a shared button.
 *
 * @param {{
 *   variant: string,
 *   size: string,
 *   destructive: boolean,
 *   fullWidth: boolean,
 *   iconOnly: boolean,
 *   className: string
 * }} options
 * @returns {string}
 */
function createButtonClassName({
  variant,
  size,
  destructive,
  fullWidth,
  iconOnly,
  className,
}) {
  const resolvedVariant = destructive
    ? 'destructive'
    : variant;
  const resolvedSize = iconOnly ? 'icon' : size;

  return [
    'inline-flex items-center justify-center gap-2 rounded-md border font-semibold leading-5',
    'transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-60',
    VARIANT_CLASSES[resolvedVariant],
    SIZE_CLASSES[resolvedSize],
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Shared accessible SAB-styled button primitive.
 *
 * @param {{
 *   children?: React.ReactNode,
 *   variant?: 'primary'|'secondary'|'outline'|'ghost'|'destructive'|'danger',
 *   size?: 'small'|'medium'|'large'|'icon',
 *   loading?: boolean,
 *   isLoading?: boolean,
 *   loadingText?: string,
 *   disabled?: boolean,
 *   destructive?: boolean,
 *   fullWidth?: boolean,
 *   iconOnly?: boolean,
 *   icon?: React.ReactNode,
 *   leadingIcon?: React.ReactNode,
 *   trailingIcon?: React.ReactNode,
 *   className?: string,
 *   type?: 'button'|'submit'|'reset',
 *   ariaLabel?: string
 * }} props
 * @param {React.ForwardedRef<HTMLButtonElement>} ref
 * @returns {React.ReactElement}
 */
export const Button = forwardRef(function Button(
  {
    children = null,
    variant = 'primary',
    size = 'medium',
    loading = false,
    isLoading = false,
    loadingText = '',
    disabled = false,
    destructive = false,
    fullWidth = false,
    iconOnly = false,
    icon = null,
    leadingIcon = null,
    trailingIcon = null,
    className = '',
    type = 'button',
    ariaLabel,
    ...buttonProps
  },
  ref,
) {
  const busy = loading || isLoading;
  const resolvedLeadingIcon = leadingIcon ?? icon;
  const resolvedAriaLabel =
    ariaLabel ??
    buttonProps['aria-label'] ??
    (iconOnly && typeof children === 'string'
      ? children
      : undefined);
  const buttonClassName = createButtonClassName({
    variant,
    size,
    destructive,
    fullWidth,
    iconOnly: iconOnly || size === 'icon',
    className,
  });

  return (
    <button
      {...buttonProps}
      ref={ref}
      type={type}
      className={buttonClassName}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      aria-label={resolvedAriaLabel}
    >
      {busy ? (
        <svg
          className="h-5 w-5 shrink-0 animate-spin motion-reduce:animate-none"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-90"
            fill="currentColor"
            d="M21 12a9 9 0 0 0-9-9v3a6 6 0 0 1 6 6h3Z"
          />
        </svg>
      ) : null}

      {!busy && resolvedLeadingIcon !== null ? (
        <span
          className="inline-flex shrink-0 items-center justify-center"
          aria-hidden="true"
        >
          {resolvedLeadingIcon}
        </span>
      ) : null}

      {iconOnly ? (
        <span
          className="inline-flex items-center justify-center"
          aria-hidden="true"
        >
          {children}
        </span>
      ) : (
        <span>
          {busy && loadingText.length > 0
            ? loadingText
            : children}
        </span>
      )}

      {!busy && !iconOnly && trailingIcon !== null ? (
        <span
          className="inline-flex shrink-0 items-center justify-center"
          aria-hidden="true"
        >
          {trailingIcon}
        </span>
      ) : null}
    </button>
  );
});

Button.displayName = 'Button';

Button.propTypes = {
  children: PropTypes.node,
  variant: PropTypes.oneOf([
    'primary',
    'secondary',
    'outline',
    'ghost',
    'destructive',
    'danger',
  ]),
  size: PropTypes.oneOf([
    'small',
    'medium',
    'large',
    'icon',
  ]),
  loading: PropTypes.bool,
  isLoading: PropTypes.bool,
  loadingText: PropTypes.string,
  disabled: PropTypes.bool,
  destructive: PropTypes.bool,
  fullWidth: PropTypes.bool,
  iconOnly: PropTypes.bool,
  icon: PropTypes.node,
  leadingIcon: PropTypes.node,
  trailingIcon: PropTypes.node,
  className: PropTypes.string,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  ariaLabel: PropTypes.string,
};

export default Button;