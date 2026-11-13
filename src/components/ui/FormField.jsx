import PropTypes from 'prop-types';
import {
  cloneElement,
  isValidElement,
  useId,
} from 'react';

const CONTROL_CLASSES =
  'block min-h-touch w-full rounded-md border border-border bg-white px-3 py-2 text-base text-ink shadow-sm transition-colors placeholder:text-ink-subtle focus:border-sab-600 focus:outline-none focus:ring-2 focus:ring-sab-600 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-muted sm:text-sm';

const CHOICE_CONTROL_CLASSES =
  'h-5 w-5 rounded border-border text-sab-600 focus:outline-none focus:ring-2 focus:ring-sab-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

const INVALID_CONTROL_CLASSES =
  'border-danger focus:border-danger focus:ring-danger';

/**
 * Determines whether display content should be rendered.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function hasContent(value) {
  return (
    value !== null &&
    value !== undefined &&
    value !== false &&
    !(typeof value === 'string' && value.trim().length === 0)
  );
}

/**
 * Combines space-separated identifier lists without duplicates.
 *
 * @param {...unknown} values
 * @returns {string|undefined}
 */
function combineIdentifiers(...values) {
  const identifiers = values
    .filter((value) => typeof value === 'string')
    .flatMap((value) => value.trim().split(/\s+/))
    .filter(Boolean);

  if (identifiers.length === 0) {
    return undefined;
  }

  return [...new Set(identifiers)].join(' ');
}

/**
 * Combines class names into one normalized class string.
 *
 * @param {...unknown} values
 * @returns {string}
 */
function combineClassNames(...values) {
  return values
    .filter(
      (value) =>
        typeof value === 'string' &&
        value.trim().length > 0,
    )
    .join(' ');
}

/**
 * Shared accessible form field for inputs, selects, and textareas.
 *
 * A control may be supplied as a child or through the `control` prop. When no
 * control is supplied, an input is rendered by default and `as` may be set to
 * `select` or `textarea`.
 *
 * @param {{
 *   id?: string,
 *   name?: string,
 *   label: React.ReactNode,
 *   hint?: React.ReactNode,
 *   helperText?: React.ReactNode,
 *   error?: React.ReactNode|boolean,
 *   errorMessage?: React.ReactNode,
 *   validationMessage?: React.ReactNode,
 *   required?: boolean,
 *   invalid?: boolean,
 *   children?: React.ReactNode,
 *   control?: React.ReactElement,
 *   as?: 'input'|'select'|'textarea',
 *   htmlFor?: string,
 *   hideLabel?: boolean,
 *   className?: string,
 *   fieldClassName?: string,
 *   labelClassName?: string,
 *   controlClassName?: string,
 *   inputClassName?: string,
 *   hintClassName?: string,
 *   errorClassName?: string,
 *   hintId?: string,
 *   errorId?: string
 * }} props
 * @returns {React.ReactElement}
 */
export function FormField({
  id,
  name,
  label,
  hint = null,
  helperText = null,
  error = null,
  errorMessage = null,
  validationMessage = null,
  required = false,
  invalid = false,
  children = null,
  control = null,
  as: ControlComponent,
  htmlFor,
  hideLabel = false,
  className = '',
  fieldClassName = '',
  labelClassName = '',
  controlClassName = '',
  inputClassName = '',
  hintClassName = '',
  errorClassName = '',
  hintId,
  errorId,
  ...controlProps
}) {
  const generatedId = useId().replace(/:/g, '');
  const childControl =
    control ??
    (ControlComponent === undefined && isValidElement(children)
      ? children
      : null);
  const childProps = childControl?.props ?? {};
  const resolvedControlId =
    childProps.id ??
    id ??
    htmlFor ??
    (typeof name === 'string' && name.trim().length > 0
      ? name.trim()
      : `form-field-${generatedId}`);
  const resolvedHint = hint ?? helperText;
  const resolvedError =
    errorMessage ??
    validationMessage ??
    (error !== true && error !== false ? error : null);
  const hasHint = hasContent(resolvedHint);
  const hasError =
    invalid === true ||
    error === true ||
    hasContent(resolvedError);
  const resolvedHintId =
    hintId ?? `${resolvedControlId}-hint`;
  const resolvedErrorId =
    errorId ?? `${resolvedControlId}-error`;
  const existingDescribedBy =
    childProps['aria-describedby'] ??
    controlProps['aria-describedby'];
  const describedBy = combineIdentifiers(
    existingDescribedBy,
    hasHint ? resolvedHintId : null,
    hasError && hasContent(resolvedError)
      ? resolvedErrorId
      : null,
  );
  const resolvedRequired =
    required === true || childProps.required === true;
  const resolvedType =
    childProps.type ?? controlProps.type;
  const resolvedElementType =
    childControl?.type ?? ControlComponent ?? 'input';
  const isChoiceControl =
    resolvedElementType === 'input' &&
    (resolvedType === 'checkbox' ||
      resolvedType === 'radio');
  const baseControlClassName = isChoiceControl
    ? CHOICE_CONTROL_CLASSES
    : CONTROL_CLASSES;
  const resolvedControlClassName = combineClassNames(
    baseControlClassName,
    hasError ? INVALID_CONTROL_CLASSES : '',
    controlClassName,
    inputClassName,
    childProps.className,
  );
  const accessibilityProps = {
    id: resolvedControlId,
    required: resolvedRequired || undefined,
    'aria-required': resolvedRequired || undefined,
    'aria-invalid': hasError || undefined,
    'aria-describedby': describedBy,
    'aria-errormessage':
      hasError && hasContent(resolvedError)
        ? resolvedErrorId
        : undefined,
  };

  let renderedControl;

  if (childControl !== null) {
    renderedControl = cloneElement(childControl, {
      ...controlProps,
      ...childProps,
      ...accessibilityProps,
      className: resolvedControlClassName,
    });
  } else {
    const Element = ControlComponent ?? 'input';

    renderedControl = (
      <Element
        {...controlProps}
        {...accessibilityProps}
        name={name}
        className={resolvedControlClassName}
      >
        {Element === 'input' ? undefined : children}
      </Element>
    );
  }

  return (
    <div
      className={combineClassNames(
        'space-y-1.5',
        className,
        fieldClassName,
      )}
      data-invalid={hasError || undefined}
    >
      <label
        htmlFor={resolvedControlId}
        className={combineClassNames(
          hideLabel
            ? 'sr-only'
            : 'block text-sm font-semibold text-ink',
          labelClassName,
        )}
      >
        {label}
        {resolvedRequired ? (
          <span
            className="ms-1 text-danger"
            aria-hidden="true"
          >
            *
          </span>
        ) : null}
      </label>

      {renderedControl}

      {hasHint ? (
        <p
          id={resolvedHintId}
          className={combineClassNames(
            'text-sm text-ink-muted',
            hintClassName,
          )}
        >
          {resolvedHint}
        </p>
      ) : null}

      {hasError && hasContent(resolvedError) ? (
        <p
          id={resolvedErrorId}
          className={combineClassNames(
            'text-sm font-medium text-danger',
            errorClassName,
          )}
          role="alert"
        >
          {resolvedError}
        </p>
      ) : null}
    </div>
  );
}

FormField.propTypes = {
  id: PropTypes.string,
  name: PropTypes.string,
  label: PropTypes.node.isRequired,
  hint: PropTypes.node,
  helperText: PropTypes.node,
  error: PropTypes.oneOfType([
    PropTypes.node,
    PropTypes.bool,
  ]),
  errorMessage: PropTypes.node,
  validationMessage: PropTypes.node,
  required: PropTypes.bool,
  invalid: PropTypes.bool,
  children: PropTypes.node,
  control: PropTypes.element,
  as: PropTypes.oneOf(['input', 'select', 'textarea']),
  htmlFor: PropTypes.string,
  hideLabel: PropTypes.bool,
  className: PropTypes.string,
  fieldClassName: PropTypes.string,
  labelClassName: PropTypes.string,
  controlClassName: PropTypes.string,
  inputClassName: PropTypes.string,
  hintClassName: PropTypes.string,
  errorClassName: PropTypes.string,
  hintId: PropTypes.string,
  errorId: PropTypes.string,
};

export default FormField;