import PropTypes from 'prop-types';
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';

const DOCUMENT_SCROLL_LOCKS = new WeakMap();

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
 * Assigns a value to a callback or object ref.
 *
 * @param {unknown} ref
 * @param {HTMLElement|null} value
 * @returns {void}
 */
function assignRef(ref, value) {
  if (typeof ref === 'function') {
    ref(value);
    return;
  }

  if (
    ref !== null &&
    typeof ref === 'object' &&
    Object.prototype.hasOwnProperty.call(ref, 'current')
  ) {
    ref.current = value;
  }
}

/**
 * Resolves a portal target from an element, ref, or provider.
 *
 * @param {unknown} target
 * @param {Document} ownerDocument
 * @returns {Element|DocumentFragment}
 */
function resolvePortalTarget(target, ownerDocument) {
  let candidate = target;

  if (typeof candidate === 'function') {
    candidate = candidate();
  }

  if (
    candidate !== null &&
    typeof candidate === 'object' &&
    Object.prototype.hasOwnProperty.call(candidate, 'current')
  ) {
    candidate = candidate.current;
  }

  if (
    candidate !== null &&
    typeof candidate === 'object' &&
    (candidate.nodeType === 1 ||
      candidate.nodeType === 11)
  ) {
    return candidate;
  }

  return ownerDocument.body;
}

/**
 * Prevents the document behind an open modal from scrolling.
 *
 * @param {Document} ownerDocument
 * @returns {() => void}
 */
function lockDocumentScroll(ownerDocument) {
  const existingLock = DOCUMENT_SCROLL_LOCKS.get(ownerDocument);

  if (existingLock !== undefined) {
    existingLock.count += 1;
  } else {
    const hadOverflowClass =
      ownerDocument.body.classList.contains('overflow-hidden');

    ownerDocument.body.classList.add('overflow-hidden');
    DOCUMENT_SCROLL_LOCKS.set(ownerDocument, {
      count: 1,
      hadOverflowClass,
    });
  }

  let locked = true;

  return () => {
    if (!locked) {
      return;
    }

    locked = false;
    const currentLock =
      DOCUMENT_SCROLL_LOCKS.get(ownerDocument);

    if (currentLock === undefined) {
      return;
    }

    currentLock.count -= 1;

    if (currentLock.count > 0) {
      return;
    }

    if (!currentLock.hadOverflowClass) {
      ownerDocument.body.classList.remove('overflow-hidden');
    }

    DOCUMENT_SCROLL_LOCKS.delete(ownerDocument);
  };
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
 * Portal-based accessible modal dialog with focus and scroll containment.
 *
 * @param {{
 *   children: React.ReactNode,
 *   isOpen?: boolean,
 *   open?: boolean,
 *   onClose?: (event: Event) => void,
 *   onDismiss?: (event: Event) => void,
 *   title?: React.ReactNode,
 *   ariaLabel?: string,
 *   description?: React.ReactNode,
 *   footer?: React.ReactNode,
 *   closeLabel?: string,
 *   showCloseButton?: boolean,
 *   closeOnBackdrop?: boolean,
 *   closeOnEscape?: boolean,
 *   initialFocusRef?: {current: HTMLElement|null},
 *   returnFocusRef?: {current: HTMLElement|null},
 *   triggerRef?: {current: HTMLElement|null},
 *   portalTarget?: Element|DocumentFragment|{current: Element|null}|(() => Element|null),
 *   id?: string,
 *   ariaLabelledby?: string,
 *   ariaDescribedby?: string,
 *   className?: string,
 *   backdropClassName?: string,
 *   headerClassName?: string,
 *   contentClassName?: string,
 *   footerClassName?: string
 * }} props
 * @param {React.ForwardedRef<HTMLDivElement>} ref
 * @returns {React.ReactPortal|null}
 */
export const Modal = forwardRef(function Modal(
  {
    children,
    isOpen,
    open = false,
    onClose,
    onDismiss,
    title = null,
    ariaLabel = '',
    description = null,
    footer = null,
    closeLabel = 'Close',
    showCloseButton = true,
    closeOnBackdrop = true,
    closeOnEscape = true,
    initialFocusRef,
    returnFocusRef,
    triggerRef,
    portalTarget = null,
    id,
    ariaLabelledby,
    ariaDescribedby,
    className = '',
    backdropClassName = '',
    headerClassName = '',
    contentClassName = '',
    footerClassName = '',
    ...dialogProps
  },
  ref,
) {
  const generatedId = useId().replace(/:/g, '');
  const dialogContainerRef = useRef(null);
  const modalOpen = isOpen ?? open;
  const closeHandler = onClose ?? onDismiss;
  const titleVisible = hasContent(title);
  const descriptionVisible = hasContent(description);
  const dialogId = id ?? `modal-${generatedId}`;
  const titleId = `${dialogId}-title`;
  const descriptionId = `${dialogId}-description`;
  const resolvedTitle = titleVisible
    ? title
    : ariaLabel.trim().length > 0
      ? ariaLabel
      : 'Dialog';

  const setDialogRef = useCallback(
    (element) => {
      dialogContainerRef.current = element;
      assignRef(ref, element);
    },
    [ref],
  );

  const requestClose = useCallback(
    (event) => {
      if (typeof closeHandler === 'function') {
        closeHandler(event);
      }
    },
    [closeHandler],
  );

  useFocusTrap({
    active: modalOpen,
    containerRef: dialogContainerRef,
    initialFocusRef,
    returnFocusRef,
    triggerRef,
    restoreFocus: true,
    onEscape: closeOnEscape ? requestClose : undefined,
  });

  useEffect(() => {
    if (!modalOpen || typeof document === 'undefined') {
      return undefined;
    }

    return lockDocumentScroll(document);
  }, [modalOpen]);

  const handleBackdropClick = (event) => {
    if (
      closeOnBackdrop &&
      event.target === event.currentTarget
    ) {
      requestClose(event);
    }
  };

  if (!modalOpen || typeof document === 'undefined') {
    return null;
  }

  const resolvedPortalTarget = resolvePortalTarget(
    portalTarget,
    document,
  );

  return createPortal(
    <div
      className={combineClassNames(
        'fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-sab-950/60 p-4',
        'sm:p-6',
        backdropClassName,
      )}
      onClick={handleBackdropClick}
      data-modal-backdrop=""
    >
      <div
        {...dialogProps}
        ref={setDialogRef}
        id={dialogId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledby ?? titleId}
        aria-describedby={
          ariaDescribedby ??
          (descriptionVisible ? descriptionId : undefined)
        }
        className={combineClassNames(
          'my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-white text-ink shadow-elevated',
          'sm:max-h-[calc(100dvh-3rem)]',
          className,
        )}
      >
        <div
          className={combineClassNames(
            'flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6',
            headerClassName,
          )}
        >
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className={
                titleVisible
                  ? 'text-lg font-semibold leading-7 text-ink'
                  : 'sr-only'
              }
            >
              {resolvedTitle}
            </h2>

            {descriptionVisible ? (
              <div
                id={descriptionId}
                className="mt-1 text-sm leading-6 text-ink-muted"
              >
                {description}
              </div>
            ) : null}
          </div>

          {showCloseButton ? (
            <button
              type="button"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sab-600 focus-visible:ring-offset-2"
              aria-label={closeLabel}
              onClick={requestClose}
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="m6 6 12 12M18 6 6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ) : null}
        </div>

        <div
          className={combineClassNames(
            'min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6',
            contentClassName,
          )}
        >
          {children}
        </div>

        {hasContent(footer) ? (
          <div
            className={combineClassNames(
              'flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-border bg-surface-subtle px-4 py-4 sm:px-6',
              footerClassName,
            )}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    resolvedPortalTarget,
  );
});

Modal.displayName = 'Modal';

Modal.propTypes = {
  children: PropTypes.node.isRequired,
  isOpen: PropTypes.bool,
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onDismiss: PropTypes.func,
  title: PropTypes.node,
  ariaLabel: PropTypes.string,
  description: PropTypes.node,
  footer: PropTypes.node,
  closeLabel: PropTypes.string,
  showCloseButton: PropTypes.bool,
  closeOnBackdrop: PropTypes.bool,
  closeOnEscape: PropTypes.bool,
  initialFocusRef: PropTypes.shape({
    current: PropTypes.object,
  }),
  returnFocusRef: PropTypes.shape({
    current: PropTypes.object,
  }),
  triggerRef: PropTypes.shape({
    current: PropTypes.object,
  }),
  portalTarget: PropTypes.oneOfType([
    PropTypes.object,
    PropTypes.func,
  ]),
  id: PropTypes.string,
  ariaLabelledby: PropTypes.string,
  ariaDescribedby: PropTypes.string,
  className: PropTypes.string,
  backdropClassName: PropTypes.string,
  headerClassName: PropTypes.string,
  contentClassName: PropTypes.string,
  footerClassName: PropTypes.string,
};

export default Modal;